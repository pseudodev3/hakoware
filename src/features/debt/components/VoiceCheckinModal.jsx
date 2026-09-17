import React, { useState, useRef, useEffect } from 'react';
import { Mic, StopCircle, Play, Pause, Trash2, Zap, AlertCircle } from 'lucide-react';
import { Modal } from '../../../shared/components/Modal';
import { Button } from '../../../shared/components/Button';
import { performCheckin } from '../../../services/friendshipService';
import { sendVoiceNote } from '../../../services/voiceNoteService';
import { useAuth } from '../../../contexts/AuthContext';
import './VoiceCheckinModal.css';

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

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(timerRef.current);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
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
        setRecordingTime(previous => {
          if (previous >= 59) {
            queueMicrotask(stopRecording);
            return 60;
          }
          return previous + 1;
        });
      }, 1000);
    } catch (error) {
      showToast?.('MICROPHONE ACCESS DENIED', 'ERROR');
    }
  };

  const deleteRecording = () => {
    audioPlayerRef.current?.pause();
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioBlob(null);
    setAudioUrl(null);
    setRecordingTime(0);
    setIsPlaying(false);
  };

  const togglePlayback = async () => {
    const player = audioPlayerRef.current;
    if (!player) return;

    try {
      if (isPlaying) player.pause();
      else await player.play();
    } catch (error) {
      showToast?.('AUDIO PLAYBACK FAILED', 'ERROR');
    }
  };

  const handleSubmit = async () => {
    if (!audioBlob) return;
    setLoading(true);

    try {
      const checkinRes = await performCheckin(friendship.id || friendship._id);
      if (checkinRes.success) {
        const voiceResult = await sendVoiceNote(
          friendship.id || friendship._id,
          user.uid || user.id,
          user.displayName,
          friend._id || friend.id,
          audioBlob
        );

        if (!voiceResult.success) throw new Error(voiceResult.error || 'Voice note upload failed');

        showToast?.('VOICE CONTRACT SYNCED', 'SUCCESS');
        onRefresh?.();
        onClose?.();
        deleteRecording();
      } else {
        showToast?.(checkinRes.error || 'SYNC FAILED', 'ERROR');
      }
    } catch (err) {
      showToast?.(err.message || 'SYSTEM ERROR DURING TRANSMISSION', 'ERROR');
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (seconds) => `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, '0')}`;

  if (!friendship) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Voice check-in" size="md">
      <div className="voice-modal-content">
        <div className="voice-header">
          <div className={`mic-status ${isRecording ? 'active' : ''}`}>
            <Mic size={22} strokeWidth={1.8} />
          </div>
          <p className="voice-description">Recording a check-in for <span>{friend.displayName}</span></p>
        </div>

        <div className="recording-area">
          <div className={`waveform ${isRecording ? 'recording' : audioUrl ? 'recorded' : ''}`} aria-hidden="true">
            {Array.from({ length: 24 }).map((_, index) => (
              <span
                key={index}
                className="wave-bar"
                style={{
                  '--bar-scale': 0.35 + ((index * 7) % 10) / 13,
                  '--bar-delay': `${-(index % 8) * 65}ms`,
                  '--bar-duration': `${420 + (index % 5) * 55}ms`
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
              aria-label={isRecording ? 'Stop recording' : 'Start recording'}
            >
              {isRecording ? <StopCircle size={34} strokeWidth={1.7} /> : <Mic size={34} strokeWidth={1.7} />}
            </button>
          ) : (
            <div className="playback-group">
              <button className="trash-btn" onClick={deleteRecording} aria-label="Delete recording">
                <Trash2 size={19} strokeWidth={1.8} />
              </button>
              <button className="play-btn" onClick={togglePlayback} aria-label={isPlaying ? 'Pause recording' : 'Play recording'}>
                {isPlaying ? <Pause size={26} strokeWidth={1.8} /> : <Play size={26} strokeWidth={1.8} className="play-icon" />}
              </button>
            </div>
          )}
        </div>

        <div className="protocol-info">
          <AlertCircle size={14} strokeWidth={1.8} />
          <p>Voice notes are attached to this contract and available to the recipient.</p>
        </div>

        <div className="voice-actions">
          <Button variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button
            variant="aura"
            className="flex-1"
            icon={Zap}
            disabled={!audioUrl}
            loading={loading}
            onClick={handleSubmit}
          >
            Send check-in
          </Button>
        </div>
      </div>
    </Modal>
  );
};
