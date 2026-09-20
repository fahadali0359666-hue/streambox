import type {
  ArchiveItem,
  HomePayload,
  MediaType,
  TitlePayload,
} from './types';

export const API_BASE = (
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:8787'
).replace(/\/$/, '');

async function get<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`);
  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || `Request failed (${response.status})`);
  }
  return response.json() as Promise<T>;
}

export const api = {
  home: () => get<HomePayload>('/v1/home'),

  search: (query: string, page = 1) =>
    get<{ results: any[]; page: number; total_pages: number }>(
      `/v1/search?q=${encodeURIComponent(query)}&page=${page}`,
    ),

  title: (type: MediaType, id: string) =>
    get<TitlePayload>(`/v1/title/${type}/${id}?region=PK`),

  playback: (catalogId: string) =>
    get<{ playback: any }>(
      `/v1/playback/${encodeURIComponent(catalogId)}`,
    ),

  archiveSearch: (query: string) =>
    get<{ results: ArchiveItem[] }>(
      `/v1/archive/search?q=${encodeURIComponent(query)}`,
    ),

  archiveStream: (identifier: string) =>
    get<{ playback: any; metadata: any }>(
      `/v1/archive/${encodeURIComponent(identifier)}/stream`,
    ),
};

export const imageUrl = (
  path?: string | null,
  size = 'w500',
) =>
  path
    ? `https://image.tmdb.org/t/p/${size}${path}`
    : 'https://placehold.co/500x750/161a22/9aa4b2?text=No+Poster';
