import { api, API_BASE_URL } from '../lib/api';

export const sendVoiceNote = async (friendshipId, senderId, senderName, recipientId, audioBlob) => {
  try {
    const formData = new FormData();
    formData.append('audio', audioBlob, `voice_note_${Date.now()}.webm`);
    formData.append('friendshipId', friendshipId);
    formData.append('senderName', senderName);
    formData.append('recipientId', recipientId);

    const token = localStorage.getItem('token');
    const response = await fetch(`${API_BASE_URL}/api/voice-notes/upload`, {
      method: 'POST',
      headers: {
        'x-auth-token': token
      },
      body: formData
    });

    const res = await response.json();
    if (!response.ok || res.msg) throw new Error(res.msg || 'Voice note upload failed');

    return { success: true, voiceNoteId: res._id };
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
  const response = await fetch(audioUrl, {
    headers: {
      'x-auth-token': token
    }
  });

  if (!response.ok) {
    let message = 'Voice note playback failed';
    try {
      const data = await response.json();
      message = data.msg || message;
    } catch {
      // Ignore non-JSON error bodies.
    }
    throw new Error(message);
  }

  return response.blob();
};

export const markVoiceNoteListened = async (voiceNoteId) => {
  try {
    await api.put(`/voice-notes/${voiceNoteId}/listened`);
    return { success: true };
  } catch (error) {
    console.error('Error marking voice note as listened:', error);
    return { success: false, error: error.message };
  }
};

export const getVoiceNotes = async () => getMyVoiceNotes();
