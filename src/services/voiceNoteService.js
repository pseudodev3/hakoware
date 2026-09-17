import { api, API_BASE_URL } from '../lib/api';

const audioExtension = (mimeType = '') => {
  if (mimeType.includes('mp4') || mimeType.includes('m4a')) return 'm4a';
  if (mimeType.includes('ogg')) return 'ogg';
  if (mimeType.includes('mpeg')) return 'mp3';
  return 'webm';
};

export const sendVoiceNote = async (friendshipId, audioBlob, duration = 0) => {
  try {
    const formData = new FormData();
    const extension = audioExtension(audioBlob?.type);
    formData.append('audio', audioBlob, `voice_note_${Date.now()}.${extension}`);
    formData.append('friendshipId', friendshipId);
    formData.append('duration', String(duration));

    const token = localStorage.getItem('token');
    const response = await fetch(`${API_BASE_URL}/api/voice-notes/upload`, {
      method: 'POST',
      headers: token ? { 'x-auth-token': token } : {},
      body: formData
    });

    let data = null;
    try { data = await response.json(); } catch { /* handled below */ }
    if (!response.ok) throw new Error(data?.msg || 'Voice note upload failed');
    return { success: true, voiceNoteId: data?._id };
  } catch (error) {
    console.error('Error sending voice note:', error);
    return { success: false, error: error.message };
  }
};

export const getMyVoiceNotes = async () => {
  try {
    const notes = await api.get('/voice-notes/my-inbox');
    if (!Array.isArray(notes)) return [];
    return notes.map((note) => ({
      ...note,
      id: note._id,
      audioUrl: note.filePath?.startsWith('http') ? note.filePath : `${API_BASE_URL}${note.filePath || ''}`
    }));
  } catch (error) {
    console.error('Error getting voice notes:', error);
    return [];
  }
};

export const fetchVoiceNoteAudio = async (audioUrl) => {
  const token = localStorage.getItem('token');
  const response = await fetch(audioUrl, { headers: token ? { 'x-auth-token': token } : {} });
  if (!response.ok) {
    let message = 'Voice note playback failed';
    try { message = (await response.json()).msg || message; } catch { /* keep fallback */ }
    throw new Error(message);
  }
  return response.blob();
};

export const markVoiceNoteListened = async (voiceNoteId) => {
  try {
    await api.put(`/voice-notes/${voiceNoteId}/listened`);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const getVoiceNotes = getMyVoiceNotes;
