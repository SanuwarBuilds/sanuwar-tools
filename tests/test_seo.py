"""Public search metadata must never expose unpublished or private catalogue data."""
import copy
import json
import re
import unittest
from unittest.mock import patch
from xml.etree.ElementTree import fromstring
import app as module

class SearchDiscoveryTests(unittest.TestCase):
    def setUp(self):
        self.records={module.TOOLS_CONFIG_REL:{'site':{},'tools':[
            {'id':'active','name':'Useful photo tool','siteUrl':'https://example.com/photo','visible':True},
            {'id':'secret','name':'Unpublished secret tool','siteUrl':'https://example.com/secret','visible':False}],
            'categories':['All'],'downloadPage':{'enabled':True}},module.DOWNLOADS_REL:[
            {'id':'free','title':'Public album','is_album':True,'album_files':[{'name':'Public guide.pdf','link':'https://example.com/guide.pdf'}]},
            {'id':'hidden','title':'Secret download title','enabled':False,'link':'https://example.com/hidden.zip'},
            {'id':'paid','title':'Paid album','is_album':True,'pricing':{'mode':'paid','price':'99','discount':'0'},
             'album_files':[{'name':'Premium file.zip','asset':{'public_id':'private/secret','type':'authenticated','resource_type':'raw','format':'zip'},'link':'https://example.com/secret-original.zip'}]}]}
        patch.object(module,'safe_read',side_effect=lambda p:copy.deepcopy(self.records.get(p))).start()
        self.client=module.app.test_client()

    def tearDown(self):patch.stopall()

    def test_public_metadata_has_canonical_brand_and_page_specific_description(self):
        for path, canonical in [('/', '/'),('/downloads','/downloads'),('/download.html','/downloads')]:
            response=self.client.get(path,base_url='https://untrusted.example')
            text=response.get_data(as_text=True)
            self.assertEqual(response.status_code,200)
            self.assertIn('rel="canonical" href="https://sanuwartools.online'+canonical+'"',text)
            self.assertIn('property="og:site_name" content="SanuwarTools"',text)
            self.assertNotIn('noindex',response.headers.get('X-Robots-Tag',''))
            self.assertNotIn('https://untrusted.example',text)
        self.assertNotEqual(self.client.get('/').data,self.client.get('/downloads').data)

    def test_structured_data_is_valid_and_site_logo_is_public(self):
        text=self.client.get('/').get_data(as_text=True)
        data=json.loads(re.search(r'<script[^>]*type="application/ld\+json">(.*?)</script>',text,re.S).group(1))
        website, organization=data['@graph']
        self.assertEqual(website['name'],'SanuwarTools')
        self.assertEqual(website['alternateName'],'Sanuwar Tools')
        self.assertEqual(organization['logo']['url'],'https://sanuwartools.online/assets/favicon.png')
        self.assertEqual(self.client.get('/assets/favicon.png').status_code,200)

    def test_initial_html_contains_searchable_public_content_without_js(self):
        home=self.client.get('/').get_data(as_text=True)
        self.assertIn('Useful photo tool',home)
        self.assertNotIn('Unpublished secret tool',home)
        page=self.client.get('/downloads').get_data(as_text=True)
        for text in ('Public album','Public guide.pdf','https://example.com/guide.pdf','Paid album','Premium file.zip'):self.assertIn(text,page)
        for secret in ('Secret download title','https://example.com/hidden.zip','private/secret','secret-original.zip'):self.assertNotIn(secret,page)

    def test_home_tools_never_load_or_render_download_records(self):
        with patch.object(module, 'public_downloads', side_effect=AssertionError('Tools page must not load downloads')):
            response=self.client.get('/')
        self.assertEqual(response.status_code,200)
        text=response.get_data(as_text=True)
        self.assertIn('Useful photo tool',text)
        for download in ('Public album','Paid album','Secret download title','/downloads?item='):
            self.assertNotIn(download,text)

    def test_sitemap_only_includes_canonical_public_pages(self):
        response=self.client.get('/sitemap.xml')
        self.assertEqual(response.status_code,200)
        self.assertEqual(response.mimetype,'application/xml')
        root=fromstring(response.data)
        self.assertEqual([node.text for node in root.iter('{http://www.sitemaps.org/schemas/sitemap/0.9}loc')],
                         ['https://sanuwartools.online/','https://sanuwartools.online/downloads',
                          'https://sanuwartools.online/about','https://sanuwartools.online/contact','https://sanuwartools.online/privacy'])
        self.records[module.TOOLS_CONFIG_REL]['downloadPage']['enabled']=False
        self.assertNotIn(b'/downloads',self.client.get('/sitemap.xml').data)
        self.assertEqual(self.client.get('/downloads').status_code,404)

    def test_robots_preserves_resources_needed_for_rendering(self):
        text=self.client.get('/robots.txt').get_data(as_text=True)
        self.assertIn('Sitemap: https://sanuwartools.online/sitemap.xml',text)
        self.assertIn('Disallow: /admin',text)
        self.assertNotIn('Disallow: /assets',text)
        self.assertNotIn('Disallow: /api/\n',text)
        for path in ('/admin/login','/api/admin/downloads','/api/downloads_data','/payment-demo','/purchases','/not-a-page'):
            self.assertEqual(self.client.get(path).headers.get('X-Robots-Tag'),'noindex, nofollow',path)

    def test_initial_html_escapes_text_and_drops_executable_urls(self):
        self.records[module.DOWNLOADS_REL]=[{'id':'x','title':'<script>alert(1)</script>','link':'javascript:alert(1)','image':'javascript:alert(2)'}]
        self.records[module.TOOLS_CONFIG_REL]['tools'][0]['siteUrl']='javascript:alert(3)'
        text=self.client.get('/downloads').get_data(as_text=True)
        self.assertIn('&lt;script&gt;alert(1)&lt;/script&gt;',text)
        self.assertNotIn('javascript:',text)
        self.assertNotIn('javascript:',self.client.get('/').get_data(as_text=True))
