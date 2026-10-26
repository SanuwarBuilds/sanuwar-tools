"""Private first-party analytics. No IPs, URLs, account details or photo data persist."""
import hashlib
import hmac
import os
import re
import time
import threading
from collections import defaultdict, deque
import uuid
from datetime import datetime, timedelta
from functools import lru_cache
from zoneinfo import ZoneInfo
from flask import jsonify, request, session
from sqlalchemy import create_engine, MetaData, Table, Column, String, BigInteger, select, update, delete, func
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.pool import NullPool

IST = ZoneInfo('Asia/Kolkata')
PAGES = {'/': 'Home', '/downloads': 'Downloads', '/download.html': 'Downloads',
         '/photo-tools': 'Photo Tools', '/about': 'About', '/contact': 'Contact', '/privacy': 'Privacy'}
SOURCES = {'direct': 'Direct', 'google': 'Google', 'bing': 'Bing', 'social': 'Social', 'referral': 'Other websites'}
DEVICES = {'mobile': 'Mobile', 'tablet': 'Tablet', 'desktop': 'Desktop'}
KINDS = ('pageview', 'tool_open', 'download_click')
_attempts = defaultdict(deque)
_attempt_lock = threading.Lock()


def analytics_limited(identity):
    # Dedicated buckets: frequent analytics calls must not shorten auth limit windows.
    now = time.monotonic()
    with _attempt_lock:
        for key in list(_attempts):
            while _attempts[key] and _attempts[key][0] <= now-60:
                _attempts[key].popleft()
            if not _attempts[key]: del _attempts[key]
        if len(_attempts['global']) >= 1200 or len(_attempts[identity]) >= 90: return True
        _attempts['global'].append(now); _attempts[identity].append(now)
    return False

meta = MetaData()
events = Table('site_analytics_events_v1', meta,
    Column('id', String(36), primary_key=True), Column('visitor', String(64), nullable=False),
    Column('at', BigInteger, nullable=False), Column('day', String(10), nullable=False, index=True),
    Column('kind', String(20), nullable=False), Column('page', String(30), nullable=False),
    Column('item', String(100), nullable=False), Column('source', String(12), nullable=False),
    Column('device', String(10), nullable=False))
visitors = Table('site_analytics_visitors_v1', meta,
    Column('id', String(64), primary_key=True), Column('last_seen', BigInteger, nullable=False, index=True))
totals = Table('site_analytics_totals_v1', meta,
    Column('id', String(10), primary_key=True), Column('views', BigInteger, nullable=False),
    Column('visitors', BigInteger, nullable=False), Column('started', BigInteger, nullable=False),
    Column('cleanup_at', BigInteger, nullable=False))


def database_url():
    return (os.getenv('ANALYTICS_DATABASE_URL') or os.getenv('LICENSE_DATABASE_URL') or
            os.getenv('LICENSE_DATABASE_DATABASE_URL') or os.getenv('POSTGRES_URL') or os.getenv('DATABASE_URL'))


def configured():
    return os.getenv('ANALYTICS_ENABLED', '1') != '0' and bool(database_url()) and len(secret()) >= 32


def secret():
    return next((os.getenv(key) for key in ('ANALYTICS_SECRET', 'SECRET_KEY', 'FLASK_SECRET_KEY') if len(os.getenv(key, '')) >= 32), '')


def uuid4(value):
    if not isinstance(value, str) or len(value) != 36:
        raise ValueError('Invalid analytics identifier')
    parsed = uuid.UUID(value)
    if parsed.version != 4 or str(parsed) != value:
        raise ValueError('Invalid analytics identifier')
    return value


