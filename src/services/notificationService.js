import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  deleteDoc
} from 'firebase/firestore';
import { db } from './firebase';

const NOTIFICATIONS_COLLECTION = 'notifications';

// Create a notification
export const createNotification = async (data) => {
  try {
    const notificationRef = await addDoc(collection(db, NOTIFICATIONS_COLLECTION), {
      ...data,
      createdAt: serverTimestamp(),
      read: false
    });
    return { success: true, notificationId: notificationRef.id };
  } catch (error) {
    console.error('Error creating notification:', error);
    return { success: false, error: error.message };
  }
};

// Get notifications for a user
export const getUserNotifications = async (userId, limit_count = 50) => {
  try {
    const q = query(
      collection(db, NOTIFICATIONS_COLLECTION),
      where('toUserId', '==', userId),
      orderBy('createdAt', 'desc'),
      limit(limit_count)
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('Error getting notifications:', error);
    return [];
  }
};

// Get unread notification count
export const getUnreadNotificationCount = async (userId) => {
  try {
    const q = query(
      collection(db, NOTIFICATIONS_COLLECTION),
      where('toUserId', '==', userId),
      where('read', '==', false)
    );

    const snapshot = await getDocs(q);
    return snapshot.size;
  } catch (error) {
    console.error('Error getting unread count:', error);
    return 0;
  }
};

// Mark notification as read
export const markNotificationAsRead = async (notificationId) => {
  try {
    const notificationRef = doc(db, NOTIFICATIONS_COLLECTION, notificationId);
    await updateDoc(notificationRef, { read: true, readAt: serverTimestamp() });
    return { success: true };
  } catch (error) {
    console.error('Error marking notification as read:', error);
    return { success: false, error: error.message };
  }
};

// Mark all notifications as read
export const markAllNotificationsAsRead = async (userId) => {
  try {
    const q = query(
      collection(db, NOTIFICATIONS_COLLECTION),
      where('toUserId', '==', userId),
      where('read', '==', false)
    );

    const snapshot = await getDocs(q);
    const batch = [];
    
    snapshot.docs.forEach(docSnap => {
      batch.push(updateDoc(doc(db, NOTIFICATIONS_COLLECTION, docSnap.id), { 
        read: true, 
        readAt: serverTimestamp() 
      }));
    });

    await Promise.all(batch);
    return { success: true, count: snapshot.size };
  } catch (error) {
    console.error('Error marking all as read:', error);
    return { success: false, error: error.message };
  }
};

// Delete a notification
export const deleteNotification = async (notificationId) => {
  try {
    await deleteDoc(doc(db, NOTIFICATIONS_COLLECTION, notificationId));
    return { success: true };
  } catch (error) {
    console.error('Error deleting notification:', error);
    return { success: false, error: error.message };
  }
};

// Notification type helpers
export const NOTIFICATION_TYPES = {
  LIMIT_CHANGED: 'LIMIT_CHANGED',
  BAILOUT_RECEIVED: 'BAILOUT_RECEIVED',
  MERCY_GRANTED: 'MERCY_GRANTED',
  MERCY_DECLINED: 'MERCY_DECLINED',
  MERCY_COUNTERED: 'MERCY_COUNTERED',
  FRIENDSHIP_REMOVED: 'FRIENDSHIP_REMOVED',
  CHECKIN_REMINDER: 'CHECKIN_REMINDER',
  VOICE_NOTE: 'VOICE_NOTE'
};

// Create limit changed notification
export const notifyLimitChanged = async (friendship, changerUserId, oldLimit, newLimit) => {
  try {
    const isUser1 = friendship.user1.userId === changerUserId;
    const changer = isUser1 ? friendship.user1 : friendship.user2;
    const recipient = isUser1 ? friendship.user2 : friendship.user1;

    return await createNotification({
      type: NOTIFICATION_TYPES.LIMIT_CHANGED,
      toUserId: recipient.userId,
      fromUserId: changer.userId,
      fromUserName: changer.displayName,
      friendshipId: friendship.id,
      title: 'Ghosting Limit Changed',
      message: `${changer.displayName} changed their ghosting limit for you from ${oldLimit} to ${newLimit} days.`,
      oldLimit,
      newLimit
    });
  } catch (error) {
    console.error('Error creating limit change notification:', error);
    return { success: false, error: error.message };
  }
};

// Create bailout received notification
export const notifyBailoutReceived = async (friendship, fromUserId, toUserId, amount, message) => {
  try {
    const isUser1 = friendship.user1.userId === fromUserId;
    const bailedBy = isUser1 ? friendship.user1 : friendship.user2;
    const recipient = isUser1 ? friendship.user2 : friendship.user1;

    return await createNotification({
      type: NOTIFICATION_TYPES.BAILOUT_RECEIVED,
      toUserId: recipient.userId,
      fromUserId: bailedBy.userId,
      fromUserName: bailedBy.displayName,
      friendshipId: friendship.id,
      title: 'You Were Bailed Out!',
      message: message 
        ? `${bailedBy.displayName} paid ${amount} APR of your debt and said: "${message}"`
        : `${bailedBy.displayName} paid ${amount} APR of your debt.`,
      amount,
      bailoutMessage: message || null
    });
  } catch (error) {
    console.error('Error creating bailout notification:', error);
    return { success: false, error: error.message };
  }
};

// Create mercy response notification
export const notifyMercyResponse = async (mercyRequest, response, condition = null) => {
  try {
    let title, message;
    
    switch (response) {
      case 'granted':
        title = 'Mercy Granted!';
        message = `${mercyRequest.creditorName} has forgiven your debt. You are debt free!`;
        break;
      case 'declined':
        title = 'Mercy Declined';
        message = `${mercyRequest.creditorName} declined your mercy request.`;
        break;
      case 'countered':
        title = 'Counter Offer Received';
        message = `${mercyRequest.creditorName} set a condition: "${condition}"`;
        break;
      default:
        title = 'Mercy Request Updated';
        message = 'Your mercy request has been updated.';
    }

    return await createNotification({
      type: response === 'granted' ? NOTIFICATION_TYPES.MERCY_GRANTED : 
            response === 'declined' ? NOTIFICATION_TYPES.MERCY_DECLINED : 
            NOTIFICATION_TYPES.MERCY_COUNTERED,
      toUserId: mercyRequest.requesterId,
      fromUserId: mercyRequest.creditorId,
      fromUserName: mercyRequest.creditorName,
      friendshipId: mercyRequest.friendshipId,
      title,
      message,
      response,
      condition
    });
  } catch (error) {
    console.error('Error creating mercy notification:', error);
    return { success: false, error: error.message };
  }
};
