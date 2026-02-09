import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { MicIcon, StopIcon, PlayIcon, TrashIcon } from '../icons/Icons';
import { sendVoiceNote } from '../../services/voiceNoteService';
import { performCheckin } from '../../services/checkinService';

const VoiceCheckinModal = ({ isOpen, onClose, friendship, showToast, onCheckinComplete }) => {
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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  if (!isOpen || !friendship) return null;

  const isUser1 = friendship.myPerspective === 'user1';
  const friend = isUser1 ? friendship.user2 : friendship.user1;

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(audioBlob);
        setAudioBlob(audioBlob);
        setAudioUrl(url);
        
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => {
          if (prev >= 60) { // Max 60 seconds
            stopRecording();
            return 60;
          }
          return prev + 1;
        });
      }, 1000);

    } catch (error) {
      console.error('Error starting recording:', error);
      showToast('Could not access microphone. Please allow permissions.', 'ERROR');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const deleteRecording = () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioBlob(null);
    setAudioUrl(null);
    setRecordingTime(0);
    setIsPlaying(false);
  };

  const togglePlayback = () => {
    if (audioPlayerRef.current) {
      if (isPlaying) {
        audioPlayerRef.current.pause();
      } else {
        audioPlayerRef.current.play();
      }
    }
  };

  const handleSubmit = async () => {
    if (!audioBlob) {
      showToast('Please record a voice message first', 'ERROR');
      return;
    }

    setLoading(true);
    
    try {
      // First, perform the checkin
      const checkinResult = await performCheckin(friendship.id, user.uid, 'Voice note check-in');
      
      if (!checkinResult.success) {
        showToast(checkinResult.message || 'Check-in failed', 'ERROR');
        setLoading(false);
        return;
      }

      // Then send the voice note to the friend
      const friend = isUser1 ? friendship.user2 : friendship.user1;
      const voiceResult = await sendVoiceNote(
        friendship.id,
        user.uid,
        user.displayName || 'Anonymous',
        friend.userId,
        audioBlob
      );

      if (voiceResult.success) {
        showToast(`Check-in sent! ${checkinResult.message}`, 'SUCCESS');
        onCheckinComplete?.();
        onClose();
        deleteRecording();
      } else {
        showToast('Check-in saved but voice note failed to send', 'WARNING');
        onCheckinComplete?.();
        onClose();
      }
    } catch (error) {
      console.error('Error submitting voice check-in:', error);
      showToast('Failed to submit check-in', 'ERROR');
    }
    
    setLoading(false);
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Visualization bars for recording
  const renderWaveform = () => {
    return (
      <div style={waveformContainerStyle}>
        {Array.from({ length: 20 }).map((_, i) => (
          <div
            key={i}
            style={{
              ...waveformBarStyle,
              height: isRecording 
                ? `${10 + Math.random() * 40}px`
                : audioUrl 
                  ? `${10 + (i % 3) * 15}px`
                  : '4px',
              background: isRecording ? '#ff4444' : audioUrl ? '#00e676' : '#333',
              animation: isRecording ? `waveform-${i} 0.5s ease-in-out infinite alternate` : 'none',
              animationDelay: `${i * 0.05}s`
            }}
          />
        ))}
      </div>
    );
  };

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={headerStyle}>
          <div style={{
            width: '50px',
            height: '50px',
            borderRadius: '50%',
            background: isRecording ? 'rgba(255,68,68,0.2)' : 'rgba(0,230,118,0.2)',
            border: `2px solid ${isRecording ? '#ff4444' : '#00e676'}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            animation: isRecording ? 'pulse 1s infinite' : 'none'
          }}>
            <MicIcon size={24} color={isRecording ? '#ff4444' : '#00e676'} />
          </div>
          <div>
            <h2 style={{ margin: 0, color: '#fff' }}>VOICE CHECK-IN</h2>
            <p style={{ margin: '5px 0 0 0', color: '#666', fontSize: '0.85rem' }}>
              Record a message for {friend.displayName}
            </p>
          </div>
        </div>

        {/* Waveform */}
        <div style={waveformWrapperStyle}>
          {renderWaveform()}
          
          {/* Time display */}
          <div style={timeDisplayStyle}>
            {formatTime(recordingTime)}
            {isRecording && <span style={{ color: '#ff4444', marginLeft: '10px' }}>● REC</span>}
          </div>
        </div>

        {/* Audio player (hidden) */}
        {audioUrl && (
          <audio
            ref={audioPlayerRef}
            src={audioUrl}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onEnded={() => setIsPlaying(false)}
          />
        )}

        {/* Controls */}
        <div style={controlsStyle}>
          {!audioUrl ? (
            // Recording controls
            <button
              onClick={isRecording ? stopRecording : startRecording}
              style={{
                ...recordButtonStyle,
                background: isRecording ? '#ff4444' : '#00e676',
                boxShadow: isRecording 
                  ? '0 0 30px rgba(255,68,68,0.5)' 
                  : '0 0 30px rgba(0,230,118,0.3)'
              }}
            >
              {isRecording ? <StopIcon size={32} color="#fff" /> : <MicIcon size={32} color="#000" />}
            </button>
          ) : (
            // Playback controls
            <div style={playbackControlsStyle}>
              <button onClick={deleteRecording} style={iconButtonStyle}>
                <TrashIcon size={24} color="#ff4444" />
              </button>
              <button 
                onClick={togglePlayback} 
                style={{
                  ...playButtonStyle,
                  background: isPlaying ? '#ff4444' : '#00e676'
                }}
              >
                <PlayIcon size={32} color={isPlaying ? '#fff' : '#000'} />
              </button>
            </div>
          )}
        </div>

        {/* Instructions */}
        <div style={instructionsStyle}>
          {!audioUrl ? (
            <>
              <p style={{ margin: '0 0 8px 0', color: '#fff', fontWeight: 'bold' }}>
                {isRecording ? 'Recording... Tap to stop' : 'Tap the mic to start'}
              </p>
              <p style={{ margin: 0, color: '#666', fontSize: '0.8rem' }}>
                Minimum 3 seconds • Maximum 60 seconds
              </p>
            </>
          ) : (
            <>
              <p style={{ margin: '0 0 8px 0', color: '#fff', fontWeight: 'bold' }}>
                Recording complete!
              </p>
              <p style={{ margin: 0, color: '#666', fontSize: '0.8rem' }}>
                Listen back or submit your check-in
              </p>
            </>
          )}
        </div>

        {/* Actions */}
        <div style={actionsStyle}>
          <button
            onClick={handleSubmit}
            disabled={!audioUrl || loading}
            style={{
              ...submitButtonStyle,
              opacity: !audioUrl || loading ? 0.5 : 1
            }}
          >
            {loading ? 'SUBMITTING...' : 'SUBMIT CHECK-IN'}
          </button>
          <button onClick={onClose} style={cancelButtonStyle}>
            CANCEL
          </button>
        </div>

        {/* Tips */}
        <div style={tipsStyle}>
          <p style={{ margin: 0, fontSize: '0.75rem', color: '#555' }}>
            💡 Tip: Say something personal! Low effort voice notes may be rejected.
          </p>
        </div>
      </div>

      {/* Add keyframes */}
      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.05); opacity: 0.8; }
        }
        ${Array.from({ length: 20 }).map((_, i) => `
          @keyframes waveform-${i} {
            0% { height: ${10 + Math.random() * 20}px; }
            100% { height: ${20 + Math.random() * 40}px; }
          }
        `).join('')}
      `}</style>
    </div>
  );
};