class AnalyticsStore:
    def __init__(self, url, now=lambda: int(time.time()), production=False):
        if url.startswith('postgres://'): url = 'postgresql+psycopg://' + url[len('postgres://'):]
        if url.startswith('postgresql://'): url = 'postgresql+psycopg://' + url[len('postgresql://'):]
        if production and not url.startswith('postgresql+psycopg://'):
            raise RuntimeError('Production analytics requires private PostgreSQL')
        if not url.startswith(('postgresql+psycopg://', 'sqlite:')):
            raise RuntimeError('Unsupported analytics database')
        self.engine = create_engine(url, poolclass=NullPool, hide_parameters=True,
                                    connect_args={'connect_timeout': 4} if url.startswith('postgresql') else {})
        self.insert = pg_insert if self.engine.dialect.name == 'postgresql' else sqlite_insert
        self.now = now

    def initialize(self):
        meta.create_all(self.engine)
        with self.engine.begin() as c:
            c.execute(self.insert(totals).values(id='main', views=0, visitors=0, started=self.now(), cleanup_at=self.now()).on_conflict_do_nothing(index_elements=['id']))

    def record(self, event, visitor):
        now = self.now()
        day = datetime.fromtimestamp(now, IST).date().isoformat()
        with self.engine.begin() as c:
            inserted = c.execute(self.insert(events).values(id=event['event_id'], visitor=visitor,
                at=now, day=day, kind=event['kind'], page=event['page'], item=event.get('item', ''),
                source=event['source'], device=event['device']).on_conflict_do_nothing(index_elements=['id']).returning(events.c.id)).scalar()
            if inserted is None: return False
            new = c.execute(self.insert(visitors).values(id=visitor, last_seen=now).on_conflict_do_nothing(index_elements=['id']).returning(visitors.c.id)).scalar()
            if new is None: c.execute(update(visitors).where(visitors.c.id == visitor).values(last_seen=now))
            c.execute(update(totals).where(totals.c.id == 'main').values(
                views=totals.c.views + int(event['kind'] == 'pageview'), visitors=totals.c.visitors + int(new is not None)))
            cleanup = c.execute(update(totals).where(totals.c.id == 'main', totals.c.cleanup_at < now-86400).values(cleanup_at=now).returning(totals.c.id)).scalar()
            if cleanup:
                c.execute(delete(events).where(events.c.at < now-90*86400))
                c.execute(delete(visitors).where(visitors.c.last_seen < now-180*86400))
        return True

    def summary(self, days=30):
        today = datetime.fromtimestamp(self.now(), IST).date()
        start = (today-timedelta(days=days-1)).isoformat()
        views = events.c.kind == 'pageview'
        def since(n): return events.c.day >= (today-timedelta(days=n-1)).isoformat()
        with self.engine.connect() as c:
            overall = c.execute(select(totals).where(totals.c.id == 'main')).mappings().one()
            def count(condition, unique=False):
                return c.execute(select(func.count(func.distinct(events.c.visitor)) if unique else func.count()).select_from(events).where(condition)).scalar() or 0
            def grouped(column, kind='pageview'):
                rows = c.execute(select(column, func.count().label('count')).where(events.c.day >= start, events.c.kind == kind).group_by(column).order_by(func.count().desc()).limit(10)).all()
                return [{'key': key, 'count': count} for key, count in rows]
            daily = {day: {'views': n, 'visitors': unique} for day,n,unique in c.execute(select(events.c.day, func.count(), func.count(func.distinct(events.c.visitor))).where(since(14), views).group_by(events.c.day))}
            series = []
            for offset in range(13,-1,-1):
                day = (today-timedelta(days=offset)).isoformat()
                series.append({'day': day, **daily.get(day, {'views': 0, 'visitors': 0})})
            return {'days': days, 'timezone': 'Asia/Kolkata', 'started_at': overall['started'],
                'today_visitors': count(since(1) & views, True), 'today_views': count(since(1) & views),
                'week_visitors': count(since(7) & views, True), 'total_visitors': overall['visitors'],
                'total_views': overall['views'], 'period_visitors': count(since(days) & views, True),
                'download_clicks': count(since(days) & (events.c.kind == 'download_click')),
                'series': series, 'pages': grouped(events.c.page), 'sources': grouped(events.c.source),
                'devices': grouped(events.c.device), 'tools': grouped(events.c.item, 'tool_open'),
                'downloads': grouped(events.c.item, 'download_click')}


@lru_cache(maxsize=1)
def configured_store():
    store = AnalyticsStore(database_url(), production=bool(os.getenv('VERCEL')))
    store.initialize()
    return store


