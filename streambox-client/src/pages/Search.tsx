import { Search as SearchIcon } from 'lucide-react';
import { FormEvent, useState } from 'react';
import MediaShelf from '../components/MediaShelf';
import { api } from '../api';

export default function Search() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(
    'Search movies and TV series',
  );

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!query.trim()) return;

    setBusy(true);

    try {
      const data = await api.search(query.trim());
      setResults(data.results || []);
      setMessage(
        data.results?.length ? '' : 'No results found',
      );
    } catch (error: any) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page content-wrap search-page">
      <h1>Search</h1>

      <form className="search-box" onSubmit={submit}>
        <SearchIcon size={20} />
        <input
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Movies, series…"
        />
        <button disabled={busy}>
          {busy ? 'Searching…' : 'Search'}
        </button>
      </form>

      {message && <p className="muted">{message}</p>}
      <MediaShelf title="Results" items={results} />
    </div>
  );
}
