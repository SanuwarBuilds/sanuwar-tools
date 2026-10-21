import base64,hashlib,json,tempfile,unittest
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from cryptography.hazmat.primitives import hashes,serialization
from cryptography.hazmat.primitives.asymmetric import ec
from sqlalchemy import select
from licensing import LicenseStore,LicenseError,proof_message,licenses,OFFLINE_SECONDS

class LicensingTest(unittest.TestCase):
 def setUp(self):
  self.directory=tempfile.TemporaryDirectory();self.addCleanup(self.directory.cleanup);self.now=1800000000
  self.server=ec.generate_private_key(ec.SECP256R1());self.device=ec.generate_private_key(ec.SECP256R1())
  self.store=LicenseStore('sqlite:///'+str(Path(self.directory.name)/'licenses.db'),self.server,now=lambda:self.now);self.store.initialize()
  self.code=self.store.create(9,'Customer A')[0]['code']
 def lease(self,action='activate',key=None,**extra):
  key=key or self.device;nonce='a'*43
  identity=hashlib.sha256(extra.get('code',self.code).encode()).hexdigest() if action=='activate' else extra['licenseId']
  body={'nonce':nonce,'signature':base64.b64encode(key.sign(proof_message(action,identity,nonce),ec.ECDSA(hashes.SHA256()))).decode(),**extra}
  if action=='activate':body.update(code=extra.get('code',self.code),devicePublicKey=base64.b64encode(key.public_key().public_bytes(serialization.Encoding.DER,serialization.PublicFormat.SubjectPublicKeyInfo)).decode())
  out=self.store.issue(action,body);raw=base64.b64decode(out['payload'])
  self.server.public_key().verify(base64.b64decode(out['signature']),raw,ec.ECDSA(hashes.SHA256()))
  return json.loads(raw)
 def test_custom_days_first_activation_and_twenty_four_hour_cap(self):
  self.now+=100000;p=self.lease();self.assertEqual(p['expiresAt'],self.now+9*86400);self.assertEqual(p['offlineUntil'],self.now+86400);self.assertEqual(OFFLINE_SECONDS,86400)
 def test_repeat_activation_does_not_restart_expiry(self):
  first=self.lease();self.now+=86400;self.assertEqual(first['expiresAt'],self.lease()['expiresAt'])
 def test_independent_bulk_codes(self):
  codes=self.store.create(17,'Batch',3);self.assertEqual(len({x['code'] for x in codes}),3)
  for item in codes:self.assertEqual(self.lease(key=ec.generate_private_key(ec.SECP256R1()),code=item['code'])['expiresAt'],self.now+17*86400)
 def test_second_phone_rejected(self):
  self.lease()
  with self.assertRaises(LicenseError) as ctx:self.lease(key=ec.generate_private_key(ec.SECP256R1()))
  self.assertEqual(ctx.exception.code,'DEVICE_BOUND')
 def test_blocked_device_attempt_is_durable_without_changing_original_access(self):
  first=self.lease();other=ec.generate_private_key(ec.SECP256R1())
  for step in [0,20]:
   self.now+=step
   with self.assertRaises(LicenseError) as ctx:self.lease(key=other)
   self.assertEqual(ctx.exception.code,'DEVICE_BOUND')
  # A new store/connection must see events even though the activation raised.
  independent=LicenseStore(str(self.store.engine.url),self.server,now=lambda:self.now)
  row=independent.list()[0]
  self.assertEqual(row['device_attempt_count'],2)
  self.assertEqual(row['last_device_attempt_at'],self.now)
  self.assertEqual(row['expires_at'],first['expiresAt'])
  self.assertFalse(row['revoked'])
  self.assertEqual(self.lease('refresh',licenseId=first['licenseId'])['expiresAt'],first['expiresAt'])
 def test_same_phone_and_separate_codes_do_not_raise_device_alerts(self):
  self.lease();self.lease()
  fresh=self.store.create(7,'Other')[0]['code']
  self.lease(key=ec.generate_private_key(ec.SECP256R1()),code=fresh)
  for row in self.store.list():
   self.assertEqual(row['device_attempt_count'],0)
   self.assertIsNone(row['last_device_attempt_at'])
 def test_invalid_signature_does_not_create_false_device_alert(self):
  self.lease();public_key=ec.generate_private_key(ec.SECP256R1());signing_key=ec.generate_private_key(ec.SECP256R1())
  nonce='b'*43
  body={'code':self.code,'nonce':nonce,'devicePublicKey':base64.b64encode(public_key.public_key().public_bytes(serialization.Encoding.DER,serialization.PublicFormat.SubjectPublicKeyInfo)).decode(),
   'signature':base64.b64encode(signing_key.sign(proof_message('activate',hashlib.sha256(self.code.encode()).hexdigest(),nonce),ec.ECDSA(hashes.SHA256()))).decode()}
  with self.assertRaises(LicenseError) as ctx:self.store.issue('activate',body)
  self.assertEqual(ctx.exception.code,'INVALID_PROOF')
  self.assertEqual(self.store.list()[0]['device_attempt_count'],0)
 def test_atomic_concurrent_binding(self):
  def claim(_):
   try:return self.lease(key=ec.generate_private_key(ec.SECP256R1()))['licenseId']
   except LicenseError:return None
  with ThreadPoolExecutor(max_workers=2) as pool:results=list(pool.map(claim,range(2)))
  self.assertEqual(sum(x is not None for x in results),1)
 def test_refresh_requires_device_proof(self):
  identity=self.lease()['licenseId']
  with self.assertRaises(LicenseError) as ctx:self.lease('refresh',licenseId=identity,key=ec.generate_private_key(ec.SECP256R1()))
  self.assertEqual(ctx.exception.code,'INVALID_PROOF')
 def test_revocation_and_restore(self):
  identity=self.lease()['licenseId'];self.store.change(identity,'revoke')
  for action,args in [('activate',{}),('refresh',{'licenseId':identity})]:
   with self.assertRaises(LicenseError) as ctx:self.lease(action,**args)
   self.assertEqual(ctx.exception.code,'REVOKED')
  self.store.change(identity,'renew',2);self.lease('refresh',licenseId=identity)
 def test_renew_active_and_expired(self):
  p=self.lease();self.store.change(p['licenseId'],'renew',3);q=self.lease('refresh',licenseId=p['licenseId']);self.assertEqual(q['expiresAt'],p['expiresAt']+3*86400)
  self.now=q['expiresAt']+2
  with self.assertRaises(LicenseError):self.lease('refresh',licenseId=p['licenseId'])
  self.store.change(p['licenseId'],'renew',2);self.assertEqual(self.lease('refresh',licenseId=p['licenseId'])['expiresAt'],self.now+2*86400)
 def test_expiry_caps_offline_window(self):
  p=self.lease();self.now=p['expiresAt']-10;self.assertEqual(self.lease('refresh',licenseId=p['licenseId'])['offlineUntil'],p['expiresAt']);self.now+=10
  with self.assertRaises(LicenseError):self.lease('refresh',licenseId=p['licenseId'])
 def test_codes_private_hashed_only(self):
  rows=self.store.list();self.assertNotIn('code_hash',rows[0]);self.assertNotIn('device_key',rows[0])
  with self.store.engine.connect() as c:row=c.execute(select(licenses)).mappings().first()
  self.assertEqual(row['code_hash'],hashlib.sha256(self.code.encode()).hexdigest());self.assertNotIn(self.code,str(row))
 def test_invalid_days_and_bulk(self):
  for days in [0,-1,True,1.5,3651,'7']:
   with self.assertRaises(LicenseError):self.store.create(days)
  with self.assertRaises(LicenseError):self.store.create(7,count=101)
 def test_unactivated_renewal(self):
  identity=self.store.list()[0]['id'];self.store.change(identity,'renew',6);self.now+=50000;self.assertEqual(self.lease()['expiresAt'],self.now+15*86400)
 def test_durable_rate_limit(self):
  for _ in range(120):self.store.rate_limit('actor')
  with self.assertRaises(LicenseError):self.store.rate_limit('actor')
  self.now+=3600;self.store.rate_limit('actor')
 def test_sqlite_not_for_production(self):
  with self.assertRaises(RuntimeError):LicenseStore('sqlite://',self.server,production=True)

if __name__=='__main__':unittest.main()
