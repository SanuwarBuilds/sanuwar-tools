"""Shared request protections and schema validation; no credentials in source."""
import hmac
import os
import secrets
import time
import threading
from collections import defaultdict, deque
from datetime import timedelta
from urllib.parse import urlsplit
from flask import request, session, jsonify
from werkzeug.exceptions import HTTPException

_attempts = defaultdict(deque)
_lock = threading.Lock()

def limited(key, maximum=6, window=900):
    # Per-process limiter. Use a shared gateway/Redis limiter for multiple instances.
    now = time.monotonic()
    with _lock:
        for old_key in list(_attempts):
            while _attempts[old_key] and _attempts[old_key][0] <= now-window:
                _attempts[old_key].popleft()
            if not _attempts[old_key]:
                del _attempts[old_key]
        bucket = _attempts[key]
        if len(bucket) >= maximum:
            return True
        bucket.append(now)
        return False

def valid_url(value, image=False):
    if not isinstance(value, str) or len(value) > 500_000:
        return False
    if not value:
        return True
    if image and value.startswith(('data:image/png;base64,', 'data:image/jpeg;base64,', 'data:image/webp;base64,', 'data:image/svg+xml;base64,')):
        return True  # Only rendered in an img element, never inline markup.
    if value.startswith('/assets/') and not any(c in value for c in ('\\', '\n', '\r')):
        return True
    parsed = urlsplit(value)
    return parsed.scheme == 'https' and bool(parsed.hostname) and not parsed.username and not parsed.password and not any(c in value for c in ('\\', '\n', '\r'))

def validate_payload(data):
    """Bound nested content and reject executable URL schemes on every write API."""
    if not isinstance(data, (dict, list)):
        raise ValueError('Expected a JSON object or array')
    def walk(value, depth=0):
        if depth > 12:
            raise ValueError('Content is nested too deeply')
        if isinstance(value, dict):
            if len(value) > 100:
                raise ValueError('Too many fields')
            for key, child in value.items():
                if key in ('enabled', 'visible', 'is_album', 'featured') and type(child) is not bool:
                    raise ValueError(f'{key} must be true or false')
                if key in ('url','siteUrl','link','image','thumbnail','favicon','github','instagram','youtube','twitter','photo_url','image_url') and not valid_url(child, key in ('image','thumbnail','favicon','photo_url','image_url')):
                    # Preserve the legacy local downloads route.
                    if not (key == 'url' and child in ('/downloads','/download.html')):
                        raise ValueError(f'Invalid {key}: use an HTTPS URL')
                if key == 'images' and isinstance(child, list):
                    for entry in child:
                        if not valid_url(entry if isinstance(entry, str) else entry.get('url', '') if isinstance(entry, dict) else None, True):
                            raise ValueError('Invalid gallery image URL')
                walk(child, depth+1)
        elif isinstance(value, list):
            if len(value) > 2000:
                raise ValueError('Too many entries')
            for child in value:
                walk(child, depth+1)
        elif isinstance(value, str) and len(value) > 500_000:
            raise ValueError('Field is too long')
    walk(data)

