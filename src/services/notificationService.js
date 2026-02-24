import { api } from './api';

// Create a new notification
export const createNotification = async (notificationData) => {
  try {
    return await api.post('/notifications', notificationData);
  } catch (error) {
    console.error('Error creating notification:', error);
    return { success: false, error: error.message };
  }
};

// Get notifications for a user
export const getUserNotifications = async (userId) => {
  try {
    return await api.get('/notifications');
  } catch (error) {
    console.error('Error getting notifications:', error);
    return [];
  }
};

// Mark notification as read
export const markNotificationRead = async (notificationId) => {
  try {
    return await api.put(`/notifications/${notificationId}/read`);
  } catch (error) {
    console.error('Error marking notification as read:', error);
    return { success: false, error: error.message };
  }
};

// Mark all notifications as read
export const markAllRead = async (userId) => {
  try {
    return await api.put('/notifications/read-all');
  } catch (error) {
    console.error('Error marking all as read:', error);
    return { success: false, error: error.message };
  }
};

// Delete a notification
export const deleteNotification = async (notificationId) => {
  try {
    return await api.delete(`/notifications/${notificationId}`);
  } catch (error) {
    console.error('Error deleting notification:', error);
    return { success: false, error: error.message };
  }
};

// Clear all notifications
export const clearAllNotifications = async (userId) => {
  try {
    return await api.delete('/notifications/clear-all');
  } catch (error) {
    console.error('Error clearing notifications:', error);
    return { success: false, error: error.message };
  }
};
