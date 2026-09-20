# StreamBox API — Cloudflare Workers + D1

Backend for the StreamBox web/Android client.

## Admin panel

After deployment open `/admin` on the API Worker URL. Login with `ADMIN_TOKEN`. The panel manages TMDB, Watchmode, Internet Archive, Mux, Filmhub, Vuulr and Direct Streams, plus license records and authorized stream registration.

Provider credentials saved in the admin panel are AES-GCM encrypted before being stored in D1. Set a separate `CONFIG_ENCRYPTION_KEY` Worker secret and keep it stable; changing it makes previously encrypted provider settings unreadable.

## Providers

- **TMDB** — catalog, trending, search, artwork, movie/TV details.
- **Watchmode** — where-to-watch provider availability and outbound provider links. It is not the video source.
- **Internet Archive** — public-domain/rights-cleared items only; playback is denied when rights metadata cannot be verified.
- **Mux** — playback/transcoding for media you are authorized to distribute.
- **Filmhub / Vuulr** — licensing workflow sources. After licensing a title, register the deal and ingest the authorized master into Mux.

## First deployment

1. `npm install`
2. `npx wrangler login`
3. Create D1:
   ```bash
   npx wrangler d1 create streambox-db --location apac
   ```
4. Put the returned D1 UUID into `wrangler.jsonc` as `database_id`.
5. Apply migrations:
   ```bash
   npm run db:remote
   ```
6. Add secrets:
   ```bash
   npx wrangler secret put TMDB_READ_TOKEN
   npx wrangler secret put WATCHMODE_API_KEY
   npx wrangler secret put ADMIN_TOKEN
   npx wrangler secret put CONFIG_ENCRYPTION_KEY
   npx wrangler secret put MUX_TOKEN_ID
   npx wrangler secret put MUX_TOKEN_SECRET
   npx wrangler secret put ALLOWED_ORIGIN
   ```
7. Deploy:
   ```bash
   npm run deploy
   ```

## License record example

```bash
curl -X POST "https://YOUR_API/v1/admin/licenses" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "catalogId":"tmdb:movie:123",
    "marketplace":"filmhub",
    "reference":"YOUR-LICENSE-DEAL-ID",
    "territory":"PK",
    "startsAt":"2026-09-20T00:00:00Z",
    "endsAt":"2027-09-20T00:00:00Z"
  }'
```

## Mux ingest example

```bash
curl -X POST "https://YOUR_API/v1/admin/mux/assets" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "catalogId":"tmdb:movie:123",
    "title":"Licensed Movie",
    "inputUrl":"https://authorized-delivery.example/master.mp4",
    "rightsStatus":"licensed",
    "licenseSource":"filmhub",
    "licenseReference":"YOUR-LICENSE-DEAL-ID",
    "territory":"PK"
  }'
```

## GitHub Actions

Repository secrets:
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

The Worker runtime secrets above still need to be configured once through Wrangler or the Cloudflare dashboard.