def install(app):
    secret = os.getenv('SECRET_KEY', '')
    if not secret or len(secret) < 32:
        secret = os.getenv('FLASK_SECRET_KEY', '')
        if len(secret) < 32:
            secret = secrets.token_urlsafe(48)
    app.secret_key = secret
    app.config.update(SESSION_COOKIE_HTTPONLY=True, SESSION_COOKIE_SAMESITE='Lax',
                      SESSION_COOKIE_SECURE=bool(os.getenv('VERCEL')) or os.getenv('COOKIE_SECURE') == '1',
                      PERMANENT_SESSION_LIFETIME=timedelta(hours=2), MAX_CONTENT_LENGTH=32*1024*1024,
                      MAX_FORM_MEMORY_SIZE=1024*1024)
    @app.context_processor
    def csrf_context():
        if 'csrf_token' not in session:
            session['csrf_token'] = secrets.token_urlsafe(32)
        return {'csrf_token': session['csrf_token']}
    @app.before_request
    def protect():
        # Machine-to-machine payment callbacks authenticate their raw body with HMAC.
        if request.path == '/api/payments/webhook' and request.method == 'POST':
            return None
        # Native licensing uses per-device signed proofs, not browser session cookies.
        # Only these exact endpoints are exempt; all admin mutations retain CSRF checks.
        if request.method == 'POST' and request.path in ('/api/license/activate','/api/license/refresh'):
            if request.headers.get('Origin'):
                return jsonify(error='Native application endpoint'), 403
            return None
        if request.method in ('POST','PUT','PATCH','DELETE'):
            token = request.headers.get('X-CSRF-Token', '')
            if not token or not hmac.compare_digest(token, session.get('csrf_token', '')):
                return jsonify(error='Session expired. Refresh this page and try again.'), 403
            origin = request.headers.get('Origin')
            if origin and origin != request.host_url.rstrip('/'):
                return jsonify(error='Cross-origin request rejected'), 403
            empty_delete = request.method == 'DELETE' and not request.get_data(cache=True)
            if request.path.startswith('/api/') and not request.is_json and not empty_delete and not request.path.startswith('/api/admin/upload'):
                return jsonify(error='Send JSON with Content-Type application/json'), 415
            if request.is_json:
                try:
                    payload = request.get_json()
                    if not isinstance(payload, dict):
                        raise ValueError('Expected a JSON object')
                    if request.path != '/admin/login':
                        validate_payload(payload)
                    if request.path == '/api/tools.config':
                        if not isinstance(payload, dict) or not isinstance(payload.get('tools'), list) or not isinstance(payload.get('categories'), list):
                            raise ValueError('Tools and categories must be arrays')
                        if any(not isinstance(c, str) or not c.strip() or len(c) > 80 for c in payload['categories']):
                            raise ValueError('Category names must be nonempty text up to 80 characters')
                        ids = set()
                        for tool in payload['tools']:
                            if not isinstance(tool, dict) or not isinstance(tool.get('name'), str) or not tool['name'].strip() or not isinstance(tool.get('id'), str) or tool['id'] in ids:
                                raise ValueError('Each tool needs a name and a unique ID')
                            ids.add(tool['id'])
                    elif request.path in ('/api/add_item','/api/update_item'):
                        if not isinstance(payload, dict) or not isinstance(payload.get('title'), str) or not payload['title'].strip():
                            raise ValueError('A title is required')
                        if not isinstance(payload.get('album_files', []), list) or any(not isinstance(f, dict) or not isinstance(f.get('name'), str) or not (f.get('link') or isinstance(f.get('asset'), dict)) for f in payload.get('album_files', [])):
                            raise ValueError('Each album file needs a name and an HTTPS link')
                    elif request.path.startswith('/api/admin/widgets') and request.method in ('POST', 'PUT') and not request.path.endswith('/reorder'):
                        if 'order' in payload and (type(payload['order']) is not int or not 0 <= payload['order'] <= 10000):
                            raise ValueError('Widget order must be a nonnegative integer')
                        if 'data' in payload and not isinstance(payload['data'], dict):
                            raise ValueError('Widget fields must be an object')
                        if (request.method == 'POST' or 'type' in payload) and payload.get('type') not in {'notice','poll','winner','person_card','link_card','ticker','gallery','event_card','quote','custom_html'}:
                            raise ValueError('Choose a supported widget type and fields')

                except ValueError as error:
                    return jsonify(error=str(error)), 400
    @app.after_request
    def headers(response):
        response.headers['X-Content-Type-Options'] = 'nosniff'
        response.headers['X-Frame-Options'] = 'DENY'
        response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
        response.headers['Permissions-Policy'] = 'camera=(), microphone=(), geolocation=()'
        response.headers['Content-Security-Policy'] = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' https: data:; font-src 'self'; connect-src 'self'; media-src 'self' https:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'"
        # Google supports nonce-based strict CSP for AdSense. Only successful public
        # ad pages allow third-party ad resources; admin, APIs and checkout retain
        # the restrictive first-party policy above.
        import monetization
        if response.status_code == 200 and response.mimetype == 'text/html' and monetization.ads_enabled():
            response.headers['Content-Security-Policy'] = (
                "default-src 'self'; script-src 'nonce-" + monetization.nonce() + "' 'unsafe-eval' 'strict-dynamic' https:; "
                "style-src 'self' 'unsafe-inline' https:; img-src 'self' https: data:; "
                "font-src 'self' https:; connect-src 'self' https:; frame-src https:; "
                "media-src 'self' https:; object-src 'none'; base-uri 'none'; "
                "frame-ancestors 'none'; form-action 'self'")
        if request.path == '/photo-tools' and response.status_code == 200:
            # Local editing and print previews only; no third-party processing.
            response.headers['Content-Security-Policy'] = (
                "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; "
                "img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; "
                "object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'")
            response.headers['Cache-Control'] = 'no-store'
        if request.path == '/signin' and response.status_code == 200:
            response.headers['Content-Security-Policy'] = (
                "default-src 'self'; script-src 'self' https://accounts.google.com/gsi/client; "
                "style-src 'self' 'unsafe-inline' https://accounts.google.com/gsi/style; "
                "connect-src 'self' https://accounts.google.com/gsi/; frame-src https://accounts.google.com/gsi/; "
                "img-src 'self' https: data:; font-src 'self'; object-src 'none'; base-uri 'self'; "
                "frame-ancestors 'none'; form-action 'self'")
            response.headers['Cross-Origin-Opener-Policy'] = 'same-origin-allow-popups'
        if request.is_secure:
            response.headers['Strict-Transport-Security'] = 'max-age=31536000'
        if request.path.startswith(('/admin','/api/','/purchase')) or request.path in ('/', '/downloads', '/download.html', '/tools.config.json', '/privacy', '/about', '/contact'):
            response.headers['Cache-Control'] = 'no-store'
        return response
    @app.errorhandler(HTTPException)
    def request_error(error):
        if request.path.startswith('/api/') or request.method != 'GET':
            return jsonify(error=error.description), error.code
        return error
