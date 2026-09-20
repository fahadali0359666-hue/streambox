# StreamBox

Movie/series discovery and authorized streaming platform with responsive web + Android client and a Cloudflare Workers backend.

- `streambox-client/` — React/Vite web app + Capacitor Android shell
- `streambox-api/` — Cloudflare Worker + D1 backend

Playback is designed for licensed or public-domain content only. TMDB supplies metadata, Watchmode supplies where-to-watch availability, Internet Archive is rights-gated, and Mux handles authorized media playback.

## Admin

The backend includes a built-in admin panel at `https://<streambox-api-worker>/admin` for provider/API configuration, enable/disable controls, license records, Mux ingest and direct authorized streams.
