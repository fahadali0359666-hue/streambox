import api from '../streambox-api/src/index';

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  ADMIN_TOKEN?: string;
  CONFIG_ENCRYPTION_KEY?: string;
  TMDB_READ_TOKEN?: string;
  WATCHMODE_API_KEY?: string;
  MUX_TOKEN_ID?: string;
  MUX_TOKEN_SECRET?: string;
  ALLOWED_ORIGIN?: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (
      url.pathname === '/admin' ||
      url.pathname === '/health' ||
      url.pathname.startsWith('/v1/')
    ) {
      return api.fetch(request, env as any);
    }

    return env.ASSETS.fetch(request);
  },
};
