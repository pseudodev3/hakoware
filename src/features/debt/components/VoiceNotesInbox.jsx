import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, Play, Pause, CheckCircle2, Trash2, Calendar, User, Loader2 } from 'lucide-react';
import { getMyVoiceNotes, markVoiceNoteListened } from '../../../services/voiceNoteService';
import { Button } from '../../../shared/components/Button';
import './VoiceNotesInbox.css';

/**
 * High-fidelity Voice Notes Inbox.
 * Allows users to listen to incoming voice contracts.
 */
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

  const togglePlay = (note) => {
    const player = audioPlayerRef.current;
    
    if (activeNote?.id === note.id) {
      if (isPlaying) {
        player.pause();
        setIsPlaying(false);
      } else {
        player.play();
        setIsPlaying(true);
      }
    } else {
      player.src = note.audioUrl;
      player.play();
      setActiveNote(note);
      setIsPlaying(true);
    }
  };

  const handleMarkListened = async (id) => {
    await markVoiceNoteListened(id);
    setNotes(prev => prev.map(n => n.id === id ? { ...n, listened: true } : n));
  };

  return (
    <div className="voice-inbox-container">
      <header className="inbox-header">
        <div className="title-group">
          <MessageSquare size={20} color="var(--aura-blue)" />
          <h3>VOICE INBOX</h3>
        </div>
        <button className="refresh-btn" onClick={loadNotes} disabled={loading}>
          <Loader2 size={16} className={loading ? 'animate-spin' : ''} />
        </button>
      </header>

      <div className="notes-list">
        {loading && notes.length === 0 ? (
          <div className="inbox-empty">
            <Loader2 className="animate-spin" />
            <p>SYNCING VOICE RECORDS...</p>
          </div>
        ) : notes.length === 0 ? (
          <div className="inbox-empty">
             <MessageSquare size={40} opacity={0.2} />
             <p>NO INCOMING TRANSMISSIONS</p>
          </div>
        ) : (
          notes.map((note) => (
            <motion.div 
              key={note.id} 
              className={`note-card glass ${note.listened ? 'listened' : 'unread'}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="note-main">
                <button className="play-trigger" onClick={() => togglePlay(note)}>
                  {activeNote?.id === note.id && isPlaying ? <Pause size={20} /> : <Play size={20} />}
                </button>
                <div className="note-info">
                  <div className="sender-row">
                    <User size={12} color="var(--aura-gold)" />
                    <span className="sender-name">{note.senderName}</span>
                    {!note.listened && <span className="unread-tag">NEW</span>}
                  </div>
                  <div className="date-row">
                    <Calendar size={12} />
                    <span>{new Date(note.createdAt).toLocaleString()}</span>
                  </div>
                </div>
              </div>
              
              <div className="note-actions">
                {note.listened ? (
                  <CheckCircle2 size={18} color="var(--aura-green)" />
                ) : (
                  <Button variant="ghost" size="sm" onClick={() => handleMarkListened(note.id)}>
                    MARK READ
                  </Button>
                )}
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
};
