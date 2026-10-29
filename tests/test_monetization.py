"""Ads must not escape the canonical public pages or weaken private workflows."""
import copy
import os
import re
import unittest
from unittest.mock import patch
import app as module


class AdSenseIsolationTests(unittest.TestCase):
    def setUp(self):
        self.records = {module.TOOLS_CONFIG_REL: {'site': {}, 'tools': [], 'categories': [],
                       'downloadPage': {'enabled': True}}, module.DOWNLOADS_REL: []}
        self.read = patch.object(module, 'safe_read', side_effect=lambda p: copy.deepcopy(self.records.get(p)))
        self.read.start()
        self.env = patch.dict(os.environ, {'ADSENSE_ENABLED': '1', 'ADSENSE_CLIENT': 'ca-pub-8814284684394847'})
        self.env.start()
        self.client = module.app.test_client()

    def tearDown(self):
        self.read.stop()
        self.env.stop()

    def get(self, path, origin='https://sanuwartools.online'):
        return self.client.get(path, base_url=origin)

    def test_public_ads_use_unique_nonce_and_retain_injection_protections(self):
        nonces = []
        for path in ('/', '/downloads', '/download.html', '/'):
            response = self.get(path)
            self.assertEqual(response.status_code, 200)
            text = response.get_data(as_text=True)
            self.assertIn('adsbygoogle.js?client=ca-pub-8814284684394847', text)
            policy = response.headers['Content-Security-Policy']
            nonce = re.search(r"'nonce-([^']+)'", policy).group(1)
            nonces.append(nonce)
            scripts = re.findall(r'<script\b([^>]*)>', text)
            self.assertTrue(scripts)
            self.assertTrue(all('nonce="' + nonce + '"' in attrs for attrs in scripts))
            for protection in ("'strict-dynamic'", "object-src 'none'", "base-uri 'none'", "frame-ancestors 'none'", "form-action 'self'"):
                self.assertIn(protection, policy)
            self.assertNotIn("'unsafe-inline'", policy.split('script-src ')[1].split(';')[0])
            self.assertEqual(response.headers['Cache-Control'], 'no-store')
        self.assertEqual(len(set(nonces)), len(nonces))

    def test_private_errors_support_and_other_hosts_never_get_ad_tags_or_ad_csp(self):
        for path in ('/admin/login', '/admin', '/api/downloads_data', '/purchase/missing', '/payment-demo', '/privacy', '/about', '/contact', '/not-a-page'):
            response = self.get(path)
            self.assertNotIn(b'adsbygoogle.js', response.data, path)
            self.assertNotIn('strict-dynamic', response.headers['Content-Security-Policy'], path)
        for host in ('http://sanuwartools.online', 'https://sanuwartools.vercel.app', 'https://sanuwartools.online.attacker.example', 'http://localhost'):
            response = self.get('/', host)
            self.assertNotIn(b'adsbygoogle.js', response.data)
            self.assertIn("script-src 'self'", response.headers['Content-Security-Policy'])
        self.records[module.TOOLS_CONFIG_REL]['downloadPage']['enabled'] = False
        response = self.get('/downloads')
        self.assertEqual(response.status_code, 404)
        self.assertNotIn(b'adsbygoogle.js', response.data)
        self.assertNotIn('strict-dynamic', response.headers['Content-Security-Policy'])

    def test_configuration_fails_closed_and_emergency_pause_works(self):
        for invalid in ('', 'ca-pub-123', 'ca-pub-8814284684394847" onload="alert(1)'):
            with patch.dict(os.environ, {'ADSENSE_CLIENT': invalid}):
                self.assertNotIn(b'adsbygoogle.js', self.get('/').data)
                self.assertEqual(self.get('/ads.txt').status_code, 404)
        with patch.dict(os.environ, {'ADSENSE_ENABLED': '0'}):
            self.assertNotIn(b'adsbygoogle.js', self.get('/').data)
            self.assertIn("script-src 'self'", self.get('/').headers['Content-Security-Policy'])

    def test_manual_units_render_only_for_valid_numeric_slots(self):
        with patch.dict(os.environ, {'ADSENSE_SLOT_HOME': '1234567890', 'ADSENSE_SLOT_DOWNLOADS': '9876543210'}):
            for path, slot in (('/', '1234567890'), ('/downloads', '9876543210'), ('/download.html', '9876543210')):
                response = self.get(path)
                text = response.get_data(as_text=True)
                nonce = re.search(r"'nonce-([^']+)'", response.headers['Content-Security-Policy']).group(1)
                self.assertIn('class="adsbygoogle"', text, path)
                self.assertIn('data-ad-client="ca-pub-8814284684394847"', text, path)
                self.assertIn('data-ad-slot="' + slot + '"', text, path)
                self.assertIn('nonce="' + nonce + '"', text, path)
                self.assertEqual(text.count('adsbygoogle = window.adsbygoogle'), 1, path)
        with patch.dict(os.environ, {'ADSENSE_SLOT_HOME': '"><script>alert(1)</script>'}):
            text = self.get('/').get_data(as_text=True)
            self.assertNotIn('class="adsbygoogle"', text)
            self.assertNotIn('<script>alert(1)</script>', text)
        self.assertNotIn('class="adsbygoogle"', self.get('/').get_data(as_text=True))

    def test_seller_record_matches_publisher_and_privacy_stays_ad_free(self):
        response = self.get('/ads.txt')
        self.assertEqual(response.mimetype, 'text/plain')
        self.assertEqual(response.data, b'google.com, pub-8814284684394847, DIRECT, f08c47fec0942fa0\n')
        response = self.get('/privacy')
        self.assertEqual(response.status_code, 200)
        for required in (b'local storage', b'Google AdSense', b'/contact', b'myadcenter.google.com'):
            self.assertIn(required, response.data)
        for tag in (b'adsbygoogle', b'fundingchoicesmessages.google.com'):
            self.assertNotIn(tag, response.data)
