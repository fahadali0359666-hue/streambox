import { FormEvent, useState } from 'react';
import { Play, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import type { ArchiveItem } from '../types';

export default function Archive() {
  const [query, setQuery] = useState('public domain film');
  const [items, setItems] = useState<ArchiveItem[]>([]);
  const [message, setMessage] = useState(
    'Search Internet Archive. Playback is enabled only when rights metadata indicates public-domain/cleared usage.',
  );
  const navigate = useNavigate();

  async function submit(event: FormEvent) {
    event.preventDefault();
    setMessage('Searching…');

    try {
      const data = await api.archiveSearch(query);
      setItems(data.results || []);
      setMessage(data.results?.length ? '' : 'No matching items');
    } catch (error: any) {
      setMessage(error.message);
    }
  }

  async function play(identifier: string) {
    try {
      const data = await api.archiveStream(identifier);
      if (data.playback?.available) {
        navigate(`/watch/archive/${encodeURIComponent(identifier)}`);
      } else {
        setMessage(
          data.playback?.reason || 'No cleared stream found',
        );
      }
    } catch (error: any) {
      setMessage(error.message);
    }
  }

  return (
    <div className="page content-wrap">
      <h1>Free & Public-Domain Library</h1>

      <form className="search-box" onSubmit={submit}>
        <Search size={20} />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <button>Search</button>
      </form>

      {message && <p className="muted">{message}</p>}

      <div className="archive-grid">
        {items.map((item) => (
          <article key={item.identifier} className="archive-card">
            <div>
              <h3>{item.title}</h3>
              <p>{item.date || ''}</p>
              <small>
                {Array.isArray(item.creator)
                  ? item.creator.join(', ')
                  : item.creator || 'Internet Archive'}
              </small>
            </div>
            <button onClick={() => play(item.identifier)}>
              <Play size={16} />
              Check & play
            </button>
          </article>
        ))}
      </div>
    </div>
  );
}
