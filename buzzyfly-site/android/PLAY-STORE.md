# Publish Buzzyfly Study Plan on Google Play

The Android app is a **Trusted Web Activity**: a small Android app that opens
paperclip.buzzyfly.com full-screen, with no browser bar. Buyers get the same
working app, checkout, support and data as on the website.

GitHub builds the Play bundle for you on every change
(workflow **"Android app (Google Play)"** → run → **Artifacts**). You only
need to create the upload key once and upload the file to Play.

## 1. Create your upload key (once, about 2 minutes)

On your computer (needs Java):

```bash
keytool -genkeypair -v -keystore upload.jks -alias upload -keyalg RSA -keysize 2048 -validity 10000
base64 -w0 upload.jks > upload.jks.b64     # macOS: base64 -i upload.jks -o upload.jks.b64
```

Keep `upload.jks` and the password somewhere safe (a password manager).
Never email them or commit them.

In GitHub → `cm97/paperclip` → Settings → Secrets → Actions, add:

| Secret | Value |
| --- | --- |
| `ANDROID_KEYSTORE_BASE64` | contents of `upload.jks.b64` |
| `ANDROID_KEYSTORE_PASSWORD` | the password you chose |
| `ANDROID_KEY_ALIAS` | `upload` |

Then run the workflow (Actions → "Android app (Google Play)" → Run workflow).
Download `app-release.aab` from the run's Artifacts.

## 2. Create the app in Play Console

1. Sign up at https://play.google.com/console (one-time $25, identity check).
2. Create app → name **Buzzyfly Study Plan** → App, Free.
3. Testing → Internal testing → upload `app-release.aab`. Play App Signing turns on automatically.
4. Setup → App integrity → copy the **App signing key SHA-256** fingerprint.
5. Add it as the GitHub secret `ANDROID_SHA256` (comma-separate if you add your
   upload key's too) and re-run the site deploy. The site then serves
   `/.well-known/assetlinks.json`, which removes the browser bar in the app.

## 3. Store listing

- **Short description:** Day-by-day exam study plans with spaced review and flashcards.
- **Full description:** Know exactly what to study tonight. Type your exam date
  and topics, and Buzzyfly Study Plan builds a day-by-day plan. Each topic
  comes back for review 1, 3 and 7 days later, and the last days are mixed
  practice. Flashcards bring back the ones you miss. A daily streak keeps you
  going. Free for your first exam. No account needed. Help and support built in.
- **Category:** Education. **Contact email:** support@buzzyfly.com.
  **Privacy policy:** https://paperclip.buzzyfly.com/privacy
- **Screenshots:** take 2–8 phone screenshots of `/app` (Today, Full plan, Flashcards).
- **Data safety:** study plans stay on the device and aren't collected. Email,
  name and messages are collected **only** if the user opens a support ticket
  or answers the survey, to reply to them. Purchases are processed by PayPal
  or Stripe. Data is encrypted in transit. Users can ask for deletion through support.
- **Content rating:** Education, no user-to-user content, no ads.
- **Target audience:** 13+ (teens, adults, teachers). Not designed for children under 13.

## 4. Payments inside the Play app: read before Production

Google Play's Payments policy generally requires **Google Play Billing** for
digital goods bought in apps it distributes, with regional exceptions that
change (for example US external-offer and alternative-billing programs).
Check the current policy in Play Console before you publish to Production:

- **Option A:** if your region allows external payment links, keep the
  current PayPal/Stripe checkout.
- **Option B:** otherwise, publish the free app and have the Builder agent
  add Play Billing (Digital Goods API) for the paid tiers. People who
  bought on the website can still unlock with their unlock link.

Then promote the Internal testing release to Production.
