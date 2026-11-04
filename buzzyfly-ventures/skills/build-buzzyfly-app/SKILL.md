---
name: build-buzzyfly-app
description: Build and ship a new Buzzyfly business as a Cloudflare Worker on a buzzyfly.com subdomain with free tier and verified checkout.
---

# Build a Buzzyfly app

Copy the full-stack pattern in `buzzyfly-site/` of the cm97/paperclip repo
(paperclip.buzzyfly.com). Every new business gets:

1. **Its own folder and Worker** with `routes: [{ "pattern": "<name>.buzzyfly.com", "custom_domain": true }]`
   in `wrangler.json`. Cloudflare creates DNS and TLS on first deploy.
2. **A sales page** with an outcome-first headline, how it works, pricing
   with a "Most popular" tier, FAQ, and the refund line:
   "30-day refund if you can't access the app or it isn't as described."
3. **A free tier** that is useful on its own and hits a clear limit.
4. **One-time prices.** No subscriptions unless the owner approves one.
5. **Checkout** through PayPal Orders (`/buy/<product>`) and optional Stripe
   Payment Links. **Always verify on the server** (status, amount, currency,
   product) before unlocking.
6. **Unlock** with an HMAC-signed pass (cookie + unlock link) on the thank-you
   page, plus a `/restore` page. Data stays in the buyer's browser.
7. **A real back end**: a D1 database for orders, support tickets and survey
   answers, with migrations in `migrations/`. Rate-limit public forms and
   reject cross-site posts.
8. **Customer support**: `/support` with an AI help chat grounded only in the
   app's facts, an FAQ, and tickets with a private reply link. `/admin`
   (behind `ADMIN_TOKEN`) shows revenue, orders, tickets (reply from there) and
   survey answers.
9. **A built-in survey** (`/survey` plus a business version) so buyers tell us
   what to build next.
10. **Available everywhere**: installable web app (manifest, icons, offline
    service worker), a Play Store wrapper (Trusted Web Activity in `android/`
    with `/.well-known/assetlinks.json`), `robots.txt`, `sitemap.xml` and
    schema.org product data. List it on free marketplaces after launch.
11. **Terms & privacy page**, `support@buzzyfly.com` as contact, `/api/health`.
12. **Deploy workflow** that typechecks and dry-runs on PRs, deploys and syncs
   secrets on merge, then checks the live URLs return 200.

## Done means

- `npm run check` passes.
- Local run with a mock PayPal: buy → return → unlocked; wrong amount → 402; forged pass → 400.
- Browser test at 375px: no horizontal scroll, no console errors, free limit shows the upgrade.
- Ticket → admin reply → customer sees the reply. Survey answer shows in admin. Service worker registers.
- **No "flat" apps.** If any of the above is missing, it isn't done.
- PR opened with the proof. Never commit secrets.
