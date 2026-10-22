"""YouPI checkout and private digital delivery. Browser callbacks never grant access."""
import copy
import hashlib
import hmac
import json
import os
import re
import secrets
import time
import uuid
from decimal import Decimal, InvalidOperation
from functools import lru_cache
from urllib.parse import urlsplit

import requests
import cloudinary.utils
from flask import Blueprint, jsonify, request, render_template, current_app
from sqlalchemy import (create_engine, MetaData, Table, Column, String, Text, Integer,
                        BigInteger, select, insert, update)
from sqlalchemy.exc import IntegrityError
from sqlalchemy.pool import NullPool

meta = MetaData()
orders = Table('download_orders_v1', meta,
    Column('id', String(36), primary_key=True), Column('item_id', String(100), nullable=False),
    Column('title', Text, nullable=False), Column('amount', Integer, nullable=False),
    Column('receipt_hash', String(64), nullable=False), Column('assets', Text, nullable=False),
    Column('status', String(24), nullable=False), Column('payment_id', String(100), unique=True),
    Column('checkout_url', Text), Column('created_at', BigInteger, nullable=False),
    Column('paid_at', BigInteger), Column('utr', String(100), unique=True))

class PaymentError(Exception):
    def __init__(self, message, status=400): self.message, self.status = message, status


def digest(value): return hashlib.sha256(value.encode()).hexdigest()

def money(value):
    if isinstance(value, bool): raise ValueError('Price must be an INR amount')
    try:
        amount = Decimal(str(value))
        if not amount.is_finite() or amount < 0 or amount > 100000 or amount.as_tuple().exponent < -2:
            raise ValueError('Use an INR amount between 0 and 100000, with at most two decimals')
        return int(amount * 100)
    except (InvalidOperation, TypeError):
        raise ValueError('Enter a valid INR amount')


def pricing(data, previous=None):
    value = data.get('pricing', (previous or {}).get('pricing', {}))
    if not isinstance(value, dict): raise ValueError('Invalid pricing')
    mode = value.get('mode', 'free')
    if mode not in ('free', 'paid'): raise ValueError('Choose Free or Paid')
    price = money(value.get('price', 0))
    discount = money(value.get('discount', 0))
    if mode == 'paid' and (price < 100 or price - discount < 100):
        raise ValueError('Paid downloads need a final price of at least ₹1. Choose Free for free access.')
    if discount > price: raise ValueError('Discount cannot exceed price')
    return {'mode': mode, 'price': f'{price/100:.2f}', 'discount': f'{discount/100:.2f}'}


def quote(item):
    p = pricing(item)
    amount = money(p['price']) - money(p['discount']) if p['mode'] == 'paid' else 0
    return {**p, 'amount_paise': amount, 'currency': 'INR', 'payable': f'{amount/100:.2f}'}


def private_asset(asset):
    if not isinstance(asset, dict) or asset.get('type') != 'authenticated': return False
    return (asset.get('resource_type') in ('image', 'video', 'raw')
            and isinstance(asset.get('public_id'), str) and 0 < len(asset['public_id']) <= 500
            and isinstance(asset.get('format', ''), str) and len(asset.get('format', '')) <= 20)


def protect_item(item):
    """Reject public-hosted paid originals. All album files inherit the album price."""
    item['pricing'] = pricing(item)
    files = item.get('album_files', []) if item.get('is_album') else [item]
    if item['pricing']['mode'] == 'paid':
        if not files or any(not private_asset(f.get('asset')) for f in files):
            raise ValueError('Paid files must be uploaded again with Paid selected, using private upload. Public download links cannot be sold securely.')
        # The upload delivery URLs can contain permanent signatures: never persist them.
        item['link'] = ''
        for f in files: f['link'] = ''
    # A free item with a private asset still uses our delivery endpoint.
    return item


