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
    const data = await api.get('/friendships');
    return data; // Return the object with active, pendingReceived, and pendingSent
  } catch (error) {
    console.error('Error getting user friendships:', error);
    return { active: [], pendingReceived: [], pendingSent: [] };
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
// Get pending invitations
export const getPendingInvitations = async () => {
  try {
    const data = await api.get('/friendships');
    return { 
      received: data.pendingReceived || [], 
      sent: data.pendingSent || [] 
    };
  } catch (error) {
    console.error('Error getting pending invitations:', error);
    return { received: [], sent: [] };
  }
};

// Respond to an invitation
export const respondToInvitation = async (friendshipId, action) => {
  try {
    const normalizedAction = action.toUpperCase();
    const res = await api.put(`/friendships/${friendshipId}/respond`, { action: normalizedAction });
    if (res.error) return { success: false, error: res.msg || 'FAILED TO RESPOND' };
    return { success: true, friendship: res };
  } catch (error) {
    console.error('Error responding to invitation:', error);
    return { success: false, error: error.message };
  }
};
export const removeFriendship = async () => ({ success: true });
export const updateFriendshipLimit = async () => ({ success: true });
