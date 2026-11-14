"""Public search metadata must never expose unpublished or private catalogue data."""
import copy
import json
import re
import unittest
from pathlib import Path
from unittest.mock import patch
from xml.etree.ElementTree import fromstring
import app as module
import seo

ROOT = Path(__file__).resolve().parents[1]

class SearchDiscoveryTests(unittest.TestCase):
    def setUp(self):
        self.records={module.TOOLS_CONFIG_REL:{'site':{},'tools':[
            {'id':'active','name':'Useful photo tool','siteUrl':'https://example.com/photo','visible':True},
            {'id':'secret','name':'Unpublished secret tool','siteUrl':'https://example.com/secret','visible':False}],
            'categories':['All'],'downloadPage':{'enabled':True}},module.DOWNLOADS_REL:[
            {'id':'free','title':'Public album','is_album':True,'album_files':[{'name':'Public guide.pdf','link':'https://example.com/guide.pdf'}]},
            {'id':'hidden','title':'Secret download title','enabled':False,'link':'https://example.com/hidden.zip'},
            {'id':'paid','title':'Paid album','is_album':True,'pricing':{'mode':'paid','price':'99','discount':'0'},
             'album_files':[{'name':'Premium file.zip','asset':{'public_id':'private/secret','type':'authenticated','resource_type':'raw','format':'zip'},'link':'https://example.com/secret-original.zip'}]}],
            module.DIRECTORY_REL:{'notice':'Test notice.','categories':[
                {'slug':'anime','name':'Anime','short':'Anime','icon':'anime','description':'Test anime directory.',
                 'groups':[{'name':'All sites','sites':[{'name':'anime.example','url':'https://anime.example/'}]}]}]}}
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
        website, organization=data['@graph'][:2]
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

    def test_homepage_renders_public_downloads_but_never_private_ones(self):
        response=self.client.get('/')
        self.assertEqual(response.status_code,200)
        text=response.get_data(as_text=True)
        self.assertIn('Useful photo tool',text)
        for public in ('Public album','Paid album'):
            self.assertIn(public,text)
        for secret in ('Secret download title','https://example.com/hidden.zip','private/secret','secret-original.zip'):
            self.assertNotIn(secret,text)

    def test_sitemap_only_includes_canonical_public_pages(self):
        response=self.client.get('/sitemap.xml')
        self.assertEqual(response.status_code,200)
        self.assertEqual(response.mimetype,'application/xml')
        root=fromstring(response.data)
        self.assertEqual([node.text for node in root.iter('{http://www.sitemaps.org/schemas/sitemap/0.9}loc')],
                         ['https://sanuwartools.online/','https://sanuwartools.online/downloads',
                          'https://sanuwartools.online/photo-tools','https://sanuwartools.online/about','https://sanuwartools.online/contact','https://sanuwartools.online/privacy',
                          'https://sanuwartools.online/directory','https://sanuwartools.online/eduhelp','https://sanuwartools.online/directory/anime'])
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

    def test_downloads_page_has_one_h1_and_descriptive_copy(self):
        text=self.client.get('/downloads').get_data(as_text=True)
        self.assertEqual(len(re.findall(r'<h1[ >]',text)),1)
        self.assertIn('<h1 id="downloads-title">Downloads</h1>',text)
        self.assertIn('Free Android apps, files and albums',text)

    def test_home_and_photo_pages_expose_keyword_copy(self):
        home=self.client.get('/').get_data(as_text=True)
        self.assertIn('photo resizing and passport photos',home)
        self.assertIn('photo resizer and compressor',home)
        photo=self.client.get('/photo-tools').get_data(as_text=True)
        self.assertIn('Resize and compress photos for forms and printing',photo)
        self.assertIn('Common questions',photo)
        for question,_ in seo.PHOTO_FAQS:self.assertIn(question,photo)

    def test_photo_tools_structured_data_has_app_faq_and_breadcrumb(self):
        text=self.client.get('/photo-tools').get_data(as_text=True)
        data=json.loads(re.search(r'<script[^>]*type="application/ld\+json">(.*?)</script>',text,re.S).group(1))
        types={node.get('@type') for node in data['@graph']}
        self.assertTrue({'WebApplication','FAQPage','BreadcrumbList'} <= types)
        faq=next(node for node in data['@graph'] if node.get('@type')=='FAQPage')
        self.assertEqual(len(faq['mainEntity']),len(seo.PHOTO_FAQS))
        self.assertEqual(faq['mainEntity'][0]['name'],seo.PHOTO_FAQS[0][0])

    def test_social_preview_uses_large_card_and_absolute_png(self):
        text=self.client.get('/').get_data(as_text=True)
        self.assertIn('property="og:image" content="https://sanuwartools.online/assets/og/sanuwartools-og.png"',text)
        self.assertIn('property="og:image:width" content="1200"',text)
        self.assertIn('property="og:image:height" content="630"',text)
        self.assertIn('name="twitter:card" content="summary_large_image"',text)
        self.assertEqual(self.client.get('/assets/og/sanuwartools-og.png').status_code,200)

    def test_verification_meta_comes_from_environment(self):
        with patch.dict('os.environ',{'GOOGLE_SITE_VERIFICATION':'google-token','BING_SITE_VERIFICATION':'bing-token'}):
            text=self.client.get('/').get_data(as_text=True)
        self.assertIn('<meta name="google-site-verification" content="google-token">',text)
        self.assertIn('<meta name="msvalidate.01" content="bing-token">',text)

    def test_indexnow_key_and_sitemap_lastmod(self):
        response=self.client.get('/'+seo.INDEXNOW_KEY+'.txt')
        self.assertEqual(response.status_code,200)
        self.assertEqual(response.get_data(as_text=True),seo.INDEXNOW_KEY)
        sitemap=self.client.get('/sitemap.xml').data.decode()
        self.assertEqual(sitemap.count('<lastmod>'+seo.SITE_UPDATED+'</lastmod>'),9)

    def test_directory_hub_and_category_pages_are_indexable(self):
        hub=self.client.get('/directory')
        self.assertEqual(hub.status_code,200)
        self.assertIn('Anime',hub.get_data(as_text=True))
        self.assertNotIn('noindex',hub.headers.get('X-Robots-Tag',''))
        detail=self.client.get('/directory/anime')
        self.assertEqual(detail.status_code,200)
        text=detail.get_data(as_text=True)
        self.assertIn('https://anime.example/',text)
        self.assertIn('Search anime sites',text)
        data=json.loads(re.search(r'<script[^>]*type="application/ld\+json">(.*?)</script>',text,re.S).group(1))
        types={node.get('@type') for node in data['@graph']}
        self.assertTrue({'CollectionPage','BreadcrumbList','ItemList'} <= types)
        self.assertEqual(self.client.get('/directory/missing').status_code,404)

    def test_private_pages_send_noindex_header(self):
        for path in ('/signin','/account'):
            self.assertIn('noindex',self.client.get(path).headers.get('X-Robots-Tag',''),path)

    def test_visible_title_matches_page_metadata(self):
        for path in ('/','/downloads','/photo-tools'):
            text=self.client.get(path).get_data(as_text=True)
            expected=seo.PAGES[path][0].replace('&','&amp;')
            self.assertIn('<title>'+expected+'</title>',text)
            self.assertIn('property="og:title" content="'+expected+'"',text)

    def test_telegram_contact_link_is_public(self):
        url='https://t.me/+dBcRFw3B1zcwMDg1'
        self.records[module.TOOLS_CONFIG_REL]['socialLinks']={'telegram':url}
        contact=self.client.get('/contact').get_data(as_text=True)
        self.assertIn(url,contact)
        self.assertIn('Telegram ↗',contact)
        home=self.client.get('/').get_data(as_text=True)
        self.assertIn(url,home)
        data=json.loads(re.search(r'<script[^>]*type="application/ld\+json">(.*?)</script>',home,re.S).group(1))
        organization=next(node for node in data['@graph'] if node.get('@type')=='Organization')
        self.assertEqual(organization['contactPoint']['url'],url)

    def test_initial_html_escapes_text_and_drops_executable_urls(self):
        self.records[module.DOWNLOADS_REL]=[{'id':'x','title':'<script>alert(1)</script>','link':'javascript:alert(1)','image':'javascript:alert(2)'}]
        self.records[module.TOOLS_CONFIG_REL]['tools'][0]['siteUrl']='javascript:alert(3)'
        text=self.client.get('/downloads').get_data(as_text=True)
        self.assertIn('&lt;script&gt;alert(1)&lt;/script&gt;',text)
        self.assertNotIn('javascript:',text)
        self.assertNotIn('javascript:',self.client.get('/').get_data(as_text=True))


