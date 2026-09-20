export interface AdminEnv {
  DB: D1Database;
  ADMIN_TOKEN?: string;
  CONFIG_ENCRYPTION_KEY?: string;
  TMDB_READ_TOKEN?: string;
  WATCHMODE_API_KEY?: string;
  MUX_TOKEN_ID?: string;
  MUX_TOKEN_SECRET?: string;
}

export type ProviderId =
  | 'tmdb'
  | 'watchmode'
  | 'internet_archive'
  | 'mux'
  | 'filmhub'
  | 'vuulr'
  | 'direct';

export const PROVIDERS = [
  { id: 'tmdb', name: 'TMDB', purpose: 'Movie/TV metadata, posters, search and recommendations.', secrets: ['readToken'], fields: [] },
  { id: 'watchmode', name: 'Watchmode', purpose: 'Where-to-watch availability and provider links.', secrets: ['apiKey'], fields: ['defaultRegion'] },
  { id: 'internet_archive', name: 'Internet Archive', purpose: 'Public-domain / rights-cleared video search and playback.', secrets: [], fields: [] },
  { id: 'mux', name: 'Mux', purpose: 'HLS transcoding and playback for authorized masters.', secrets: ['tokenId', 'tokenSecret'], fields: [] },
  { id: 'filmhub', name: 'Filmhub', purpose: 'Content licensing workflow and deal references.', secrets: [], fields: ['accountReference'] },
  { id: 'vuulr', name: 'Vuulr', purpose: 'Content licensing marketplace and deal references.', secrets: [], fields: ['accountReference'] },
  { id: 'direct', name: 'Direct Streams', purpose: 'Authorized direct HLS/MP4 streams registered manually.', secrets: [], fields: [] },
] as const;

function b64(bytes: Uint8Array) {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}
function unb64(value: string) {
  return Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
}
async function aesKey(secret: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret));
  return crypto.subtle.importKey('raw', digest, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}
async function encrypt(secret: string, config: Record<string, any>) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    await aesKey(secret),
    new TextEncoder().encode(JSON.stringify(config)),
  );
  return b64(iv) + '.' + b64(new Uint8Array(cipher));
}
async function decrypt(secret: string, payload?: string | null) {
  if (!payload) return {};
  const [iv, cipher] = payload.split('.');
  if (!iv || !cipher) throw new Error('Invalid encrypted provider config');
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: unb64(iv) },
    await aesKey(secret),
    unb64(cipher),
  );
  return JSON.parse(new TextDecoder().decode(plain));
}

function legacy(env: AdminEnv, id: ProviderId) {
  if (id === 'tmdb') return { enabled: !!env.TMDB_READ_TOKEN, config: { readToken: env.TMDB_READ_TOKEN || '' }, source: 'worker-secret' };
  if (id === 'watchmode') return { enabled: !!env.WATCHMODE_API_KEY, config: { apiKey: env.WATCHMODE_API_KEY || '', defaultRegion: 'PK' }, source: 'worker-secret' };
  if (id === 'mux') return { enabled: !!(env.MUX_TOKEN_ID && env.MUX_TOKEN_SECRET), config: { tokenId: env.MUX_TOKEN_ID || '', tokenSecret: env.MUX_TOKEN_SECRET || '' }, source: 'worker-secret' };
  return { enabled: true, config: {}, source: 'default' };
}

export async function providerRuntime(env: AdminEnv, id: ProviderId) {
  const row = await env.DB.prepare(
    'SELECT provider, enabled, config_encrypted, updated_at FROM provider_settings WHERE provider = ? LIMIT 1',
  ).bind(id).first<any>();
  if (!row) return legacy(env, id);
  if (!env.CONFIG_ENCRYPTION_KEY) {
    return { enabled: !!row.enabled, config: {}, source: 'admin', configError: 'CONFIG_ENCRYPTION_KEY is missing', updatedAt: row.updated_at };
  }
  return {
    enabled: !!row.enabled,
    config: await decrypt(env.CONFIG_ENCRYPTION_KEY, row.config_encrypted),
    source: 'admin',
    updatedAt: row.updated_at,
  };
}

