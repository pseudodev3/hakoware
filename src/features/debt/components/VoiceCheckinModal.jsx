import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Mic, Pause, Play, ShieldCheck, StopCircle, Target, Trash2 } from 'lucide-react';
import { Modal } from '../../../shared/components/Modal';
import { Button } from '../../../shared/components/Button';
import { performCheckin } from '../../../services/friendshipService';
import { getContractBounty } from '../../../services/bountyService';
import { sendVoiceNote } from '../../../services/voiceNoteService';
import { useDebt } from '../../../hooks/useDebt';
import './VoiceCheckinModal.css';

export const VoiceCheckinModal = ({ isOpen, onClose, friendship, currentUserId, onRefresh, showToast }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [bounty, setBounty] = useState(null);
  const [bountyLoading, setBountyLoading] = useState(false);
  const [bountySyncError, setBountySyncError] = useState(false);
  const [creditHunter, setCreditHunter] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);
  const audioPlayerRef = useRef(null);

  const user1Id = friendship?.user1?._id || friendship?.user1;
  const isUser1 = String(user1Id) === String(currentUserId);
  const perspective = isUser1 ? friendship?.user1Perspective : friendship?.user2Perspective;
  const friend = isUser1 ? friendship?.user2 : friendship?.user1;
  const stats = useDebt(perspective);

  const cleanupStream = () => {
    const recorder = mediaRecorderRef.current;
    if (recorder?.stream) recorder.stream.getTracks().forEach((track) => track.stop());
  };

  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    cleanupStream();
  }, [audioUrl]);

  useEffect(() => {
    let active = true;
    const loadBounty = async () => {
      if (!isOpen || !friendship) {
        setBounty(null);
        setBountyLoading(false);
        setBountySyncError(false);
        setCreditHunter(false);
        return;
      }
      setBountyLoading(true);
      setBountySyncError(false);
      try {
        const result = await getContractBounty(friendship._id || friendship.id);
        if (active) {
          setBounty(result || null);
          setCreditHunter(false);
        }
      } catch {
        if (active) {
          setBounty(null);
          setBountySyncError(true);
        }
      } finally {
        if (active) setBountyLoading(false);
      }
    };
    loadBounty();
    return () => { active = false; };
  }, [isOpen, friendship?._id, friendship?.id]);

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
    } catch {
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
    if (bountyLoading) return showToast?.('Arena is still syncing', 'ERROR');
    if (bountySyncError) return showToast?.('Could not verify the bounty. Reopen this voice check-in.', 'ERROR');

    setLoading(true);
    const contractId = friendship._id || friendship.id;
    const pressureReady = bounty?.status === 'PRESSURE_SENT' && bounty?.hunterName;
    const bountyCreditId = creditHunter && pressureReady ? bounty._id : null;
    const bountyDecision = pressureReady ? (creditHunter ? 'CREDIT' : 'ESCAPE') : null;

    const voice = await sendVoiceNote(contractId, audioBlob, recordingTime);
    if (!voice.success) {
      showToast?.(voice.error || 'Could not upload the voice check-in', 'ERROR');
      setLoading(false);
      return;
    }

    const checkin = await performCheckin(contractId, 'VOICE', bountyCreditId, bountyDecision, voice.voiceNoteId);
    if (checkin.success) {
      const xp = checkin.game?.xp;
      const chaos = checkin.game?.chaosResolved ? ' · anomaly survived' : '';
      const wanted = checkin.game?.wantedCleared ? ' · Wanted cleared' : '';
      const bountyResult = checkin.bounty?.outcome === 'CLAIMED'
        ? ` · ${bounty?.hunterName || 'hunter'} credited`
        : checkin.bounty?.outcome === 'ESCAPED'
          ? ' · bounty escaped'
          : '';
      const recovery = checkin.recovery?.started
        ? ' · recovery started · 1 clean check-in left'
        : checkin.recovery?.completed
          ? ' · bankruptcy recovery complete'
          : '';
      showToast?.(`Voice sent to ${friend?.displayName || 'your friend'}${xp ? ` · +${xp} Duo XP` : ''}${chaos}${wanted}${bountyResult}${recovery}`, 'SUCCESS');
    } else {
      showToast?.(`Voice uploaded, but the check-in was not recorded: ${checkin.error || 'unknown error'}`, 'ERROR');
    }

    await onRefresh?.();
    deleteRecording();
    onClose?.();
    setLoading(false);
  };

  const formatTime = (seconds) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  if (!friendship || !friend) return null;

  const activeChaos = friendship.chaos?.activeEvent;
  const isChaosTarget = activeChaos && String(activeChaos.targetUserId) === String(currentUserId);
  const pressureReady = bounty?.status === 'PRESSURE_SENT' && bounty?.hunterName;
  const hasOpenBounty = Boolean(bounty && ['ACTIVE', 'HUNTING', 'PRESSURE_SENT'].includes(bounty.status));
  const fundingBreakdown = bounty?.chaosAmount > 0
    ? `${bounty.chaosAmount} Chaos${bounty.partnerAmount > 0 ? ` + ${bounty.partnerAmount} Partner` : ''}`
    : null;
  const proofBlocked = bountyLoading || bountySyncError;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Voice check-in with ${friend.displayName}`} size="md">
      <div className="voice-modal-content">
        {isChaosTarget && (
          <div className="voice-chaos-banner">
            <strong>{activeChaos.name}</strong>
            <span>{activeChaos.description}</span>
          </div>
        )}

        {bountySyncError && (
          <div className="voice-bounty-proof sync-error">
            <div className="voice-bounty-icon"><AlertTriangle size={18} /></div>
            <div className="voice-bounty-copy"><span>ARENA SYNC FAILED</span><strong>Bounty not verified.</strong><p>Reopen before sending.</p></div>
          </div>
        )}

        {stats?.isBankrupt && (
          <div className="voice-recovery-banner">
            <span>BANKRUPTCY RECOVERY</span>
            <strong>Recovery starts now.</strong>
            <p>Debt drops to {stats.limit}. One more check-in after 20h completes recovery.</p>
          </div>
        )}

        {stats?.isRecovering && !stats?.isBankrupt && (
          <div className="voice-recovery-banner recovering">
            <span>RECOVERING</span>
            <strong>One clean check-in left.</strong>
            <p>This completes recovery.</p>
          </div>
        )}

        {hasOpenBounty && !bountySyncError && (
          <div className={`voice-bounty-proof ${pressureReady ? 'pressure-ready' : ''}`}>
            <div className="voice-bounty-icon">{pressureReady ? <ShieldCheck size={18} /> : <Target size={18} />}</div>
            <div className="voice-bounty-copy">
              <span>{pressureReady ? 'PROOF OF PRESSURE' : 'BOUNTY LIVE'}</span>
              <strong>{bounty.amount} Aura on this check-in</strong>
              <p>{fundingBreakdown ? `${fundingBreakdown}. ` : ''}{pressureReady ? `Did ${bounty.hunterName} bring you back?` : 'Send now to close the bounty without paying a hunter.'}</p>
              {pressureReady && (
                <div className="voice-proof-choice" role="group" aria-label="Bounty hunter credit">
                  <button type="button" className={!creditHunter ? 'active' : ''} onClick={() => setCreditHunter(false)}>Escape</button>
                  <button type="button" className={creditHunter ? 'active credit' : ''} onClick={() => setCreditHunter(true)}>Credit {bounty.hunterName}</button>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="voice-header">
          <div className={`mic-status ${isRecording ? 'active' : ''}`}><Mic size={22} strokeWidth={1.8} /></div>
          <div><strong>{isRecording ? 'Recording' : audioUrl ? 'Ready' : 'Say something.'}</strong><p>{audioUrl ? 'Listen or send.' : 'Up to 60s · bonus Duo XP.'}</p></div>
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
          <Button variant="aura" disabled={!audioBlob || proofBlocked} loading={loading || bountyLoading} onClick={handleSubmit}>
            {bountyLoading ? 'Syncing Arena…' : pressureReady && creditHunter ? `Send & credit ${bounty.hunterName}` : hasOpenBounty ? 'Send & escape bounty' : 'Send voice'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
