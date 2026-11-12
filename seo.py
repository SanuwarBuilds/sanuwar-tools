"""Canonical public discovery metadata; private workflows stay out of search."""
import datetime
import os
import re
from xml.etree.ElementTree import Element, SubElement, tostring
from flask import Response, request
import security

ORIGIN = 'https://sanuwartools.online'
SITE_UPDATED = '2026-11-12'
SITE_UPDATED_DISPLAY = datetime.date.fromisoformat(SITE_UPDATED).strftime('%d %B %Y').lstrip('0')
OG_IMAGE = ORIGIN + '/assets/og/sanuwartools-og.png'
TELEGRAM_URL = 'https://t.me/+dBcRFw3B1zcwMDg1'
INDEXNOW_KEY = '9c3f7a1e5b8d4f2a6c0e9d7b3a5f1c8e'
PAGES = {
    '/': ('SanuwarTools — Free Web Tools & Android Downloads',
          'Free browser tools for photo resizing, passport photos, cricket scores and expenses, plus Android apps and files. No install — open, work, done.'),
    '/photo-tools': ('Photo Resizer & Compressor — Passport Photos | SanuwarTools',
                     'Resize, crop and compress photos free in your browser. Set exact pixels, DPI and KB limits, make passport photos and print sheets. Your photo stays on your device.'),
    '/privacy': ('Privacy Policy | SanuwarTools',
                 'How SanuwarTools uses cookies, local storage and advertising services, and how to contact us about your privacy.'),
    '/about': ('About SanuwarTools — Web Tools & Downloads',
               'Learn about SanuwarTools, a collection of useful web tools, Android apps and downloadable files maintained by Sanuwar.'),
    '/contact': ('Contact & Support | SanuwarTools',
                 'Contact SanuwarTools for support, download issues, corrections, privacy requests or content concerns.'),
    '/downloads': ('Downloads — Android Apps & Files | SanuwarTools',
                   'Browse Android apps, files and albums on SanuwarTools. Preview available downloads, check versions and choose the files you need.'),
    '/directory': ('Open Directories — Movies, Anime, Manga & More | SanuwarTools',
                   'Browse hand-checked directories for movies, TV shows, anime, manga, live sports, live TV, torrents, games, music, eBooks, comics, Asian drama, VPNs and ad blockers.'),
}
PAGE_TYPES = {
    '/': 'WebPage',
    '/photo-tools': 'WebPage',
    '/privacy': 'WebPage',
    '/about': 'AboutPage',
    '/contact': 'ContactPage',
    '/downloads': 'CollectionPage',
    '/directory': 'CollectionPage',
}
BREADCRUMBS = {
    '/photo-tools': 'Photo Tools',
    '/downloads': 'Downloads',
    '/about': 'About',
    '/contact': 'Contact',
    '/privacy': 'Privacy',
    '/directory': 'Directories',
}
PHOTO_FAQS = [
    ('How do I resize a photo to exact pixels?',
     'Open Photo Tools, choose your photo, then enter the width and height in pixels. The preview updates instantly. Use Lock aspect ratio to keep proportions, then download when the output size matches your form.'),
    ('How do I compress a photo to 20 KB?',
     'Choose JPG, enter 20 in Maximum size (KB), and download. The tool re-encodes the image under the limit, lowering JPG quality only as much as needed. The live file-size estimate shows the target before you export.'),
    ('What size is a passport photo in pixels?',
     'Many online portals ask for 630 × 810 px, which is 35 × 45 mm at 300 DPI. Printed passport photos commonly use 35 × 45 mm. Always check the latest dimensions and KB limit on the official form or portal.'),
    ('Does SanuwarTools upload my photo?',
     'No. Photos are opened and processed in your browser using the canvas API. Files are not uploaded to our servers, and exports are re-encoded on your device so camera metadata such as GPS location is removed.'),
    ('Can I make a 4 × 6 inch photo print sheet?',
     'Yes. Pick a preset or set a 35 × 45 mm output, choose the 4 × 6 inch print sheet, then save or print the sheet at 100% / actual size with page margins off.'),
]