def public_item(item):
    p = quote(item)
    result = {key: copy.deepcopy(item.get(key)) for key in (
        'id', 'title', 'description', 'category', 'image', 'version', 'is_album',
        'created_at', 'updated_at', 'uploaded_at', 'is_new') if key in item}
    result.update(pricing=p, locked=p['mode'] == 'paid')
    result['link'] = '' if result['locked'] or private_asset(item.get('asset')) else item.get('link', '')
    result['private_delivery'] = private_asset(item.get('asset'))
    result['album_files'] = []
    for index, f in enumerate(item.get('album_files', [])):
        entry = {key: f[key] for key in ('name', 'added_at', 'uploaded_at', 'size') if key in f}
        entry.update(index=index, private_delivery=private_asset(f.get('asset')))
        entry['link'] = '' if result['locked'] or entry['private_delivery'] else f.get('link', '')
        result['album_files'].append(entry)
    return result


class PaymentStore:
    def __init__(self, url, production=False):
        if url.startswith('postgres://'): url = 'postgresql+psycopg://' + url[len('postgres://'):]
        if url.startswith('postgresql://'): url = 'postgresql+psycopg://' + url[len('postgresql://'):]
        if production and not url.startswith('postgresql+psycopg://'):
            raise RuntimeError('Payments require private PostgreSQL storage on Vercel')
        self.engine = create_engine(url, poolclass=NullPool, hide_parameters=True)

    def initialize(self): meta.create_all(self.engine)

    def create(self, item, token):
        identity = str(uuid.uuid4())
        files = item.get('album_files', []) if item.get('is_album') else [item]
        snapshot = [{'name': f.get('name') or item['title'], 'asset': f['asset']} for f in files]
        with self.engine.begin() as c:
            c.execute(insert(orders).values(id=identity, item_id=item['id'], title=item['title'],
                amount=quote(item)['amount_paise'], receipt_hash=digest(token), assets=json.dumps(snapshot),
                status='PENDING', created_at=int(time.time())))
        return identity

    def get(self, identity, token=None):
        with self.engine.connect() as c:
            row = c.execute(select(orders).where(orders.c.id == identity)).mappings().first()
        if not row or (token is not None and not hmac.compare_digest(row['receipt_hash'], digest(token))):
            raise PaymentError('Purchase not found. Use the browser where you started payment.', 404)
        return dict(row)

    def bind(self, identity, payment_id, checkout_url):
        with self.engine.begin() as c:
            c.execute(update(orders).where(orders.c.id == identity, orders.c.payment_id.is_(None))
                      .values(payment_id=payment_id, checkout_url=checkout_url))

    def confirm(self, payload):
        # All checks are inside the transaction; row locking serializes duplicate/reordered deliveries.
        try:
            with self.engine.begin() as c:
                row = c.execute(select(orders).where(orders.c.id == payload.get('orderId')).with_for_update()).mappings().first()
                if not row: raise PaymentError('Unknown order', 404)
                if payload.get('paymentId') != row['payment_id'] or not row['payment_id']:
                    raise PaymentError('Payment ID does not match', 409)
                if (payload.get('currency') != 'INR' or type(payload.get('amountPaise')) is not int
                        or payload['amountPaise'] != row['amount'] or money(payload.get('amount')) != row['amount']):
                    raise PaymentError('Payment amount does not match', 409)
                if payload.get('event') != 'SUCCESS' or payload.get('method') != 'UPI':
                    if payload.get('event') in ('FAILED', 'EXPIRED', 'CANCELLED') and row['status'] != 'PAID':
                        c.execute(update(orders).where(orders.c.id == row['id']).values(status=payload['event']))
                    return  # COD/counter and failure events never unlock files or undo a paid order.
                if type(payload.get('verificationLevel')) is not int or payload['verificationLevel'] not in (1, 2):
                    raise PaymentError('Gateway bank observation is not verified', 409)
                utr = payload.get('utr')
                if not isinstance(utr, str) or not re.fullmatch(r'[A-Za-z0-9-]{6,100}', utr):
                    raise PaymentError('A bank reference is required', 409)
                if row['status'] == 'PAID':
                    if row['utr'] != utr: raise PaymentError('Bank reference does not match', 409)
                    return
                c.execute(update(orders).where(orders.c.id == row['id']).values(
                    status='PAID', paid_at=int(time.time()), utr=utr))
        except IntegrityError:
            raise PaymentError('Bank reference already belongs to another payment', 409)

    def recent(self):
        with self.engine.connect() as c:
            return [dict(r) for r in c.execute(select(orders.c.id, orders.c.title, orders.c.amount,
                orders.c.status, orders.c.created_at, orders.c.paid_at, orders.c.utr)
                .order_by(orders.c.created_at.desc()).limit(100)).mappings()]


