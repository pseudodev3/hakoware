import { collection, addDoc, serverTimestamp, query, where, getDocs, doc, getDoc, runTransaction, Timestamp } from 'firebase/firestore';
import { db } from './firebase';

// Feature flag - set to true when functions are deployed
const USE_SERVER_CHECKIN = false;

const CHECK_IN_REWARD = 2; // -2% APR per check-in

/**
 * Perform a check-in for a friendship
 * Uses Firestore transactions for atomic updates (client-side approach)
 */
export const performCheckin = async (friendshipId, userId, proofOfContact = '') => {
  // Validate input
  if (!friendshipId || !userId) {
    throw new Error('Friendship ID and User ID are required');
  }

  const friendshipRef = doc(db, 'friendships', friendshipId);
  
  try {
    const result = await runTransaction(db, async (transaction) => {
      // Get current friendship data
      const friendshipDoc = await transaction.get(friendshipRef);
      
      if (!friendshipDoc.exists()) {
        throw new Error('Friendship not found');
      }
      
      const friendship = friendshipDoc.data();
      
      // Verify user is part of this friendship
      if (friendship.user1 !== userId && friendship.user2 !== userId) {
        throw new Error('Unauthorized: User is not part of this friendship');
      }
      
      // Check if already checked in today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const lastCheckin = friendship.lastCheckin?.toDate?.() || new Date(0);
      const lastCheckinDay = new Date(lastCheckin);
      lastCheckinDay.setHours(0, 0, 0, 0);
      
      if (lastCheckinDay.getTime() === today.getTime()) {
        throw new Error('Already checked in today');
      }
      
      // Calculate streak
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      
      const isConsecutive = lastCheckinDay.getTime() === yesterday.getTime();
      const streak = isConsecutive ? (friendship.streak || 0) + 1 : 1;
      
      // Calculate new APR (reward for check-in)
      const currentAPR = friendship.currentAPR || 5;
      const newAPR = Math.max(0.1, currentAPR - CHECK_IN_REWARD); // Min 0.1%
      
      // Update friendship
      transaction.update(friendshipRef, {
        lastCheckin: serverTimestamp(),
        streak: streak,
        currentAPR: newAPR,
        updatedAt: serverTimestamp()
      });
      
      // Create check-in record
      const checkinRef = doc(collection(db, 'checkins'));
      transaction.set(checkinRef, {
        friendshipId,
        userId,
        proofOfContact,
        timestamp: serverTimestamp(),
        streak,
        aprReward: CHECK_IN_REWARD,
        newAPR
      });
      
      return {
        success: true,
        checkinId: checkinRef.id,
        streak,
        newAPR,
        isConsecutive,
        timestamp: new Date()
      };
    });
    
    return result;
    
  } catch (error) {
    console.error('Check-in transaction failed:', error);
    throw error;
  }
};

/**
 * Check if user has already checked in today
 */
export const hasCheckedInToday = async (friendshipId, userId) => {
  if (!friendshipId || !userId) return false;
  
  try {
    const friendshipRef = doc(db, 'friendships', friendshipId);
    const docSnap = await getDoc(friendshipRef);
    
    if (!docSnap.exists()) return false;
    
    const data = docSnap.data();
    if (!data.lastCheckin) return false;
    
    // Compare dates
    const lastCheckin = data.lastCheckin.toDate();
    const today = new Date();
    
    return lastCheckin.getDate() === today.getDate() &&
           lastCheckin.getMonth() === today.getMonth() &&
           lastCheckin.getFullYear() === today.getFullYear();
  } catch (error) {
    console.error('Error checking check-in status:', error);
    return false;
  }
};

/**
 * Get check-in history for a friendship
 */
export const getCheckinHistory = async (friendshipId, limit = 30) => {
  try {
    const checkinsQuery = query(
      collection(db, 'checkins'),
      where('friendshipId', '==', friendshipId)
    );
    
    const snapshot = await getDocs(checkinsQuery);
    const checkins = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    // Sort by timestamp descending
    checkins.sort((a, b) => b.timestamp?.toMillis() - a.timestamp?.toMillis());
    
    return checkins.slice(0, limit);
  } catch (error) {
    console.error('Error fetching check-in history:', error);
    return [];
  }
};

/**
 * Calculate current debt for a friendship (client-side)
 * This is a fallback when Cloud Functions aren't available
 */
export const calculateCurrentDebt = (friendship) => {
  if (!friendship) return 0;
  
  const {
    baseDebt = 0,
    lastDebtUpdate,
    currentAPR = 5
  } = friendship;
  
  if (baseDebt <= 0) return 0;
  
  // Calculate days since last update
  const lastUpdate = lastDebtUpdate?.toDate?.() || friendship.createdAt?.toDate?.() || new Date();
  const now = new Date();
  const daysSinceUpdate = Math.floor((now - lastUpdate) / (1000 * 60 * 60 * 24));
  
  if (daysSinceUpdate <= 0) return baseDebt;
  
  // Compound interest: P * (1 + r/100)^t
  const debtMultiplier = Math.pow(1 + (currentAPR / 100), daysSinceUpdate);
  const currentDebt = baseDebt * debtMultiplier;
  
  return Math.round(currentDebt * 100) / 100;
};

/**
 * Daily debt accrual - should be called by a scheduled function
 * For client-side: can be triggered when user opens app (once per day)
 */
export const applyDailyDebtAccrual = async (friendshipId) => {
  const friendshipRef = doc(db, 'friendships', friendshipId);
  
  try {
    await runTransaction(db, async (transaction) => {
      const friendshipDoc = await transaction.get(friendshipRef);
      
      if (!friendshipDoc.exists()) {
        throw new Error('Friendship not found');
      }
      
      const friendship = friendshipDoc.data();
      const {
        baseDebt = 0,
        lastDebtUpdate,
        currentAPR = 5
      } = friendship;
      
      if (baseDebt <= 0) return;
      
      // Calculate days since last update
      const lastUpdate = lastDebtUpdate?.toDate?.() || friendship.createdAt?.toDate?.() || new Date();
      const now = new Date();
      const daysSinceUpdate = Math.floor((now - lastUpdate) / (1000 * 60 * 60 * 24));
      
      if (daysSinceUpdate <= 0) return; // Already updated today
      
      // Calculate new base debt with compound interest
      const debtMultiplier = Math.pow(1 + (currentAPR / 100), daysSinceUpdate);
      const newBaseDebt = baseDebt * debtMultiplier;
      
      // Update friendship with new debt
      transaction.update(friendshipRef, {
        baseDebt: Math.round(newBaseDebt * 100) / 100,
        lastDebtUpdate: Timestamp.now(),
        updatedAt: serverTimestamp()
      });
    });
    
    return { success: true };
  } catch (error) {
    console.error('Debt accrual failed:', error);
    throw error;
  }
};

export default {
  performCheckin,
  hasCheckedInToday,
  getCheckinHistory,
  calculateCurrentDebt,
  applyDailyDebtAccrual
};
