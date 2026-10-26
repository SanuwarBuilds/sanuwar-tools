"""Photo editing is local and stays separate from private/download workflows."""
import copy
import unittest
from unittest.mock import patch
import app as module

class PhotoToolsTests(unittest.TestCase):
    def setUp(self):
        self.config={'site':{},'tools':[{'id':'builtin-photo-tools','name':'Photo Tools','siteUrl':'https://sanuwartools.online/photo-tools','visible':True,'enabled':True}], 'downloadPage':{'enabled':True}}
        self.reader=patch.object(module,'safe_read',side_effect=lambda path:copy.deepcopy(self.config) if path==module.TOOLS_CONFIG_REL else [])
        self.reader.start();self.addCleanup(self.reader.stop);self.client=module.app.test_client()

    def test_editor_is_public_indexable_and_does_not_load_ad_or_remote_processing_scripts(self):
        response=self.client.get('/photo-tools',base_url='https://sanuwartools.online')
        self.assertEqual(response.status_code,200)
        html=response.get_data(as_text=True)
        for marker in ('/assets/css/photo-tools.css','/assets/js/photo-core.js','/assets/js/photo-tools.js','id="photo-file"','id="photo-canvas"','rel="canonical" href="https://sanuwartools.online/photo-tools"'):
            self.assertIn(marker,html)
        self.assertNotIn('adsbygoogle.js',html)
        self.assertIn("connect-src 'self'",response.headers['Content-Security-Policy'])
        self.assertIn("img-src 'self' data: blob:",response.headers['Content-Security-Policy'])
        self.assertEqual(response.headers['Cache-Control'],'no-store')
        self.assertNotIn('blob:',self.client.get('/admin/login').headers['Content-Security-Policy'])

    def test_disabled_photo_tool_is_hidden_from_home_config_sitemap_and_direct_route(self):
        self.assertIn(b'Photo Tools',self.client.get('/').data)
        self.assertIn(b'/photo-tools',self.client.get('/sitemap.xml').data)
        for flag in ('enabled','visible'):
            self.config['tools'][0][flag]=False
            self.assertEqual(self.client.get('/photo-tools').status_code,404)
            self.assertNotIn(b'Photo Tools',self.client.get('/').data)
            self.assertEqual(self.client.get('/tools.config.json').json['tools'],[])
            self.assertNotIn(b'/photo-tools',self.client.get('/sitemap.xml').data)
            self.config['tools'][0][flag]=True
