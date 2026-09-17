import React, { useEffect, useRef, useState } from 'react';
import { Mic, Pause, Play, StopCircle, Trash2 } from 'lucide-react';
import { Modal } from '../../../shared/components/Modal';
import { Button } from '../../../shared/components/Button';
import { performCheckin } from '../../../services/friendshipService';
import { sendVoiceNote } from '../../../services/voiceNoteService';
import './VoiceCheckinModal.css';

export const VoiceCheckinModal = ({ isOpen, onClose, friendship, currentUserId, onRefresh, showToast }) => {
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

  const user1Id = friendship?.user1?._id || friendship?.user1;
  const isUser1 = String(user1Id) === String(currentUserId);
  const friend = isUser1 ? friendship?.user2 : friendship?.user1;

  const cleanupStream = () => {
    const recorder = mediaRecorderRef.current;
    if (recorder?.stream) recorder.stream.getTracks().forEach((track) => track.stop());
  };

  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    cleanupStream();
  }, [audioUrl]);

  const stopRecording = () => {
    const recorder = mediaRecorderRef.current;
    if (recorder?.state && recorder.state !== 'inactive') recorder.stop();
    setIsRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  };

  const startRecording = async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      showToast?.('Voice recording is not supported in this browser', 'ERROR');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      recorder.onstop = () => {
        const type = recorder.mimeType || audioChunksRef.current[0]?.type || 'audio/webm';
        const blob = new Blob(audioChunksRef.current, { type });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach((track) => track.stop());
      };

      recorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      timerRef.current = setInterval(() => {
        setRecordingTime((previous) => {
          if (previous >= 59) {
            queueMicrotask(stopRecording);
            return 60;
          }
          return previous + 1;
        });
      }, 1000);
    } catch (error) {
      cleanupStream();
      showToast?.('Allow microphone access to send a voice check-in', 'ERROR');
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
    } catch {
      showToast?.('Could not play this recording', 'ERROR');
    }
  };

  const handleSubmit = async () => {
    if (!audioBlob || !friendship) return;
    setLoading(true);
    const contractId = friendship._id || friendship.id;

    const checkin = await performCheckin(contractId);
    if (!checkin.success) {
      showToast?.(checkin.error || 'Could not check in', 'ERROR');
      setLoading(false);
      return;
    }

    const voice = await sendVoiceNote(contractId, audioBlob, recordingTime);
    if (!voice.success) {
      showToast?.(`Check-in saved, but voice upload failed: ${voice.error}`, 'ERROR');
      await onRefresh?.();
      setLoading(false);
      return;
    }

    showToast?.(`Voice check-in sent to ${friend?.displayName || 'your friend'}`, 'SUCCESS');
    await onRefresh?.();
    deleteRecording();
    onClose?.();
    setLoading(false);
  };

  const formatTime = (seconds) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  if (!friendship || !friend) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Voice check-in with ${friend.displayName}`} size="md">
      <div className="voice-modal-content">
        <div className="voice-header">
          <div className={`mic-status ${isRecording ? 'active' : ''}`}><Mic size={22} strokeWidth={1.8} /></div>
          <div><strong>{isRecording ? 'Recording' : audioUrl ? 'Ready to send' : 'Say something real.'}</strong><p>{audioUrl ? 'Listen back or send it.' : 'Up to 60 seconds. Sending it also counts as today’s check-in.'}</p></div>
        </div>

        <div className="recording-area">
          <div className={`waveform ${isRecording ? 'recording' : audioUrl ? 'recorded' : ''}`} aria-hidden="true">
            {Array.from({ length: 24 }).map((_, index) => (
              <span key={index} className="wave-bar" style={{ '--bar-scale': 0.35 + ((index * 7) % 10) / 13, '--bar-delay': `${-(index % 8) * 65}ms`, '--bar-duration': `${420 + (index % 5) * 55}ms` }} />
            ))}
          </div>
          <div className="time-display">{formatTime(recordingTime)}</div>
        </div>

        {audioUrl && <audio ref={audioPlayerRef} src={audioUrl} onPlay={() => setIsPlaying(true)} onPause={() => setIsPlaying(false)} onEnded={() => setIsPlaying(false)} className="hidden" />}

        <div className="voice-controls">
          {!audioUrl ? (
            <button className={`record-btn ${isRecording ? 'stop' : 'start'}`} onClick={isRecording ? stopRecording : startRecording} aria-label={isRecording ? 'Stop recording' : 'Start recording'}>
              {isRecording ? <StopCircle size={34} strokeWidth={1.7} /> : <Mic size={34} strokeWidth={1.7} />}
            </button>
          ) : (
            <div className="playback-group">
              <button className="trash-btn" onClick={deleteRecording} aria-label="Delete recording"><Trash2 size={19} strokeWidth={1.8} /></button>
              <button className="play-btn" onClick={togglePlayback} aria-label={isPlaying ? 'Pause recording' : 'Play recording'}>{isPlaying ? <Pause size={26} strokeWidth={1.8} /> : <Play size={26} strokeWidth={1.8} className="play-icon" />}</button>
            </div>
          )}
        </div>

        <div className="voice-actions">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="aura" disabled={!audioBlob} loading={loading} onClick={handleSubmit}>Send voice check-in</Button>
        </div>
      </div>
    </Modal>
  );
};
