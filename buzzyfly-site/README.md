# paperclip.buzzyfly.com: Buzzyfly Study Plan

A dynamic Cloudflare Worker (`buzzyfly-paperclip`) on the custom domain
`paperclip.buzzyfly.com`. It sells a browser study-planner app:

- `/`: sales page, `/schools`: teacher page, `/app`: the app (free for 1 exam / 20 cards)
- `/buy/student`, `/buy/classroom`: PayPal checkout ($19 / $99, one-time)
- `/paypal/return`, `/stripe/return`: verify payment, unlock the app (signed cookie + unlock link)
- `/unlock?t=…`: open the app on another device or for a class
- `/restore`: re-unlock with a PayPal order reference
- `/api/health`: which payment settings are present

No database: access passes are HMAC-signed with `ACCESS_SECRET`. App data stays in the buyer's browser.

## Turn on payments

Add these as **GitHub repo secrets** (Settings → Secrets → Actions). The deploy
workflow copies them onto the Worker:

| Secret | What it is |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | Needed to deploy at all |
| `ACCESS_SECRET` | Any long random string. Required to sell. |
| `PAYPAL_CLIENT_ID`, `PAYPAL_SECRET` | Same Live REST app keys buzzyfly.com uses |
| `STRIPE_SECRET_KEY` | Optional, for card payments |
| `STRIPE_LINK_STUDENT`, `STRIPE_LINK_CLASSROOM` | Optional `https://buy.stripe.com/...` Payment Links ($19 / $99) |

For each Stripe Payment Link, set "After payment → redirect" to
`https://paperclip.buzzyfly.com/stripe/return?session_id={CHECKOUT_SESSION_ID}&p=student`
(or `p=classroom`).

Until `ACCESS_SECRET` plus PayPal or Stripe are set, buy buttons open an email to support@buzzyfly.com.

## Develop

    npm install
    npm run check   # typecheck + wrangler dry-run
    npm run dev     # local, reads .dev.vars

Marketing copy: `marketing/LAUNCH-KIT.md`.
