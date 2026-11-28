import os
import unittest
from unittest.mock import Mock, patch

import app as module


class EduHelpDoubtTests(unittest.TestCase):
    def setUp(self):
        self.client = module.app.test_client()
        self.headers = {'X-CSRF-Token': 'doubt-test-token'}
        with self.client.session_transaction() as session:
            session['csrf_token'] = self.headers['X-CSRF-Token']

    @patch.dict(os.environ, {'CLOUDFLARE_ACCOUNT_ID': '', 'CLOUDFLARE_API_TOKEN': ''})
    def test_notes_remain_available_without_ai_credentials(self):
        page = self.client.get('/eduhelp/doubts?grade=10&topic=Electricity')
        self.assertEqual(page.status_code, 200)
        self.assertIn(b'Download PDF', page.data)
        self.assertIn(b'data-ai-ready="false"', page.data)
        disabled = self.client.post('/api/eduhelp/doubts', json={}, headers=self.headers)
        self.assertEqual(disabled.status_code, 503)

    @patch.dict(os.environ, {'CLOUDFLARE_ACCOUNT_ID': '1' * 32, 'CLOUDFLARE_API_TOKEN': 'test-server-token'})
    @patch('eduhelp_ai.requests.post')
    def test_question_proxy_keeps_credentials_server_side_and_passes_language_context(self, upstream):
        upstream.return_value = Mock(status_code=200, ok=True)
        upstream.return_value.json.return_value = {'success': True, 'result': {
            'choices': [{'message': {'content': 'ওমৰ সূত্ৰ: V = IR'}}]}}
        request = {'prompt': 'ওমৰ সূত্ৰ কি?', 'language': 'as', 'mode': 'ask', 'grade': 10, 'topic': 'Electricity',
                   'history': [{'question': 'What is voltage?', 'answer': 'Potential difference.'}]}
        self.assertNotIn(b'test-server-token', self.client.get('/eduhelp/doubts').data)
        self.assertEqual(self.client.post('/api/eduhelp/doubts', json=request).status_code, 403)
        res = self.client.post('/api/eduhelp/doubts', json=request, headers=self.headers)
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json, {'answer': 'ওমৰ সূত্ৰ: V = IR'})
        sent = upstream.call_args.kwargs
        self.assertEqual(sent['headers']['Authorization'], 'Bearer test-server-token')
        self.assertFalse(sent['allow_redirects'])
        messages = sent['json']['messages']
        self.assertIn('Class 10', messages[0]['content'])
        self.assertIn('Assamese', messages[0]['content'])
        self.assertIn('Study chapter: Electricity', messages[-1]['content'])
        self.assertEqual([msg['role'] for msg in messages], ['system', 'user', 'assistant', 'user'])

        upstream.return_value.status_code = 429
        limit = self.client.post('/api/eduhelp/doubts', json=request, headers=self.headers)
        self.assertEqual(limit.status_code, 429)
        self.assertNotIn('test-server-token', limit.get_data(as_text=True))