@lru_cache(maxsize=4)
def _store(url, production):
    store = PaymentStore(url, production); store.initialize(); return store


def get_store():
    url = os.getenv('PAYMENTS_DATABASE_URL', '')
    if not url: raise PaymentError('Payment storage setup pending hai. Abhi payment mat karo.', 503)
    return _store(url, bool(os.getenv('VERCEL')))


def settings():
    def https_url(name):
        value = os.getenv(name, '').rstrip('/')
        p = urlsplit(value)
        return value if p.scheme == 'https' and p.hostname and not p.username and not p.password and not p.query and not p.fragment else ''
    return {'api': https_url('YOUPI_API_URL'), 'checkout': https_url('YOUPI_CHECKOUT_URL'),
            'site': https_url('PAYMENTS_SITE_URL'), 'merchant': os.getenv('YOUPI_MERCHANT_ID', ''),
            'secret': os.getenv('YOUPI_WEBHOOK_SECRET', '')}


def readiness():
    s = settings()
    checks = {
        'gateway_urls': bool(s['api'] and s['checkout']), 'merchant_id': bool(s['merchant']),
        'webhook_secret': len(s['secret']) >= 32, 'site_url': bool(s['site']),
        'private_database': bool(os.getenv('PAYMENTS_DATABASE_URL')),
        'session_secret': len(os.getenv('SECRET_KEY', '') or os.getenv('FLASK_SECRET_KEY', '')) >= 32,
        'private_uploads': all(os.getenv(k) for k in ('CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET')),
        'payments_enabled': os.getenv('PAYMENTS_ENABLED') == '1',
    }
    if os.getenv('VERCEL') and not os.getenv('PAYMENTS_DATABASE_URL', '').startswith(('postgres://','postgresql://','postgresql+psycopg://')):
        checks['private_database'] = False
    return {'ready': all(checks.values()), 'checks': checks}


def signed_download(asset):
    if not private_asset(asset): raise PaymentError('Private file unavailable', 404)
    return cloudinary.utils.private_download_url(asset['public_id'], asset.get('format', ''),
        resource_type=asset['resource_type'], type='authenticated', attachment=True,
        expires_at=int(time.time()) + 60)


