import { api } from './api';

// Send a friend invitation (In the new backend, we'll start with direct friendship for now)
export const sendFriendInvitation = async (fromUserId, toEmail, limit) => {
  try {
    const res = await api.post('/friendships', { friendEmail: toEmail, limit });
    if (res.msg) {
      return { success: false, error: res.msg, message: res.msg };
    }
    return { success: true, friendshipId: res._id, message: 'Friend added!' };
  } catch (error) {
    console.error('Error adding friend:', error);
    return { success: false, error: error.message };
  }
};

// Get all friendships for a user
export const getUserFriendships = async (userId) => {
  try {
    const friendships = await api.get('/friendships');
    
    // Map backend data to frontend expected format
    return friendships.map(f => {
      const isUser1 = f.user1._id === userId;
      return {
        id: f._id,
        ...f,
        myPerspective: isUser1 ? 'user1' : 'user2',
        friend: isUser1 ? f.user2 : f.user1,
        myData: isUser1 ? f.user1Perspective : f.user2Perspective,
        friendData: isUser1 ? f.user2Perspective : f.user1Perspective
      };
    });
  } catch (error) {
    console.error('Error getting user friendships:', error);
    return [];
  }
};

// Perform a check-in
export const performCheckin = async (friendshipId) => {
  try {
    const res = await api.post(`/friendships/${friendshipId}/checkin`);
    if (res.msg) return { success: false, error: res.msg };
    return { success: true, friendship: res };
  } catch (error) {
    console.error('Error checking in:', error);
    return { success: false, error: error.message };
  }
};

// The following will be implemented as needed in the backend
export const getPendingInvitations = async () => ({ received: [], sent: [] });
export const respondToInvitation = async () => ({ success: true });
export const removeFriendship = async () => ({ success: true });
export const updateFriendshipLimit = async () => ({ success: true });
