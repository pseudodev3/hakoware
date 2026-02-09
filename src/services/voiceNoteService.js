import {
  collection,
  doc,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  getDocs,
  serverTimestamp,
  deleteDoc
} from 'firebase/firestore';
import { db } from './firebase';
import { createNotification } from './notificationService';

const VOICE_NOTES_COLLECTION = 'voiceNotes';

// Upload voice note (stores base64 in Firestore for demo - in production use Firebase Storage)
export const sendVoiceNote = async (friendshipId, senderId, senderName, recipientId, audioBlob) => {
  try {
    // Convert blob to base64 for storage
    const reader = new FileReader();
    const base64Promise = new Promise((resolve) => {
      reader.onloadend = () => resolve(reader.result);
      reader.readAsDataURL(audioBlob);
    });
    const base64Audio = await base64Promise;

    // Create voice note record
    const voiceNoteRef = await addDoc(collection(db, VOICE_NOTES_COLLECTION), {
      friendshipId,
      senderId,
      senderName,
      recipientId,
      audioData: base64Audio,
      duration: Math.round(audioBlob.size / 1000), // rough estimate
      listened: false,
      createdAt: serverTimestamp()
    });

    // Create notification for recipient
    await createNotification({
      type: 'VOICE_NOTE',
      toUserId: recipientId,
      fromUserId: senderId,
      fromUserName: senderName,
      friendshipId,
      title: 'New Voice Note',
      message: `${senderName} sent you a voice check-in message`,
      voiceNoteId: voiceNoteRef.id
    });

    return {
      success: true,
      voiceNoteId: voiceNoteRef.id,
      message: 'Voice note sent!'
    };
  } catch (error) {
    console.error('Error sending voice note:', error);
    return { success: false, error: error.message };
  }
};

// Get voice notes for a friendship
export const getVoiceNotes = async (friendshipId, userId) => {
  try {
    const q = query(
      collection(db, VOICE_NOTES_COLLECTION),
      where('friendshipId', '==', friendshipId),
      orderBy('createdAt', 'desc')
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      isMine: doc.data().senderId === userId,
      createdAt: doc.data().createdAt?.toDate?.() || new Date()
    }));
  } catch (error) {
    console.error('Error getting voice notes:', error);
    return [];
  }
};

// Mark voice note as listened
export const markVoiceNoteListened = async (voiceNoteId) => {
  try {
    await updateDoc(doc(db, VOICE_NOTES_COLLECTION, voiceNoteId), {
      listened: true,
      listenedAt: serverTimestamp()
    });
    return { success: true };
  } catch (error) {
    console.error('Error marking voice note:', error);
    return { success: false, error: error.message };
  }
};

// Get unread voice note count for a user
export const getUnreadVoiceNoteCount = async (userId) => {
  try {
    const q = query(
      collection(db, VOICE_NOTES_COLLECTION),
      where('recipientId', '==', userId),
      where('listened', '==', false)
    );

    const snapshot = await getDocs(q);
    return snapshot.size;
  } catch (error) {
    console.error('Error getting unread count:', error);
    return 0;
  }
};

// Delete voice note
export const deleteVoiceNote = async (voiceNoteId) => {
  try {
    await deleteDoc(doc(db, VOICE_NOTES_COLLECTION, voiceNoteId));
    return { success: true };
  } catch (error) {
    console.error('Error deleting voice note:', error);
    return { success: false, error: error.message };
  }
};
