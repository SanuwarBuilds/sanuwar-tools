"""Real JWT signature tests plus visitor/admin, origin, nonce and CSRF boundaries."""
import base64
import copy
import json
import os
import time
import unittest
from types import SimpleNamespace
from unittest.mock import patch
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding, rsa
import app as module
import security
import user_auth

CLIENT='1234567890-testing.apps.googleusercontent.com'
ORIGIN='https://sanuwartools.online'


def b64(data):
    return base64.urlsafe_b64encode(data).rstrip(b'=')


class VisitorSignInTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.key=rsa.generate_private_key(public_exponent=65537,key_size=2048)
        cls.public=cls.key.public_key().public_bytes(serialization.Encoding.PEM,serialization.PublicFormat.SubjectPublicKeyInfo).decode()

    def setUp(self):
        self.env=patch.dict(os.environ,{'GOOGLE_CLIENT_ID':CLIENT,'SECRET_KEY':'s'*48})
        self.env.start()
        self.records={module.TOOLS_CONFIG_REL:{'site':{},'tools':[],'categories':[],'downloadPage':{'enabled':True}},module.DOWNLOADS_REL:[]}
        self.read=patch.object(module,'safe_read',side_effect=lambda path:copy.deepcopy(self.records.get(path)))
        self.read.start()
        self.certs=patch.object(user_auth,'google_request',return_value=SimpleNamespace(status=200,data=json.dumps({'test-key':self.public}).encode()))
        self.certs.start()
        with security._lock:security._attempts.clear()
        self.client=module.app.test_client()

    def tearDown(self):
        self.env.stop();self.read.stop();self.certs.stop()
        with security._lock:security._attempts.clear()

    def start(self):
        response=self.client.get('/signin',base_url=ORIGIN)
        self.assertEqual(response.status_code,200)
        with self.client.session_transaction(base_url=ORIGIN) as session:
            return session['google_challenge']['nonce'],session['csrf_token']

    def jwt(self,challenge_nonce,**overrides):
        claims={'iss':'https://accounts.google.com','sub':'google-unique-sub','aud':CLIENT,
                'iat':int(time.time())-5,'exp':int(time.time())+300,'nonce':challenge_nonce,
                'email':'visitor@example.com','email_verified':True,'name':'Test Visitor'}
        claims.update(overrides)
        body=b'.'.join([b64(json.dumps({'alg':'RS256','kid':'test-key'}).encode()),b64(json.dumps(claims).encode())])
        return (body+b'.'+b64(self.key.sign(body,padding.PKCS1v15(),hashes.SHA256()))).decode()

    def post(self,credential,csrf,origin=ORIGIN):
        return self.client.post('/api/auth/google',base_url=ORIGIN,json={'credential':credential},headers={'X-CSRF-Token':csrf,'Origin':origin})

    def test_verified_google_identity_signs_in_without_admin_privileges(self):
        nonce,csrf=self.start()
        response=self.post(self.jwt(nonce),csrf)
        self.assertEqual(response.status_code,200,response.json)
        with self.client.session_transaction(base_url=ORIGIN) as session:
            self.assertEqual(session['visitor']['id'],'google-unique-sub')
            self.assertNotIn('admin_logged_in',session)
            self.assertNotIn('google_challenge',session)
            self.assertNotIn('credential',session)
            self.assertNotEqual(session['csrf_token'],csrf)
        account=self.client.get('/account',base_url=ORIGIN)
        self.assertIn(b'visitor@example.com',account.data)
        self.assertEqual(account.headers['Cache-Control'],'no-store')
        self.assertEqual(account.headers['X-Robots-Tag'],'noindex, nofollow')
        self.assertEqual(self.client.get('/api/admin/downloads').status_code,401)
        self.assertEqual(self.post(self.jwt(nonce),csrf).status_code,403)

    def test_rejects_invalid_signature_audience_issuer_expiry_email_and_nonce(self):
        cases=[{'aud':'different-client'},{'iss':'https://attacker.example'},{'exp':int(time.time())-60},
               {'email_verified':False},{'email_verified':'true'},{'nonce':'different-nonce'}, {'sub':''},{'azp':'another-client'}]
        for override in cases:
            with self.subTest(override=override):
                nonce,csrf=self.start()
                self.assertEqual(self.post(self.jwt(nonce,**override),csrf).status_code,401)
                with self.client.session_transaction(base_url=ORIGIN) as session:self.assertNotIn('visitor',session)
        nonce,csrf=self.start()
        token=self.jwt(nonce).split('.')
        token[2]=b64(b'forged-signature').decode()
        self.assertEqual(self.post('.'.join(token),csrf).status_code,401)

    def test_origin_csrf_and_expired_or_missing_challenge_are_required(self):
        nonce,csrf=self.start()
        token=self.jwt(nonce)
        self.assertEqual(self.post(token,'').status_code,403)
        self.assertEqual(self.post(token,csrf,'https://attacker.example').status_code,403)
        self.assertEqual(self.client.post('/api/auth/google',base_url=ORIGIN,json={'credential':token},headers={'X-CSRF-Token':csrf}).status_code,403)
        with self.client.session_transaction(base_url=ORIGIN) as session:
            session['google_challenge']={**session['google_challenge'],'created':time.time()-601}
        self.assertEqual(self.post(token,csrf).status_code,401)
        self.assertEqual(self.post(token,csrf).status_code,401)

    def test_logout_requires_csrf_and_does_not_change_admin_session(self):
        nonce,csrf=self.start()
        self.assertEqual(self.post(self.jwt(nonce),csrf).status_code,200)
        with self.client.session_transaction(base_url=ORIGIN) as session:
            csrf=session['csrf_token'];session['admin_logged_in']=True
        self.assertEqual(self.client.post('/api/auth/logout',json={}).status_code,403)
        response=self.client.post('/api/auth/logout',base_url=ORIGIN,json={},headers={'X-CSRF-Token':csrf,'Origin':ORIGIN})
        self.assertEqual(response.status_code,200)
        with self.client.session_transaction(base_url=ORIGIN) as session:
            self.assertNotIn('visitor',session)
            self.assertTrue(session['admin_logged_in'])
        self.assertEqual(self.client.get('/account').status_code,302)

    def test_missing_configuration_fails_closed_and_private_routes_have_no_ads(self):
        for config in ('','bad-client'):
            with patch.dict(os.environ,{'GOOGLE_CLIENT_ID':config}):
                nonce,csrf=self.start()
                self.assertNotIn(b'accounts.google.com/gsi/client',self.client.get('/signin').data)
                self.assertEqual(self.post(self.jwt(nonce),csrf).status_code,503)
        with patch.dict(os.environ,{'SECRET_KEY':'short','FLASK_SECRET_KEY':''}):
            self.assertFalse(user_auth.configured())
        for path in ('/signin','/account'):
            response=self.client.get(path,base_url=ORIGIN)
            self.assertNotIn(b'adsbygoogle.js',response.data)
            self.assertEqual(response.headers['X-Robots-Tag'],'noindex, nofollow')

    def test_google_resources_only_allowed_on_signin_and_public_html_does_not_expose_email(self):
        signin=self.client.get('/signin',base_url=ORIGIN)
        self.assertIn('https://accounts.google.com/gsi/client',signin.headers['Content-Security-Policy'])
        self.assertEqual(signin.headers['Cross-Origin-Opener-Policy'],'same-origin-allow-popups')
        self.assertNotIn('accounts.google.com',self.client.get('/admin/login').headers['Content-Security-Policy'])
        nonce,csrf=self.start();self.post(self.jwt(nonce,name='<script>alert(1)</script>'),csrf)
        self.assertNotIn(b'<script>alert(1)</script>',self.client.get('/account',base_url=ORIGIN).data)
        home=self.client.get('/',base_url=ORIGIN).data
        self.assertNotIn(b'visitor@example.com',home)
        self.assertIn(b'href="/account"',home)
