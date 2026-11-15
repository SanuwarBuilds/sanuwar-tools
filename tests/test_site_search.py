import unittest
from unittest.mock import patch
from site_search import build_index, ADMIN_VIEWS
from app import app
import app as module

class SiteSearchTests(unittest.TestCase):
    def setUp(self):
        self.config = {'tools': [
            {'name': 'Photo Tools', 'id': 'builtin-photo-tools', 'tags': ['crop']},
            {'name': 'External tool', 'siteUrl': 'https://example.com/tool'},
            {'name': 'Hidden tool', 'route': '/hidden', 'visible': False},
            {'name': 'Bad URL', 'route': '//evil.example'},
            {'name': 'Bad script', 'route': 'javascript:alert(1)'},
        ]}
        self.downloads = [
            {'id': 'paid', 'title': 'Physics album', 'is_album': True, 'price': 50,
             'asset': {'secret': 'PRIVATE'}, 'album_files': [
                 {'name': 'Electricity notes.pdf', 'link': 'https://private.example/SECRET'},
                 {'name': 'hidden-file.pdf', 'visible': False}]},
            {'id': 'hidden', 'title': 'Hidden download', 'enabled': False},
        ]
        self.directory = {'categories': [{'name': 'Music', 'slug': 'music', 'groups': [
            {'name': 'Sources', 'sites': [{'name': 'Music source', 'url': 'https://example.com'}]}]}]}
        self.edu = {'updates': [{'title': 'Exam result', 'summary': 'Physics', 'enabled': True},
                                {'title': 'Hidden notice', 'enabled': False}]}

    def index(self, admin=False):
        return build_index(self.config, {'tools': [{'name': 'QR Code', 'slug': 'qr-code'}]},
                           self.downloads, self.directory, self.edu, admin)

    def test_all_content_types_and_safe_delivery(self):
        entries = self.index()
        names = [item['name'] for item in entries]
        for name in ('Photo Tools', 'External tool', 'QR Code', 'Physics album',
                     'Electricity notes.pdf', 'Music source', 'Exam result', 'Admin'):
            self.assertIn(name, names)
        for name in ('Hidden tool', 'Bad URL', 'Bad script', 'Hidden download', 'Hidden notice', 'hidden-file.pdf'):
            self.assertNotIn(name, names)
        self.assertNotIn('SECRET', str(entries))
        self.assertNotIn('PRIVATE', str(entries))
        file = next(item for item in entries if item['category'] == 'File')
        self.assertTrue(file['href'].startswith('/downloads?item=paid&file='))
        self.assertFalse(any(item['category'] == 'Admin' for item in entries))

    def test_only_published_widgets_are_searchable(self):
        entries = build_index({}, {}, [], {}, {}, widgets=[
            {'enabled': True, 'data': {'title': 'Weekly poll', 'question': 'Physics?'}},
            {'enabled': False, 'data': {'title': 'Hidden poll'}},
        ])
        names = [entry['name'] for entry in entries]
        self.assertIn('Weekly poll', names)
        self.assertNotIn('Hidden poll', names)

    def test_disabled_download_library_is_absent(self):
        self.config['downloadPage'] = {'enabled': False}
        self.assertFalse(any(e['category'] in ('File', 'Download', 'Album') or e['href'] == '/downloads' for e in self.index()))

    def test_admin_sections_require_authenticated_session_and_feed_is_private(self):
        with patch.object(module, 'safe_read', return_value=self.config), \
             patch.object(module, 'load_tool_catalog', return_value={'tools': []}), \
             patch.object(module, 'public_downloads', return_value=self.downloads), \
             patch.object(module, 'load_directory', return_value=self.directory), \
             patch.object(module, 'load_eduhelp', return_value=self.edu):
            client = app.test_client()
            response = client.get('/api/search-index')
            self.assertEqual(response.status_code, 200)
            self.assertTrue(response.cache_control.no_store)
            self.assertFalse(any(e['category'] == 'Admin' for e in response.json['entries']))
            self.assertEqual(client.get('/admin').status_code, 302)
            with client.session_transaction() as session:
                session['admin_logged_in'] = True
            entries = client.get('/api/search-index').json['entries']
            for view in ADMIN_VIEWS:
                self.assertTrue(any(e['href'] == '/admin#' + view for e in entries))