class ToolHubTests(unittest.TestCase):
    def setUp(self):
        self.catalog=json.loads((ROOT/'data/tools.catalog.json').read_text())
        self.records={
            module.TOOLS_CONFIG_REL:{'site':{},'tools':[],'categories':['All'],'downloadPage':{'enabled':True}},
            module.DOWNLOADS_REL:[],
            module.DIRECTORY_REL:{'notice':'Test notice.','categories':[]},
            module.TOOL_CATALOG_REL:self.catalog,
        }
        patch.object(module,'safe_read',side_effect=lambda path:copy.deepcopy(self.records.get(path))).start()
        self.client=module.app.test_client()

    def tearDown(self):patch.stopall()

    def test_hub_and_tool_pages_are_indexable(self):
        hub=self.client.get('/tools',base_url='https://untrusted.example')
        self.assertEqual(hub.status_code,200)
        text=hub.get_data(as_text=True)
        self.assertIn(f'All Tools — {len(self.catalog["tools"])} Free Browser Utilities',text)
        self.assertIn('rel="canonical" href="https://sanuwartools.online/tools"',text)
        self.assertNotIn('noindex',hub.headers.get('X-Robots-Tag',''))
        self.assertEqual(text.count('href="/tools/'),len(self.catalog['tools']))
        self.assertEqual(self.client.get('/tools/').status_code,200)
        self.assertIn('href="/tools"',self.client.get('/').get_data(as_text=True))

        tool=self.client.get('/tools/ip-calculator')
        self.assertEqual(tool.status_code,200)
        body=tool.get_data(as_text=True)
        self.assertIn('<h1>IP Calculator</h1>',body)
        self.assertIn('rel="canonical" href="https://sanuwartools.online/tools/ip-calculator"',body)
        data=json.loads(re.search(r'<script[^>]*type="application/ld\+json">(.*?)</script>',body,re.S).group(1))
        app_node=next(node for node in data['@graph'] if node.get('@type')=='WebApplication')
        self.assertEqual(app_node['name'],'IP Calculator')
        self.assertEqual(app_node['url'],'https://sanuwartools.online/tools/ip-calculator')
        self.assertEqual(self.client.get('/tools/missing-tool').status_code,404)

    def test_homepage_merges_every_browser_tool_into_the_catalogue(self):
        home=self.client.get('/').get_data(as_text=True)
        self.assertIn('id="browser-tools"',home)
        self.assertIn('class="home-download-strip"',home)
        for tool in self.catalog['tools']:
            self.assertIn(f'href="/tools/{tool["slug"]}"',home)
        for category in self.catalog['categories']:
            self.assertIn(category.replace('&','&amp;'),home)

    def test_browser_tools_feed_exposes_only_card_fields(self):
        response=self.client.get('/api/browser-tools.json')
        self.assertEqual(response.status_code,200)
        self.assertIn('max-age=300',response.headers['Cache-Control'])
        cards=response.get_json()['tools']
        self.assertEqual(len(cards),len(self.catalog['tools']))
        fields={'id','name','category','description','longDescription','route','tags','icon','thumbnail','featured','popular','visible','enabled','downloadAvailable'}
        for card in cards:
            self.assertEqual(set(card),fields)
            self.assertTrue(card['route'].startswith('/tools/'))
            self.assertTrue(card['thumbnail'].startswith('/assets/icons/'))

    def test_tool_pages_use_self_hosted_csp(self):
        for path in ('/tools','/tools/ip-calculator'):
            response=self.client.get(path)
            self.assertEqual(response.status_code,200)
            csp=response.headers['Content-Security-Policy']
            self.assertIn("script-src 'self'",csp)
            self.assertNotIn("'unsafe-eval'",csp)
            self.assertIn('https://api.frankfurter.dev',csp)
            self.assertIn("worker-src 'self' blob:",csp)
            self.assertIn('blob:',csp.split('img-src')[1].split(';')[0])

    def test_sitemap_includes_hub_and_every_tool(self):
        root=fromstring(self.client.get('/sitemap.xml').data)
        locs=[node.text for node in root.iter('{http://www.sitemaps.org/schemas/sitemap/0.9}loc')]
        self.assertIn('https://sanuwartools.online/tools',locs)
        for tool in self.catalog['tools']:
            self.assertIn('https://sanuwartools.online/tools/'+tool['slug'],locs)
        self.assertEqual(sum(1 for loc in locs if loc.startswith('https://sanuwartools.online/tools/')),len(self.catalog['tools']))

    def test_catalog_and_javascript_bundles_are_consistent(self):
        tools=self.catalog['tools']
        slugs=[tool['slug'] for tool in tools]
        self.assertEqual(len(slugs),125)
        self.assertEqual(len(slugs),len(set(slugs)))
        categories=set(self.catalog['categories'])
        registered={}
        for bundle in sorted(module.TOOL_BUNDLES):
            source=(ROOT/'static/assets/js/tools'/f'{bundle}.js').read_text()
            if bundle=='calculators':
                found=re.findall(r'slug:\s*"([a-z0-9-]+)"',source)
            else:
                found=re.findall(r'(?:T\.register|codeTool|singleHashTool)\("([a-z0-9-]+)"',source)
            for slug in found:
                registered.setdefault(slug,bundle)
        self.assertEqual(set(registered),set(slugs))
        for tool in tools:
            self.assertIn(tool['category'],categories)
            self.assertEqual(registered[tool['slug']],tool['bundle'])
            self.assertTrue(tool['description'].strip())
            self.assertIn(tool['bundle'],module.TOOL_BUNDLES)
