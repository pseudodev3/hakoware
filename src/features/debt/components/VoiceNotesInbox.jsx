import React, { useEffect, useRef, useState } from 'react';
import { Calendar, CheckCircle2, Loader2, MessageSquare, Pause, Play, RefreshCw, User } from 'lucide-react';
import { Button } from '../../../shared/components/Button';
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
      setPlaybackError('Could not sync voice notes.');
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
          setPlaybackError('Playback could not start.');
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

  return (
    <section className="voice-inbox-container" aria-labelledby="voice-inbox-title">
      <header className="inbox-header">
        <div className="title-group">
          <MessageSquare size={19} className="inbox-title-icon" aria-hidden="true" />
          <div>
            <h3 id="voice-inbox-title">Voice inbox</h3>
            <p>Private check-ins from your contracts</p>
          </div>
        </div>
        <button className="refresh-btn" onClick={loadNotes} disabled={loading} aria-label="Refresh voice inbox">
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
      </header>

      {playbackError && <p className="voice-playback-error" role="status">{playbackError}</p>}

      <div className="notes-list">
        {loading && notes.length === 0 ? (
          <div className="inbox-empty">
            <Loader2 className="animate-spin" aria-hidden="true" />
            <p>Syncing voice notes…</p>
          </div>
        ) : notes.length === 0 ? (
          <div className="inbox-empty">
            <MessageSquare size={36} className="empty-icon" aria-hidden="true" />
            <p>No voice notes yet.</p>
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
                      <User size={13} aria-hidden="true" />
                      <span className="sender-name">{note.senderName || 'Friend'}</span>
                      {!note.listened && <span className="unread-tag">New</span>}
                    </div>
                    <div className="date-row">
                      <Calendar size={12} aria-hidden="true" />
                      <time dateTime={note.createdAt}>{new Date(note.createdAt).toLocaleString()}</time>
                    </div>
                  </div>
                </div>

                <div className="note-actions">
                  {note.listened ? (
                    <CheckCircle2 size={18} className="listened-icon" aria-label="Listened" />
                  ) : (
                    <Button variant="ghost" size="sm" onClick={() => handleMarkListened(note.id)}>
                      Mark read
                    </Button>
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
