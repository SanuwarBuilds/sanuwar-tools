"""Exercise catalogue discovery and the fixed-host weather proxy with mock HTTP."""
import json
import os
import unittest
from pathlib import Path
from unittest.mock import Mock, patch

import requests

import app as module

ROOT = Path(__file__).resolve().parents[1]
TOOLS = {
    'dictionary-science-reference': {'https://api.dictionaryapi.dev', 'https://toolalize.com'},
    'books-scripture-explorer': {
        'https://vedicscriptures.github.io', 'https://bayan.alwa7i.com',
        'https://bible-api.com', 'https://openbookrank.com',
    },
    'weather-air-quality': {
        'https://geocoding-api.open-meteo.com', 'https://api.open-meteo.com',
        'https://air-quality-api.open-meteo.com',
    },
    'url-shortener': {'https://is.gd'},
    'live-forex-crypto-converter': {'https://api.coinbase.com', 'https://toolalize.com'},
    'caption-transcript-extractor': set(),
}


class StudyUtilitiesTests(unittest.TestCase):
    def setUp(self):
        self.client = module.app.test_client()
        self.records = {
            path: json.loads((ROOT / path).read_text())
            for path in (module.TOOLS_CONFIG_REL, module.TOOL_CATALOG_REL, module.EDUHELP_REL)
        }
        patches = (
            patch.object(module, 'safe_read', side_effect=self.records.get),
            patch.dict(os.environ, {'OPEN_METEO_API_KEY': '', 'OPEN_METEO_NONCOMMERCIAL': '0'}),
            patch.object(module.security, 'limited', return_value=False),
        )
        for active in patches:
            active.start()
            self.addCleanup(active.stop)

    def test_tools_are_discoverable_and_connect_only_to_their_providers(self):
        feed = self.client.get('/api/browser-tools.json').get_json()['tools']
        routes = {item['route'] for item in feed}
        for slug, domains in TOOLS.items():
            path = '/tools/' + slug
            with self.subTest(slug=slug):
                self.assertIn(path, routes)
                page = self.client.get(path)
                self.assertEqual(page.status_code, 200)
                self.assertIn(b'/assets/js/tools/study-utilities.js', page.data)
                csp = page.headers['Content-Security-Policy']
                connect = next(item for item in csp.split('; ') if item.startswith('connect-src '))
                self.assertEqual(set(connect.split()[1:]), {"'self'", *domains})
                self.assertIn("script-src 'self';", csp)
                self.assertIn("object-src 'none';", csp)
        eduhelp = self.client.get('/eduhelp')
        self.assertIn(b'data-study-weather-widget data-weather-mode="public"', eduhelp.data)
        for slug in ('dictionary-science-reference', 'books-scripture-explorer', 'weather-air-quality'):
            self.assertIn(('/tools/' + slug).encode(), eduhelp.data)
        self.assertIn(b'/eduhelp/labs', eduhelp.data)
        self.assertIn(b'/tools/study-timer-revision-planner', eduhelp.data)
        self.assertIn(b'/tools/url-shortener', self.client.get('/tools/qr-code-generator').data)
        self.assertIn(b'/tools/live-forex-crypto-converter', self.client.get('/tools/currency-converter').data)

    def test_video_library_browses_classes_before_lessons_and_searches_across_grades(self):
        catalog = self.client.get('/eduhelp/videos')
        self.assertEqual(catalog.status_code, 200)
        self.assertIn('Class 12 · Commerce'.encode(), catalog.data)
        self.assertNotIn(b'https://i.ytimg.com/vi/', catalog.data)
        subjects = self.client.get('/eduhelp/videos?grade=12&stream=Commerce')
        self.assertIn(b'subject=Accountancy', subjects.data)
        self.assertNotIn(b'https://i.ytimg.com/vi/', subjects.data)
        results = self.client.get('/eduhelp/videos?board=ncert&q=class+12+physics')
        self.assertIn(b'Search results</h2>', results.data)
        self.assertIn('Class 12 · Physics'.encode(), results.data)
        self.assertNotIn('Class 11 · Physics'.encode(), results.data)

    def test_video_library_filters_by_grade_subject_and_provider(self):
        page = self.client.get('/eduhelp/videos?grade=12&stream=Commerce&subject=Accountancy&view=lessons')
        self.assertEqual(page.status_code, 200)
        self.assertIn(b'Accountancy</h2>', page.data)
        self.assertIn(b'https://i.ytimg.com/vi/', page.data)
        self.assertIn(b'https://www.youtube.com/watch?v=', page.data)
        self.assertIn('frame-src https://www.youtube-nocookie.com', page.headers['Content-Security-Policy'])
        self.assertNotIn('youtube-nocookie.com', self.client.get('/eduhelp/study').headers['Content-Security-Policy'])
        self.assertNotIn(b'<iframe', page.data)

    def test_video_chapter_uses_textbook_order_and_links_lessons_to_practice(self):
        subject = '/eduhelp/videos?grade=10&subject=General+Science'
        catalogue = self.client.get(subject)
        self.assertEqual(catalogue.status_code, 200)
        self.assertIn(b'aria-label="Chapters"', catalogue.data)
        self.assertLess(catalogue.data.index(b'chapter=Carbon+and+its+Compounds'),
                        catalogue.data.index(b'chapter=Electricity'))
        chapter = self.client.get(subject + '&chapter=Electricity&lesson=kyBnzI5hNZc')
        self.assertEqual(chapter.status_code, 200)
        self.assertIn(b'Electricity</h2>', chapter.data)
        self.assertIn(b'Electricity Part-I</h3>', chapter.data)
        self.assertIn(b'/eduhelp/study/electricity#notes', chapter.data)
        self.assertIn(b'/eduhelp/study/electricity#quiz', chapter.data)
        self.assertIn(b'data-video-language', chapter.data)
        self.assertNotIn(b'<iframe', chapter.data)
        old_url = self.client.get(subject + '&chapter=Chapter+4')
        self.assertIn(b'Carbon and its Compounds</h2>', old_url.data)

    def test_calendar_export_uses_exclusive_end_and_rejects_unknown_events(self):
        response = self.client.get('/eduhelp/calendar/hslc-2027-theory.ics')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.mimetype, 'text/calendar')
        self.assertIn('attachment;', response.headers['Content-Disposition'])
        self.assertIn(b'DTSTART;VALUE=DATE:20270225\r\nDTEND;VALUE=DATE:20270317\r\n', response.data)
        self.assertEqual(self.client.get('/eduhelp/calendar/missing.ics').status_code, 404)

    def test_study_hub_filters_chapters_and_shows_guided_resources(self):
        page = self.client.get('/eduhelp/study?board=NCERT&level=Class+10&subject=Chemistry')
        self.assertEqual(page.status_code, 200)
        self.assertIn(b'/eduhelp/study/carbon-compounds#quiz', page.data)
        self.assertNotIn(b'/eduhelp/study/electricity#quiz', page.data)
        chapter = self.client.get('/eduhelp/study/carbon-compounds')
        self.assertIn(b'/eduhelp/labs/carbon-compounds', chapter.data)
        self.assertIn(b'data-edu-worksheet', chapter.data)
        self.assertEqual(self.client.get('/eduhelp/study/missing').status_code, 404)

    def test_weather_picks_public_or_proxy_mode_without_exposing_key(self):
        page = '/tools/weather-air-quality'
        self.assertIn(b'data-weather-mode="unconfigured"', self.client.get(
            page, base_url='https://commercial.example').data)
        with patch.dict(os.environ, {'OPEN_METEO_NONCOMMERCIAL': '1'}):
            self.assertIn(b'data-weather-mode="public"', self.client.get(
                page, base_url='https://edu.example').data)
        with patch.dict(os.environ, {'OPEN_METEO_API_KEY': 'test-secret-value'}):
            response = self.client.get(page)
            self.assertIn(b'data-weather-mode="proxy"', response.data)
            self.assertNotIn(b'test-secret-value', response.data)

    def test_paid_weather_uses_fixed_upstreams_and_filtered_data(self):
        api = '/api/public-weather/'
        with patch.dict(os.environ, {'OPEN_METEO_API_KEY': 'test-secret-value'}), patch.object(module.requests, 'get') as get:
            get.return_value = Mock(status_code=200)
            get.return_value.json.return_value = {
                'results': [{'name': 'Guwahati', 'admin1': 'Assam', 'country': 'India',
                             'latitude': 26.14, 'longitude': 91.74, 'unrelated': 'test-secret-value'}]
            }
            response = self.client.get(api + 'places?name=Guwahati&apikey=override&url=https://example.com')
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.get_json()['results'][0]['name'], 'Guwahati')
            self.assertNotIn(b'test-secret-value', response.data)
            destination = get.call_args.args[0]
            self.assertEqual(destination, 'https://customer-geocoding-api.open-meteo.com/v1/search')
            self.assertFalse(get.call_args.kwargs['allow_redirects'])
            self.assertEqual(get.call_args.kwargs['params'], {
                'name': 'Guwahati', 'count': 6, 'language': 'en', 'apikey': 'test-secret-value',
            })

            for kind, fields in (('weather', ['temperature_2m', 'relative_humidity_2m', 'wind_speed_10m', 'weather_code']),
                                 ('air', ['us_aqi', 'pm2_5', 'pm10'])):
                with self.subTest(kind=kind):
                    get.return_value.json.return_value = {
                        'timezone': 'Asia/Kolkata', 'current': {
                            'time': '2026-11-26T20:00', **dict.fromkeys(fields, 20), 'unrelated': 'test-secret-value',
                        },
                    }
                    response = self.client.get(api + kind + '?latitude=26.14&longitude=91.74&current=oversized')
                    self.assertEqual(response.status_code, 200)
                    self.assertEqual(set(response.get_json()['current']), {'time', *fields})
                    self.assertNotIn(b'test-secret-value', response.data)
                    self.assertEqual(get.call_args.kwargs['params']['current'], ','.join(fields))

    def test_weather_rejects_invalid_requests_and_handles_upstream_errors(self):
        api = '/api/public-weather/'
        with patch.object(module.requests, 'get') as get:
            self.assertEqual(self.client.get(api + 'weather').status_code, 503)
            with patch.dict(os.environ, {'OPEN_METEO_API_KEY': 'test-secret-value'}):
                self.assertEqual(self.client.get(api + 'anything').status_code, 404)
                self.assertEqual(self.client.get(api + 'places?name=A').status_code, 400)
                for invalid in ('NaN', 'inf', '100', ''):
                    self.assertEqual(self.client.get(api + 'air?latitude=' + invalid + '&longitude=0').status_code, 400)
                get.assert_not_called()

                get.return_value = Mock(status_code=429)
                self.assertEqual(self.client.get(api + 'places?name=Guwahati').status_code, 429)
                get.return_value = Mock(status_code=302)
                self.assertEqual(self.client.get(api + 'places?name=Guwahati').status_code, 502)
                get.side_effect = requests.Timeout('test-secret-value')
                response = self.client.get(api + 'places?name=Guwahati')
                self.assertEqual(response.status_code, 502)
                self.assertNotIn(b'test-secret-value', response.data)
