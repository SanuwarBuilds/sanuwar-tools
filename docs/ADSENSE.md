# AdSense on SanuwarTools

Public publisher: `ca-pub-8814284684394847`. This is a public identifier, not a credential.

The async tag loads only on successful HTTPS `sanuwartools.online` home and downloads responses. Admin, APIs, checkout, receipts, errors, support pages, localhost and preview deployments remain ad-free. `/ads.txt` advertises the matching authorized Google seller. `/privacy` explains cookies, browser storage, file hosts and Google advertising and does not load advertising/consent tags.

Set `ADSENSE_ENABLED=0` in the deployment environment and redeploy to pause all ad scripts. `ADSENSE_CLIENT` can override the public publisher ID; malformed values fail closed. Keep the account's site, publisher ID and seller record aligned.

Public ad pages use a per-response cryptographic nonce on every script and strict-dynamic CSP. HTTPS ad frames and resource requests are permitted on these pages only, while object embedding, base changes, framing the site and external form submission remain blocked. Other routes retain the original first-party CSP. The public script policy does not permit inline handlers or eval. Recheck browser errors if Google changes its runtime; do not weaken admin/API security to resolve an ad problem.

## Google account configuration

Use AdSense Auto ads: normal in-page ads, dismissible bottom anchor, and vignette ads at a moderate interval (target 10 minutes if available). Disable extra vignette triggers and distracting ad intents. Direct download anchors opt out of vignette triggers. No custom popups, pop-unders, forced ad clicks, or simulated download buttons.

Publish Google's European regulations consent message using `https://sanuwartools.online/privacy`, with consent, manage options and do-not-consent choices. Configure the account-provided privacy-choice link before personalized advertising for EEA/UK/Switzerland. Do not substitute an unverified custom consent banner. Configure page exclusions as a second layer if offered by Auto ads; server code is the primary boundary.

Complete the owner's actual payment/contact profile in AdSense, verify site ownership, then request site review. Tags and settings do not mean approval; Google controls review, ad delivery, fill and earnings. Never click your own ads while testing.

References: [Google CSP](https://support.google.com/adsense/answer/16283098), [Auto ads](https://support.google.com/adsense/answer/9305577), [Consent requirements](https://support.google.com/adsense/answer/13554116), [Privacy pages](https://support.google.com/adsense/answer/10961370).
