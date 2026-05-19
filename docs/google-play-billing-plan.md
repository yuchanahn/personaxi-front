# Google Play Billing Plan

Status: implementation scaffolded
Last checked: 2026-05-15

## What Is Ready

- Android builds include Google Play Billing Library `8.3.0`.
- Android manifest declares `com.android.vending.BILLING`.
- The Capacitor Android app registers a local `GooglePlayBilling` plugin.
- Android checkout now queries Play product details, displays Play-localized prices, launches Google Play checkout, and sends purchase tokens to the backend.
- Backend endpoint: `POST /api/google-play/verify-purchase`
- Backend verifies the purchase token with Google Play Developer API, grants Neurons only after a verified purchased state, records the purchase token, and consumes the purchase so the product remains reusable.

## Product IDs

Use the same IDs in Play Console and pricing policy unless a specific Android override is needed.

| Play product ID | Paid Neurons | Existing policy field |
| --- | ---: | --- |
| `neuron_1000` | 1,000 | `item_id` |
| `neuron_5500` | 5,500 | `item_id` |
| `neuron_12000` | 12,000 | `item_id` |

If a Play product ID has to differ from the web `item_id`, add `android_product_id` to that purchase option in the pricing policy. The Android app and backend both prefer `android_product_id`, then fall back to `item_id`.

## Play Console Setup

1. Finish Play Console account and payments profile verification.
2. Create one-time/in-app products for each product ID above.
3. Set each product active and available in the countries where the app is distributed.
4. Set product titles/descriptions with `PeroChat`; do not use `PXI`.
5. Create a service account with Android Publisher access and grant the app permission in Play Console.
6. Configure backend env:

```bash
GOOGLE_PLAY_PACKAGE_NAME=com.personaxi.app
GOOGLE_PLAY_SERVICE_ACCOUNT_JSON='{"type":"service_account",...}'
# or
GOOGLE_APPLICATION_CREDENTIALS=/secure/path/google-play-service-account.json
```

Optional:

```bash
GOOGLE_PLAY_REQUIRE_OBFUSCATED_ACCOUNT_ID=true
GOOGLE_PLAY_ALLOW_APPLICATION_DEFAULT_CREDENTIALS=true
```

## Fee-Inclusive Pricing

Country-specific pricing is supported. Play can auto-fill local prices from a default price, and you can manually override prices per country. The app must display the localized `formattedPrice` returned by Play Billing, not locally calculated prices.

Use this rule for Play Console input prices:

```text
play_price = round_to_valid_play_price(target_net_revenue / (1 - play_service_fee_rate))
```

Recommended default while the account is new:

- If the account qualifies for the lower service-fee tier, model `play_service_fee_rate = 0.15`.
- If not confirmed yet, keep a fallback table with `0.30` so margin is not accidentally underpriced.
- Let Play auto-fill all countries first, then manually override KR, JP, US if the local price looks wrong for purchasing power or local price endings.

Seed-price examples from `sql/create_app_policies.sql`:

| Product ID | Web/base KRW | 15% fee-inclusive KRW | 30% fee-inclusive KRW |
| --- | ---: | ---: | ---: |
| `neuron_1000` | 1,200 | 1,400 | 1,700 |
| `neuron_5500` | 5,900 | 6,900 | 8,500 |
| `neuron_12000` | 12,000 | 14,000 | 17,000 |

These are console-entry starting points, not hardcoded app prices. Final Play prices should be chosen from valid Play price points and checked in each target country.

## References

- Google Play Billing integration: https://developer.android.com/google/play/billing/integrate
- Google Play Developer API purchase verification: https://developers.google.com/android-publisher/api-ref/rest/v3/purchases.products/get
- Google Play Developer API consume purchase: https://developers.google.com/android-publisher/api-ref/rest/v3/purchases.products/consume
- Play Console price setup: https://support.google.com/googleplay/android-developer/answer/6334373
- In-app product pricing and country-specific prices: https://support.google.com/googleplay/android-developer/answer/1153481
