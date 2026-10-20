"""Private, transactional remote-app licensing. Public download JSON is never a license store."""
import base64
import hashlib
import json
import os
import re
import secrets
import time
import uuid
from functools import lru_cache

from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.exceptions import InvalidSignature
from flask import Blueprint, jsonify, request, render_template
from sqlalchemy import (create_engine, MetaData, Table, Column, String, Text, Integer,
                        BigInteger, Boolean, select, insert, update, delete, and_)
from sqlalchemy.pool import NullPool

OFFLINE_SECONDS = 5 * 60 * 60
meta = MetaData()
licenses = Table('remote_licenses_v1', meta,
    Column('id', String(36), primary_key=True), Column('code_hash', String(64), unique=True, nullable=False),
    Column('label', String(100), nullable=False), Column('duration_days', Integer, nullable=False),
    Column('created_at', BigInteger, nullable=False), Column('activated_at', BigInteger),
    Column('expires_at', BigInteger), Column('device_key', Text),
    Column('revoked', Boolean, nullable=False, default=False), Column('last_seen', BigInteger),
    Column('revision', Integer, nullable=False, default=1))
audit = Table('remote_license_audit_v1', meta,
    Column('id', String(36), primary_key=True), Column('license_id', String(36), nullable=False),
    Column('event', String(24), nullable=False), Column('at', BigInteger, nullable=False))
limits = Table('remote_license_limits_v1', meta,
    Column('key', String(64), primary_key=True), Column('bucket', BigInteger, nullable=False),
    Column('count', Integer, nullable=False))

class LicenseError(Exception):
    def __init__(self, code, message, status=403):
        self.code, self.message, self.status = code, message, status


def normalize_code(code):
    if not isinstance(code, str): raise LicenseError('INVALID_CODE', 'Enter a valid activation code.', 400)
    code = code.strip().upper().replace('-', '').replace(' ', '')
    if not re.fullmatch(r'LR[A-Z2-7]{32}', code):
        raise LicenseError('INVALID_CODE', 'Enter a valid activation code.', 400)
    return code


def digest(value): return hashlib.sha256(value.encode()).hexdigest()
def b64(data): return base64.b64encode(data).decode('ascii')
def unb64(value, limit=2048):
    if not isinstance(value, str) or len(value) > limit: raise ValueError('Invalid encoding')
    return base64.b64decode(value, validate=True)


def proof_message(action, identity, nonce):
    return f'LR-{action.upper()}-1\n{identity}\n{nonce}'.encode('utf-8')


