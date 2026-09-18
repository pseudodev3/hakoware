import React, { useEffect, useRef, useState } from 'react';
import { Check, CheckCircle2, Loader2, MessageSquare, Pause, Play, RefreshCw } from 'lucide-react';
import { fetchVoiceNoteAudio, getMyVoiceNotes, markVoiceNoteListened } from '../../../services/voiceNoteService';
import './VoiceNotesInbox.css';

export const VoiceNotesInbox = () => {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeNoteId, setActiveNoteId] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackError, setPlaybackError] = useState('');
  const audioPlayerRef = useRef(new Audio());
  const objectUrlRef = useRef(null);
  const activeNoteIdRef = useRef(null);

  const loadNotes = async () => {
    setLoading(true);
    try {
      const data = await getMyVoiceNotes();
      setNotes(data || []);
    } catch (error) {
      console.error('Failed to load voice notes:', error);
      setPlaybackError('Voice notes could not sync.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotes();

    const player = audioPlayerRef.current;
    const handleEnded = async () => {
      setIsPlaying(false);
      const id = activeNoteIdRef.current;
      if (!id) return;

      const result = await markVoiceNoteListened(id);
      if (result.success) {
        setNotes((previous) => previous.map((note) => note.id === id ? { ...note, listened: true } : note));
      }
    };

    player.addEventListener('ended', handleEnded);
    return () => {
      player.pause();
      player.removeEventListener('ended', handleEnded);
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, []);

  const togglePlay = async (note) => {
    const player = audioPlayerRef.current;
    setPlaybackError('');

    if (activeNoteId === note.id && player.src) {
      if (isPlaying) {
        player.pause();
        setIsPlaying(false);
      } else {
        try {
          await player.play();
          setIsPlaying(true);
        } catch {
          setPlaybackError('Could not play voice note.');
        }
      }
      return;
    }

    try {
      player.pause();
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);

      const blob = await fetchVoiceNoteAudio(note.audioUrl);
      const objectUrl = URL.createObjectURL(blob);
      objectUrlRef.current = objectUrl;
      player.src = objectUrl;
      activeNoteIdRef.current = note.id;
      setActiveNoteId(note.id);
      await player.play();
      setIsPlaying(true);
    } catch (error) {
      console.error('Failed to play voice note:', error);
      setPlaybackError(error.message || 'Voice note playback failed.');
      setIsPlaying(false);
    }
  };

  const handleMarkListened = async (id) => {
    const result = await markVoiceNoteListened(id);
    if (result.success) {
      setNotes((previous) => previous.map((note) => note.id === id ? { ...note, listened: true } : note));
    }
  };

  const formatNoteTime = (value) => {
    const date = new Date(value);
    const diff = Date.now() - date.getTime();
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.max(1, Math.floor(diff / 60000))}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  return (
    <section className="voice-inbox-container" aria-labelledby="voice-inbox-title">
      <header className="inbox-header">
        <div className="title-group">
          <MessageSquare size={16} className="inbox-title-icon" aria-hidden="true" />
          <h3 id="voice-inbox-title">Voice inbox</h3>
          {!loading && notes.length > 0 && <span className="voice-count">{notes.length}</span>}
        </div>
        <button className="refresh-btn" onClick={loadNotes} disabled={loading} aria-label="Refresh voice inbox">
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
        </button>
      </header>

      {playbackError && <p className="voice-playback-error" role="status">{playbackError}</p>}

      <div className="notes-list">
        {loading && notes.length === 0 ? (
          <div className="inbox-empty">
            <Loader2 className="animate-spin" aria-hidden="true" />
            <p>Syncing…</p>
          </div>
        ) : notes.length === 0 ? (
          <div className="inbox-empty">
            <MessageSquare size={36} className="empty-icon" aria-hidden="true" />
            <p>No voice notes.</p>
          </div>
        ) : (
          notes.map((note) => {
            const active = activeNoteId === note.id;
            return (
              <article key={note.id} className={`note-card ${note.listened ? 'listened' : 'unread'}`}>
                <div className="note-main">
                  <button className="play-trigger" onClick={() => togglePlay(note)} aria-label={`${active && isPlaying ? 'Pause' : 'Play'} voice note from ${note.senderName || 'friend'}`}>
                    {active && isPlaying ? <Pause size={19} /> : <Play size={19} />}
                  </button>
                  <div className="note-info">
                    <div className="sender-row">
                      <span className="sender-name">{note.senderName || 'Friend'}</span>
                      {!note.listened && <span className="unread-tag">New</span>}
                    </div>
                    <time className="date-row" dateTime={note.createdAt}>{formatNoteTime(note.createdAt)}</time>
                  </div>
                </div>

                <div className="note-actions">
                  {note.listened ? (
                    <CheckCircle2 size={17} className="listened-icon" aria-label="Listened" />
                  ) : (
                    <button className="mark-listened-btn" onClick={() => handleMarkListened(note.id)} aria-label="Mark voice note as listened" title="Mark listened">
                      <Check size={14} strokeWidth={1.9} />
                    </button>
                  )}
                </div>
              </article>
            );
          })
        )}
      </div>
    </section>
  );
};
