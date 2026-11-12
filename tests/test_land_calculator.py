"""Land measurement calculator: route, catalogue, assets and search metadata."""
import json
import re
import unittest
from xml.etree.ElementTree import fromstring
import app as module
import seo


class LandCalculatorTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        module.app.config.update(TESTING=True)
        cls.client = module.app.test_client()
        cls.response = cls.client.get('/tools/land-measurement-calculator')
        cls.html = cls.response.get_data(as_text=True)

    def test_catalogue_registers_land_tool(self):
        self.assertIn('land', module.TOOL_BUNDLES)
        self.assertEqual(module.TOOL_CATEGORY_ICONS['Land & Property'], 'convert')
        catalog = module.load_tool_catalog()
        tool = next(item for item in catalog['tools'] if item['slug'] == 'land-measurement-calculator')
        self.assertEqual(tool['bundle'], 'land')
        self.assertEqual(tool['category'], 'Land & Property')
        self.assertEqual(tool['icon_file'], 'convert')
        self.assertIn('Land & Property', catalog['categories'])

    def test_page_renders_calculator_shell(self):
        self.assertEqual(self.response.status_code, 200)
        self.assertEqual(len(re.findall(r'<h1[ >]', self.html)), 1)
        self.assertIn('<h1>Indian Land Measurement Calculator</h1>', self.html)
        for asset in ('core.js?v=1', 'land-data.js?v=1', 'land-engine.js?v=1',
                      'land-i18n.js?v=1', 'land.js?v=1', 'land.css?v=1', 'tools.css?v=2'):
            self.assertIn(asset, self.html)
        self.assertIn('data-tool-slug="land-measurement-calculator"', self.html)
        self.assertIn('id="tool-root"', self.html)
        self.assertIn('Brahmaputra Valley', self.html)
        self.assertIn('Lessa', self.html)

    def test_static_content_and_disclaimers(self):
        self.assertIn('Land measurement in India', self.html)
        self.assertIn('not a legal survey', self.html)
        self.assertIn('Common questions', self.html)
        i18n = self.client.get('/assets/js/tools/land-i18n.js').get_data(as_text=True)
        self.assertIn('ज़रूरी सूचना', i18n)
        self.assertIn('গুৰুত্বপূৰ্ণ', i18n)
        self.assertIn('ভূমি মাপ', i18n)

    def test_search_metadata_and_structured_data(self):
        self.assertIn('<title>Land Measurement Calculator — Bigha, Katha, Lessa | SanuwarTools</title>', self.html)
        self.assertIn('<meta name="robots" content="index, follow, max-image-preview:large">', self.html)
        self.assertIn('rel="canonical" href="https://sanuwartools.online/tools/land-measurement-calculator"', self.html)
        script = re.search(r'<script[^>]*type="application/ld\+json">(.*?)</script>', self.html, re.S).group(1)
        data = json.loads(script)
        nodes = {node.get('@type'): node for node in data['@graph']}
        self.assertIn('WebApplication', nodes)
        self.assertIn('FAQPage', nodes)
        self.assertIn('BreadcrumbList', nodes)
        app_node = nodes['WebApplication']
        self.assertEqual(app_node['applicationCategory'], 'BusinessApplication')
        self.assertEqual(app_node['name'], 'Indian Land Measurement Calculator')
        self.assertTrue(any('Bigha' in feature for feature in app_node['featureList']))
        self.assertEqual(len(nodes['FAQPage']['mainEntity']), len(seo.LAND_FAQS))
        for node, (question, answer) in zip(nodes['FAQPage']['mainEntity'], seo.LAND_FAQS):
            self.assertEqual(node['name'], question)
            self.assertEqual(node['acceptedAnswer']['text'], answer)
            self.assertIn(question, self.html)
            self.assertIn(answer, self.html)
        crumbs = nodes['BreadcrumbList']['itemListElement']
        self.assertEqual(crumbs[-1]['name'], 'Land Measurement Calculator')

    def test_assets_are_served(self):
        for path in ('/assets/js/tools/land-data.js', '/assets/js/tools/land-engine.js',
                     '/assets/js/tools/land-i18n.js', '/assets/js/tools/land.js',
                     '/assets/css/land.css'):
            response = self.client.get(path)
            self.assertEqual(response.status_code, 200, path)
            self.assertGreater(len(response.data), 500, path)

    def test_hub_and_sitemap_include_tool(self):
        hub = self.client.get('/tools').get_data(as_text=True)
        self.assertIn('Indian Land Measurement Calculator', hub)
        sitemap = self.client.get('/sitemap.xml')
        self.assertEqual(sitemap.status_code, 200)
        locations = [node.text for node in fromstring(sitemap.data).iter('{http://www.sitemaps.org/schemas/sitemap/0.9}loc')]
        self.assertIn('https://sanuwartools.online/tools/land-measurement-calculator', locations)

    def test_unknown_tool_still_returns_404(self):
        self.assertEqual(self.client.get('/tools/not-a-real-tool').status_code, 404)


if __name__ == '__main__':
    unittest.main()
