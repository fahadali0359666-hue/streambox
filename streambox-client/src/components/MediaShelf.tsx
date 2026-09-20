import { Link } from 'react-router-dom';
import { imageUrl } from '../api';
import type { MediaCard, MediaType } from '../types';

function getType(item: MediaCard): MediaType {
  return item.media_type === 'tv' || (!item.title && !!item.name)
    ? 'tv'
    : 'movie';
}

export default function MediaShelf({
  title,
  items,
}: {
  title: string;
  items: MediaCard[];
}) {
  if (!items?.length) return null;

  return (
    <section className="shelf-section">
      <div className="section-heading">
        <h2>{title}</h2>
      </div>

      <div className="media-row">
        {items.map((item) => {
          const type = getType(item);
          return (
            <Link
              className="media-card"
              to={`/title/${type}/${item.id}`}
              key={`${type}-${item.id}`}
            >
              <img
                loading="lazy"
                src={imageUrl(item.poster_path, 'w342')}
                alt={item.title || item.name || 'Poster'}
              />
              <div className="card-overlay">
                <strong>{item.title || item.name}</strong>
                <span>★ {(item.vote_average || 0).toFixed(1)}</span>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
