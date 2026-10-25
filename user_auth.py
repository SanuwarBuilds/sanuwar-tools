"""Visitor Google sign-in. Visitor identities never confer admin privileges."""
import hmac
import os
import re
import secrets
import time
from flask import jsonify, redirect, render_template, request, session
from google.auth.exceptions import GoogleAuthError, TransportError
from google.auth.transport.requests import Request
from google.oauth2 import id_token
import security

# OAuth web client identifiers are public. A host environment can override this.
DEFAULT_CLIENT_ID = '821061434136-gpj8jtnbv2ti8ahf7juo771t5oqricu5.apps.googleusercontent.com'


def client_id():
    value = os.getenv('GOOGLE_CLIENT_ID', DEFAULT_CLIENT_ID).strip()
    return value if re.fullmatch(r'[0-9]+-[A-Za-z0-9_-]+\.apps\.googleusercontent\.com', value) else ''


def configured():
    secret = os.getenv('SECRET_KEY', '')
    if len(secret) < 32:
        secret = os.getenv('FLASK_SECRET_KEY', '')
    return bool(client_id()) and len(secret) >= 32


def google_request(url, method='GET', body=None, headers=None, **kwargs):
    return Request()(url, method=method, body=body, headers=headers, timeout=10)


def install(app):
    @app.context_processor
    def visitor_context():
        return {'visitor': session.get('visitor'), 'google_signin_configured': configured()}

    @app.get('/signin')
    def visitor_signin():
        if session.get('visitor'):
            return redirect('/account')
        challenge = secrets.token_urlsafe(32)
        session['google_challenge'] = {'nonce': challenge, 'created': time.time()}
        return render_template('signin.html', google_client_id=client_id() if configured() else '', google_nonce=challenge)

    @app.post('/api/auth/google')
    def visitor_google_login():
        if not configured():
            return jsonify(error='Google sign-in setup is not complete yet.'), 503
        if request.headers.get('Origin') != request.host_url.rstrip('/'):
            return jsonify(error='Sign in from this website.'), 403
        if security.limited(('google-signin', request.remote_addr), maximum=20, window=60):
            return jsonify(error='Too many attempts. Please try again in a minute.'), 429
        challenge = session.pop('google_challenge', None)
        if not isinstance(challenge, dict) or not 0 <= time.time()-challenge.get('created', 0) <= 600:
            return jsonify(error='Sign-in session expired. Refresh this page.'), 401
        credential = (request.get_json(silent=True) or {}).get('credential')
        if not isinstance(credential, str) or not 10 <= len(credential) <= 16000:
            return jsonify(error='Google did not return a valid credential. Refresh and retry.'), 400
        try:
            # Verifies Google's signature, expiry, audience and issuer; never trust a decoded payload.
            claims = id_token.verify_oauth2_token(credential, google_request, client_id())
            if claims.get('aud') != client_id() or claims.get('azp', client_id()) != client_id():
                raise ValueError('Client mismatch')
            nonce = claims.get('nonce')
            if not isinstance(nonce, str) or not hmac.compare_digest(nonce, challenge['nonce']):
                raise ValueError('Nonce mismatch')
            if claims.get('email_verified') is not True or not isinstance(claims.get('sub'), str) or not 1 <= len(claims['sub']) <= 255:
                raise ValueError('Unverified identity')
            email = claims.get('email')
            if not isinstance(email, str) or not 3 <= len(email) <= 320 or '@' not in email:
                raise ValueError('Invalid email')
            name = claims.get('name')
            visitor = {'id': claims['sub'], 'email': email,
                       'name': name[:100] if isinstance(name, str) and name.strip() else email.split('@')[0]}
        except TransportError:
            return jsonify(error='Google could not be reached. Refresh and try again.'), 503
        except (ValueError, TypeError, KeyError, GoogleAuthError):
            return jsonify(error='Google sign-in could not be verified. Refresh and retry.'), 401
        session['visitor'] = visitor
        session['csrf_token'] = secrets.token_urlsafe(32)
        session.permanent = True
        return jsonify(success=True, redirect='/account')

    @app.get('/account')
    def visitor_account():
        if not session.get('visitor'):
            return redirect('/signin')
        return render_template('account.html')

    @app.post('/api/auth/logout')
    def visitor_logout():
        session.pop('visitor', None)
        session.pop('google_challenge', None)
        session['csrf_token'] = secrets.token_urlsafe(32)
        return jsonify(success=True)

    @app.after_request
    def visitor_headers(response):
        if request.path in ('/signin', '/account') or request.path.startswith('/api/auth/'):
            response.headers['Cache-Control'] = 'no-store'
            response.headers['X-Robots-Tag'] = 'noindex, nofollow'
        return response
