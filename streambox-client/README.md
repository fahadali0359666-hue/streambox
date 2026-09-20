# StreamBox Client — Web + Android

Responsive React/Vite streaming-discovery UI that ships as:

- **Web SPA** on Cloudflare Workers Static Assets
- **Android app** through Capacitor
- HLS playback through `hls.js`

The client never contains provider secrets. It calls `streambox-api` for TMDB catalog data, Watchmode availability, Internet Archive rights-cleared/public-domain items, and licensed Mux playback.

## Local setup

```bash
cp .env.example .env
npm install
npm run dev
```

Set `VITE_API_BASE_URL` to the deployed backend Worker.

## Deploy web to Cloudflare

```bash
npm run deploy:web
```

## Android

First time:

```bash
npm install
npm run cap:add:android
npm run cap:sync
npm run cap:open
```

Build/sign the APK or AAB in Android Studio. After web-code changes run `npm run cap:sync`.

## GitHub Actions

Repository secrets:
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

Repository variable:
- `VITE_API_BASE_URL` = deployed `streambox-api` Worker URL

## Playback rule

A TMDB title receives an in-app **Play** button only when the backend has a currently active stream record marked `licensed` or `public_domain`. Otherwise the UI shows legal where-to-watch provider links when available.
