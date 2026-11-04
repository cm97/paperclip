# Publish Buzzyfly Study Plan on Google Play

The Android app is a **Trusted Web Activity**: a thin Android wrapper that
opens paperclip.buzzyfly.com full-screen. The same back end, support system
and data work in the Play Store app, the website and the installed web app.

## What you need (owner)

- A Google Play developer account (one-time $25 fee, identity check).
- Java 17 and Node.js on your computer.

## Build the app (about 15 minutes)

```bash
cd buzzyfly-site/android
npx @bubblewrap/cli init --manifest https://paperclip.buzzyfly.com/manifest.webmanifest
# accept the values from twa-manifest.json; create a new signing key when asked
npx @bubblewrap/cli build
```

This creates `app-release-bundle.aab`. **Keep `android.keystore` and its
password safe and private. Never commit them.** You need them for every update.

## Link the app to the site

1. Get the SHA-256 fingerprint:
   `keytool -list -v -keystore android.keystore -alias buzzyfly-studyplan`
2. Turn on Play App Signing in Play Console and copy the **app signing key**
   SHA-256 too (Setup → App integrity).
3. Add both, comma-separated, as the GitHub secret `ANDROID_SHA256`. The deploy
   workflow puts them on the Worker, which serves
   `/.well-known/assetlinks.json`. Without this the app shows a browser bar.

## Upload

In Play Console: Create app → upload the `.aab` to Internal testing first →
fill in the store listing (use the copy below), content rating, data safety
(no data collected on device; email collected only for support tickets) →
then Production.

## Store listing copy

**Short description (80 chars):** Day-by-day exam study plans with spaced review and flashcards.

**Full description:**
Know exactly what to study tonight. Type your exam date and topics, and
Buzzyfly Study Plan builds a day-by-day plan. Each topic comes back for review
1, 3 and 7 days later, and the last days are mixed practice. Add flashcards
that bring back the ones you miss. Free for your first exam. No account needed.

## Payments inside the Play Store app: read before launch

Google Play's policy usually requires **Google Play Billing** for digital
goods bought inside apps it distributes, with regional exceptions that change
(for example US alternative-billing and external-offer programs). Check the
current Payments policy in Play Console before you publish. Two safe options:

1. **Free Play Store app, unlock on the web:** publish the app with the free
   tier. Buyers who already paid on the website unlock it with their unlock link.
2. **Add Play Billing** (Digital Goods API) for in-app purchases. Ask the
   Builder agent to add it once the Play Console products exist.
