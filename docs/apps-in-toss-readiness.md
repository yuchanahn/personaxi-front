# Apps in Toss Release Notes

This branch packages the SvelteKit static app as an Apps in Toss `.ait` bundle.

## Commands

- `pnpm dev`: run through Granite for Apps in Toss local development.
- `pnpm dev:web`: run the original Vite dev server.
- `pnpm build`: create the `.ait` bundle.
- `pnpm build:web`: create the original SvelteKit static build in `build/`.
- `pnpm deploy`: upload the `.ait` bundle after adding a Toss API key.

This branch disables SvelteKit gzip/brotli precompression by default so duplicate `.gz` and `.br` files are not included in the Toss bundle. Set `SVELTE_PRECOMPRESS=true` only when building for a web host that serves those files.

## Bundle Size Policy

Apps in Toss accepts bundles up to 100 MB uncompressed. Keep this branch lean.

Removed from the bundle in this branch:

- `static/animations/**`
- `static/AvatarSample_B.vrm`
- `static/8429501718162919766.vrm`
- `static/The Machine.vrm`

Move these assets to CDN before enabling full 3D flows inside Toss:

- VRM sample/default models: serve from an HTTPS CDN and update the VRM fallback path.
- VRM animation files under `static/animations/**`: serve from an HTTPS CDN and update the animation catalog path resolver.
- `static/studio_small_03_1k.hdr`: serve from CDN or replace with a smaller environment texture.
- `static/chat_bg.png`: convert to WebP/AVIF or serve from CDN.
- `static/event_01.mp4`: keep out of the initial bundle and lazy-load from CDN.
- `static/og-image-v4.png`: needed for web metadata, not for Toss runtime; do not include unless required by the host.

Set `PUBLIC_STATIC_ASSET_BASE` to the CDN origin when building this branch. Example:

```sh
PUBLIC_STATIC_ASSET_BASE=https://cdn.personaxi.com/toss-static pnpm build
```

The app now resolves VRM fallback models, VRM animations, and the HDR environment file through this base URL when it is set.

## Backend Checklist

Add exact Apps in Toss origins to backend CORS before QR testing:

- `https://perochat.private-apps.tossmini.com`
- `https://perochat.apps.tossmini.com`

Do not wildcard `*.tossmini.com`.

## Product Checklist

- Test at least once through the Toss QR flow before requesting review.
- Confirm auth does not depend on third-party cookies in the Toss webview.
- Confirm payment and identity verification flows are either Toss-compatible or hidden behind a Toss-specific feature flag.
- Confirm external resources use HTTPS only.
