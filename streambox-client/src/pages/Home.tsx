import { Play, Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, imageUrl } from '../api';
import MediaShelf from '../components/MediaShelf';
import type { HomePayload } from '../types';

export default function Home() {
  const [data, setData] = useState<HomePayload | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.home().then(setData).catch((err) => setError(err.message));
  }, []);

  if (error) {
    return (
      <div className="state-card">
        <h2>Backend not configured yet</h2>
        <p>{error}</p>
        <p>
          Add the Worker URL to <code>VITE_API_BASE_URL</code> and
          TMDB token to the backend.
        </p>
      </div>
    );
  }

  if (!data) {
    return <div className="loading-grid">Loading StreamBox…</div>;
  }

  const hero = data.trending[0];
  const heroType =
    hero?.media_type || (hero?.name ? 'tv' : 'movie');

  return (
    <>
      {hero && (
        <section
          className="hero"
          style={{
            backgroundImage: `linear-gradient(90deg, rgba(7,9,13,.96) 0%, rgba(7,9,13,.7) 40%, rgba(7,9,13,.18) 75%, rgba(7,9,13,.94) 100%), url(${imageUrl(
              hero.backdrop_path,
              'original',
            )})`,
          }}
        >
          <div className="hero-content">
            <div className="eyebrow">TRENDING NOW</div>
            <h1>{hero.title || hero.name}</h1>
            <p>{hero.overview}</p>

            <div className="hero-actions">
              <Link
                className="primary-btn"
                to={`/title/${heroType}/${hero.id}`}
              >
                <Play size={18} />
                View details
              </Link>

              <Link className="secondary-btn" to="/search">
                <Search size={18} />
                Search library
              </Link>
            </div>
          </div>
        </section>
      )}

      <div className="content-wrap">
        <MediaShelf title="Trending" items={data.trending} />
        <MediaShelf
          title="Popular Movies"
          items={data.popularMovies}
        />
        <MediaShelf
          title="Popular Series"
          items={data.popularTv}
        />
        <MediaShelf
          title="Now Playing"
          items={data.nowPlaying}
        />
      </div>
    </>
  );
}
