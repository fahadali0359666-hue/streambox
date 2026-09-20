import { ExternalLink, Play } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, imageUrl } from '../api';
import MediaShelf from '../components/MediaShelf';
import type { MediaType, TitlePayload } from '../types';

export default function Details() {
  const { type = 'movie', id = '' } = useParams();
  const [data, setData] = useState<TitlePayload | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .title(type as MediaType, id)
      .then(setData)
      .catch((err) => setError(err.message));
  }, [type, id]);

  if (error) return <div className="state-card">{error}</div>;
  if (!data) return <div className="loading-grid">Loading title…</div>;

  const item = data.item;
  const title = item.title || item.name;
  const year = (
    item.release_date ||
    item.first_air_date ||
    ''
  ).slice(0, 4);

  return (
    <>
      <section
        className="detail-hero"
        style={{
          backgroundImage: `linear-gradient(0deg,#090b10 3%,rgba(9,11,16,.2) 65%,rgba(9,11,16,.55)),url(${imageUrl(
            item.backdrop_path,
            'original',
          )})`,
        }}
      >
        <div className="detail-panel">
          <img
            className="detail-poster"
            src={imageUrl(item.poster_path, 'w500')}
            alt={title}
          />

          <div className="detail-copy">
            <span className="eyebrow">
              {type === 'tv' ? 'SERIES' : 'MOVIE'}
            </span>
            <h1>{title}</h1>

            <div className="meta-line">
              <span>{year}</span>
              <span>★ {(item.vote_average || 0).toFixed(1)}</span>
              <span>
                {item.genres
                  ?.map((genre: any) => genre.name)
                  .slice(0, 3)
                  .join(' • ')}
              </span>
            </div>

            <p>{item.overview || 'No overview available.'}</p>

            <div className="hero-actions">
              {data.playback.available ? (
                <Link
                  className="primary-btn"
                  to={`/watch/catalog/${encodeURIComponent(
                    `tmdb:${type}:${id}`,
                  )}`}
                >
                  <Play size={18} />
                  Play
                </Link>
              ) : (
                <span className="disabled-btn">
                  Playback not licensed in this catalog
                </span>
              )}
            </div>
          </div>
        </div>
      </section>

      <div className="content-wrap">
        <section className="provider-section">
          <h2>Where to watch</h2>

          {data.watchmode.available &&
          data.watchmode.sources.length ? (
            <div className="providers">
              {data.watchmode.sources.slice(0, 12).map((provider, index) => (
                <a
                  key={`${provider.name}-${index}`}
                  href={provider.web_url}
                  target="_blank"
                  rel="noreferrer"
                >
                  <span>{provider.name}</span>
                  <small>{provider.type}</small>
                  <ExternalLink size={15} />
                </a>
              ))}
            </div>
          ) : (
            <p className="muted">
              Add WATCHMODE_API_KEY to show streaming-provider
              availability.
            </p>
          )}
        </section>

        <MediaShelf
          title="You may also like"
          items={item.recommendations?.results || []}
        />
      </div>
    </>
  );
}
