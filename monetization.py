"""AdSense is confined to canonical public content, never account/checkout pages."""
import os
import re
import secrets
from flask import Response, abort, g, render_template, request

DEFAULT_CLIENT = 'ca-pub-8814284684394847'
AD_PATHS = frozenset(('/', '/downloads', '/download.html'))
SLOT_NAMES = ('home', 'downloads')


def client_id():
    value = os.getenv('ADSENSE_CLIENT', DEFAULT_CLIENT).strip()
    return value if re.fullmatch(r'ca-pub-[0-9]{16}', value) else ''


def slot_id(name):
    value = os.getenv('ADSENSE_SLOT_' + name.upper(), '').strip()
    return value if re.fullmatch(r'[0-9]{10,20}', value) else ''


def ads_enabled():
    return (os.getenv('ADSENSE_ENABLED', '1') == '1' and bool(client_id())
            and request.host == 'sanuwartools.online' and request.is_secure
            and request.path in AD_PATHS and request.method == 'GET'
            and request.endpoint in ('index', 'downloads'))


def nonce():
    if not getattr(g, 'script_nonce', None):
        g.script_nonce = secrets.token_urlsafe(32)
    return g.script_nonce


def install(app):
    @app.context_processor
    def ads_context():
        enabled = ads_enabled()
        return {
            'adsense_client': client_id() if enabled else '',
            'csp_nonce': nonce(),
            'adsense_slots': {name: slot_id(name) for name in SLOT_NAMES} if enabled else {},
        }

    @app.get('/ads.txt')
    def ads_txt():
        client = client_id()
        if not client:
            abort(404)
        return Response('google.com, ' + client.removeprefix('ca-') + ', DIRECT, f08c47fec0942fa0\n',
                        mimetype='text/plain', headers={'Cache-Control': 'public, max-age=300'})

    @app.get('/privacy')
    @app.get('/about')
    @app.get('/contact')
    def information_page():
        return render_template('information.html', page=request.path.strip('/'))
