# Visitor Google sign-in

Public routes: `/signin` and `/account`. The GIS JavaScript callback posts an ID token to `/api/auth/google` with the existing same-origin CSRF header. Google-auth verifies the token's signature, expiry, issuer and audience; the application additionally checks the authorized party, verified email, subject and a ten-minute session nonce. Google tokens are never retained or written to logs. Session cookies contain only the visitor identifier, display name and email and expire after two hours. Logout uses a CSRF-protected POST.

Visitor sessions never grant `admin_logged_in`. Admin authentication and payment receipts retain their own authorization checks. Sign-in/account pages remain ad-free, no-store and noindex. Only `/signin` permits Google's GIS script, frames and connections in CSP; private/admin routes keep their previous first-party policy. No Gmail, Drive, contacts or offline access is requested. Downloads remain publicly browsable without sign-in; this change does not claim to synchronize purchase receipts between devices.

## Google Cloud

Create/select the site's project, configure Google Auth Platform branding and an External audience, and register a **Web application** client. For production add only `https://sanuwartools.online` to Authorized JavaScript origins. This integration uses the GIS callback rather than a redirect, so no OAuth redirect URI or client secret is required. Publish the app audience for general visitor access. Add the site's home and privacy URLs to branding as appropriate. The owner must approve any Google policy agreement or creation of credentials and review the support/contact email shown on the consent screen.

Set the public `GOOGLE_CLIENT_ID` host variable (or the public default in `user_auth.py`) to that web client ID. A persistent `SECRET_KEY` or `FLASK_SECRET_KEY` of at least 32 characters must already be configured in the deployment. Missing/invalid configuration fails closed with a setup notice; it never simulates a successful sign-in. A separate test client can authorize a localhost development origin when required.

Run the Python suite and JS syntax checks. `tests/test_user_auth.py` signs real RSA JWTs with a local test key and mocks only Google's certificate transport to exercise verification and rejection paths. A genuine Google consent/sign-in still needs an owner/browser test on the authorized production origin.

References: [GIS setup](https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid), [server verification](https://developers.google.com/identity/gsi/web/guides/verify-google-id-token).
