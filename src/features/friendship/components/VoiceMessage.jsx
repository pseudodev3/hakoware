import React, { useEffect, useRef, useState } from 'react';
import { Mic, Pause, Play, Square, Trash2 } from 'lucide-react';
import { fetchVoiceNoteAudio, markVoiceNoteListened, sendVoiceNote } from '../../../services/voiceNoteService';
import { resolveApiMediaUrl } from '../../../lib/api';

export const VoiceMessage = ({ voice }) => {
  const playerRef = useRef(null);
  const urlRef = useRef(null);
  const aliveRef = useRef(true);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    aliveRef.current = true;
    return () => { aliveRef.current = false; playerRef.current?.pause(); if (urlRef.current) URL.revokeObjectURL(urlRef.current); };
  }, []);
  const toggle = async () => {
    if (loading) return;
    setError('');
    if (playing) { playerRef.current?.pause(); setPlaying(false); return; }
    setLoading(true);
    try {
      if (!playerRef.current) {
        const blob = await fetchVoiceNoteAudio(resolveApiMediaUrl(voice.audioUrl));
        if (!aliveRef.current) return;
        urlRef.current = URL.createObjectURL(blob);
        const player = new Audio(urlRef.current);
        player.onended = () => { if (aliveRef.current) setPlaying(false); };
        player.onerror = () => { if (aliveRef.current) { setPlaying(false); setError('Couldn’t play this note. Try again.'); } };
        playerRef.current = player;
      }
      await playerRef.current.play();
      if (!aliveRef.current) { playerRef.current.pause(); return; }
      setPlaying(true);
      if (voice.isRecipient && !voice.listened) void markVoiceNoteListened(voice.id);
    } catch { if (aliveRef.current) setError('Couldn’t play this note. Try again.'); }
    finally { if (aliveRef.current) setLoading(false); }
  };
  return <div className="friend-voice-message"><button onClick={() => void toggle()} disabled={loading} aria-label={playing ? 'Pause voice message' : 'Play voice message'}>{playing ? <Pause size={18} /> : <Play size={18} />}</button><span><strong>{loading ? 'Loading voice…' : 'Voice message'}</strong><small>{Math.floor((voice.duration || 0) / 60)}:{String(Math.floor((voice.duration || 0) % 60)).padStart(2, '0')}</small></span>{error && <p role="status">{error}</p>}</div>;
};

export const VoiceMessageComposer = ({ friendshipId, onSend, onCancel }) => {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const recorderRef = useRef(null);
  const timerRef = useRef(null);
  const aliveRef = useRef(true);
  const previewRef = useRef(null);
  const uploadedRef = useRef(null);
  const requestIdRef = useRef(crypto.randomUUID());
  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      clearInterval(timerRef.current);
      const recorder = recorderRef.current;
      if (recorder?.state === 'recording') recorder.stop();
      recorder?.stream?.getTracks().forEach((track) => track.stop());
      if (previewRef.current?.url) URL.revokeObjectURL(previewRef.current.url);
    };
  }, []);
  const stop = () => {
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
    clearInterval(timerRef.current); setRecording(false);
  };
  const start = async () => {
    if (busy) return;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') { setError('Voice recording isn’t supported here. You can send a text message.'); return; }
    setBusy(true); setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!aliveRef.current) { stream.getTracks().forEach((track) => track.stop()); return; }
      let recorder;
      try { recorder = new MediaRecorder(stream); } catch (err) { stream.getTracks().forEach((track) => track.stop()); throw err; }
      recorderRef.current = recorder;
      const chunks = []; const startedAt = Date.now();
      recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop()); clearInterval(timerRef.current);
        if (!aliveRef.current) return;
        const blob = new Blob(chunks, { type: recorder.mimeType || chunks[0]?.type || 'audio/webm' });
        if (!blob.size) { setError('No audio was captured. Try recording again.'); return; }
        const value = { blob, url: URL.createObjectURL(blob), duration: Math.min(60, Math.max(1, Math.round((Date.now() - startedAt) / 1000))) };
        previewRef.current = value; setPreview(value); setRecording(false);
      };
      recorder.start(); setSeconds(0); setRecording(true);
      timerRef.current = setInterval(() => { const elapsed = Math.floor((Date.now() - startedAt) / 1000); setSeconds(Math.min(60, elapsed)); if (elapsed >= 60) stop(); }, 250);
    } catch { if (aliveRef.current) setError('Allow microphone access to record a voice message.'); }
    finally { if (aliveRef.current) setBusy(false); }
  };
  const discard = () => {
    if (previewRef.current?.url) URL.revokeObjectURL(previewRef.current.url);
    previewRef.current = null; uploadedRef.current = null; requestIdRef.current = crypto.randomUUID();
    setPreview(null); setSeconds(0); setError('');
  };
  const send = async () => {
    if (!preview || busy) return;
    setBusy(true); setError('');
    try {
      if (!uploadedRef.current) {
        const result = await sendVoiceNote(friendshipId, preview.blob, preview.duration, 'MESSAGE');
        if (!result.success) throw new Error(result.error || 'Could not upload this voice message');
        uploadedRef.current = result.voiceNoteId;
      }
      if (!aliveRef.current) return;
      await onSend({ clientId: requestIdRef.current, voiceNoteId: uploadedRef.current });
    } catch (err) { if (aliveRef.current) { if (/expired|fresh voice|Record it again/i.test(err.message)) uploadedRef.current = null; setError(err.message || 'Couldn’t confirm delivery. Try again.'); } }
    finally { if (aliveRef.current) setBusy(false); }
  };
  return <div className="friend-voice-composer">
    <div className="friend-voice-record-row"><span>{recording ? `Recording · ${seconds}s / 60s` : preview ? 'Listen before sending' : 'Leave a voice message · up to 60s'}</span>{!preview && <button type="button" disabled={busy} onClick={recording ? stop : () => void start()} aria-label={recording ? 'Stop voice recording' : 'Start voice recording'}>{recording ? <Square size={18} /> : <Mic size={18} />}</button>}</div>
    {preview && <audio controls src={preview.url} aria-label="Preview your voice recording" />}
    {error && <p role="status">{error}</p>}
    <div className="friend-voice-composer-actions"><button type="button" onClick={onCancel} disabled={busy}>Cancel</button>{preview && <><button type="button" onClick={discard} disabled={busy} aria-label="Discard voice recording"><Trash2 size={17} /></button><button type="button" className="friend-send-voice" onClick={() => void send()} disabled={busy}>{busy ? 'Sending…' : 'Send voice'}</button></>}</div>
  </div>;
};