def register(app, load_downloads, login_required):
    bp = Blueprint('payments', __name__)

    @bp.errorhandler(PaymentError)
    def error(e): return jsonify(error=e.message), e.status

    @bp.errorhandler(Exception)
    def unavailable(e):
        current_app.logger.error('Payment operation unavailable: %s', type(e).__name__)
        return jsonify(error='Payment service unavailable. Retry later; payment dobara mat karo.'), 503

    def item_for(identity):
        item = next((i for i in load_downloads() if i['id'] == identity), None)
        if not item: raise PaymentError('Download not found', 404)
        return item

    def bearer():
        value = request.headers.get('Authorization', '')
        if not value.startswith('Bearer ') or not 30 <= len(value[7:]) <= 200:
            raise PaymentError('Purchase receipt required', 401)
        return value[7:]

    @bp.get('/purchases', defaults={'identity': ''})
    @bp.get('/purchase/<identity>')
    def purchase(identity): return render_template('purchase.html', order_id=identity)

    @bp.post('/api/payments/orders')
    def create_order():
        item = item_for((request.get_json() or {}).get('item_id'))
        if not readiness()['ready']: raise PaymentError('Payment setup pending hai. Abhi checkout available nahi hai.', 503)
        from security import limited
        if limited(('purchase', request.remote_addr), maximum=10, window=600):
            raise PaymentError('Please wait before starting another payment.', 429)
        if quote(item)['mode'] != 'paid': raise PaymentError('This download is free')
        protect_item(copy.deepcopy(item))
        token = secrets.token_urlsafe(32)
        store = get_store(); identity = store.create(item, token)
        s = settings()
        # Persist the local order before creating the gateway session. No secrets sent to the browser.
        try:
            response = requests.post(s['api'] + '/api/v1/payments',
                headers={'X-Merchant-Id': s['merchant'], 'Idempotency-Key': identity},
                json={'orderId': identity, 'amount': quote(item)['payable'], 'currency': 'INR',
                      'returnUrl': s['site'] + '/purchase/' + identity,
                      'metadata': {'downloadOrderId': identity}}, timeout=(5, 20), allow_redirects=False)
            response.raise_for_status(); gateway = response.json()
            checkout = gateway.get('checkoutUrl', '')
            parsed = urlsplit(checkout)
            if (gateway.get('orderId') != identity or gateway.get('currency') != 'INR'
                    or str(gateway.get('amountPaise')) != str(quote(item)['amount_paise'])
                    or not re.fullmatch(r'[A-Za-z0-9-]{1,100}', gateway.get('paymentId', ''))
                    or parsed.scheme != 'https' or parsed.netloc != urlsplit(s['checkout']).netloc
                    or not parsed.path.startswith('/checkout/') or parsed.username or parsed.password):
                raise PaymentError('Gateway returned an invalid payment session', 502)
            store.bind(identity, gateway['paymentId'], checkout)
        except requests.RequestException:
            raise PaymentError('Checkout start nahi hua. Koi payment request complete nahi hui; thodi der baad try karo.', 502)
        return jsonify(order_id=identity, receipt=token, checkout_url=checkout)

    @bp.post('/api/payments/webhook')
    def webhook():
        s = settings(); raw = request.get_data(cache=True)
        if len(s['secret']) < 32: raise PaymentError('Webhook configuration pending', 503)
        if len(raw) > 65536: raise PaymentError('Payload too large', 413)
        expected = 'sha256=' + hmac.new(s['secret'].encode(), raw, hashlib.sha256).hexdigest()
        if not hmac.compare_digest(expected, request.headers.get('X-Gateway-Signature', '')):
            raise PaymentError('Invalid signature', 401)
        try: payload = json.loads(raw)
        except (ValueError, UnicodeDecodeError): raise PaymentError('Invalid JSON')
        if not isinstance(payload, dict): raise PaymentError('Invalid JSON object')
        # The signed payload, not unsigned timestamp/event headers, is authoritative.
        # Replays are safe through order/payment/UTR uniqueness and idempotent state transitions.
        try: get_store().confirm(payload)
        except ValueError: raise PaymentError('Invalid payment amount', 409)
        return jsonify(received=True)

    @bp.get('/api/payments/orders/<identity>')
    def status(identity):
        order = get_store().get(identity, bearer())
        item_for(order['item_id'])
        assets = json.loads(order['assets'])
        return jsonify(order_id=identity, item_id=order['item_id'], title=order['title'], status=order['status'],
            amount_paise=order['amount'], checkout_url=order['checkout_url'] if order['status'] != 'PAID' else None,
            files=[{'index':i,'name':f['name']} for i,f in enumerate(assets)] if order['status'] == 'PAID' else [])

    @bp.post('/api/payments/orders/<identity>/download')
    def deliver(identity):
        order = get_store().get(identity, bearer())
        item_for(order['item_id'])
        if order['status'] != 'PAID': raise PaymentError('Payment verification pending. Files abhi locked hain.', 402)
        index = (request.get_json() or {}).get('index', 0)
        files = json.loads(order['assets'])
        if type(index) is not int or not 0 <= index < len(files): raise PaymentError('File not found', 404)
        return jsonify(url=signed_download(files[index]['asset']), expires_in=60)

    @bp.post('/api/downloads/<identity>/file')
    def free_private(identity):
        item = item_for(identity)
        if quote(item)['mode'] == 'paid': raise PaymentError('Payment required', 402)
        files = item.get('album_files', []) if item.get('is_album') else [item]
        index = (request.get_json() or {}).get('index', 0)
        if type(index) is not int or not 0 <= index < len(files): raise PaymentError('File not found', 404)
        return jsonify(url=signed_download(files[index].get('asset')), expires_in=60)

    @bp.get('/api/admin/payments')
    @login_required
    def admin_payments():
        state = readiness()
        try: recent = get_store().recent() if state['checks']['private_database'] else []
        except Exception:
            state['ready'] = False; state['checks']['database_connection'] = False; recent = []
        return jsonify(**state, orders=recent, webhook_url=settings()['site'] + '/api/payments/webhook' if settings()['site'] else '')

    app.register_blueprint(bp)