def install(app, login_required, load_config, load_downloads):
    def store(): return app.config.get('ANALYTICS_STORE') or configured_store()

    @app.context_processor
    def analytics_context():
        enabled = configured() or bool(app.config.get('ANALYTICS_STORE'))
        return {'analytics_tracking': enabled and request.path in PAGES and not session.get('admin_logged_in')}

    @app.post('/api/analytics/collect')
    def collect():
        # Existing global CSRF validation is deliberately retained for this endpoint.
        if request.headers.get('Origin') != request.host_url.rstrip('/'):
            return jsonify(error='Same-origin requests only'), 403
        if session.get('admin_logged_in') or request.headers.get('DNT') == '1' or request.headers.get('Sec-GPC') == '1':
            return '', 204
        if re.search(r'bot|spider|crawler|headless|curl|wget|python-requests', request.user_agent.string, re.I):
            return '', 204
        if not configured() and not app.config.get('ANALYTICS_STORE'):
            return jsonify(error='Analytics unavailable'), 503
        if (request.content_length or 0) > 4096: return jsonify(error='Event too large'), 413
        if analytics_limited(session.get('csrf_token', '')):
            return '', 429
        try:
            data = request.get_json(silent=True)
            if not isinstance(data, dict) or set(data)-{'event_id','visitor_id','kind','page','item','source','device'}:
                raise ValueError('Invalid event')
            uuid4(data.get('event_id')); uuid4(data.get('visitor_id'))
            if data.get('page') not in PAGES or data.get('kind') not in KINDS or data.get('source') not in SOURCES or data.get('device') not in DEVICES:
                raise ValueError('Invalid event')
            data['page'] = '/downloads' if data['page'] == '/download.html' else data['page']
            kind = data['kind']
            if kind != 'pageview':
                if kind == 'download_click' and (load_config() or {}).get('downloadPage', {}).get('enabled', True) is not True:
                    raise ValueError('Downloads disabled')
                records = (load_config() or {}).get('tools', []) if kind == 'tool_open' else load_downloads()
                ids = {str(item.get('id')) for item in records if all(item.get(flag, True) is True for flag in ('enabled','visible'))}
                if not isinstance(data.get('item'), str) or len(data['item']) > 100 or data['item'] not in ids:
                    raise ValueError('Invalid item')
            elif data.get('item'): raise ValueError('Page views must not contain item details')
            if not secret(): raise RuntimeError('Analytics secret unavailable')
            identity = hmac.new(secret().encode(), ('analytics-v1:'+data['visitor_id']).encode(), hashlib.sha256).hexdigest()
            store().record(data, identity)
            return '', 204
        except (ValueError, TypeError, AttributeError): return jsonify(error='Invalid analytics event'), 400
        except Exception:
            app.logger.warning('Analytics write unavailable')
            return jsonify(error='Analytics temporarily unavailable'), 503

    @app.get('/api/admin/analytics')
    @login_required
    def analytics_summary():
        try:
            days = int(request.args.get('days', '30'))
            if days not in (7,30,90): raise ValueError()
        except ValueError: return jsonify(error='Choose 7, 30 or 90 days'), 400
        if not configured() and not app.config.get('ANALYTICS_STORE'):
            return jsonify(error='Visitor analytics needs a private database and a stable server secret. Set ANALYTICS_DATABASE_URL (or use the existing private database) and SECRET_KEY.'), 503
        try:
            data = store().summary(days)
            tools = {str(t.get('id')): t.get('name','Tool') for t in (load_config() or {}).get('tools', [])}
            downloads = {str(t.get('id')): t.get('title','Download') for t in load_downloads()}
            for row in data['pages']: row['label'] = PAGES.get(row['key'], row['key'])
            for row in data['sources']: row['label'] = SOURCES.get(row['key'], 'Other')
            for row in data['devices']: row['label'] = DEVICES.get(row['key'], 'Other')
            for row in data['tools']: row['label'] = tools.get(row['key'], 'Removed tool')
            for row in data['downloads']: row['label'] = downloads.get(row['key'], 'Removed download')
            return jsonify(data)
        except Exception:
            app.logger.warning('Analytics summary unavailable')
            return jsonify(error='Visitor analytics is temporarily unavailable. Please retry.'), 503