class LicenseStore:
    def __init__(self, url, signer, now=lambda: int(time.time()), production=False):
        if url.startswith('postgres://'): url = 'postgresql+psycopg://' + url[len('postgres://'):]
        if url.startswith('postgresql://'): url = 'postgresql+psycopg://' + url[len('postgresql://'):]
        if production and not url.startswith('postgresql+psycopg://'):
            raise RuntimeError('Production licensing requires a private PostgreSQL database')
        self.engine = create_engine(url, poolclass=NullPool, echo=False, hide_parameters=True)
        self.signer, self.now = signer, now
        if not isinstance(signer, ec.EllipticCurvePrivateKey) or signer.curve.name != 'secp256r1':
            raise RuntimeError('A P-256 signing key is required')

    def initialize(self): meta.create_all(self.engine)

    def event(self, connection, identity, event):
        connection.execute(insert(audit).values(id=str(uuid.uuid4()), license_id=identity, event=event, at=self.now()))

    @staticmethod
    def days(value):
        if type(value) is not int or not 1 <= value <= 3650:
            raise LicenseError('INVALID_DAYS', 'Choose a whole number from 1 to 3650 days.', 400)
        return value

    def create(self, days, label='', count=1):
        days = self.days(days)
        if type(count) is not int or not 1 <= count <= 100:
            raise LicenseError('INVALID_COUNT', 'Create between 1 and 100 codes at once.', 400)
        if not isinstance(label, str) or len(label) > 100: raise LicenseError('INVALID_LABEL', 'Label is too long.', 400)
        result=[]
        with self.engine.begin() as c:
            for _ in range(count):
                raw='LR'+base64.b32encode(secrets.token_bytes(20)).decode()
                identity=str(uuid.uuid4())
                c.execute(insert(licenses).values(id=identity, code_hash=digest(raw), label=label.strip(),
                    duration_days=days, created_at=self.now(), revoked=False, revision=1))
                self.event(c, identity, 'created')
                result.append({'id':identity,'code':raw,'days':days,'label':label.strip()})
        return result # Codes shown once; only their cryptographic hashes persist.

    def list(self):
        fields=[col for col in licenses.c if col.name not in ('code_hash','device_key')]
        with self.engine.connect() as c:
            rows=c.execute(select(*fields, licenses.c.device_key.is_not(None).label('bound')).order_by(licenses.c.created_at.desc()).limit(500)).mappings()
            return [dict(row) for row in rows]

    def change(self, identity, action, days=None):
        if action not in ('renew','revoke'): raise LicenseError('INVALID_ACTION','Choose renew or revoke.',400)
        if action=='renew': days=self.days(days)
        with self.engine.begin() as c:
            row=c.execute(select(licenses).where(licenses.c.id==identity).with_for_update()).mappings().first()
            if not row: raise LicenseError('NOT_FOUND','License not found.',404)
            values={'revision':row['revision']+1}
            if action=='revoke': values['revoked']=True
            elif row['activated_at'] is None:
                values.update(duration_days=row['duration_days']+days, revoked=False)
            else:
                values.update(expires_at=max(self.now(), row['expires_at'])+days*86400, revoked=False)
            # CAS is also effective on SQLite, where FOR UPDATE is not implemented.
            done=c.execute(update(licenses).where(and_(licenses.c.id==identity,licenses.c.revision==row['revision'])).values(**values))
            if done.rowcount!=1: raise LicenseError('RETRY','License changed; retry.',409)
            self.event(c,identity,action)

    def rate_limit(self, actor):
        now=self.now(); bucket=now//3600; key=digest(actor+':'+str(bucket))
        with self.engine.begin() as c:
            # PostgreSQL and SQLite both support atomic conflict-aware insertion.
            if self.engine.dialect.name=='postgresql':
                from sqlalchemy.dialects.postgresql import insert as upsert
            else:
                from sqlalchemy.dialects.sqlite import insert as upsert
            q=upsert(limits).values(key=key,bucket=bucket,count=1)
            c.execute(q.on_conflict_do_update(index_elements=['key'],set_={'count':limits.c.count+1}))
            count=c.execute(select(limits.c.count).where(limits.c.key==key)).scalar_one()
            c.execute(delete(limits).where(limits.c.bucket<bucket-24))
        if count>120: raise LicenseError('RATE_LIMITED','Too many requests. Please try again later.',429)

    def issue(self, action, data):
        if action not in ('activate','refresh'): raise LicenseError('INVALID_ACTION','Invalid operation.',400)
        try:
            nonce=data['nonce']
            if not isinstance(nonce,str) or not re.fullmatch(r'[A-Za-z0-9_-]{32,80}',nonce): raise ValueError()
            signature=unb64(data['signature'],256)
            identity=digest(normalize_code(data.get('code'))) if action=='activate' else str(uuid.UUID(data['licenseId']))
            supplied=None
            if action=='activate':
                supplied=unb64(data['devicePublicKey'],1024)
                public=serialization.load_der_public_key(supplied)
                if not isinstance(public,ec.EllipticCurvePublicKey) or public.curve.name!='secp256r1': raise ValueError()
        except (KeyError,ValueError,TypeError): raise LicenseError('INVALID_REQUEST','Invalid activation request.',400)
        with self.engine.begin() as c:
            condition=licenses.c.code_hash==identity if action=='activate' else licenses.c.id==identity
            row=c.execute(select(licenses).where(condition).with_for_update()).mappings().first()
            if not row: raise LicenseError('INVALID_LICENSE','License was not found.',403)
            stored=row['device_key']
            if action=='refresh':
                if not stored: raise LicenseError('NOT_ACTIVATED','Activate this device first.')
                public=serialization.load_der_public_key(unb64(stored))
            try: public.verify(signature, proof_message(action,identity,nonce),ec.ECDSA(hashes.SHA256()))
            except (InvalidSignature,ValueError): raise LicenseError('INVALID_PROOF','Device verification failed.')
            if action=='activate' and stored and stored!=b64(supplied):
                raise LicenseError('DEVICE_BOUND','This code is already activated on another phone.')
            if row['revoked']: raise LicenseError('REVOKED','Access revoked. Contact admin.')
            now=self.now(); activated=row['activated_at']; expires=row['expires_at']
            if activated is None:
                activated=now; expires=now+row['duration_days']*86400
            if expires<=now: raise LicenseError('EXPIRED','Access expired. Contact admin.')
            values={'activated_at':activated,'expires_at':expires,'last_seen':now}
            if action=='activate': values['device_key']=b64(supplied)
            # Binding is atomic: racing first activations cannot both claim one code.
            claim=and_(condition, licenses.c.revision==row['revision'])
            claim=and_(claim, licenses.c.device_key.is_(None) if stored is None else licenses.c.device_key==stored)
            done=c.execute(update(licenses).where(claim).values(**values))
            if done.rowcount!=1: raise LicenseError('RETRY','Activation changed. Please retry.',409)
            if row['activated_at'] is None: self.event(c,row['id'],'activated')
            key=values.get('device_key',stored)
            payload={'v':1,'licenseId':row['id'],'deviceKeySha256':hashlib.sha256(unb64(key)).hexdigest(),
                     'activatedAt':activated,'expiresAt':expires,'serverTime':now,
                     'offlineUntil':min(expires,now+OFFLINE_SECONDS),'requestNonce':nonce,'revision':row['revision']}
            encoded=json.dumps(payload,separators=(',',':'),sort_keys=True).encode()
            return {'payload':b64(encoded),'signature':b64(self.signer.sign(encoded,ec.ECDSA(hashes.SHA256())))}


