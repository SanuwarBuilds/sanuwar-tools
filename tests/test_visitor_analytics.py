import copy
import os
import tempfile
import unittest
import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from unittest.mock import patch
from sqlalchemy import select, func
import app as module
import visitor_analytics as analytics

ORIGIN='https://sanuwartools.online'

class VisitorAnalyticsTests(unittest.TestCase):
    def setUp(self):
        self.directory=tempfile.TemporaryDirectory();self.addCleanup(self.directory.cleanup)
        self.clock=[int(datetime(2026,10,26,0,10,tzinfo=analytics.IST).timestamp())]
        self.store=analytics.AnalyticsStore('sqlite:///'+self.directory.name+'/traffic.sqlite',now=lambda:self.clock[0]);self.store.initialize()
        self.previous=module.app.config.get('ANALYTICS_STORE');module.app.config['ANALYTICS_STORE']=self.store
        self.addCleanup(lambda:module.app.config.__setitem__('ANALYTICS_STORE',self.previous))
        self.env=patch.dict(os.environ,{'ANALYTICS_SECRET':'local-test-analytics-key-over-32-characters','ANALYTICS_ENABLED':'1'});self.env.start();self.addCleanup(self.env.stop)
        self.config={'site':{},'tools':[{'id':'tool-public','name':'Useful tool','siteUrl':'https://example.com','enabled':True},{'id':'tool-hidden','enabled':False}],'downloadPage':{'enabled':True}}
        self.downloads=[{'id':'file-public','title':'A useful file','enabled':True,'link':'https://example.com/file.pdf'},{'id':'file-hidden','enabled':False}]
        reader=patch.object(module,'safe_read',side_effect=lambda p:copy.deepcopy(self.config if p==module.TOOLS_CONFIG_REL else self.downloads if p==module.DOWNLOADS_REL else []));reader.start();self.addCleanup(reader.stop)
        self.client=module.app.test_client();self.client.get('/',base_url=ORIGIN)
        with self.client.session_transaction(base_url=ORIGIN) as s:self.csrf=s['csrf_token']
        self.identity=str(uuid.uuid4())

    def event(self,**changes):
        return {'event_id':str(uuid.uuid4()),'visitor_id':self.identity,'kind':'pageview','page':'/','source':'direct','device':'mobile',**changes}

    def post(self,event=None,headers=None):
        return self.client.post('/api/analytics/collect',base_url=ORIGIN,json=event or self.event(),headers={'Origin':ORIGIN,'X-CSRF-Token':self.csrf,'User-Agent':'Mozilla/5.0 Chrome/130',**(headers or {})})

    def admin(self):
        with self.client.session_transaction(base_url=ORIGIN) as s:s['admin_logged_in']=True

    def test_repeat_pageviews_count_once_per_browser_and_events_are_idempotent(self):
        event=self.event();self.assertEqual(self.post(event).status_code,204);self.assertEqual(self.post(event).status_code,204)
        self.post(self.event(page='/downloads'));self.post(self.event(visitor_id=str(uuid.uuid4())))
        data=self.store.summary();self.assertEqual((data['today_views'],data['today_visitors'],data['total_views'],data['total_visitors']),(3,2,3,2))
        with self.store.engine.connect() as c:
            hashes=c.execute(select(analytics.visitors.c.id)).scalars().all()
        self.assertNotIn(self.identity,hashes);self.assertTrue(all(len(value)==64 for value in hashes))
        self.admin();summary=self.client.get('/api/admin/analytics',base_url=ORIGIN)
        self.assertEqual(summary.status_code,200);self.assertNotIn(self.identity,summary.get_data(as_text=True));self.assertNotIn(hashes[0],summary.get_data(as_text=True))

    def test_admin_google_visitor_and_cross_origin_do_not_gain_access(self):
        self.assertEqual(self.client.get('/api/admin/analytics',base_url=ORIGIN).status_code,401)
        with self.client.session_transaction(base_url=ORIGIN) as s:s['visitor']={'id':'google-id','email':'test@example.com','name':'Visitor'}
        self.assertEqual(self.client.get('/api/admin/analytics',base_url=ORIGIN).status_code,401)
        self.assertEqual(self.post(headers={'Origin':'https://evil.example'}).status_code,403)
        self.assertEqual(self.post(headers={'X-CSRF-Token':''}).status_code,403)
        self.assertEqual(self.store.summary()['total_views'],0)
        self.admin();self.assertEqual(self.post().status_code,204);self.assertEqual(self.store.summary()['total_views'],0)
        self.assertNotIn('id="visitor-metrics"',self.client.get('/',base_url=ORIGIN).get_data(as_text=True))

    def test_privacy_optouts_bots_and_private_paths_are_not_measured(self):
        for header in ({'DNT':'1'},{'Sec-GPC':'1'},{'User-Agent':'Googlebot'}):self.assertEqual(self.post(headers=header).status_code,204)
        for page in ('/admin','/signin','/account','/purchase/secret','/?email=private@example.com','/downloads?receipt=secret'):
            self.assertEqual(self.post(self.event(page=page)).status_code,400)
        self.assertEqual(self.post(self.event(email='private@example.com')).status_code,400)
        self.assertEqual(self.store.summary()['total_views'],0)
        for path in ('/signin','/admin/login','/account'):
            self.assertNotIn('id="visitor-metrics"',self.client.get(path,base_url=ORIGIN).get_data(as_text=True))
        privacy=self.client.get('/privacy',base_url=ORIGIN).get_data(as_text=True)
        self.assertIn('id="analytics-optout"',privacy);self.assertIn('keyed hash',privacy)

    def test_only_public_item_ids_are_accepted_and_clicks_are_separate_from_views(self):
        self.assertEqual(self.post(self.event(kind='tool_open',item='tool-public')).status_code,204)
        self.assertEqual(self.post(self.event(kind='download_click',page='/downloads',item='file-public')).status_code,204)
        for kind,item in (('tool_open','tool-hidden'),('download_click','file-hidden'),('download_click','https://example.com/private?token=x')):
            self.assertEqual(self.post(self.event(kind=kind,item=item)).status_code,400)
        self.assertEqual(self.post(self.event(kind='pageview',item='tool-public')).status_code,400)
        self.admin();data=self.client.get('/api/admin/analytics',base_url=ORIGIN).json
        self.assertEqual(data['total_views'],0);self.assertEqual(data['download_clicks'],1)
        self.assertEqual(data['tools'][0]['label'],'Useful tool');self.assertEqual(data['downloads'][0]['label'],'A useful file')
        for value in ('0','31','1000','x'):
            self.assertEqual(self.client.get('/api/admin/analytics?days='+value,base_url=ORIGIN).status_code,400)

    def test_india_midnight_boundary_and_period_uniques(self):
        self.clock[0]-=20*60;self.post(self.event()) # 25 October 23:50 IST
        self.clock[0]+=20*60;self.post(self.event(source='google'))
        data=self.store.summary(7)
        self.assertEqual(data['today_visitors'],1);self.assertEqual(data['today_views'],1)
        self.assertEqual(data['week_visitors'],1);self.assertEqual(data['total_views'],2)
        self.assertEqual(data['series'][-2]['views'],1);self.assertEqual(data['series'][-1]['views'],1)

    def test_concurrent_writes_do_not_lose_counts(self):
        batch=[self.event() for _ in range(24)]
        with ThreadPoolExecutor(max_workers=4) as pool:
            list(pool.map(lambda event:self.store.record(event,'a'*64),batch+batch[:4]))
        data=self.store.summary();self.assertEqual(data['total_views'],24);self.assertEqual(data['total_visitors'],1)

    def test_pruning_preserves_lifetime_totals_and_failure_does_not_break_site(self):
        self.store.record(self.event(),'a'*64);self.clock[0]+=181*86400;self.store.record(self.event(),'b'*64)
        data=self.store.summary();self.assertEqual(data['total_views'],2);self.assertEqual(data['total_visitors'],2);self.assertEqual(data['today_views'],1)
        with self.store.engine.connect() as c:self.assertEqual(c.execute(select(func.count()).select_from(analytics.events)).scalar(),1)
        with patch.object(self.store,'record',side_effect=RuntimeError('secret-db-password')):
            response=self.post();self.assertEqual(response.status_code,503);self.assertNotIn(b'secret-db-password',response.data)
        self.assertEqual(self.client.get('/',base_url=ORIGIN).status_code,200)

    def test_rate_limit_does_not_use_or_modify_authentication_buckets(self):
        import security
        before=copy.deepcopy(dict(security._attempts))
        with patch.object(analytics,'analytics_limited',return_value=True):
            self.assertEqual(self.post().status_code,429)
        self.assertEqual(dict(security._attempts),before)
        self.assertEqual(self.store.summary()['total_views'],0)

    def test_production_rejects_ephemeral_storage_and_disabled_setup_is_honest(self):
        with self.assertRaises(RuntimeError):analytics.AnalyticsStore('sqlite:////tmp/unsafe.sqlite',production=True)
        module.app.config['ANALYTICS_STORE']=None
        with patch.object(analytics,'configured',return_value=False):
            self.assertNotIn('id="visitor-metrics"',self.client.get('/',base_url=ORIGIN).get_data(as_text=True))
            self.admin();self.assertEqual(self.client.get('/api/admin/analytics',base_url=ORIGIN).status_code,503)
