"""Publication state must be shared across serverless instances, not /tmp copies."""
import base64
import copy
import json
import os
import unittest
from unittest.mock import Mock, patch
import requests
import app as module
from flask import g
from werkzeug.exceptions import ServiceUnavailable

class CataloguePersistenceTests(unittest.TestCase):
    def setUp(self):
        self.env=patch.dict(os.environ,{'GITHUB_USER':'test-owner','GITHUB_PAT':'test-only-token','GITHUB_REPO':'test-repo'})
        self.env.start()
        self.vercel=patch.object(module,'IS_VERCEL',True); self.vercel.start()

    def tearDown(self):
        patch.stopall()

    def response(self, enabled, sha):
        response=Mock()
        response.json.return_value={'sha':sha,'content':base64.b64encode(json.dumps([{'id':'one','enabled':enabled}]).encode()).decode()}
        return response

    def test_each_request_reads_latest_remote_publication_and_copies_cached_records(self):
        with patch.object(requests,'get',side_effect=[self.response(True,'old'),self.response(False,'new')]) as get:
            with module.app.test_request_context('/'):
                first=module.safe_read(module.DOWNLOADS_REL)
                first.clear()
                self.assertEqual(len(module.safe_read(module.DOWNLOADS_REL)),1)
                self.assertEqual(g.catalogue_revisions[module.DOWNLOADS_REL],'old')
            with module.app.test_request_context('/'):
                self.assertIs(module.safe_read(module.DOWNLOADS_REL)[0]['enabled'],False)
                self.assertEqual(g.catalogue_revisions[module.DOWNLOADS_REL],'new')
            self.assertEqual(get.call_count,2)

    def test_remote_failure_does_not_fall_back_to_stale_enabled_content(self):
        with module.app.test_request_context('/api/downloads_data'), patch.object(requests,'get',side_effect=requests.Timeout), patch.object(module,'get_writable_path') as local:
            with self.assertRaises(ServiceUnavailable):module.safe_read(module.DOWNLOADS_REL)
            local.assert_not_called()

    def test_write_uses_revision_read_before_mutation(self):
        with module.app.test_request_context('/api/admin/content/downloads/one/availability'), patch.object(requests,'get',return_value=self.response(True,'read-revision')) as get, patch.object(requests,'put',return_value=Mock()) as put:
            data=module.safe_read(module.DOWNLOADS_REL)
            data[0]['enabled']=False
            module.github_push(module.DOWNLOADS_REL,json.dumps(data))
            self.assertEqual(get.call_count,1)
            self.assertEqual(put.call_args.kwargs['json']['sha'],'read-revision')

    def test_concurrent_remote_write_failure_is_not_acknowledged(self):
        failed=Mock();failed.raise_for_status.side_effect=requests.HTTPError('Conflict')
        with module.app.test_request_context('/'), patch.object(requests,'put',return_value=failed):
            g.catalogue_revisions={module.DOWNLOADS_REL:'old-revision'}
            with self.assertRaises(RuntimeError):module.github_push(module.DOWNLOADS_REL,'[]')