export async function providerSummaries(env: AdminEnv) {
  const rows = [];
  for (const def of PROVIDERS) {
    const runtime = await providerRuntime(env, def.id);
    const publicConfig: Record<string, string> = {};
    for (const key of def.fields) publicConfig[key] = String((runtime.config as any)?.[key] || '');
    const secretConfigured: Record<string, boolean> = {};
    for (const key of def.secrets) secretConfigured[key] = !!String((runtime.config as any)?.[key] || '').trim();
    rows.push({
      id: def.id, name: def.name, purpose: def.purpose,
      enabled: runtime.enabled, source: runtime.source,
      updatedAt: (runtime as any).updatedAt || null,
      configError: (runtime as any).configError || null,
      publicConfig, secretConfigured,
    });
  }
  return rows;
}

export async function saveProvider(env: AdminEnv, id: string, body: any) {
  const def = PROVIDERS.find((p) => p.id === id);
  if (!def) throw new Error('Unsupported provider');
  if (!env.CONFIG_ENCRYPTION_KEY) throw new Error('CONFIG_ENCRYPTION_KEY must be configured before saving provider settings');
  const current = await providerRuntime(env, def.id);
  const config: Record<string, any> = { ...(current.config || {}) };
  for (const key of def.secrets) {
    const value = body?.config?.[key];
    if (typeof value === 'string' && value.trim()) config[key] = value.trim();
  }
  for (const key of def.fields) {
    const value = body?.config?.[key];
    if (typeof value === 'string') config[key] = value.trim();
  }
  const payload = await encrypt(env.CONFIG_ENCRYPTION_KEY, config);
  await env.DB.prepare(
    `INSERT INTO provider_settings (provider,enabled,config_encrypted,updated_at)
     VALUES (?,?,?,datetime('now'))
     ON CONFLICT(provider) DO UPDATE SET
       enabled=excluded.enabled,config_encrypted=excluded.config_encrypted,updated_at=datetime('now')`,
  ).bind(def.id, body?.enabled === false ? 0 : 1, payload).run();
  return providerSummaries(env);
}

async function sign(env: AdminEnv, value: string) {
  if (!env.ADMIN_TOKEN) throw new Error('ADMIN_TOKEN is not configured');
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(env.ADMIN_TOKEN),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value));
  return b64(new Uint8Array(sig)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}
function cookie(request: Request, name: string) {
  for (const part of (request.headers.get('cookie') || '').split(';')) {
    const [key, ...value] = part.trim().split('=');
    if (key === name) return value.join('=');
  }
  return '';
}
export async function makeSession(env: AdminEnv) {
  const expires = Math.floor(Date.now() / 1000) + 60 * 60 * 12;
  return { value: String(expires) + '.' + await sign(env, 'admin:' + expires), expires };
}
export async function isAdmin(request: Request, env: AdminEnv) {
  if (!env.ADMIN_TOKEN) return false;
  if (request.headers.get('authorization') === 'Bearer ' + env.ADMIN_TOKEN) return true;
  const value = cookie(request, 'streambox_admin');
  const [expiresRaw, signature] = value.split('.');
  const expires = Number(expiresRaw);
  if (!expires || expires < Math.floor(Date.now() / 1000) || !signature) return false;
  return signature === await sign(env, 'admin:' + expires);
}

export async function adminDashboard(env: AdminEnv) {
  const [streams, licenses, streamCount, licenseCount, providers] = await Promise.all([
    env.DB.prepare(`SELECT catalog_id,title,source_type,rights_status,license_source,license_reference,territory,starts_at,ends_at,updated_at FROM streams ORDER BY updated_at DESC LIMIT 100`).all(),
    env.DB.prepare(`SELECT id,catalog_id,marketplace,reference,territory,starts_at,ends_at,notes,created_at FROM license_records ORDER BY created_at DESC LIMIT 100`).all(),
    env.DB.prepare('SELECT COUNT(*) AS count FROM streams').first<any>(),
    env.DB.prepare('SELECT COUNT(*) AS count FROM license_records').first<any>(),
    providerSummaries(env),
  ]);
  return {
    stats: {
      providersEnabled: providers.filter((p) => p.enabled).length,
      providersTotal: providers.length,
      streams: Number(streamCount?.count || 0),
      licenses: Number(licenseCount?.count || 0),
    },
    providers,
    streams: streams.results || [],
    licenses: licenses.results || [],
  };
}
