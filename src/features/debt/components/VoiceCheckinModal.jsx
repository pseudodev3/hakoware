import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, StopCircle, Play, Trash2, Zap, AlertCircle, History } from 'lucide-react';
import { Modal } from '../../../shared/components/Modal';
import { Button } from '../../../shared/components/Button';
import { performCheckin } from '../../../services/friendshipService';
import { sendVoiceNote } from '../../../services/voiceNoteService';
import { useAuth } from '../../../contexts/AuthContext';
import './VoiceCheckinModal.css';

/**
 * High-fidelity Voice Checkin Modal.
 * Captures audio and resets debt through the HxH protocol.
 */
export const VoiceCheckinModal = ({ isOpen, onClose, friendship, currentUserId, onRefresh, showToast }) => {
  const { user } = useAuth();
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);
  const audioPlayerRef = useRef(null);

  const isUser1 = friendship?.user1?._id === currentUserId || friendship?.user1 === currentUserId;
  const friend = isUser1 ? friendship?.user2 : friendship?.user1;

  // Cleanup
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        setAudioBlob(blob);
        setAudioUrl(url);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      timerRef.current = setInterval(() => {
        setRecordingTime(prev => {
          if (prev >= 60) {
            stopRecording();
            return 60;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (error) {
      showToast('MICROPHONE ACCESS DENIED', 'ERROR');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(timerRef.current);
    }
  };

  const deleteRecording = () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioBlob(null);
    setAudioUrl(null);
    setRecordingTime(0);
    setIsPlaying(false);
  };

  const handleSubmit = async () => {
    if (!audioBlob) return;
    setLoading(true);
    
    try {
      const checkinRes = await performCheckin(friendship.id || friendship._id);
      if (checkinRes.success) {
        await sendVoiceNote(
          friendship.id || friendship._id,
          user.uid || user.id,
          user.displayName,
          friend._id || friend.id,
          audioBlob
        );
        showToast('VOICE CONTRACT SYNCED', 'SUCCESS');
        onRefresh();
        onClose();
        deleteRecording();
      } else {
        showToast(checkinRes.error || 'SYNC FAILED', 'ERROR');
      }
    } catch (err) {
      showToast('SYSTEM ERROR DURING TRANSMISSION', 'ERROR');
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (s) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  if (!friendship) return null;

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title="VOICE AUTHORIZATION"
      size="md"
    >
      <div className="voice-modal-content">
        <div className="voice-header">
           <div className={`mic-status ${isRecording ? 'active' : ''}`}>
              <Mic size={24} color={isRecording ? 'var(--aura-red)' : 'var(--aura-gold)'} />
           </div>
           <p className="voice-description">Recording message for <span>{friend.displayName}</span></p>
        </div>

        <div className="recording-area glass">
           <div className="waveform">
              {Array.from({ length: 24 }).map((_, i) => (
                <motion.div 
                  key={i}
                  className="wave-bar"
                  animate={{ 
                    height: isRecording ? [10, Math.random() * 40 + 10, 10] : 4 
                  }}
                  transition={{ 
                    repeat: Infinity, 
                    duration: 0.5, 
                    delay: i * 0.05 
                  }}
                  style={{ 
                    backgroundColor: isRecording ? 'var(--aura-red)' : audioUrl ? 'var(--aura-gold)' : 'var(--border-subtle)' 
                  }}
                />
              ))}
           </div>
           <div className="time-display">{formatTime(recordingTime)}</div>
        </div>

        {audioUrl && (
          <audio 
            ref={audioPlayerRef} 
            src={audioUrl} 
            onPlay={() => setIsPlaying(true)} 
            onPause={() => setIsPlaying(false)} 
            onEnded={() => setIsPlaying(false)} 
            className="hidden"
          />
        )}

        <div className="voice-controls">
          {!audioUrl ? (
            <button 
              className={`record-btn ${isRecording ? 'stop' : 'start'}`}
              onClick={isRecording ? stopRecording : startRecording}
            >
              {isRecording ? <StopCircle size={40} /> : <Mic size={40} />}
            </button>
          ) : (
            <div className="playback-group">
               <button className="trash-btn" onClick={deleteRecording}><Trash2 size={20} /></button>
               <button className="play-btn" onClick={() => audioPlayerRef.current.play()}>
                 <Play size={32} />
               </button>
            </div>
          )}
        </div>

        <div className="protocol-info">
           <AlertCircle size={14} color="var(--text-muted)" />
           <p>Voice messages are encrypted and stored in the Association archives.</p>
        </div>

        <div className="voice-actions">
           <Button variant="secondary" className="flex-1" onClick={onClose}>ABORT</Button>
           <Button 
            variant="aura" 
            className="flex-1" 
            icon={Zap} 
            disabled={!audioUrl} 
            loading={loading}
            onClick={handleSubmit}
           >
             SUBMIT SYNC
           </Button>
        </div>
      </div>
    </Modal>
  );
};