LAND_FAQS = [
    ('How many square feet is 1 Bigha in Assam?',
     'In the Brahmaputra Valley standard, 1 Bigha = 14,400 sq ft = 5 Katha. In the Barak Valley reference, 1 Bigha is also 14,400 sq ft but is divided into 20 Katha of 720 sq ft. Local records may still differ.'),
    ('How many Katha are in a Bigha?',
     'It depends on the standard. In the Assam Brahmaputra Valley standard, 1 Bigha = 5 Katha. In West Bengal and the Assam Barak Valley reference, 1 Bigha = 20 Katha. Choose your state and local standard in the calculator.'),
    ('What is 1 Lessa in square feet?',
     '1 Lessa = 144 sq ft. In the Brahmaputra Valley standard, 1 Katha = 2,880 sq ft = 20 Lessa.'),
    ('Why is a Bigha different in different states?',
     'Bigha, Katha, Biswa and similar names were defined by local revenue practice, not by a single national rule. Even nearby districts can use different sizes. That is why this calculator asks for your state and local standard.'),
    ('Can I use this calculator for a legal land record?',
     'No. Use it for a quick reference only. For purchase, sale, loan, registration or construction, confirm the area with official land records, the registered deed, or a licensed surveyor.'),
    ('Does the calculator upload my data?',
     'No. All calculations run in your browser. The page does not send your area or conversions to a server.'),
]

TOOL_ICON_NAMES = ('photo', 'passport', 'score', 'wallet', 'tool', 'download', 'album',
                   'film', 'anime', 'manga', 'sports', 'tv', 'torrent', 'game', 'music',
                   'ebook', 'comics', 'drama', 'vpn', 'shield', 'calculator', 'key',
                   'text', 'convert', 'document', 'clock', 'heart', 'archive')


