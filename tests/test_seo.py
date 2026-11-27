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
from tool_guides import GUIDES

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
        for path, canonical in [('/', '/'),('/downloads','/downloads'),('/download.html','/downloads'),('/eduhelp/labs','/eduhelp/labs')]:
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
                          'https://sanuwartools.online/downloads/free/public-album','https://sanuwartools.online/downloads/paid/paid-album',
                          'https://sanuwartools.online/photo-tools',
                          *(f'https://sanuwartools.online/guides/{slug}' for slug in GUIDES),
                          'https://sanuwartools.online/about','https://sanuwartools.online/contact','https://sanuwartools.online/privacy',
                          'https://sanuwartools.online/directory','https://sanuwartools.online/eduhelp','https://sanuwartools.online/eduhelp/labs','https://sanuwartools.online/players','https://sanuwartools.online/directory/anime'])
        self.records[module.TOOLS_CONFIG_REL]['downloadPage']['enabled']=False
        self.assertNotIn(b'/downloads',self.client.get('/sitemap.xml').data)
        self.assertEqual(self.client.get('/downloads').status_code,404)

    def test_download_detail_is_discoverable_and_keeps_private_delivery_hidden(self):
        free = '/downloads/free/public-album'
        paid = '/downloads/paid/paid-album'
        library = self.client.get('/downloads').get_data(as_text=True)
        self.assertIn(f'href="{free}"', library)
        self.assertIn(f'href="{paid}"', library)
        response = self.client.get(free, base_url='https://untrusted.example')
        self.assertEqual(response.status_code, 200)
        text = response.get_data(as_text=True)
        self.assertIn(f'rel="canonical" href="https://sanuwartools.online{free}"', text)
        self.assertIn('<h1>Public album</h1>', text)
        self.assertIn('https://example.com/guide.pdf', text)
        self.assertNotIn('noindex', response.headers.get('X-Robots-Tag', ''))
        paid_page = self.client.get(paid).get_data(as_text=True)
        self.assertIn('Premium file.zip', paid_page)
        self.assertIn('/downloads?item=paid', paid_page)
        self.assertNotIn('private/secret', paid_page)
        self.assertNotIn('secret-original.zip', paid_page)
        redirect = self.client.get('/downloads/free/outdated-title')
        self.assertEqual((redirect.status_code, redirect.location), (301, free))
        self.assertEqual(self.client.get('/downloads/hidden/secret-download-title').status_code, 404)
        self.records[module.TOOLS_CONFIG_REL]['downloadPage']['enabled'] = False
        self.assertEqual(self.client.get(free).status_code, 404)

    def test_guides_are_crawlable_and_link_to_tools(self):
        home = self.client.get('/').get_data(as_text=True)
        for slug, guide in GUIDES.items():
            path = f'/guides/{slug}'
            page = self.client.get(path)
            self.assertEqual(page.status_code, 200)
            self.assertIn(f'href="{path}"', home)
            self.assertIn(f'rel="canonical" href="{seo.ORIGIN}{path}"', page.get_data(as_text=True))
            self.assertIn(guide['sections'][0][0].encode(), page.data)
            for _, tool_path in guide['tools']:
                self.assertIn(f'href="{tool_path}"', page.get_data(as_text=True))
        self.assertEqual(self.client.get('/guides/unknown').status_code, 404)

    def test_unpublished_directory_is_hidden_from_routes_and_sitemap(self):
        categories = self.records[module.DIRECTORY_REL]['categories']
        categories.append({**categories[0], 'slug': 'unpublished-directory', 'name': 'Unpublished directory', 'enabled': False})
        self.assertEqual(self.client.get('/directory/unpublished-directory').status_code, 404)
        self.assertNotIn(b'unpublished-directory', self.client.get('/sitemap.xml').data)
        self.assertNotIn(b'unpublished-directory', self.client.get('/directory').data)
        self.assertNotIn(b'unpublished-directory', self.client.get('/directory/anime').data)

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
        self.assertEqual(sitemap.count('<lastmod>'+seo.SITE_UPDATED+'</lastmod>'),11)

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
        self.assertIn(f'{len(self.catalog["tools"])} free browser tools', home)
        self.assertIn('/photo-tools?mode=photo&amp;kb=50', home)
        self.assertIn('desk-downloads',home)
        for tool in self.catalog['tools']:
            self.assertIn(f'href="/tools/{tool["slug"]}"',home)
        for category in self.catalog['categories']:
            self.assertIn(category.replace('&','&amp;'),home)

    def test_pdf_organizer_and_currency_converter_describe_their_processing(self):
        pdf = self.client.get('/tools/pdf-organizer').get_data(as_text=True)
        for asset in ('/assets/vendor/pdf-lib.js', '/assets/vendor/pdf.min.js', '/assets/js/tools/media.js'):
            self.assertIn(asset, pdf)
        self.assertIn('data-save-tool="/tools/pdf-organizer"', pdf)
        currency = self.client.get('/tools/currency-converter').get_data(as_text=True)
        self.assertIn('selected currency codes to Frankfurter', currency)
        self.assertNotIn('Your inputs and files stay on this device', currency)

    def test_form_tools_are_discoverable_and_load_local_assets(self):
        home = self.client.get('/').get_data(as_text=True)
        checker = self.client.get('/tools/form-file-checker').get_data(as_text=True)
        signer = self.client.get('/tools/fill-sign-pdf').get_data(as_text=True)
        for slug, body in (('form-file-checker', checker), ('fill-sign-pdf', signer)):
            self.assertIn(f'href="/tools/{slug}"', home)
            self.assertIn(f'data-tool-slug="{slug}"', body)
            self.assertIn('/assets/js/tools/forms.js', body)
            self.assertIn('/assets/vendor/pdf-lib.js', body)
        self.assertIn('data-photo-available="true"', checker)
        self.assertNotIn('/assets/vendor/pdf.min.js', checker)
        self.assertIn('/assets/vendor/pdf.min.js', signer)

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

    def test_image_codecs_scope_wasm_to_the_required_context(self):
        header = 'Content-Security-Policy'
        ocr = self.client.get('/tools/image-to-text')
        self.assertEqual(ocr.status_code, 200)
        self.assertNotIn("'wasm-unsafe-eval'", ocr.headers[header])
        self.assertIn('/assets/vendor/ocr/tesseract.min.js', ocr.get_data(as_text=True))
        with self.client.get('/assets/vendor/ocr/worker.min.js') as worker:
            self.assertEqual(worker.status_code, 200)
            self.assertIn("script-src 'self' 'wasm-unsafe-eval'", worker.headers[header])
            self.assertIn("connect-src 'self'", worker.headers[header])
        heic = self.client.get('/tools/heic-to-jpg')
        self.assertEqual(heic.status_code, 200)
        self.assertIn("script-src 'self' 'wasm-unsafe-eval'", heic.headers[header])

    def test_pdf_editor_native_engine_uses_an_isolated_wasm_worker(self):
        header = 'Content-Security-Policy'
        with self.client.get('/tools/pdf-editor') as editor:
            self.assertEqual(editor.status_code, 200)
            self.assertIn('/assets/js/tools/pdf-editor.js', editor.get_data(as_text=True))
            self.assertNotIn("'wasm-unsafe-eval'", editor.headers[header])
        with self.client.get('/assets/js/tools/pdf-native-worker.js') as worker:
            self.assertEqual(worker.status_code, 200)
            self.assertIn("script-src 'self' 'wasm-unsafe-eval'", worker.headers[header])
            self.assertIn("connect-src 'self'", worker.headers[header])
        with self.client.get('/assets/vendor/pdfium/pdfium.wasm') as wasm:
            self.assertEqual(wasm.status_code, 200)
            self.assertEqual(wasm.mimetype, 'application/wasm')

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
        self.assertIn('pdf-organizer', slugs)
        self.assertEqual(len(slugs),len(set(slugs)))
        categories=set(self.catalog['categories'])
        registered={}
        for bundle in sorted(module.TOOL_BUNDLES):
            source=(ROOT/'static/assets/js/tools'/f'{bundle}.js').read_text()
            if bundle=='calculators':
                found=re.findall(r'slug:\s*"([a-z0-9-]+)"',source)
            else:
                found=re.findall(r'(?:T\.register|registerTextTool|codeTool|singleHashTool)\("([a-z0-9-]+)"',source)
            for slug in found:
                registered.setdefault(slug,bundle)
        self.assertEqual(set(registered),set(slugs))
        for tool in tools:
            self.assertIn(tool['category'],categories)
            self.assertEqual(registered[tool['slug']],tool['bundle'])
            self.assertTrue(tool['description'].strip())
            self.assertIn(tool['bundle'],module.TOOL_BUNDLES)

    def test_browser_api_tools_have_scoped_provider_access_and_public_metadata(self):
        config = json.loads((ROOT / 'data/tools.config.json').read_text())
        routes = {
            '/tools/color-contrast-studio': {'https://www.thecolorapi.com'},
            '/tools/link-safety-checker': {'https://scanmalware.com'},
            '/tools/svg-icon-font-finder': {'https://api.iconify.design', 'https://api.fontsource.org', 'https://cdn.jsdelivr.net'},
            '/tools/anime-scene-finder': {'https://api.trace.moe'},
        }
        cards = {card['route']: card for card in config['tools'] if card.get('route') in routes}
        self.assertEqual(set(cards), set(routes))
        for route, providers in routes.items():
            with self.subTest(route=route):
                response = self.client.get(route)
                self.assertEqual(response.status_code, 200)
                html = response.get_data(as_text=True)
                self.assertIn('/assets/js/tools/api-studio.js', html)
                self.assertIn('/assets/css/api-studio.css', html)
                self.assertIn('Data and privacy', html)
                directives = dict(part.strip().split(' ', 1) for part in
                                  response.headers['Content-Security-Policy'].split(';') if part.strip())
                self.assertEqual(set(directives['connect-src'].split()), {"'self'"} | providers)
                self.assertEqual(directives['script-src'], "'self'")
                self.assertEqual(directives['object-src'], "'none'")
                self.assertEqual(directives['form-action'], "'self'")

        self.records[module.TOOLS_CONFIG_REL]['tools'] = [cards[route] for route in routes]
        response = self.client.get('/api/search-index')
        self.assertEqual(response.status_code, 200)
        entries = response.get_json()['entries']
        for route in routes:
            self.assertEqual(sum(item['href'] == route for item in entries), 1)
        hidden = '/tools/link-safety-checker'
        cards[hidden]['visible'] = False
        self.assertEqual(self.client.get(hidden).status_code, 404)
        self.assertFalse(any(card['route'] == hidden for card in self.client.get('/api/browser-tools.json').json['tools']))

    def test_api_directory_ships_search_metadata_and_filter_controls(self):
        self.records[module.DIRECTORY_REL] = json.loads((ROOT / 'data/directory.json').read_text())
        self.assertEqual(self.client.get('/directory').status_code, 200)
        response = self.client.get('/directory/public-apis')
        body = response.get_data(as_text=True)
        self.assertEqual(response.status_code, 200)
        self.assertIn('data-api-filter="auth"', body)
        self.assertIn('data-api-filter="https"', body)
        self.assertIn('data-api-filter="cors"', body)
        self.assertIn('data-auth="API Key" data-https="Yes" data-cors="Unknown"', body)
        self.assertIn('data-auth="No" data-https="Yes" data-cors="Yes"', body)
        self.assertIn('/tools/link-safety-checker#url=https%3A%2F%2F', body)
        self.assertIn('/directory/public-apis', self.client.get('/sitemap.xml').get_data(as_text=True))
