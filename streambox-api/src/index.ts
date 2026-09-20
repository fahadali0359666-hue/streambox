import { adminDashboard, isAdmin, makeSession, providerRuntime, providerSummaries, saveProvider, testProvider } from './admin';
import { ADMIN_HTML } from './admin-ui';
import { ensureSchema } from './schema';

export interface Env {
  DB: D1Database;
  TMDB_READ_TOKEN: string;
  WATCHMODE_API_KEY?: string;
  ADMIN_TOKEN?: string;
  CONFIG_ENCRYPTION_KEY?: string;
  MUX_TOKEN_ID?: string;
  MUX_TOKEN_SECRET?: string;
  ALLOWED_ORIGIN?: string;
}

const TMDB = 'https://api.themoviedb.org/3';
const WATCHMODE = 'https://api.watchmode.com/v1';
const ARCHIVE = 'https://archive.org';

function cors(env: Env) {
  return {
    'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN || '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    Vary: 'Origin',
  };
}

function json(data: unknown, status = 200, env?: Env) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...(env ? cors(env) : {}),
    },
  });
}

async function fetchJson(url: string, init?: RequestInit, ttl = 300): Promise<any> {
  const cache = await caches.open('streambox-api');
  const request = new Request(url, init);
  const method = init?.method || 'GET';

  if (method === 'GET') {
    const hit = await cache.match(request);
    if (hit) return hit.json();
  }

  const response = await fetch(request);
  const text = await response.text();
  let body: any;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }

  if (!response.ok) {
    throw new Error(
      `Upstream ${response.status}: ${
        typeof body === 'string'
          ? body.slice(0, 180)
          : JSON.stringify(body).slice(0, 180)
      }`,
    );
  }

  if (method === 'GET') {
    const cacheResponse = new Response(JSON.stringify(body), {
      headers: {
        'content-type': 'application/json',
        'Cache-Control': `public, max-age=${ttl}`,
      },
    });
    await cache.put(request, cacheResponse);
  }

  return body;
}

async function tmdb(
  env: Env,
  path: string,
  params: Record<string, string> = {},
) {
  const provider = await providerRuntime(env, 'tmdb');
  if (!provider.enabled) throw new Error('TMDB provider is disabled');
  const token = String(provider.config?.readToken || '');
  if (!token) throw new Error('TMDB token is not configured');
  const url = new URL(`${TMDB}${path}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  return fetchJson(
    url.toString(),
    {
      headers: {
        Authorization: `Bearer ${token}`,
        accept: 'application/json',
      },
    },
    600,
  );
}

async function watchmodeByTmdb(
  env: Env,
  tmdbId: string,
  region: string,
) {
  const provider = await providerRuntime(env, 'watchmode');
  if (!provider.enabled) return { available: false, sources: [] };
  const apiKey = String(provider.config?.apiKey || '');
  if (!apiKey) return { available: false, sources: [] };

  const search = new URL(`${WATCHMODE}/search/`);
  search.searchParams.set('apiKey', apiKey);
  search.searchParams.set('search_field', 'tmdb_id');
  search.searchParams.set('search_value', tmdbId);

  const mapped = await fetchJson(search.toString(), undefined, 3600);
  const hit = mapped?.title_results?.[0];
  if (!hit?.id) {
    return { available: true, sources: [] };
  }

  const sources = new URL(`${WATCHMODE}/title/${hit.id}/sources/`);
  sources.searchParams.set('apiKey', apiKey);
  if (region) sources.searchParams.set('regions', region.toUpperCase());

  const result = await fetchJson(sources.toString(), undefined, 900);
  return {
    available: true,
    watchmodeId: hit.id,
    sources: Array.isArray(result) ? result : [],
  };
}

function activeByTime(row: any) {
  const now = Date.now();
  if (row.starts_at && Date.parse(row.starts_at) > now) return false;
  if (row.ends_at && Date.parse(row.ends_at) < now) return false;
  return true;
}

async function playbackFor(env: Env, catalogId: string) {
  const row = await env.DB.prepare(
    'SELECT * FROM streams WHERE catalog_id = ? LIMIT 1',
  )
    .bind(catalogId)
    .first<any>();

  if (!row || !activeByTime(row)) {
    return {
      available: false,
      reason: 'No active licensed/public-domain stream registered',
    };
  }

  if (!['licensed', 'public_domain'].includes(row.rights_status)) {
    return { available: false, reason: 'Rights not cleared' };
  }

  const playbackProvider = await providerRuntime(
    env,
    row.source_type === 'mux' ? 'mux' : 'direct',
  );
  if (!playbackProvider.enabled) {
    return { available: false, reason: 'Playback provider is disabled' };
  }

  if (row.source_type === 'mux' && row.playback_id) {
    return {
      available: true,
      source: 'mux',
      url: `https://stream.mux.com/${row.playback_id}.m3u8`,
      title: row.title,
      rights_status: row.rights_status,
    };
  }

  if (row.source_type === 'direct' && row.stream_url) {
    return {
      available: true,
      source: 'direct',
      url: row.stream_url,
      title: row.title,
      rights_status: row.rights_status,
    };
  }

  return { available: false, reason: 'Stream record is incomplete' };
}

