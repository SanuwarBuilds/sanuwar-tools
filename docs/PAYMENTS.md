# YouPI paid downloads

The site includes per-download Free/Paid pricing, fixed INR discounts, one price for a whole album,
private file uploads, hosted YouPI checkout, signed-webhook verification, durable orders and
buyer receipt export/restore. Existing catalogue entries remain free. No real payment account is
configured by committing this integration.

## Free hosted flow demo

`/payment-demo` runs on the existing Vercel site without a paid gateway server. It uses sample text
files and browser-only simulated success/failure. It never creates a real order, collects a UPI ID,
presents a payable QR, sends money, or unlocks real catalogue files. Its price controls change only
the demo preview. Real paid download endpoints remain disabled until the setup below is completed.

## Required deployment setup

1. Host **YouPI separately** on an always-on server with persistent storage and HTTPS. The current
   upstream revision reviewed is `3fe33cedfd1d01537fe4269f79eb3aa74edc911f`
   at https://github.com/youpi-pg/YouPI-PG. Its package currently requires Node >=24; some upstream
   deployment prose still lists older versions. Follow the checked-out package's engine requirement.
   This multi-service gateway, queue, SQLite/PostgreSQL and bank observers cannot run as this
   Flask app's stateless Vercel function. The adapter calls its REST API; gateway source is not vendored.
2. In YouPI's merchant admin, replace demo credentials and the demo receiving account with the
   merchant's **own UPI ID and payee name**. Configure the SMS or Gmail banking observer for that
   same account. Keep developer simulation/test mode OFF for real customers. Restrict the gateway
   admin and observer endpoints; only the customer checkout/API routes need public HTTPS.
3. Create a private PostgreSQL database (a separate database or the existing private licensing
   database is suitable; payment tables have different names). Use a TLS connection string with
   the provider's recommended certificate verification. Never store orders/receipts/UTRs in the
   public GitHub catalogue. Vercel `/tmp`, SQLite and repository writes are not payment storage.
4. Configure these **server environment variables in the Vercel project serving the actual site**:

   ```dotenv
   PAYMENTS_ENABLED=0
   PAYMENTS_SITE_URL=https://sanuwartools.vercel.app
   YOUPI_API_URL=https://your-gateway.example
   YOUPI_CHECKOUT_URL=https://your-gateway.example
   YOUPI_MERCHANT_ID=your-real-merchant-id
   YOUPI_WEBHOOK_SECRET=the-merchant-webhook-secret-at-least-32-characters
   PAYMENTS_DATABASE_URL=postgresql://user:password@host/database?sslmode=require
   SECRET_KEY=a-random-site-session-secret-at-least-32-characters
   CLOUDINARY_CLOUD_NAME=your-cloud-name
   CLOUDINARY_API_KEY=your-api-key
   CLOUDINARY_API_SECRET=your-api-secret
   ```

   The checkout portal can proxy the gateway API; otherwise use the API's own HTTPS base URL.
   `YOUPI_CHECKOUT_URL` must match the origin returned in `checkoutUrl`. The gateway webhook secret
   is the **same merchant signing secret** used by YouPI, not an unrelated new value.
   Secrets stay in environment variables, never in public admin settings or JSON content.
5. Set the merchant webhook URL to
   `https://sanuwartools.vercel.app/api/payments/webhook` (or the canonical domain in
   `PAYMENTS_SITE_URL`). Webhooks authenticate using HMAC-SHA256 over raw body bytes. Admin >
   Payments shows setup checks and the last 100 orders without revealing credentials.
6. In Admin > Downloads > Edit/Add choose **Paid**, enter the INR price and INR discount.
   Example: price ₹199, discount ₹50 => customer pays ₹149. Minimum payable amount ₹1;
   choose Free for free downloads. Select Paid **before** uploading the original files; each file
   uploads with Cloudinary `type=authenticated`. A public cover can be uploaded separately.
   The whole album is purchased once, unlocking every file in the order snapshot.
7. Verify the end-to-end flow in an isolated setup first. Then set `PAYMENTS_ENABLED=1`, redeploy
   and run a separately authorized small real UPI transfer to the merchant's own account. Confirm
   the beneficiary shown in the UPI app, the bank's credited amount/UTR, the signed webhook and
   the final download. A real QR transfer is real money, even at ₹1. Do not advertise checkout
   as working until this has passed. Turn `PAYMENTS_ENABLED=0` if accepting new purchases must stop;
   existing receipt holders can still retrieve already-paid downloads.

## Delivery and reconciliation

- Price/discount are calculated in paise on the server; a browser-supplied amount is ignored.
- A signed webhook must match the locally bound order/payment ID, exact INR amount, UPI method,
  gateway bank-observation verification level 1 or 2 and bank reference. A browser callback, return
  URL or COD success does not unlock files. Repeated webhooks are idempotent; one UTR cannot pay
  two orders. Late valid success can recover a failed/expired order; failure cannot undo a paid one.
- Pending orders stay locked when webhook delivery is delayed. The buyer is told not to pay again
  when money was debited. Reconcile with official bank records and investigate the gateway's
  observer/webhook retry logs. This integration deliberately offers no public/manual force-success.
- Each order retains its purchased asset snapshot and price even if the catalogue is edited later.
- Receipt tokens are random, hashed in PostgreSQL, and sent in an Authorization header. They are
  kept in the buyer's browser and can be exported/restored as a receipt file. A receipt is a bearer
  credential: anyone who receives it can retrieve that purchase. There is no buyer login/email
  recovery in this version; a buyer who clears storage and loses the export needs merchant support.
- Paid originals and Cloudinary asset metadata are removed from the public catalogue response.
  Delivery uses an authenticated, attachment URL valid for 60 seconds. The buyer may generate
  another link using their paid receipt. Files already downloaded can of course be copied.
- Previously public files must be uploaded privately again. **Old public GitHub release URLs,
  Cloudinary originals, repository history, and copies held by other people remain accessible**;
  this integration does not revoke or delete them. Do not sell exclusivity for those existing copies.
- Current small upload UI uses the existing site upload limit; Vercel request-body limits may be
  lower. Large APK/video uploads require a future direct signed-upload flow.
- The inherited hardcoded session-key fallback was removed. Missing configuration now gets an
  ephemeral process key; payments fail closed until a configured 32+ character secret exists.
- The local checkout throttle is per process, not a distributed abuse limit. Configure a shared
  WAF/rate limit on checkout and appropriate limits/monitoring on the gateway before public traffic.

## Verification and limits

`python -m unittest discover -s tests -q` covers pricing validation, public redaction, private
uploads, server-calculated totals, unconfigured checkout, incorrect signatures, wrong payment ID /
amount / currency, COD rejection, pending-access denial, receipt ownership, UTR reuse, duplicate and
late callbacks, file snapshots, and the 60-second signed-download call.

The upstream merchant SDK and developer-test-mode suites also passed 21 tests on Node 24 using
random ephemeral test encryption keys and no bank connections. These upstream tests are separate
from the Flask adapter tests.

Local browser QA uses in-memory catalogue data and a **simulated signed payment**, never a bank
transfer. Real Cloudinary private delivery, PostgreSQL connectivity, gateway deployment, bank
observer attribution and live settlement remain unverified until actual account setup.

YouPI's README explicitly describes the gateway as experimental, unaudited and not production-ready.
Its SMS/Gmail-derived confirmation is not conclusive bank settlement evidence. Review that notice
and reconcile real payments against the bank's official records. Refunds, disputes, chargebacks,
tax invoices, and bank-account onboarding are not implemented by this download adapter.
