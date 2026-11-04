# paperclip.buzzyfly.com: Buzzyfly Study Plan

A dynamic Cloudflare Worker (`buzzyfly-paperclip`) on the custom domain
`paperclip.buzzyfly.com`. It sells a browser study-planner app:

- `/`: sales page, `/schools`: teacher page, `/app`: the app (free for 1 exam / 20 cards)
- `/buy/student`, `/buy/classroom`: PayPal checkout ($19 / $99, one-time)
- `/paypal/return`, `/stripe/return`: verify payment, unlock the app (signed cookie + unlock link)
- `/unlock?t=…`: open the app on another device or for a class
- `/restore`: re-unlock with a PayPal order reference
- `/business`: Business tier ($299, up to 25 staff) and business needs survey
- `/support`: AI help chat (Workers AI), FAQ, and support tickets with private reply links
- `/survey`: "what do you need?" survey (personal and business)
- `/admin`: owner dashboard (revenue, orders, tickets with replies, survey answers). Sign in with `ADMIN_TOKEN`
- `/api/health`: which settings are present
- Installable web app (manifest + offline service worker) and Play Store wrapper in `android/` (see `android/PLAY-STORE.md`)
- `robots.txt`, `sitemap.xml` and schema.org product data for search engines
- Emails (Cloudflare Email Service, same as buzzyfly.com): receipt with unlock link, ticket received, support replied, owner alerts
- Legal and trust pages: `/about`, `/terms`, `/privacy`, `/refunds`, `/accessibility`, `/.well-known/security.txt`
- Security: CSP, HSTS, signed passes, refunds revoke access, rate limits, admin lockout, audit log, privacy erase
- Android app: `android/` (Trusted Web Activity). GitHub builds the Play bundle: workflow "Android app (Google Play)"

Back end: Cloudflare Worker + D1 database `buzzyfly-study-db` (orders, tickets,
ticket messages, survey answers, rate limits; schema in `migrations/`).
Access passes are HMAC-signed with `ACCESS_SECRET`. Study plans stay in the buyer's browser.

## Turn on payments

Add these as **GitHub repo secrets** (Settings → Secrets → Actions). The deploy
workflow copies them onto the Worker:

| Secret | What it is |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | Needed to deploy at all |
| `ACCESS_SECRET` | Any long random string. Required to sell. |
| `ADMIN_TOKEN` | Any long random string (16+ chars). Your password for `/admin`. |
| `OWNER_EMAIL` | Where new-ticket alerts go (private, never shown on the site) |
| `ANDROID_SHA256` | Play Store signing fingerprints (see `android/PLAY-STORE.md`) |
| `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` | Your Play upload key, so GitHub builds a signed `.aab` |
| `PAYPAL_CLIENT_ID`, `PAYPAL_SECRET` | Same Live REST app keys buzzyfly.com uses |
| `STRIPE_SECRET_KEY` | Optional, for card payments |
| `STRIPE_LINK_STUDENT`, `STRIPE_LINK_CLASSROOM`, `STRIPE_LINK_TEAM` | Optional `https://buy.stripe.com/...` Payment Links ($19 / $99 / $299) |

For each Stripe Payment Link, set "After payment → redirect" to
`https://paperclip.buzzyfly.com/stripe/return?session_id={CHECKOUT_SESSION_ID}&p=student`
(or `p=classroom`, `p=team`).

Until `ACCESS_SECRET` plus PayPal or Stripe are set, buy buttons open a support ticket request.

## Develop

    npm install
    npm run check   # typecheck + wrangler dry-run
    npm test        # end-to-end: purchases, unlocks, refunds, support, admin, security
    npx wrangler d1 migrations apply DB --local
    npm run dev     # local, reads .dev.vars (the AI binding needs a Cloudflare login)

Marketing copy: `marketing/LAUNCH-KIT.md`.
