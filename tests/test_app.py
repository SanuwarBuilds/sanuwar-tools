"""Integration checks against isolated data, never production files or services."""
import copy
import io
import os
import unittest
from unittest.mock import patch
from werkzeug.security import generate_password_hash
os.environ.setdefault('ADMIN_USER', 'test-admin')
os.environ.setdefault('ADMIN_PASSWORD', 'integration-test-password')
from app import app
import app as module
import security

class WorkspaceTests(unittest.TestCase):
    def setUp(self):
        self.records = {
            module.TOOLS_CONFIG_REL: {'tools':[{'id':'visible','name':'Visible','siteUrl':'https://example.com','visible':True},{'id':'hidden','name':'Hidden','visible':False}], 'categories':['All','Utility'], 'site':{}, 'downloadPage':{'enabled':True}},
            module.DOWNLOADS_REL: [],
            'data/config.json': {'widgets':[], 'store_apps':[]},
        }
        self.read = patch.object(module,'safe_read',side_effect=lambda path:copy.deepcopy(self.records.get(path)))
        self.write = patch.object(module,'safe_write',side_effect=lambda path,data:self.records.__setitem__(path,copy.deepcopy(data)))
        self.read.start();self.write.start()
        self.uc = patch.object(module.utils,'load_config',side_effect=lambda:copy.deepcopy(self.records['data/config.json']))
        self.us = patch.object(module.utils,'save_config',side_effect=lambda data:self.records.__setitem__('data/config.json',copy.deepcopy(data)))
        self.uc.start();self.us.start()
        self.env = patch.dict(os.environ,{'ADMIN_USER':'test-admin','ADMIN_PASSWORD':'integration-test-password','ADMIN_PASSWORD_HASH':''})
        self.env.start()
        with security._lock: security._attempts.clear()
        app.config.update(TESTING=True)
        self.client=app.test_client()
        self.client.get('/admin/login')
        with self.client.session_transaction() as session: self.token=session['csrf_token']
    def tearDown(self):
        patch.stopall()
    def request(self,path,method='POST',data=None,**kwargs):
        return self.client.open(path,method=method,json=data,headers={'X-CSRF-Token':self.token},**kwargs)
    def login(self):
        response=self.request('/admin/login',data={'username':'test-admin','password':'integration-test-password'})
        self.assertEqual(response.status_code,200)
        with self.client.session_transaction() as session:self.token=session['csrf_token']
    def test_public_pages_render(self):
        for path in ('/','/downloads','/download.html','/admin/login','/payment-demo','/purchases'):
            response=self.client.get(path);self.assertEqual(response.status_code,200,path)
            self.assertNotIn(b'cdn.tailwindcss.com',response.data)
    def test_admin_requires_authentication(self):
        self.assertEqual(self.client.get('/admin').status_code,302)
        for path in ('/api/admin/tools.config','/api/admin/widgets','/api/admin/store-apps'):
            self.assertEqual(self.client.get(path).status_code,401)
    def test_all_management_writes_require_auth(self):
        for path,method,payload in [('/api/tools.config','POST',{'tools':[],'categories':[]}),('/api/add_item','POST',{'title':'Test'}),('/api/update_item','PUT',{'id':'test','title':'Test'}),('/api/delete_item/test','DELETE',{}),('/api/admin/store-apps','POST',{}),('/api/admin/widgets','POST',{'type':'notice'})]:
            self.assertEqual(self.request(path,method,payload).status_code,401,path)
    def test_csrf_required_for_login(self):
        self.assertEqual(self.client.post('/admin/login',json={'username':'admin','password':'admin'}).status_code,403)
    def test_csrf_required_after_login(self):
        self.login();self.assertEqual(self.client.post('/api/tools.config',json={}).status_code,403)
    def test_session_rotates_on_login(self):
        old=self.token;self.login();self.assertNotEqual(old,self.token)
    def test_default_credentials_not_allowed(self):
        with patch.dict(os.environ,{'ADMIN_USER':'admin','ADMIN_PASSWORD':'admin'}):
            self.assertEqual(self.request('/admin/login',data={'username':'admin','password':'admin'}).status_code,503)
    def test_hashed_password_login(self):
        with patch.dict(os.environ,{'ADMIN_PASSWORD_HASH':generate_password_hash('integration-test-password', method='pbkdf2:sha256:600000')}):self.login()
    def test_bruteforce_limited(self):
        for i in range(6):self.assertEqual(self.request('/admin/login',data={'username':'x','password':'x'}).status_code,401)
        response=self.request('/admin/login',data={'username':'x','password':'x'});self.assertEqual(response.status_code,429);self.assertEqual(response.headers['Retry-After'],'900')
    def test_origin_rejected(self):
        response=self.client.post('/admin/login',json={},headers={'X-CSRF-Token':self.token,'Origin':'https://evil.example'});self.assertEqual(response.status_code,403)
    def test_security_headers(self):
        response=self.client.get('/');self.assertEqual(response.headers['X-Frame-Options'],'DENY');self.assertEqual(response.headers['X-Content-Type-Options'],'nosniff');self.assertIn("script-src 'self'",response.headers['Content-Security-Policy']);self.assertIn("object-src 'none'",response.headers['Content-Security-Policy'])
    def test_cookie_flags_and_private_cache(self):
        response=self.client.get('/admin/login');self.assertIn('no-store',response.headers['Cache-Control']);self.assertTrue(app.config['SESSION_COOKIE_HTTPONLY']);self.assertEqual(app.config['SESSION_COOKIE_SAMESITE'],'Lax')
    def test_hidden_tools_only_visible_to_admin(self):
        self.assertEqual(len(self.client.get('/tools.config.json').json['tools']),1);self.login();self.assertEqual(len(self.client.get('/api/admin/tools.config').json['tools']),2)
    def test_invalid_config_schema(self):
        self.login()
        for payload in ([1],{'tools':'bad','categories':[]},{'tools':[{'name':'No ID'}],'categories':[]}):
            self.assertEqual(self.request('/api/tools.config',data=payload).status_code,400)
    def test_unsafe_urls_rejected(self):
        self.login()
        for link in ('javascript:alert(1)','data:text/html,bad','//evil.example','http://evil.example','https://user:pass@evil.example'):
            self.assertEqual(self.request('/api/add_item',data={'title':'Unsafe','link':link}).status_code,400)
    def test_nested_unsafe_url_rejected(self):
        self.login();self.assertEqual(self.request('/api/add_item',data={'title':'Bad album','album_files':[{'name':'Bad','link':'javascript:alert(1)'}]}).status_code,400)
    def test_tools_save(self):
        self.login();data=copy.deepcopy(self.records[module.TOOLS_CONFIG_REL]);data['site']['name']='New name';self.assertEqual(self.request('/api/tools.config',data=data).status_code,200);self.assertEqual(self.records[module.TOOLS_CONFIG_REL]['site']['name'],'New name')
    def test_download_crud(self):
        self.login();response=self.request('/api/add_item',data={'title':'Android app','link':'https://example.com/app.apk'});self.assertEqual(response.status_code,200);item=response.json['item'];self.assertEqual(len(self.client.get('/api/downloads_data').json),1)
        self.assertEqual(self.request('/api/update_item','PUT',{'id':item['id'],'title':'Updated'}).status_code,200);self.assertEqual(self.client.get('/api/downloads_data').json[0]['title'],'Updated');self.assertEqual(self.request('/api/delete_item/'+item['id'],'DELETE',{}).status_code,200);self.assertEqual(self.client.get('/api/downloads_data').json,[])
    def test_browser_empty_delete_removes_download(self):
        self.login()
        item = self.request('/api/add_item', data={'title':'Delete me','link':'https://example.com/file.apk'}).json['item']
        response = self.client.delete('/api/delete_item/'+item['id'], headers={'X-CSRF-Token':self.token})
        self.assertEqual(response.status_code, 200, response.json)
        self.assertEqual(self.records[module.DOWNLOADS_REL], [])
        self.assertEqual(self.client.get('/api/downloads_data').json, [])

    def test_empty_delete_still_requires_csrf_and_admin(self):
        self.assertEqual(self.client.delete('/api/delete_item/test').status_code, 403)
        self.assertEqual(self.client.delete('/api/delete_item/test', headers={'X-CSRF-Token':self.token}).status_code, 401)
        self.login()
        self.assertEqual(self.client.delete('/api/delete_item/test', headers={'X-CSRF-Token':self.token,'Origin':'https://evil.example'}).status_code, 403)

    def test_delete_non_json_body_is_rejected(self):
        self.login()
        response=self.client.delete('/api/delete_item/test',data='bad body',content_type='text/plain',headers={'X-CSRF-Token':self.token})
        self.assertEqual(response.status_code,415)

    def test_album_roundtrip(self):
        self.login();payload={'title':'Album','is_album':True,'album_files':[{'name':'Photo','link':'https://example.com/a.jpg'}]};response=self.request('/api/add_item',data=payload);self.assertEqual(response.status_code,200);self.assertEqual(response.json['item']['album_files'][0]['link'],payload['album_files'][0]['link']);self.assertIn('added_at',response.json['item']['album_files'][0])
    def test_widgets_crud_and_reorder(self):
        self.login();created=[]
        for title in ('One','Two'):
            response=self.request('/api/admin/widgets',data={'type':'notice','data':{'title':title},'enabled':True});self.assertEqual(response.status_code,200);created.append(response.json['widget'])
        ids=[w['id'] for w in created][::-1];self.assertEqual(self.request('/api/admin/widgets/reorder',data={'order':ids}).status_code,200)
        self.assertEqual([w['id'] for w in self.client.get('/api/widgets').json],ids)
        self.assertEqual(self.request('/api/admin/widgets/'+ids[0],'PUT',{'enabled':False}).status_code,200);self.assertEqual(len(self.client.get('/api/widgets').json),1)
        self.assertEqual(self.request('/api/admin/widgets/'+ids[0],'DELETE',{}).status_code,200)
    def test_store_crud(self):
        self.login();response=self.request('/api/admin/store-apps',data={'title':'App','link':'https://example.com/a.apk'});self.assertEqual(response.status_code,200);item_id=response.json['app']['id'];self.assertEqual(self.request('/api/admin/store-apps/'+item_id,'PUT',{'title':'New'}).status_code,200);self.assertEqual(self.client.get('/api/admin/store-apps').json[0]['title'],'New');self.assertEqual(self.request('/api/admin/store-apps/'+item_id,'DELETE',{}).status_code,200)
    def test_upload_requires_auth(self):
        self.assertEqual(self.client.post('/api/admin/upload',data={},headers={'X-CSRF-Token':self.token}).status_code,401)
    def test_bad_image_does_not_reach_cloudinary(self):
        self.login()
        with patch.object(module.cloudinary.uploader,'upload') as upload:
            response=self.client.post('/api/admin/upload',data={'image':(io.BytesIO(b'not an image'),'fake.png')},headers={'X-CSRF-Token':self.token});self.assertNotEqual(response.status_code,200);upload.assert_not_called()
    def test_html_upload_rejected(self):
        self.login()
        with patch.object(module.cloudinary.uploader,'upload') as upload:
            response=self.client.post('/api/admin/upload-download-file',data={'file':(io.BytesIO(b'<script>'),'bad.html')},headers={'X-CSRF-Token':self.token});self.assertNotEqual(response.status_code,200);upload.assert_not_called()
    def test_request_size_limited(self):
        self.assertEqual(app.config['MAX_CONTENT_LENGTH'],32*1024*1024)
    def test_logout_post_only(self):
        self.login();self.assertEqual(self.client.get('/admin/logout').status_code,405);self.assertEqual(self.request('/admin/logout',data={}).status_code,302);self.assertEqual(self.client.get('/api/admin/tools.config').status_code,401)
    def test_disabled_download_hub(self):
        self.records[module.TOOLS_CONFIG_REL]['downloadPage']['enabled']=False;self.assertEqual(self.client.get('/downloads').status_code,404)
    def test_poll_can_only_vote_once(self):
        self.records['data/config.json']['widgets']=[{'id':'poll','type':'poll','enabled':True,'order':0,'data':{'options':[{'id':'a','text':'A','votes':0}]}}]
        self.assertEqual(self.request('/api/widgets/poll/vote',data={'option_id':'a'}).status_code,200);self.assertEqual(self.request('/api/widgets/poll/vote',data={'option_id':'a'}).status_code,403)
    def test_disabled_poll_rejects_votes(self):
        self.records['data/config.json']['widgets']=[{'id':'poll','type':'poll','enabled':False,'data':{'options':[]}}];self.assertEqual(self.request('/api/widgets/poll/vote',data={'option_id':'a'}).status_code,404)
    def test_persistence_failure_returns_error(self):
        self.login()
        with patch.object(module,'safe_write',side_effect=RuntimeError('private implementation details')):
            response=self.request('/api/add_item',data={'title':'Test','link':'https://example.com/x'});self.assertEqual(response.status_code,500);self.assertNotIn('private implementation',response.json['error'])

    def test_creation_time_is_server_generated(self):
        self.login()
        response=self.request('/api/add_item',data={'title':'Dated','created_at':'2001-01-01T00:00:00Z'})
        item=response.json['item']
        self.assertNotEqual(item['created_at'],'2001-01-01T00:00:00Z')
        self.assertEqual(item['created_at'],item['updated_at'])
        self.assertTrue(item['created_at'].endswith('+00:00'))
    def test_edit_preserves_original_upload_and_creation_times(self):
        self.login()
        original={'id':'old','title':'Old','link':'https://example.com/a.png','created_at':'2026-01-01T10:00:00+00:00','uploaded_at':'2026-01-01T09:00:00+00:00','album_files':[]}
        self.records[module.DOWNLOADS_REL]=[original]
        response=self.request('/api/update_item','PUT',{'id':'old','title':'Renamed','created_at':'2000-01-01T00:00:00Z'})
        item=response.json['item']
        self.assertEqual(item['created_at'],original['created_at'])
        self.assertEqual(item['uploaded_at'],original['uploaded_at'])
        self.assertIn('updated_at',item)
    def test_legacy_album_dates_stay_unknown_and_new_files_are_dated(self):
        self.login()
        self.records[module.DOWNLOADS_REL]=[{'id':'album','title':'Legacy','is_album':True,'album_files':[{'name':'old.png','link':'https://example.com/old.png'}]}]
        response=self.request('/api/update_item','PUT',{'id':'album','title':'Legacy','album_files':[{'name':'renamed.png','link':'https://example.com/old.png'},{'name':'new.png','link':'https://example.com/new.png','added_at':'2001-01-01T00:00:00Z'}]})
        item=response.json['item']
        self.assertNotIn('created_at',item)
        self.assertNotIn('added_at',item['album_files'][0])
        self.assertNotEqual(item['album_files'][1]['added_at'],'2001-01-01T00:00:00Z')
    def test_new_file_preserves_upload_receipt_timestamp(self):
        self.login()
        timestamp='2026-01-01T09:00:00+00:00'
        response=self.request('/api/add_item',data={'title':'Album','is_album':True,'album_files':[{'name':'a.png','link':'https://example.com/a.png','uploaded_at':timestamp}]})
        self.assertEqual(response.json['item']['album_files'][0]['uploaded_at'],timestamp)
    def test_invalid_upload_timestamp_is_ignored(self):
        self.login()
        response=self.request('/api/add_item',data={'title':'Bad date','uploaded_at':'not-a-date'})
        self.assertNotIn('uploaded_at',response.json['item'])
    def test_upload_endpoint_returns_server_time_and_size(self):
        self.login()
        with patch.object(module,'upload_to_cloudinary',return_value=('https://example.com/file.txt','file.txt')):
            response=self.client.post('/api/admin/upload-download-file',data={'file':(io.BytesIO(b'hello'),'file.txt')},headers={'X-CSRF-Token':self.token})
        self.assertEqual(response.status_code,200)
        self.assertEqual(response.json['size'],5)
        self.assertTrue(response.json['uploaded_at'].endswith('+00:00'))

if __name__=='__main__':unittest.main()
