# paperclip.buzzyfly.com

A static guide page to Paperclip, published by Buzzyfly. It deploys as its own
Cloudflare Worker (`buzzyfly-paperclip`) with the custom domain
`paperclip.buzzyfly.com`. Cloudflare creates the DNS record and TLS certificate
on the first deploy, because `buzzyfly.com` is already a zone on the account.

- Edit: `public/index.html`
- Check: `npx wrangler@4 deploy --dry-run`
- Deploy: `npx wrangler@4 deploy` (or push to `master`; see
  `.github/workflows/deploy-buzzyfly-site.yml`, which needs the
  `CLOUDFLARE_API_TOKEN` repo secret)
