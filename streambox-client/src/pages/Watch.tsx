import Hls from 'hls.js';
import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api';

export default function Watch() {
  const { source = '', id = '' } = useParams();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('StreamBox Player');
  const [error, setError] = useState('');

  useEffect(() => {
    const load =
      source === 'archive'
        ? api.archiveStream(id)
        : api.playback(id);

    load
      .then((data: any) => {
        const playback = data.playback;
        if (!playback?.available || !playback.url) {
          throw new Error(
            playback?.reason || 'Playback unavailable',
          );
        }
        setUrl(playback.url);
        setTitle(playback.title || 'StreamBox Player');
      })
      .catch((err) => setError(err.message));
  }, [source, id]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !url) return;

    if (url.includes('.m3u8') && Hls.isSupported()) {
      const hls = new Hls();
      hls.loadSource(url);
      hls.attachMedia(video);
      return () => hls.destroy();
    }

    video.src = url;
  }, [url]);

  return (
    <div className="watch-page">
      <h1>{title}</h1>

      {error ? (
        <div className="state-card">{error}</div>
      ) : (
        <div className="player-frame">
          <video
            ref={videoRef}
            controls
            playsInline
            autoPlay
          />
        </div>
      )}

      <p className="muted">
        StreamBox only plays sources registered as
        licensed/public-domain in the backend.
      </p>
    </div>
  );
}
