"""Password gate, expiry and Bangla support for the private lyrics bypass tool."""
import json
import re
import time
import unittest
from pathlib import Path
from unittest.mock import patch

import app as module

ROOT = Path(__file__).resolve().parents[1]


class BypassGateTests(unittest.TestCase):
    def setUp(self):
        self.client = module.app.test_client()

    def csrf_token(self):
        text = self.client.get('/bypass').get_data(as_text=True)
        match = re.search(r'name="csrf_token" value="([^"]+)"', text)
        self.assertIsNotNone(match)
        return match.group(1)

    def test_gate_is_server_rendered_hidden_and_noindexed(self):
        response = self.client.get('/bypass')
        text = response.get_data(as_text=True)
        self.assertEqual(response.status_code, 200)
        self.assertIn('action="/bypass"', text)
        self.assertIn('name="csrf_token"', text)
        self.assertIn('name="password"', text)
        self.assertIn('noindex, nofollow', text)
        self.assertEqual(response.headers.get('X-Robots-Tag'), 'noindex, nofollow')
        self.assertNotIn('CORRECT_PIN', text)
        self.assertNotIn('maxlength="4"', text)
        self.assertIn('/assets/css/bypass.css', text)
        self.assertIn('/assets/js/bypass.js', text)

    @patch.object(module.security, 'limited', return_value=False)
    def test_wrong_password_stays_locked(self, _limited):
        token = self.csrf_token()
        response = self.client.post('/bypass', data={'password': '7277', 'csrf_token': token})
        self.assertEqual(response.status_code, 401)
        self.assertIn('data-error="invalid"', response.get_data(as_text=True))
        page = self.client.get('/bypass').get_data(as_text=True)
        self.assertIn('id="bypass-password"', page)
        self.assertNotIn('id="bypass-input"', page)

    @patch.object(module.security, 'limited', return_value=False)
    def test_owner_password_unlocks_the_tool_for_the_session(self, _limited):
        token = self.csrf_token()
        response = self.client.post('/bypass', data={'password': '60000', 'csrf_token': token})
        self.assertEqual(response.status_code, 302)
        self.assertTrue(response.headers['Location'].endswith('/bypass'))
        page = self.client.get('/bypass').get_data(as_text=True)
        self.assertIn('id="bypass-input"', page)
        self.assertIn('id="bypass-output"', page)
        self.assertIn('ACCESS GRANTED', page)
        self.assertNotIn('id="bypass-password"', page)

    def test_gate_rejects_post_without_a_session_token(self):
        response = self.client.post('/bypass', data={'password': '60000'})
        self.assertEqual(response.status_code, 403)

    @patch.object(module.security, 'limited', return_value=True)
    def test_attempt_limiter_returns_429(self, _limited):
        token = self.csrf_token()
        response = self.client.post('/bypass', data={'password': '60000', 'csrf_token': token})
        self.assertEqual(response.status_code, 429)
        self.assertIn('data-error="limited"', response.get_data(as_text=True))

    def test_unlock_expires_after_six_hours(self):
        with self.client.session_transaction() as session:
            session['bypass_unlocked_at'] = int(time.time()) - module.BYPASS_UNLOCK_SECONDS - 1
        page = self.client.get('/bypass').get_data(as_text=True)
        self.assertIn('id="bypass-password"', page)
        self.assertNotIn('id="bypass-input"', page)

    def test_expired_module_hides_the_password_form(self):
        with patch.object(module, 'BYPASS_EXPIRY', module.datetime.datetime(2020, 1, 1)):
            page = self.client.get('/bypass').get_data(as_text=True)
        self.assertIn('data-i18n="expiredBody"', page)
        self.assertNotIn('name="password"', page)

    def test_default_password_and_environment_override(self):
        with patch.dict(module.os.environ, {'BYPASS_PASSWORD': ''}):
            self.assertTrue(module.bypass_password_ok('60000'))
            self.assertFalse(module.bypass_password_ok('7277'))
            self.assertFalse(module.bypass_password_ok(''))
        with patch.dict(module.os.environ, {'BYPASS_PASSWORD': 'naya-code'}):
            self.assertTrue(module.bypass_password_ok('naya-code'))
            self.assertFalse(module.bypass_password_ok('60000'))

    def test_bangla_font_assets_and_robots_are_self_hosted(self):
        css = self.client.get('/assets/css/bypass.css').get_data(as_text=True)
        self.assertIn('NotoSansBengali-Variable.woff2', css)
        self.assertIn('unicode-range', css)
        font = self.client.get('/assets/fonts/NotoSansBengali-Variable.woff2')
        self.assertEqual(font.status_code, 200)
        self.assertEqual(font.data[:4], b'wOF2')
        js = self.client.get('/assets/js/bypass.js').get_data(as_text=True)
        self.assertIn('Intl.Segmenter', js)
        self.assertIn('বাইপাস', js)
        robots = self.client.get('/robots.txt').get_data(as_text=True)
        self.assertIn('Disallow: /bypass', robots)

    def test_homepage_card_links_to_the_gated_module(self):
        config = json.loads((ROOT / 'data' / 'tools.config.json').read_text(encoding='utf-8'))
        entry = next((tool for tool in config['tools'] if tool.get('id') == 'builtin-lyrics-bypass'), None)
        self.assertIsNotNone(entry)
        self.assertEqual(entry['route'], '/bypass')
        self.assertTrue(entry['visible'] and entry['enabled'])
        page = self.client.get('/').get_data(as_text=True)
        self.assertIn('Lyrics Bypass', page)
        self.assertIn('href="/bypass"', page)


if __name__ == '__main__':
    unittest.main()
