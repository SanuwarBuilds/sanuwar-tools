"""Isolated payment contract and access tests. No real gateway/bank/Cloudinary calls."""
import copy
import hashlib
import hmac
import io
import json
import os
import tempfile
import unittest
from unittest.mock import patch, Mock

import payments
import app as module
from app import app
import security

ASSET = {'public_id':'sanuwar-tools/paid/photo', 'resource_type':'image', 'format':'jpg','type':'authenticated'}
ITEM = {'id':'paid-album','title':'Premium Album','is_album':True,'image':'https://example.com/cover.jpg',
        'pricing':{'mode':'paid','price':'199.00','discount':'50.00'},
        'album_files':[{'name':'Photo.jpg','asset':ASSET,'link':''},{'name':'Second.jpg','asset':{**ASSET,'public_id':'paid/second'},'link':''}]}

class PaymentTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory()
        self.store=payments.PaymentStore('sqlite:///'+self.tmp.name+'/orders.db');self.store.initialize()
        self.env=patch.dict(os.environ,{'PAYMENTS_ENABLED':'1','PAYMENTS_DATABASE_URL':'sqlite:///'+self.tmp.name+'/orders.db',
            'YOUPI_API_URL':'https://api.example.com','YOUPI_CHECKOUT_URL':'https://pay.example.com',
            'PAYMENTS_SITE_URL':'https://shop.example.com','YOUPI_MERCHANT_ID':'merchant-123',
            'YOUPI_WEBHOOK_SECRET':'s'*64,'SECRET_KEY':'k'*64,'CLOUDINARY_CLOUD_NAME':'test','CLOUDINARY_API_KEY':'test',
            'CLOUDINARY_API_SECRET':'test','ADMIN_USER':'test-admin','ADMIN_PASSWORD':'integration-test-password','ADMIN_PASSWORD_HASH':''})
        self.env.start()
        self.records={module.DOWNLOADS_REL:[copy.deepcopy(ITEM)],module.TOOLS_CONFIG_REL:{}}
        patch.object(module,'safe_read',side_effect=lambda p:copy.deepcopy(self.records.get(p))).start()
        patch.object(module,'safe_write',side_effect=lambda p,d:self.records.__setitem__(p,copy.deepcopy(d))).start()
        patch.object(payments,'get_store',return_value=self.store).start()
        with security._lock:security._attempts.clear()
        self.client=app.test_client();self.client.get('/downloads')
        with self.client.session_transaction() as s:self.csrf=s['csrf_token']

    def tearDown(self):
        patch.stopall();self.store.engine.dispose();self.tmp.cleanup()

    def post(self,path,data,token=None):
        return self.client.post(path,json=data,headers={'X-CSRF-Token':self.csrf,**({'Authorization':'Bearer '+token} if token else {})})

    def order(self):
        def gateway(*args,**kwargs):
            payload=kwargs['json'];response=Mock();response.json.return_value={'orderId':payload['orderId'],
                'paymentId':'gateway-'+payload['orderId'],'currency':'INR','amountPaise':'14900',
                'checkoutUrl':'https://pay.example.com/checkout/'+payload['orderId']};return response
        with patch.object(payments.requests,'post',side_effect=gateway) as call:
            response=self.post('/api/payments/orders',{'item_id':'paid-album','amount':1})
            self.assertEqual(response.status_code,200,response.json)
            self.assertEqual(call.call_args.kwargs['json']['amount'],'149.00')
        return response.json

    def event(self,order,**overrides):
        return {'orderId':order['order_id'],'paymentId':'gateway-'+order['order_id'],'currency':'INR',
                'amount':'149.00','amountPaise':14900,'event':'SUCCESS','method':'UPI','verificationLevel':1,'utr':'123456789012',**overrides}

    def hook(self,payload,secret='s'*64):
        raw=json.dumps(payload,separators=(',',':')).encode()
        signature='sha256='+hmac.new(secret.encode(),raw,hashlib.sha256).hexdigest()
        return self.client.post('/api/payments/webhook',data=raw,content_type='application/json',headers={'X-Gateway-Signature':signature})

    def status(self,order,token=None):
        return self.client.get('/api/payments/orders/'+order['order_id'],headers={'Authorization':'Bearer '+(token or order['receipt'])})

    def test_price_validation(self):
        for value in ('NaN','Infinity','-1','0.001',True,{},'100001'):
            with self.assertRaises(ValueError):payments.money(value)
        with self.assertRaises(ValueError):payments.pricing({'pricing':{'mode':'paid','price':'10','discount':'10'}})
        self.assertEqual(payments.quote(ITEM)['amount_paise'],14900)

    def test_public_catalogue_never_exposes_private_originals(self):
        public=self.client.get('/api/downloads_data');self.assertEqual(public.status_code,200)
        self.assertNotIn(b'public_id',public.data);self.assertNotIn(b'sanuwar-tools/paid',public.data)
        self.assertEqual(public.json[0]['album_files'][0]['name'],'Photo.jpg');self.assertTrue(public.json[0]['locked'])
        self.assertEqual(self.client.get('/api/admin/downloads').status_code,401)

    def test_paid_external_links_rejected(self):
        with self.assertRaises(ValueError):payments.protect_item({'pricing':{'mode':'paid','price':'5'},'link':'https://example.com/a.zip'})

    def test_checkout_amount_is_server_calculated_and_secrets_private(self):
        order=self.order();self.assertNotIn('s'*64,json.dumps(order));self.assertEqual(self.status(order).json['status'],'PENDING')
        self.assertEqual(self.status(order).json['files'],[])

    def test_missing_setup_disables_checkout(self):
        with patch.dict(os.environ,{'PAYMENTS_ENABLED':'0'}):self.assertEqual(self.post('/api/payments/orders',{'item_id':'paid-album'}).status_code,503)

    def test_external_checkout_origin_rejected(self):
        response=Mock();response.json.return_value={'orderId':'bad','checkoutUrl':'https://evil.example/pay'}
        with patch.object(payments.requests,'post',return_value=response):
            self.assertEqual(self.post('/api/payments/orders',{'item_id':'paid-album'}).status_code,502)

    def test_token_is_required_and_wrong_token_cannot_read_or_download(self):
        order=self.order()
        self.assertEqual(self.client.get('/api/payments/orders/'+order['order_id']).status_code,401)
        self.assertEqual(self.status(order,'x'*43).status_code,404)
        self.assertEqual(self.post('/api/payments/orders/'+order['order_id']+'/download',{},'x'*43).status_code,404)

    def test_unpaid_delivery_and_free_route_bypass_denied(self):
        order=self.order()
        self.assertEqual(self.post('/api/payments/orders/'+order['order_id']+'/download',{},order['receipt']).status_code,402)
        self.assertEqual(self.post('/api/downloads/paid-album/file',{}).status_code,402)

    def test_forged_webhook_denied_without_csrf_exemption_bypass(self):
        order=self.order();self.assertEqual(self.hook(self.event(order),secret='wrong').status_code,401)
        self.assertEqual(self.client.post('/api/payments/orders',json={'item_id':'paid-album'}).status_code,403)

    def test_mismatched_amount_currency_or_payment_id_never_unlocks(self):
        order=self.order()
        for fields in ({'amountPaise':1},{'amount':'1.00'},{'currency':'USD'},{'paymentId':'different'},{'utr':''},{'amountPaise':14900.0},{'verificationLevel':0}):
            self.assertEqual(self.hook(self.event(order,**fields)).status_code,409,fields)
            self.assertEqual(self.status(order).json['status'],'PENDING')

    def test_cod_does_not_unlock(self):
        order=self.order();self.assertEqual(self.hook(self.event(order,method='COD')).status_code,200)
        self.assertEqual(self.status(order).json['status'],'PENDING')

    def test_signed_upi_success_unlocks_all_album_files_and_replay_is_safe(self):
        order=self.order();event=self.event(order)
        for _ in range(3):self.assertEqual(self.hook(event).status_code,200)
        result=self.status(order).json;self.assertEqual(result['status'],'PAID');self.assertEqual(len(result['files']),2)
        with patch.object(payments,'signed_download',return_value='https://example.com/short-lived') as signed:
            response=self.post('/api/payments/orders/'+order['order_id']+'/download',{'index':1},order['receipt'])
            self.assertEqual(response.status_code,200);self.assertEqual(signed.call_args.args[0]['public_id'],'paid/second')
            self.assertEqual(self.post('/api/payments/orders/'+order['order_id']+'/download',{'index':-1},order['receipt']).status_code,404)

    def test_utr_cannot_unlock_two_orders(self):
        one=self.order();two=self.order();self.assertEqual(self.hook(self.event(one)).status_code,200)
        self.assertEqual(self.hook(self.event(two)).status_code,409);self.assertEqual(self.status(two).json['status'],'PENDING')

    def test_failure_does_not_undo_paid_and_late_success_can_recover(self):
        order=self.order();self.hook(self.event(order,event='EXPIRED'));self.assertEqual(self.status(order).json['status'],'EXPIRED')
        self.hook(self.event(order));self.hook(self.event(order,event='FAILED'));self.assertEqual(self.status(order).json['status'],'PAID')

    def test_purchase_snapshot_survives_catalogue_price_or_file_change(self):
        order=self.order();self.records[module.DOWNLOADS_REL][0]['album_files']=[]
        self.records[module.DOWNLOADS_REL][0]['pricing']['price']='999'
        self.hook(self.event(order));self.assertEqual(len(self.status(order).json['files']),2)
        self.assertEqual(self.status(order).json['amount_paise'],14900)

    def test_sqlite_is_rejected_in_production(self):
        with self.assertRaises(RuntimeError):payments.PaymentStore('sqlite:////tmp/not-used.db',production=True)

    def test_private_upload_keeps_original_url_out_of_response(self):
        with self.client.session_transaction() as s:s['admin_logged_in']=True
        uploaded={**ASSET,'secure_url':'https://example.com/permanent-signature'}
        with patch.object(module.cloudinary.uploader,'upload',return_value=uploaded) as upload:
            response=self.client.post('/api/admin/upload-download-file',data={'private':'1','file':(io.BytesIO(b'hello'),'demo.txt')},headers={'X-CSRF-Token':self.csrf})
            self.assertEqual(response.status_code,200);self.assertEqual(response.json['url'],'')
            self.assertNotIn(b'permanent-signature',response.data);self.assertEqual(upload.call_args.kwargs['type'],'authenticated')

    def test_paid_album_admin_roundtrip_and_price_change(self):
        with self.client.session_transaction() as s:s['admin_logged_in']=True
        response=self.post('/api/add_item',{**ITEM,'title':'New paid album'})
        self.assertEqual(response.status_code,200,response.json)
        item=response.json['item'];self.assertEqual(item['link'],'');self.assertEqual(item['album_files'][0]['link'],'')
        response=self.client.put('/api/update_item',json={**item,'pricing':{'mode':'free','price':'199','discount':'0'}},headers={'X-CSRF-Token':self.csrf})
        self.assertEqual(response.status_code,200,response.json)
        with patch.object(payments,'signed_download',return_value='https://example.com/private-free'):
            self.assertEqual(self.post('/api/downloads/'+item['id']+'/file',{'index':0}).status_code,200)

    def test_short_lived_url_uses_authenticated_type_and_expiry(self):
        with patch.object(payments.cloudinary.utils,'private_download_url',return_value='signed') as sign:
            self.assertEqual(payments.signed_download(ASSET),'signed');self.assertEqual(sign.call_args.kwargs['type'],'authenticated')
            self.assertTrue(sign.call_args.kwargs['attachment']);self.assertLessEqual(sign.call_args.kwargs['expires_at']-__import__('time').time(),60)
