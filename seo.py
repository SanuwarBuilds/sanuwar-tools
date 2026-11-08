"""Canonical public discovery metadata; private workflows stay out of search."""
import os
from xml.etree.ElementTree import Element, SubElement, tostring
from flask import Response, request
import security

ORIGIN = 'https://sanuwartools.online'
SITE_UPDATED = '2026-11-08'
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
}
PAGE_TYPES = {
    '/': 'WebPage',
    '/photo-tools': 'WebPage',
    '/privacy': 'WebPage',
    '/about': 'AboutPage',
    '/contact': 'ContactPage',
    '/downloads': 'CollectionPage',
}
BREADCRUMBS = {
    '/photo-tools': 'Photo Tools',
    '/downloads': 'Downloads',
    '/about': 'About',
    '/contact': 'Contact',
    '/privacy': 'Privacy',
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


def install(app, load_config):
    def tool_icon(tool):
        name = str(tool.get('name', '')).lower()
        kind = 'photo' if 'photo' in name else 'score' if 'cricket' in name else 'wallet' if 'expense' in name else 'tool'
        return '/assets/icons/' + kind + '.svg'
    app.jinja_env.filters['tool_icon'] = tool_icon
    app.jinja_env.filters['public_url'] = lambda value: value if security.valid_url(value) else ''
    app.jinja_env.filters['public_image'] = lambda value: value if security.valid_url(value, image=True) else ''

    @app.context_processor
    def search_metadata():
        path = '/downloads' if request.path == '/download.html' else request.path
        page = PAGES.get(path)
        if page is None:
            return {'seo': {'indexable': False, 'description': ''}, 'seo_verification': []}
        title, description = page
        canonical = ORIGIN + path
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
        webpage = {'@type': PAGE_TYPES.get(path, 'WebPage'), '@id': canonical + '#webpage',
                   'url': canonical, 'name': title, 'description': description,
                   'isPartOf': {'@id': ORIGIN + '/#website'}, 'inLanguage': 'en',
                   'primaryImageOfPage': {'@type': 'ImageObject', 'url': OG_IMAGE,
                                          'width': 1200, 'height': 630},
                   'publisher': publisher}
        graph = [website, organization, webpage] if path == '/' else [organization, webpage]
        if path != '/':
            graph.append({'@type': 'BreadcrumbList', '@id': canonical + '#breadcrumb',
                          'itemListElement': [
                              {'@type': 'ListItem', 'position': 1, 'name': 'Home', 'item': ORIGIN + '/'},
                              {'@type': 'ListItem', 'position': 2,
                               'name': BREADCRUMBS.get(path, title.split(' | ')[0].split(' — ')[0]),
                               'item': canonical}]})
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
        verification = []
        for env_name, meta_name in (('GOOGLE_SITE_VERIFICATION', 'google-site-verification'),
                                    ('BING_SITE_VERIFICATION', 'msvalidate.01'),
                                    ('YANDEX_VERIFICATION', 'yandex-verification')):
            token = os.getenv(env_name, '').strip()
            if token:
                verification.append((meta_name, token))
        return {'seo': {'indexable': True, 'title': title, 'description': description,
                        'canonical': canonical, 'image': OG_IMAGE,
                        'faqs': [{'q': question, 'a': answer} for question, answer in PHOTO_FAQS] if path == '/photo-tools' else [],
                        'structured_data': {'@context': 'https://schema.org', '@graph': graph}},
                'seo_verification': verification}

    @app.get('/robots.txt')
    def robots():
        body = '\n'.join(['User-agent: *', 'Allow: /', 'Disallow: /admin',
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
        paths.extend(['/about', '/contact', '/privacy'])
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
                or path in ('/payment-demo', '/tools.config.json', '/signin', '/account')):
            response.headers['X-Robots-Tag'] = 'noindex, nofollow'
        return response
