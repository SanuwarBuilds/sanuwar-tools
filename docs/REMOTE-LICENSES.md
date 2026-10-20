# Remote access licensing v1

Admin URL: `/admin/licenses`, using existing admin login and CSRF protection.

Create a separate code per customer. Choose whole days (1–3650), label and batch size (1–100 per batch). Validity starts at first successful server activation, not code creation. One code binds to one Android Keystore P-256 public key. Repeated activation does not restart expiry. Codes are high-entropy random values, shown once and stored only as SHA256 hashes in a private PostgreSQL database. Customer labels and device bindings never go into public download JSON/GitHub.

Renew adds days to the later of now or existing expiry; unactivated licenses gain days without starting the clock. It restores revoked access but preserves device binding. Revoke rejects the next online verification. Previously signed offline access lasts until its existing deadline: at most 24 hours and never beyond license expiry. App checks online on launch/resume and every15minutes while running. A phone restart requires online verification. If boot identity is unavailable, an online lease works in that process only.

## Configuration

Dedicated private Neon Free database: Vercel `sanuwar-tools`, Production only, Sensitive values enabled. Prefix `LICENSE_DATABASE` produces `LICENSE_DATABASE_DATABASE_URL`, recognized by this service. Direct `LICENSE_DATABASE_URL` also works. PostgreSQL is mandatory on Vercel; SQLite is local/test-only.

Production Secret `LICENSE_SIGNING_KEY_PEM` contains a P-256 PKCS8 private key. Never put it in GitHub, an APK, chat or public files. Protected local copy: `~/.keystores/ludoremote-license-server-key.pem`. APK embeds only the matching public key from `~/.keystores/ludoremote-license-public-key.txt`. Back up the private key; changing it requires an APK public-key update.

After deploying, sign in to `/admin/licenses`, open First-time setup and initialize the private database once. Only `remote_licenses_v1`, `remote_license_audit_v1`, `remote_license_limits_v1` are created. Test activation, second-device rejection, renewal/revocation and locking before distributing the new licensed APK.

No existing download card or game APK is changed. Old unlicensed remote versions remain unlicensed; this feature protects the new build and does not claim to block all older software or modified APKs. Local game WebSocket v2 remains unchanged.

## Native API contract

HTTPS: `https://sanuwartools.vercel.app`.

`POST /api/license/activate`: JSON `{code,devicePublicKey,nonce,signature}`. Public key is base64 DER SubjectPublicKeyInfo P-256. Nonce is32–80base64url characters. Normalize code by uppercasing/removing spaces and hyphens. Identity is normalized-code SHA256 hex. Sign exact UTF8 `LR-ACTIVATE-1\n<identity>\n<nonce>` with device SHA256withECDSA; base64 ASN.1 DER signature.

`POST /api/license/refresh`: JSON `{licenseId,nonce,signature}`. Sign `LR-REFRESH-1\n<licenseId>\n<nonce>` with bound device key. App does not persist activation code.

Success `{payload,signature}`: payload is base64 UTF8 compact JSON. Server SHA256withECDSA signature covers exact decoded bytes. Payload: `{v:1,licenseId,deviceKeySha256,activatedAt,expiresAt,serverTime,offlineUntil,requestNonce,revision}`. Timestamps UTC seconds; `offlineUntil=min(expiresAt,serverTime+86400)`. App checks pinned public-key signature, device digest, fresh-response nonce, version and bounds. Cache reads never reset elapsed-time anchor. Phone wall-clock changes cannot extend access; copied preferences fail device-key verification.

Error `{code,error}`:400malformed,403invalid/expired/revoked/wrong device,409retry,429rate-limited,503unavailable/unconfigured. Definitive denial locks immediately. Network failures retain only a previously valid lease until its original deadline. All admin writes require session+CSRF; only two exact signed native POST endpoints are CSRF-exempt, and they reject browser Origin-bearing requests.

First binding and all mutations are transactional/atomic. No local JSON production persistence. Codes, signing keys and full device keys are excluded from admin lists/logs.
