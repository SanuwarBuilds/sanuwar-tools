"""Canonical public discovery metadata; private workflows stay out of search."""
from xml.etree.ElementTree import Element, SubElement, tostring
from flask import Response, request
import security

ORIGIN = 'https://sanuwartools.online'
PAGES = {
    '/': ('SanuwarTools — Web Tools, Android Apps & Downloads',
          'Explore SanuwarTools for useful web tools, passport photo tools, cricket scores, Android apps and downloadable files. Everything in one place.'),
    '/privacy': ('Privacy Policy | SanuwarTools', 'How SanuwarTools uses cookies, local storage and advertising services, and how to contact us about your privacy.'),
    '/about': ('About | SanuwarTools', 'Learn about SanuwarTools, a collection of useful web tools, Android apps and downloadable files maintained by Sanuwar.'),
    '/contact': ('Contact & Support | SanuwarTools', 'Contact SanuwarTools for support, download issues, corrections, privacy requests or content concerns.'),
    '/downloads': ('Downloads — Android Apps & Files | SanuwarTools',
                   'Browse Android apps, files and albums on SanuwarTools. Preview available downloads, check versions and choose the files you need.'),
}


def install(app, load_config):
    app.jinja_env.filters['public_url'] = lambda value: value if security.valid_url(value) else ''
    app.jinja_env.filters['public_image'] = lambda value: value if security.valid_url(value, image=True) else ''

    @app.context_processor
    def search_metadata():
        path = '/downloads' if request.path == '/download.html' else request.path
        page = PAGES.get(path)
        if page is None:
            return {'seo': {'indexable': False, 'description': ''}}
        title, description = page
        canonical = ORIGIN + path
        website = {'@type': 'WebSite', '@id': ORIGIN + '/#website', 'url': ORIGIN + '/',
                   'name': 'SanuwarTools', 'alternateName': 'Sanuwar Tools'}
        organization = {'@type': 'Organization', '@id': ORIGIN + '/#organization',
                        'name': 'SanuwarTools', 'url': ORIGIN + '/',
                        'logo': {'@type': 'ImageObject', 'url': ORIGIN + '/assets/favicon.png',
                                 'width': 256, 'height': 256},
                        'sameAs': ['https://github.com/SanuwarBuilds', 'https://www.instagram.com/iam.sanuwar/']}
        graph = [website, organization] if path == '/' else [
            {'@type': 'CollectionPage', 'url': canonical, 'name': title,
             'description': description, 'isPartOf': {'@id': ORIGIN + '/#website'}}]
        return {'seo': {'indexable': True, 'title': title, 'description': description,
                        'canonical': canonical, 'image': ORIGIN + '/assets/favicon.png',
                        'structured_data': {'@context': 'https://schema.org', '@graph': graph}}}

    @app.get('/robots.txt')
    def robots():
        body = '\n'.join(['User-agent: *', 'Allow: /', 'Disallow: /admin',
                          'Disallow: /purchase', 'Disallow: /payment-demo',
                          'Disallow: /api/admin/', 'Disallow: /api/payments/',
                          'Disallow: /api/license/', 'Sitemap: ' + ORIGIN + '/sitemap.xml', ''])
        return Response(body, mimetype='text/plain')

    @app.get('/sitemap.xml')
    def sitemap():
        paths = ['/']
        config = load_config() or {}
        if config.get('downloadPage', {}).get('enabled', True) is True:
            paths.append('/downloads')
        paths.extend(['/about', '/contact', '/privacy'])
        root = Element('urlset', xmlns='http://www.sitemaps.org/schemas/sitemap/0.9')
        for path in paths:
            SubElement(SubElement(root, 'url'), 'loc').text = ORIGIN + path
        return Response(tostring(root, encoding='utf-8', xml_declaration=True), mimetype='application/xml',
                        headers={'Cache-Control': 'no-store'})

    @app.after_request
    def search_headers(response):
        path = request.path
        if (response.status_code >= 400 or path.startswith(('/admin', '/api/', '/purchase'))
                or path in ('/payment-demo', '/tools.config.json')):
            response.headers['X-Robots-Tag'] = 'noindex, nofollow'
        return response
