# Android Store Readiness

Status: in progress
Last checked: 2026-05-14

## Current State

- Main branch has been merged into `feat/capacitor-android`.
- Android debug APK and release AAB builds are possible.
- Public brand is `PeroChat`; `PXI` is legacy naming and should not be used in public-facing copy.
- Android native checkout is wired to Google Play Billing at app/backend level. Console products, service account credentials, and tester validation are still required before release.

## Store Submission Blockers

1. Google Play Billing
   - Neuron is an in-app virtual currency used inside the app, so Google Play builds must use Google Play Billing for Android in-app purchases.
   - Do not expose PortOne, PayPal, external checkout links, or external payment CTAs inside the Google Play-distributed Android app.
   - App/backend scaffold is connected: Play Billing product lookup, purchase flow, token verification endpoint, token recording, credit grant, and purchase consumption.
   - Required next work: create Play Console products, set fee-inclusive country prices, configure Google Play Developer API service account credentials, and run license tester purchases.

2. Legal Documents
   - Privacy policy URL: `https://personaxi.com/ko/privacy/`
   - Terms URL: `https://personaxi.com/ko/terms/`
   - Refund guide URL: `https://personaxi.com/guide/` payment/refund article
   - Legal copy now separates web/PWA PG payments from Google Play Android in-app purchases.

3. Account Deletion
   - App has account creation/login, so Play Console needs both an in-app deletion path and a web deletion/request URL.
   - Confirm the app path under settings is reachable in the Android shell.
   - Create or confirm a public web URL for deletion requests before Play submission.

4. Data Safety
   - Play Console Data safety answers must match the privacy policy.
   - Check at least: account identifiers, email, payment history, generated content, usage logs, voice/audio features, image/media uploads, crash/diagnostic data, and third-party processors.

5. Release Packaging
   - Configure production signing credentials before upload.
   - Confirm app name, icon, screenshots, content rating, target audience, privacy URL, support email, and store listing copy all use `PeroChat`.

## References

- Google Play Payments policy: https://support.google.com/googleplay/android-developer/answer/9858738
- Google Play User Data policy: https://support.google.com/googleplay/android-developer/answer/10144311
- Google Play account deletion requirements: https://support.google.com/googleplay/android-developer/answer/13327111
- Google Play Billing integration guide: https://developer.android.google.cn/google/play/billing
- Google Play Billing plan: ./google-play-billing-plan.md