@lru_cache(maxsize=1)
def configured_store():
    url=os.getenv('LICENSE_DATABASE_URL') or os.getenv('LICENSE_DATABASE_DATABASE_URL') or os.getenv('POSTGRES_URL') or os.getenv('DATABASE_URL')
    pem=os.getenv('LICENSE_SIGNING_KEY_PEM','').replace('\\n','\n')
    if not url or not pem: raise RuntimeError('License database/signing key not configured')
    signer=serialization.load_pem_private_key(pem.encode(),password=None)
    return LicenseStore(url,signer,production=bool(os.getenv('VERCEL')))


def install(app, login_required):
    bp=Blueprint('licenses',__name__)
    @bp.errorhandler(LicenseError)
    def domain_error(e): return jsonify(error=e.message,code=e.code),e.status

    def store():
        try: return app.config.get('LICENSE_STORE') or configured_store()
        except Exception:
            raise LicenseError('NOT_CONFIGURED','License service is not configured. Contact admin.',503)

    @bp.route('/admin/licenses')
    @login_required
    def panel(): return render_template('licenses.html')

    @bp.route('/api/admin/licenses',methods=['GET','POST'])
    @login_required
    def admin_licenses():
        s=store()
        if request.method=='GET': return jsonify(licenses=s.list())
        data=request.get_json()
        return jsonify(created=s.create(data.get('days'),data.get('label',''),data.get('count',1))),201

    @bp.route('/api/admin/licenses/initialize',methods=['POST'])
    @login_required
    def initialize_database():
        store().initialize()
        return jsonify(success=True)

    @bp.route('/api/admin/licenses/<identity>',methods=['POST'])
    @login_required
    def change_license(identity):
        data=request.get_json();store().change(identity,data.get('action'),data.get('days'))
        return jsonify(success=True)

    @bp.route('/api/license/<action>',methods=['POST'])
    def license_client(action):
        if action not in ('activate','refresh'): raise LicenseError('NOT_FOUND','Unknown endpoint.',404)
        if request.content_length is None or request.content_length>8192 or not request.is_json:
            raise LicenseError('INVALID_REQUEST','Send a small JSON request.',400)
        data=request.get_json(silent=True)
        if not isinstance(data,dict): raise LicenseError('INVALID_REQUEST','JSON object required.',400)
        s=store();s.rate_limit(request.remote_addr or 'unknown')
        return jsonify(s.issue(action,data))

    @bp.errorhandler(Exception)
    def service_error(e):
        # Never return DB connection URLs, license codes or private key details.
        app.logger.error('License service failure: %s',type(e).__name__)
        return jsonify(error='License service unavailable. Please try again.',code='SERVICE_UNAVAILABLE'),503
    app.register_blueprint(bp)
