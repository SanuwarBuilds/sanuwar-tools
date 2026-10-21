import os,tempfile,unittest
from pathlib import Path
from cryptography.hazmat.primitives.asymmetric import ec
from licensing import LicenseStore

class LicenseRoutesTest(unittest.TestCase):
 def setUp(self):
  os.environ['SECRET_KEY']='test-secret-not-a-production-key-0000000000'
  import app as module
  self.app=module.app;self.app.testing=True
  self.temp=tempfile.TemporaryDirectory();self.addCleanup(self.temp.cleanup)
  s=LicenseStore('sqlite:///'+str(Path(self.temp.name)/'db.sqlite'),ec.generate_private_key(ec.SECP256R1()));s.initialize()
  self.app.config['LICENSE_STORE']=s;self.client=self.app.test_client()
 def authenticate(self):
  with self.client.session_transaction() as sess:sess.update(admin_logged_in=True,csrf_token='test-csrf')
 def test_admin_requires_session_and_csrf(self):
  self.assertEqual(self.client.get('/api/admin/licenses').status_code,401)
  self.authenticate();self.assertEqual(self.client.post('/api/admin/licenses',json={'days':7}).status_code,403)
  self.assertEqual(self.client.post('/api/admin/licenses',json={'days':12,'count':2},headers={'X-CSRF-Token':'test-csrf'}).status_code,201)
 def test_machine_endpoint_not_broad_csrf_bypass(self):
  r=self.client.post('/api/license/activate',json={});self.assertEqual(r.status_code,400)
  r=self.client.post('/api/license/activate',json={},headers={'Origin':'https://evil.invalid'});self.assertEqual(r.status_code,403)
  self.assertEqual(self.client.post('/api/add_item',json={'title':'x'}).status_code,403)
  self.assertEqual(self.client.post('/api/license/anything',json={}).status_code,403)
 def test_small_native_json_and_safe_errors(self):
  self.assertEqual(self.client.post('/api/license/refresh',data='x'*9000,content_type='application/json').status_code,400)
  self.assertEqual(self.client.post('/api/license/refresh',json=[]).status_code,400)
 def test_panel_render_and_no_license_codes_in_list(self):
  self.authenticate();self.assertEqual(self.client.get('/admin/licenses').status_code,200)
  self.client.post('/api/admin/licenses',json={'days':21,'label':'<script>alert(1)</script>'},headers={'X-CSRF-Token':'test-csrf'})
  out=self.client.get('/api/admin/licenses');self.assertEqual(out.status_code,200);self.assertNotIn('code_hash',out.json['licenses'][0]);self.assertNotIn('device_key',out.json['licenses'][0]);self.assertEqual(out.json['licenses'][0]['device_attempt_count'],0)
 def tearDown(self):self.app.config.pop('LICENSE_STORE',None)

if __name__=='__main__':unittest.main()