function archiveRights(metadata: any) {
  const license = String(metadata?.licenseurl || '');
  const rights = String(metadata?.rights || metadata?.access_restricted_item || '');
  const text = `${license} ${rights}`.toLowerCase();

  const cleared =
    text.includes('creativecommons.org/publicdomain') ||
    text.includes('public domain') ||
    text.includes('/publicdomain/');

  return { cleared, license, rights };
}

function chooseArchiveVideo(files: any[]) {
  const candidates = (files || []).filter(
    (file) =>
      typeof file?.name === 'string' &&
      /\.(mp4|m4v|ogv|webm)$/i.test(file.name) &&
      !/thumb|sample|trailer/i.test(file.name),
  );

  candidates.sort(
    (a, b) => Number(b.size || 0) - Number(a.size || 0),
  );

  return candidates[0];
}

async function handleArchiveSearch(env: Env, url: URL) {
  const provider = await providerRuntime(env, 'internet_archive');
  if (!provider.enabled) throw new Error('Internet Archive provider is disabled');
  const query = (url.searchParams.get('q') || '').trim();
  if (!query) return { results: [] };

  const upstream = new URL(`${ARCHIVE}/advancedsearch.php`);
  upstream.searchParams.set(
    'q',
    `mediatype:movies AND (${query.replace(/[()]/g, ' ')})`,
  );
  for (const field of [
    'identifier',
    'title',
    'description',
    'date',
    'creator',
    'licenseurl',
    'rights',
  ]) {
    upstream.searchParams.append('fl[]', field);
  }
  upstream.searchParams.set('rows', '24');
  upstream.searchParams.set('page', '1');
  upstream.searchParams.set('output', 'json');

  const data = await fetchJson(upstream.toString(), undefined, 600);
  return { results: data?.response?.docs || [] };
}

async function handleArchiveStream(env: Env, identifier: string) {
  const provider = await providerRuntime(env, 'internet_archive');
  if (!provider.enabled) throw new Error('Internet Archive provider is disabled');
  const metadata = await fetchJson(
    `${ARCHIVE}/metadata/${encodeURIComponent(identifier)}`,
    undefined,
    1800,
  );

  const rights = archiveRights(metadata?.metadata || {});
  if (!rights.cleared) {
    return {
      playback: {
        available: false,
        reason:
          'Internet Archive item does not expose rights metadata that this app can automatically verify as public domain.',
      },
      metadata: {
        identifier,
        title: metadata?.metadata?.title,
        ...rights,
      },
    };
  }

  const file = chooseArchiveVideo(metadata?.files || []);
  if (!file) {
    return {
      playback: {
        available: false,
        reason: 'No compatible video file found.',
      },
      metadata: {
        identifier,
        title: metadata?.metadata?.title,
        ...rights,
      },
    };
  }

  const mediaUrl = `${ARCHIVE}/download/${encodeURIComponent(
    identifier,
  )}/${file.name
    .split('/')
    .map(encodeURIComponent)
    .join('/')}`;

  return {
    playback: {
      available: true,
      source: 'direct',
      url: mediaUrl,
      title: metadata?.metadata?.title,
      rights_status: 'public_domain',
    },
    metadata: {
      identifier,
      title: metadata?.metadata?.title,
      ...rights,
    },
  };
}