def install(app, load_config, load_directory=None, load_tool_catalog=None):
    def directory_categories():
        data = load_directory() if load_directory else None
        if not isinstance(data, dict):
            return []
        return [category for category in data.get('categories', [])
                if isinstance(category, dict) and category.get('slug') and category.get('name')]

    def tool_catalog():
        data = load_tool_catalog() if load_tool_catalog else None
        if not isinstance(data, dict):
            return []
        return [tool for tool in data.get('tools', [])
                if isinstance(tool, dict) and isinstance(tool.get('slug'), str)
                and isinstance(tool.get('name'), str) and isinstance(tool.get('description'), str)
                and isinstance(tool.get('category'), str)]

    def tool_icon(tool):
        explicit = str(tool.get('icon', '')).strip().lower()
        if explicit in TOOL_ICON_NAMES:
            return '/assets/icons/' + explicit + '.svg?v=soft1'
        tags = tool.get('tags')
        tag_text = ' '.join(str(tag) for tag in tags).lower() if isinstance(tags, list) else ''

        def kind_for(text):
            return ('passport' if 'passport' in text else
                    'photo' if 'photo' in text else
                    'score' if 'cricket' in text else
                    'wallet' if 'expense' in text or 'budget' in text else
                    'film' if 'movie' in text or 'tv show' in text else
                    'anime' if 'anime' in text else
                    'manga' if 'manga' in text else
                    'sports' if 'sport' in text else
                    'tv' if 'live tv' in text else
                    'torrent' if 'torrent' in text else
                    'game' if 'game' in text else
                    'music' if 'music' in text else
                    'ebook' if 'ebook' in text else
                    'comics' if 'comic' in text else
                    'drama' if 'drama' in text else
                    'vpn' if 'vpn' in text else
                    'shield' if 'adblock' in text else '')

        kind = (kind_for(str(tool.get('name', '')).lower()) or
                kind_for(tag_text) or 'tool')
        return '/assets/icons/' + kind + '.svg?v=soft1'
    app.jinja_env.filters['tool_icon'] = tool_icon
    app.jinja_env.filters['public_url'] = lambda value: value if security.valid_url(value) else ''
    app.jinja_env.filters['public_image'] = lambda value: value if security.valid_url(value, image=True) else ''

    @app.context_processor
    def search_metadata():
        path = '/downloads' if request.path == '/download.html' else request.path
        category = None
        tool_page = None
        page = PAGES.get(path)
        tools = tool_catalog()
        if page is None and path in ('/tools', '/tools/'):
            if tools:
                page = (f'All Tools — {len(tools)} Free Browser Utilities | SanuwarTools',
                        f'Browse {len(tools)} free browser tools for text, hashes, images, PDFs, networking, calculators, unit converters, time and security. Every tool runs locally — no uploads, no account.')
        if page is None and path.startswith('/tools/'):
            slug = path[len('/tools/'):]
            if '/' not in slug:
                tool_page = next((item for item in tools if item.get('slug') == slug), None)
            if tool_page is not None:
                if tool_page['slug'] == 'land-measurement-calculator':
                    page = ('Land Measurement Calculator — Bigha, Katha, Lessa | SanuwarTools',
                            'Convert Bigha, Katha, Lessa, Biswa, Kanal, Marla, Guntha and acres with state-wise Indian standards. Assam-first, private, free land calculator.')
                else:
                    page = (f"{tool_page['name']} — Free Online Tool | SanuwarTools",
                            str(tool_page.get('description') or '')[:300])
        if page is None and path.startswith('/directory/'):
            slug = path[len('/directory/'):]
            if '/' not in slug:
                category = next((item for item in directory_categories() if item.get('slug') == slug), None)
            if category is not None:
                total = sum(len([site for site in group.get('sites', []) if isinstance(site, dict)])
                            for group in category.get('groups', []) if isinstance(group, dict))
                name = str(category.get('name'))
                page = (f'{name} — {total} Sites & Mirrors | SanuwarTools',
                        (str(category.get('description') or f'Browse {total} {name} sites and mirrors.'))[:300])
        if page is None:
            return {'seo': {'indexable': False, 'description': ''}, 'seo_verification': []}
        title, description = page
        canonical = ORIGIN + ('/tools' if path in ('/tools', '/tools/') else path)
        publisher = {'@id': ORIGIN + '/#organization'}
        website = {'@type': 'WebSite', '@id': ORIGIN + '/#website', 'url': ORIGIN + '/',
                   'name': 'SanuwarTools', 'alternateName': 'Sanuwar Tools', 'inLanguage': 'en',
                   'publisher': publisher}
        organization = {'@type': 'Organization', '@id': ORIGIN + '/#organization',
                        'name': 'SanuwarTools', 'url': ORIGIN + '/',
                        'description': 'Free browser tools, Android apps and downloadable files.',
                        'logo': {'@type': 'ImageObject', 'url': ORIGIN + '/assets/favicon.png',
                                 'width': 256, 'height': 256},
                        'contactPoint': {'@type': 'ContactPoint', 'contactType': 'customer support',
                                         'url': TELEGRAM_URL},
                        'sameAs': ['https://github.com/SanuwarBuilds', 'https://www.instagram.com/iam.sanuwar/']}
        page_type = 'CollectionPage' if path.startswith('/directory') or path in ('/tools', '/tools/') else PAGE_TYPES.get(path, 'WebPage')
        webpage = {'@type': page_type, '@id': canonical + '#webpage',
                   'url': canonical, 'name': title, 'description': description,
                   'isPartOf': {'@id': ORIGIN + '/#website'}, 'inLanguage': 'en',
                   'primaryImageOfPage': {'@type': 'ImageObject', 'url': OG_IMAGE,
                                          'width': 1200, 'height': 630},
                   'dateModified': SITE_UPDATED,
                   'publisher': publisher}
        graph = [website, organization, webpage] if path == '/' else [organization, webpage]
        if path != '/':
            if tool_page is not None and tool_page.get('slug') == 'land-measurement-calculator':
                crumb_items = [
                    {'@type': 'ListItem', 'position': 1, 'name': 'Home', 'item': ORIGIN + '/'},
                    {'@type': 'ListItem', 'position': 2, 'name': 'All tools', 'item': ORIGIN + '/tools'},
                    {'@type': 'ListItem', 'position': 3, 'name': 'Land Measurement Calculator', 'item': canonical},
                ]
            elif category is not None:
                crumb_name = str(category.get('name'))
                crumb_items = [
                    {'@type': 'ListItem', 'position': 1, 'name': 'Home', 'item': ORIGIN + '/'},
                    {'@type': 'ListItem', 'position': 2, 'name': 'Directories', 'item': ORIGIN + '/directory'},
                    {'@type': 'ListItem', 'position': 3, 'name': crumb_name, 'item': canonical},
                ]
            else:
                crumb_name = BREADCRUMBS.get(path, title.split(' | ')[0].split(' — ')[0])
                crumb_items = [
                    {'@type': 'ListItem', 'position': 1, 'name': 'Home', 'item': ORIGIN + '/'},
                    {'@type': 'ListItem', 'position': 2, 'name': crumb_name, 'item': canonical},
                ]
            graph.append({'@type': 'BreadcrumbList', '@id': canonical + '#breadcrumb',
                          'itemListElement': crumb_items})
        if category is not None:
            site_items = []
            position = 0
            for group in category.get('groups', []):
                if not isinstance(group, dict):
                    continue
                for site in group.get('sites', []):
                    if not isinstance(site, dict) or not site.get('url'):
                        continue
                    position += 1
                    site_items.append({'@type': 'ListItem', 'position': position,
                                       'name': str(site.get('name') or site['url']),
                                       'url': str(site['url'])})
            graph.append({'@type': 'ItemList', '@id': canonical + '#sites',
                          'name': title, 'numberOfItems': position,
                          'itemListElement': site_items})
        if path == '/photo-tools':
            graph.append({'@type': 'WebApplication', '@id': canonical + '#app',
                          'name': 'Photo Resizer & Compressor', 'url': canonical,
                          'description': description, 'applicationCategory': 'MultimediaApplication',
                          'operatingSystem': 'Any (browser-based)', 'browserRequirements': 'Requires JavaScript',
                          'offers': {'@type': 'Offer', 'price': '0', 'priceCurrency': 'USD'},
                          'featureList': ['Crop and resize to exact pixels', 'Set DPI and KB limits',
                                          'Passport photo presets and print sheets', 'JPG and PNG export',
                                          'Local, in-browser processing'],
                          'isPartOf': {'@id': ORIGIN + '/#website'}, 'publisher': publisher})
            graph.append({'@type': 'FAQPage', '@id': canonical + '#faq',
                          'mainEntity': [{'@type': 'Question', 'name': question,
                                          'acceptedAnswer': {'@type': 'Answer', 'text': answer}}
                                         for question, answer in PHOTO_FAQS]})
        if tool_page is not None:
            land_tool = tool_page.get('slug') == 'land-measurement-calculator'
            graph.append({'@type': 'WebApplication', '@id': canonical + '#app',
                          'name': tool_page['name'], 'url': canonical,
                          'description': description,
                          'applicationCategory': 'BusinessApplication' if land_tool else 'UtilitiesApplication',
                          'operatingSystem': 'Any (browser-based)',
                          'browserRequirements': 'Requires JavaScript',
                          'offers': {'@type': 'Offer', 'price': '0', 'priceCurrency': 'USD'},
                          'featureList': (['State-wise Bigha, Katha, Biswa, Kanal and Marla standards',
                                           'Assam Brahmaputra and Barak Valley references',
                                           'Searchable units in English, Hindi and Assamese',
                                           'Local breakdown and reference tables',
                                           'Runs locally with no uploads'] if land_tool else
                                          ['Runs locally in the browser', 'No account required',
                                           'No file uploads']),
                          'isPartOf': {'@id': ORIGIN + '/#website'}, 'publisher': publisher})
            if land_tool:
                graph.append({'@type': 'FAQPage', '@id': canonical + '#faq',
                              'mainEntity': [{'@type': 'Question', 'name': question,
                                              'acceptedAnswer': {'@type': 'Answer', 'text': answer}}
                                             for question, answer in LAND_FAQS]})
        verification = []
        for env_name, meta_name in (('GOOGLE_SITE_VERIFICATION', 'google-site-verification'),
                                    ('BING_SITE_VERIFICATION', 'msvalidate.01'),
                                    ('YANDEX_VERIFICATION', 'yandex-verification')):
            token = os.getenv(env_name, '').strip()
            if token:
                verification.append((meta_name, token))
        return {'seo': {'indexable': True, 'title': title, 'description': description,
                        'canonical': canonical, 'image': OG_IMAGE,
                        'updated': SITE_UPDATED, 'updated_display': SITE_UPDATED_DISPLAY,
                        'faqs': ([{'q': question, 'a': answer} for question, answer in PHOTO_FAQS] if path == '/photo-tools' else
                                 [{'q': question, 'a': answer} for question, answer in LAND_FAQS] if tool_page is not None and tool_page.get('slug') == 'land-measurement-calculator' else []),
                        'structured_data': {'@context': 'https://schema.org', '@graph': graph}},
                'seo_verification': verification}

    @app.get('/robots.txt')
    def robots():
        body = '\n'.join(['User-agent: *', 'Allow: /', 'Disallow: /admin',
                          'Disallow: /bypass',
                          'Disallow: /purchase', 'Disallow: /payment-demo',
                          'Disallow: /api/admin/', 'Disallow: /api/payments/',
                          'Disallow: /api/license/', 'Sitemap: ' + ORIGIN + '/sitemap.xml', ''])
        return Response(body, mimetype='text/plain', headers={'Cache-Control': 'public, max-age=3600'})

    @app.get('/sitemap.xml')
    def sitemap():
        paths = ['/']
        config = load_config() or {}
        if config.get('downloadPage', {}).get('enabled', True) is True:
            paths.append('/downloads')
        if not any(tool.get('id') == 'builtin-photo-tools' and not all(tool.get(flag, True) is True for flag in ('enabled', 'visible')) for tool in config.get('tools', [])):
            paths.append('/photo-tools')
        paths.extend(['/about', '/contact', '/privacy', '/directory'])
        for category in directory_categories():
            slug = category.get('slug')
            if isinstance(slug, str) and re.fullmatch(r'[a-z0-9-]{1,80}', slug):
                paths.append('/directory/' + slug)
        tools = tool_catalog()
        if tools:
            paths.append('/tools')
            for tool in tools:
                slug = tool.get('slug')
                if isinstance(slug, str) and re.fullmatch(r'[a-z0-9-]{1,80}', slug):
                    paths.append('/tools/' + slug)
        root = Element('urlset', xmlns='http://www.sitemaps.org/schemas/sitemap/0.9')
        for path in paths:
            url = SubElement(root, 'url')
            SubElement(url, 'loc').text = ORIGIN + path
            SubElement(url, 'lastmod').text = SITE_UPDATED
        return Response(tostring(root, encoding='utf-8', xml_declaration=True), mimetype='application/xml',
                        headers={'Cache-Control': 'no-store'})

    @app.get('/' + INDEXNOW_KEY + '.txt')
    def indexnow_key():
        return Response(INDEXNOW_KEY, mimetype='text/plain', headers={'Cache-Control': 'public, max-age=86400'})

    @app.after_request
    def search_headers(response):
        path = request.path
        if (response.status_code >= 400 or path.startswith(('/admin', '/api/', '/purchase'))
                or path in ('/payment-demo', '/tools.config.json', '/signin', '/account', '/bypass')):
            response.headers['X-Robots-Tag'] = 'noindex, nofollow'
        return response