const overlayStyle = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  background: 'rgba(0,0,0,0.9)',
  zIndex: 1000,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backdropFilter: 'blur(5px)'
};

const modalStyle = {
  background: 'linear-gradient(145deg, #111, #0a0a0a)',
  border: '1px solid #333',
  borderRadius: '20px',
  padding: '30px',
  width: '90%',
  maxWidth: '450px',
  textAlign: 'center'
};

const headerStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '15px',
  marginBottom: '25px',
  textAlign: 'left'
};

const waveformWrapperStyle = {
  background: '#0a0a0a',
  borderRadius: '12px',
  padding: '30px 20px',
  marginBottom: '25px',
  border: '1px solid #222'
};

const waveformContainerStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '4px',
  height: '60px',
  marginBottom: '15px'
};

const waveformBarStyle = {
  width: '4px',
  borderRadius: '2px',
  transition: 'height 0.1s ease'
};

const timeDisplayStyle = {
  fontSize: '1.5rem',
  color: '#fff',
  fontFamily: 'var(--font-main)',
  fontWeight: 'bold'
};

const controlsStyle = {
  marginBottom: '20px'
};

const recordButtonStyle = {
  width: '80px',
  height: '80px',
  borderRadius: '50%',
  border: 'none',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  transition: 'all 0.3s ease',
  margin: '0 auto'
};

const playbackControlsStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '20px'
};

const iconButtonStyle = {
  width: '50px',
  height: '50px',
  borderRadius: '50%',
  background: 'rgba(255,68,68,0.1)',
  border: '1px solid #ff4444',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer'
};

const playButtonStyle = {
  width: '70px',
  height: '70px',
  borderRadius: '50%',
  border: 'none',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  transition: 'all 0.2s ease'
};

const instructionsStyle = {
  marginBottom: '25px'
};

const actionsStyle = {
  display: 'flex',
  gap: '10px'
};

const submitButtonStyle = {
  flex: 1,
  padding: '16px',
  background: '#00e676',
  border: 'none',
  borderRadius: '10px',
  color: '#000',
  fontWeight: 'bold',
  fontSize: '0.9rem',
  cursor: 'pointer',
  letterSpacing: '1px'
};

const cancelButtonStyle = {
  padding: '16px 24px',
  background: 'transparent',
  border: '1px solid #444',
  borderRadius: '10px',
  color: '#666',
  cursor: 'pointer'
};

const tipsStyle = {
  marginTop: '20px',
  padding: '12px',
  background: 'rgba(255,215,0,0.05)',
  border: '1px solid #332200',
  borderRadius: '8px'
};

export default VoiceCheckinModal;
