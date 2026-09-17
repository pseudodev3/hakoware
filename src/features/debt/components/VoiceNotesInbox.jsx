import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, Play, Pause, CheckCircle2, Calendar, User, Loader2, RotateCw } from 'lucide-react';
import { getMyVoiceNotes, markVoiceNoteListened } from '../../../services/voiceNoteService';
import { Button } from '../../../shared/components/Button';
import './VoiceNotesInbox.css';

export const VoiceNotesInbox = () => {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeNote, setActiveNote] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioPlayerRef = useRef(new Audio());

  const loadNotes = async () => {
    setLoading(true);
    try {
      const data = await getMyVoiceNotes();
      setNotes(data || []);
    } catch (error) {
      console.error('Failed to load voice notes:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotes();

    const player = audioPlayerRef.current;
    player.onended = () => {
      setIsPlaying(false);
      if (activeNote && !activeNote.listened) {
        handleMarkListened(activeNote.id);
      }
    };

    return () => {
      player.pause();
    };
  }, [activeNote]);

  const togglePlay = async (note) => {
    const player = audioPlayerRef.current;

    try {
      if (activeNote?.id === note.id) {
        if (isPlaying) {
          player.pause();
          setIsPlaying(false);
        } else {
          await player.play();
          setIsPlaying(true);
        }
        return;
      }

      player.src = note.audioUrl;
      await player.play();
      setActiveNote(note);
      setIsPlaying(true);
    } catch (error) {
      console.error('Unable to play voice note:', error);
      setIsPlaying(false);
    }
  };

  const handleMarkListened = async (id) => {
    await markVoiceNoteListened(id);
    setNotes(prev => prev.map(note => note.id === id ? { ...note, listened: true } : note));
  };

  return (
    <div className="voice-inbox-container">
      <header className="inbox-header">
        <div className="title-group">
          <MessageSquare className="voice-heading-icon" size={18} strokeWidth={1.8} />
          <h3>Voice inbox</h3>
        </div>
        <button className="refresh-btn" onClick={loadNotes} disabled={loading} aria-label="Refresh voice notes">
          {loading ? <Loader2 size={16} className="animate-spin" /> : <RotateCw size={16} strokeWidth={1.8} />}
        </button>
      </header>

      <div className="notes-list">
        {loading && notes.length === 0 ? (
          <div className="inbox-empty" aria-live="polite">
            <Loader2 className="animate-spin" size={22} />
            <p>Syncing voice notes…</p>
          </div>
        ) : notes.length === 0 ? (
          <div className="inbox-empty">
            <MessageSquare size={32} className="empty-voice-icon" strokeWidth={1.6} />
            <p>No voice notes yet</p>
          </div>
        ) : (
          notes.map((note) => {
            const isActive = activeNote?.id === note.id;
            const playing = isActive && isPlaying;

            return (
              <div key={note.id} className={`note-card ${note.listened ? 'listened' : 'unread'}`}>
                <div className="note-main">
                  <button
                    className="play-trigger"
                    onClick={() => togglePlay(note)}
                    aria-label={playing ? `Pause voice note from ${note.senderName}` : `Play voice note from ${note.senderName}`}
                  >
                    {playing ? <Pause size={18} strokeWidth={1.9} /> : <Play size={18} strokeWidth={1.9} className="play-icon" />}
                  </button>
                  <div className="note-info">
                    <div className="sender-row">
                      <User size={12} strokeWidth={1.8} />
                      <span className="sender-name">{note.senderName}</span>
                      {!note.listened && <span className="unread-tag">New</span>}
                    </div>
                    <div className="date-row">
                      <Calendar size={12} strokeWidth={1.8} />
                      <span>{new Date(note.createdAt).toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                <div className="note-actions">
                  {note.listened ? (
                    <CheckCircle2 size={18} className="listened-icon" strokeWidth={1.8} aria-label="Listened" />
                  ) : (
                    <Button variant="ghost" size="sm" onClick={() => handleMarkListened(note.id)}>
                      Mark read
                    </Button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
