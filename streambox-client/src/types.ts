export type MediaType = 'movie' | 'tv';

export interface MediaCard {
  id: number;
  media_type?: MediaType;
  title?: string;
  name?: string;
  overview?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  vote_average?: number;
  release_date?: string;
  first_air_date?: string;
}

export interface HomePayload {
  trending: MediaCard[];
  popularMovies: MediaCard[];
  popularTv: MediaCard[];
  nowPlaying: MediaCard[];
}

export interface ProviderLink {
  name: string;
  type: string;
  region?: string;
  web_url?: string;
  ios_url?: string;
  android_url?: string;
}

export interface Playback {
  available: boolean;
  source?: 'mux' | 'direct';
  url?: string;
  title?: string;
  rights_status?: string;
}

export interface TitlePayload {
  item: any;
  mediaType: MediaType;
  watchmode: {
    available: boolean;
    sources: ProviderLink[];
  };
  playback: Playback;
}

export interface ArchiveItem {
  identifier: string;
  title: string;
  description?: string;
  date?: string;
  creator?: string | string[];
  licenseurl?: string;
}