async function createMuxAsset(env: Env, body: any) {
  const provider = await providerRuntime(env, 'mux');
  if (!provider.enabled) throw new Error('Mux provider is disabled');
  const tokenId = String(provider.config?.tokenId || '');
  const tokenSecret = String(provider.config?.tokenSecret || '');
  if (!tokenId || !tokenSecret) {
    throw new Error('Mux credentials are not configured');
  }
  if (!body?.inputUrl || !body?.catalogId || !body?.title) {
    throw new Error('inputUrl, catalogId and title are required');
  }
  if (!['licensed', 'public_domain'].includes(body.rightsStatus)) {
    throw new Error('rightsStatus must be licensed or public_domain');
  }
  if (!body.licenseSource || !body.licenseReference) {
    throw new Error('licenseSource and licenseReference are required');
  }

  const auth = btoa(`${tokenId}:${tokenSecret}`);
  const asset = await fetchJson(
    'https://api.mux.com/video/v1/assets',
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        inputs: [{ url: body.inputUrl }],
        playback_policies: ['public'],
        video_quality: 'basic',
      }),
    },
    0,
  );

  const playbackId = asset?.data?.playback_ids?.[0]?.id || null;

  await env.DB.prepare(
    `INSERT INTO streams (
      catalog_id,title,source_type,playback_id,rights_status,
      license_source,license_reference,territory,starts_at,ends_at
    )
    VALUES (?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(catalog_id) DO UPDATE SET
      title=excluded.title,
      source_type=excluded.source_type,
      playback_id=excluded.playback_id,
      rights_status=excluded.rights_status,
      license_source=excluded.license_source,
      license_reference=excluded.license_reference,
      territory=excluded.territory,
      starts_at=excluded.starts_at,
      ends_at=excluded.ends_at,
      updated_at=datetime('now')`,
  )
    .bind(
      body.catalogId,
      body.title,
      'mux',
      playbackId,
      body.rightsStatus,
      body.licenseSource,
      body.licenseReference,
      body.territory || 'WORLD',
      body.startsAt || null,
      body.endsAt || null,
    )
    .run();

  return { asset: asset?.data, catalogId: body.catalogId };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: cors(env),
      });
    }

    const url = new URL(request.url);
    const parts = url.pathname.split('/').filter(Boolean);

    try {
      // The /admin shell can render before DB access; all API routes self-initialize D1.
      if (request.method === 'GET' && url.pathname === '/admin') {
        return new Response(ADMIN_HTML, {
          headers: {
            'content-type': 'text/html; charset=utf-8',
            'cache-control': 'no-store',
            'x-frame-options': 'DENY',
          },
        });
      }

      if (request.method === 'POST' && url.pathname === '/v1/admin/session') {
        const body: any = await request.json();
        if (!env.ADMIN_TOKEN || body?.token !== env.ADMIN_TOKEN) {
          return json({ error: 'Invalid admin token' }, 401, env);
        }
        const session = await makeSession(env);
        return new Response(JSON.stringify({ ok: true, expiresAt: session.expires }), {
          status: 200,
          headers: {
            'content-type': 'application/json; charset=utf-8',
            'set-cookie': `streambox_admin=${session.value}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=43200`,
            'cache-control': 'no-store',
          },
        });
      }

      if (request.method === 'DELETE' && url.pathname === '/v1/admin/session') {
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: {
            'content-type': 'application/json; charset=utf-8',
            'set-cookie': 'streambox_admin=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0',
            'cache-control': 'no-store',
          },
        });
      }

      if (url.pathname.startsWith('/v1/') || url.pathname === '/health') {
        await ensureSchema(env.DB);
      }

      if (request.method === 'GET' && url.pathname === '/v1/admin/dashboard') {
        if (!(await isAdmin(request, env))) return json({ error: 'Unauthorized' }, 401, env);
        return json(await adminDashboard(env), 200, env);
      }

      if (request.method === 'GET' && url.pathname === '/v1/admin/providers') {
        if (!(await isAdmin(request, env))) return json({ error: 'Unauthorized' }, 401, env);
        return json({ providers: await providerSummaries(env) }, 200, env);
      }

      if (
        request.method === 'PUT' &&
        parts[0] === 'v1' &&
        parts[1] === 'admin' &&
        parts[2] === 'providers' &&
        parts[3]
      ) {
        if (!(await isAdmin(request, env))) return json({ error: 'Unauthorized' }, 401, env);
        const providers = await saveProvider(env, parts[3], await request.json());
        return json({ providers }, 200, env);
      }

      if (
        request.method === 'POST' &&
        parts[0] === 'v1' &&
        parts[1] === 'admin' &&
        parts[2] === 'providers' &&
        parts[3] &&
        parts[4] === 'test'
      ) {
        if (!(await isAdmin(request, env))) return json({ error: 'Unauthorized' }, 401, env);
        return json(await testProvider(env, parts[3]), 200, env);
      }

      if (request.method === 'GET' && url.pathname === '/health') {
        return json(
          {
            ok: true,
            service: 'streambox-api',
            providers: Object.fromEntries(
              (await providerSummaries(env)).map((provider) => [
                provider.id,
                { enabled: provider.enabled, configured: provider.secretConfigured },
              ]),
            ),
          },
          200,
          env,
        );
      }

      if (request.method === 'GET' && url.pathname === '/v1/home') {
        const [trending, movies, tv, now] = await Promise.all([
          tmdb(env, '/trending/all/day'),
          tmdb(env, '/movie/popular'),
          tmdb(env, '/tv/popular'),
          tmdb(env, '/movie/now_playing'),
        ]);

        return json(
          {
            trending: (trending.results || []).filter(
              (item: any) => item.media_type !== 'person',
            ),
            popularMovies: movies.results || [],
            popularTv: tv.results || [],
            nowPlaying: now.results || [],
          },
          200,
          env,
        );
      }

      if (request.method === 'GET' && url.pathname === '/v1/search') {
        const query = (url.searchParams.get('q') || '').trim();
        const page = url.searchParams.get('page') || '1';

        if (!query) {
          return json(
            { results: [], page: 1, total_pages: 0 },
            200,
            env,
          );
        }

        const data = await tmdb(env, '/search/multi', {
          query,
          page,
          include_adult: 'false',
        });

        data.results = (data.results || []).filter(
          (item: any) => item.media_type !== 'person',
        );
        return json(data, 200, env);
      }

      if (
        request.method === 'GET' &&
        parts[0] === 'v1' &&
        parts[1] === 'title' &&
        ['movie', 'tv'].includes(parts[2]) &&
        parts[3]
      ) {
        const type = parts[2];
        const id = parts[3];
        const region = url.searchParams.get('region') || 'PK';

        const [item, watchmode, playback] = await Promise.all([
          tmdb(env, `/${type}/${id}`, {
            append_to_response: 'videos,recommendations,external_ids',
          }),
          watchmodeByTmdb(env, id, region).catch(() => ({
            available: false,
            sources: [],
          })),
          playbackFor(env, `tmdb:${type}:${id}`),
        ]);

        return json(
          { item, mediaType: type, watchmode, playback },
          200,
          env,
        );
      }

      if (
        request.method === 'GET' &&
        parts[0] === 'v1' &&
        parts[1] === 'playback' &&
        parts[2]
      ) {
        return json(
          {
            playback: await playbackFor(
              env,
              decodeURIComponent(parts.slice(2).join('/')),
            ),
          },
          200,
          env,
        );
      }

      if (
        request.method === 'GET' &&
        url.pathname === '/v1/archive/search'
      ) {
        return json(await handleArchiveSearch(env, url), 200, env);
      }

      if (
        request.method === 'GET' &&
        parts[0] === 'v1' &&
        parts[1] === 'archive' &&
        parts[2] &&
        parts[3] === 'stream'
      ) {
        return json(
          await handleArchiveStream(env, decodeURIComponent(parts[2])),
          200,
          env,
        );
      }

      if (
        request.method === 'POST' &&
        url.pathname === '/v1/admin/licenses'
      ) {
        if (!(await isAdmin(request, env))) {
          return json({ error: 'Unauthorized' }, 401, env);
        }

        const body: any = await request.json();
        if (!body.catalogId || !body.marketplace || !body.reference) {
          return json(
            { error: 'catalogId, marketplace, reference required' },
            400,
            env,
          );
        }

        if (
          !['filmhub', 'vuulr', 'direct'].includes(
            String(body.marketplace).toLowerCase(),
          )
        ) {
          return json(
            { error: 'marketplace must be filmhub, vuulr, or direct' },
            400,
            env,
          );
        }

        await env.DB.prepare(
          'INSERT INTO license_records (catalog_id,marketplace,reference,territory,starts_at,ends_at,notes) VALUES (?,?,?,?,?,?,?)',
        )
          .bind(
            body.catalogId,
            body.marketplace,
            body.reference,
            body.territory || 'WORLD',
            body.startsAt || null,
            body.endsAt || null,
            body.notes || null,
          )
          .run();

        return json({ ok: true }, 201, env);
      }

      if (
        request.method === 'POST' &&
        url.pathname === '/v1/admin/mux/assets'
      ) {
        if (!(await isAdmin(request, env))) {
          return json({ error: 'Unauthorized' }, 401, env);
        }
        return json(
          await createMuxAsset(env, await request.json()),
          201,
          env,
        );
      }

      if (
        request.method === 'POST' &&
        url.pathname === '/v1/admin/streams/direct'
      ) {
        if (!(await isAdmin(request, env))) {
          return json({ error: 'Unauthorized' }, 401, env);
        }

        const body: any = await request.json();
        if (
          !body.catalogId ||
          !body.title ||
          !body.streamUrl ||
          !body.licenseSource ||
          !body.licenseReference ||
          !['licensed', 'public_domain'].includes(body.rightsStatus)
        ) {
          return json(
            {
              error:
                'catalogId,title,streamUrl,rightsStatus,licenseSource,licenseReference required',
            },
            400,
            env,
          );
        }

        await env.DB.prepare(
          `INSERT INTO streams (
            catalog_id,title,source_type,stream_url,rights_status,
            license_source,license_reference,territory,starts_at,ends_at
          )
          VALUES (?,?,?,?,?,?,?,?,?,?)
          ON CONFLICT(catalog_id) DO UPDATE SET
            title=excluded.title,
            source_type=excluded.source_type,
            stream_url=excluded.stream_url,
            rights_status=excluded.rights_status,
            license_source=excluded.license_source,
            license_reference=excluded.license_reference,
            territory=excluded.territory,
            starts_at=excluded.starts_at,
            ends_at=excluded.ends_at,
            updated_at=datetime('now')`,
        )
          .bind(
            body.catalogId,
            body.title,
            'direct',
            body.streamUrl,
            body.rightsStatus,
            body.licenseSource,
            body.licenseReference,
            body.territory || 'WORLD',
            body.startsAt || null,
            body.endsAt || null,
          )
          .run();

        return json({ ok: true }, 201, env);
      }

      return json({ error: 'Not found' }, 404, env);
    } catch (error: any) {
      return json(
        { error: error?.message || 'Internal error' },
        500,
        env,
      );
    }
  },
};
