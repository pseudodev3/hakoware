import { api } from './api';

const API_URL = 'http://5.180.182.73:5001/api';

// Send a voice note using custom backend
export const sendVoiceNote = async (friendshipId, senderId, senderName, recipientId, audioBlob) => {
  try {
    const formData = new FormData();
    formData.append('audio', audioBlob, `voice_note_${Date.now()}.wav`);
    formData.append('friendshipId', friendshipId);
    formData.append('senderName', senderName);
    formData.append('recipientId', recipientId);

    const token = localStorage.getItem('token');
    const response = await fetch(`${API_URL}/voice-notes/upload`, {
      method: 'POST',
      headers: {
        'x-auth-token': token
      },
      body: formData
    });

    const res = await response.json();
    if (res.msg) throw new Error(res.msg);
    
    return { success: true, voiceNoteId: res._id };
  } catch (error) {
    console.error('Error sending voice note:', error);
    return { success: false, error: error.message };
  }
};

// Get voice notes for current user's inbox
export const getMyVoiceNotes = async () => {
  try {
    const notes = await api.get('/voice-notes/my-inbox');
    return notes.map(n => ({
        ...n,
        id: n._id,
        // Convert static path to full URL for player
        audioUrl: `http://5.180.182.73:5001${n.filePath}`
    }));
  } catch (error) {
    console.error('Error getting voice notes:', error);
    return [];
  }
};

// Mark voice note as listened
export const markVoiceNoteListened = async (voiceNoteId) => {
  try {
    const res = await api.put(`/voice-notes/${voiceNoteId}/listened`);
    return { success: true };
  } catch (error) {
    console.error('Error marking voice note:', error);
    return { success: false, error: error.message };
  }
};

// For backward compatibility (not used anymore in backend approach)
export const getVoiceNotes = async (friendshipId, userId) => {
    return getMyVoiceNotes();
};
