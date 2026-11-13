"""P0 India-focused tools: catalogue, routes, assets and vendor wiring."""
import html as html_lib
import re
import unittest
from xml.etree.ElementTree import fromstring

import app as module
import seo


P0_SLUGS = (
    "gst-calculator",
    "income-tax-calculator",
    "plot-area-calculator",
    "stamp-duty-calculator",
    "construction-material-calculator",
    "qr-code-generator",
)


class P0ToolTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        module.app.config.update(TESTING=True)
        cls.client = module.app.test_client()
        cls.catalog = module.load_tool_catalog()
        cls.tools = {item["slug"]: item for item in cls.catalog["tools"]}

    def test_catalogue_registers_every_p0_tool(self):
        self.assertEqual(len(self.catalog["tools"]), 125)
        for slug in P0_SLUGS:
            self.assertIn(slug, self.tools)
            self.assertTrue(self.tools[slug]["description"])
            self.assertIn(self.tools[slug]["category"], self.catalog["categories"])
        self.assertEqual(self.tools["gst-calculator"]["category"], "Financial Calculators")
        self.assertEqual(self.tools["income-tax-calculator"]["category"], "Financial Calculators")
        self.assertEqual(self.tools["plot-area-calculator"]["category"], "Land & Property")
        self.assertEqual(self.tools["stamp-duty-calculator"]["category"], "Land & Property")
        self.assertEqual(self.tools["construction-material-calculator"]["category"], "Calculators")
        self.assertEqual(self.tools["qr-code-generator"]["category"], "Text Tools")
        self.assertEqual(self.tools["qr-code-generator"]["vendor"], ["qrcodegen"])

    def test_every_p0_page_renders_with_self_hosted_assets(self):
        for slug in P0_SLUGS:
            response = self.client.get(f"/tools/{slug}")
            self.assertEqual(response.status_code, 200, slug)
            html = response.get_data(as_text=True)
            self.assertIn(f'data-tool-slug="{slug}"', html)
            self.assertIn("<h1>", html)
            self.assertIn("/assets/css/tools.css?v=3", html)
            self.assertIn("script-src 'self'", response.headers["Content-Security-Policy"])
            self.assertNotIn("noindex", response.headers.get("X-Robots-Tag", ""))

    def test_calculator_pages_load_the_shared_math_engine(self):
        for slug in P0_SLUGS[:-1]:
            html = self.client.get(f"/tools/{slug}").get_data(as_text=True)
            self.assertIn("/assets/js/tools/calc-math.js?v=1", html)
            self.assertIn("/assets/js/tools/calculators.js?v=3", html)
        qr = self.client.get("/tools/qr-code-generator").get_data(as_text=True)
        self.assertNotIn("calc-math.js", qr)
        self.assertIn("/assets/js/tools/misc.js?v=2", qr)
        self.assertIn("/assets/vendor/qrcodegen.js?v=1", qr)
        self.assertIn("qrcodegen", module.TOOL_VENDORS)

    def test_p0_business_logic_and_copy_are_shipped(self):
        calculators = self.client.get("/assets/js/tools/calculators.js").get_data(as_text=True)
        for slug in P0_SLUGS[:-1]:
            self.assertIn(f'slug: "{slug}"', calculators)
        self.assertIn("FY 2026-27", calculators)
        self.assertIn("GST 2.0", calculators)
        self.assertIn("Heron's formula", calculators)
        self.assertIn("Last reviewed", calculators)
        self.assertIn("https://www.incometaxindia.gov.in/documents/81799/11848482/memo-2026.pdf", calculators)
        self.assertIn("https://courier.cbic.gov.in/ECCS/advisory/2025/NOTIFICATION%20NO.%209_2025-INTEGRATED%20TAX%20(RATE)%20-1759486719.pdf", calculators)
        self.assertIn("https://www.indiacode.nic.in/handle/123456789/15510?locale=en", calculators)
        misc = self.client.get("/assets/js/tools/misc.js").get_data(as_text=True)
        self.assertIn('T.register("qr-code-generator"', misc)
        self.assertIn("WIFI:T:", misc)
        self.assertIn("upi://pay?", misc)
        math = self.client.get("/assets/js/tools/calc-math.js").get_data(as_text=True)
        self.assertIn("const incomeTax", math)
        self.assertIn("const construction", math)

    def test_p0_assets_are_served(self):
        paths = (
            "/assets/js/tools/calc-math.js",
            "/assets/js/tools/calculators.js",
            "/assets/js/tools/misc.js",
            "/assets/vendor/qrcodegen.js",
            "/assets/css/tools.css",
        )
        for path in paths:
            response = self.client.get(path)
            self.assertEqual(response.status_code, 200, path)
            self.assertGreater(len(response.data), 500, path)
        css = self.client.get("/assets/css/tools.css").get_data(as_text=True)
        self.assertIn(".qr-preview", css)
        self.assertIn(".qr-canvas", css)

    def test_p0_tools_appear_on_hub_and_sitemap(self):
        hub = self.client.get("/tools").get_data(as_text=True)
        home = self.client.get("/").get_data(as_text=True)
        sitemap = fromstring(self.client.get("/sitemap.xml").data)
        locations = [node.text for node in sitemap.iter("{http://www.sitemaps.org/schemas/sitemap/0.9}loc")]
        for slug in P0_SLUGS:
            self.assertIn(f'href="/tools/{slug}"', hub)
            self.assertIn(f'href="/tools/{slug}"', home)
            self.assertIn(f"https://sanuwartools.online/tools/{slug}", locations)

    def test_p0_pages_have_single_h1_and_generic_metadata(self):
        for slug in P0_SLUGS:
            html = self.client.get(f"/tools/{slug}").get_data(as_text=True)
            self.assertEqual(len(re.findall(r"<h1[ >]", html)), 1, slug)
            self.assertIn(f'rel="canonical" href="https://sanuwartools.online/tools/{slug}"', html)
            self.assertIn('property="og:site_name" content="SanuwarTools"', html)
            self.assertIn(f'<title>{html_lib.escape(seo.TOOL_SEO[slug][0])}</title>', html)
            self.assertIn(f'<meta name="description" content="{html_lib.escape(seo.TOOL_SEO[slug][1], quote=True)}">', html)


if __name__ == "__main__":
    unittest.main()
