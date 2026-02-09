import {
  doc,
  getDoc,
  updateDoc,
  addDoc,
  collection,
  query,
  where,
  getDocs,
  serverTimestamp,
  orderBy,
  limit,
  Timestamp
} from 'firebase/firestore';
import { db } from './firebase';

const BANKRUPTCY_HISTORY_COLLECTION = 'bankruptcyHistory';
const MERCY_REQUESTS_COLLECTION = 'mercyRequests';
const FRIENDSHIPS_COLLECTION = 'friendships';

// Check and update bankruptcy status
export const checkBankruptcyStatus = async (friendshipId, userId) => {
  try {
    const friendshipRef = doc(db, FRIENDSHIPS_COLLECTION, friendshipId);
    const friendshipDoc = await getDoc(friendshipRef);

    if (!friendshipDoc.exists()) {
      return { success: false, error: 'Friendship not found' };
    }

    const friendship = friendshipDoc.data();
    const isUser1 = friendship.user1.userId === userId;
    const perspective = isUser1 ? 'user1Perspective' : 'user2Perspective';
    const myData = isUser1 ? friendship.user1Perspective : friendship.user2Perspective;

    // Calculate current debt
    const lastInteraction = myData.lastInteraction?.toDate();
    const now = new Date();
    const daysSince = lastInteraction 
      ? Math.floor((now - lastInteraction) / (1000 * 60 * 60 * 24))
      : 999;
    
    const limit = myData.limit || 7;
    // NEW: Interest only accrues after limit, bankruptcy at 2x limit
    const daysOverLimit = Math.max(0, daysSince - limit);
    const totalDebt = (myData.baseDebt || 0) + daysOverLimit;

    const wasBankrupt = myData.status === 'bankrupt';
    // NEW: Bankruptcy threshold is 2x the limit (warning zone)
    const isNowBankrupt = totalDebt >= limit * 2;

    // If newly bankrupt, record it
    if (!wasBankrupt && isNowBankrupt) {
      await updateDoc(friendshipRef, {
        [`${perspective}.status`]: 'bankrupt',
        [`${perspective}.bankruptcyDeclaredAt`]: serverTimestamp(),
        [`${perspective}.bankruptcyDebt`]: totalDebt
      });

      // Add to bankruptcy history
      await addDoc(collection(db, BANKRUPTCY_HISTORY_COLLECTION), {
        friendshipId,
        userId,
        userName: isUser1 ? friendship.user1.displayName : friendship.user2.displayName,
        friendId: isUser1 ? friendship.user2.userId : friendship.user1.userId,
        friendName: isUser1 ? friendship.user2.displayName : friendship.user1.displayName,
        debtAtBankruptcy: totalDebt,
        daysGhosted: daysSince,
        declaredAt: serverTimestamp(),
        resolvedAt: null,
        resolutionType: null // 'checkin', 'mercy', 'bailout'
      });

      return {
        success: true,
        newlyBankrupt: true,
        totalDebt,
        daysSince
      };
    }

    return {
      success: true,
      newlyBankrupt: false,
      isBankrupt: isNowBankrupt,
      isInWarningZone: totalDebt >= limit && totalDebt < limit * 2,
      totalDebt,
      daysSince,
      daysUntilBankrupt: Math.max(0, (limit * 2) - totalDebt)
    };
  } catch (error) {
    console.error('Error checking bankruptcy status:', error);
    return { success: false, error: error.message };
  }
};

// File a "Beg for Aura" request (mercy request)
export const fileMercyRequest = async (friendshipId, userId, message = '') => {
  try {
    const friendshipRef = doc(db, FRIENDSHIPS_COLLECTION, friendshipId);
    const friendshipDoc = await getDoc(friendshipRef);

    if (!friendshipDoc.exists()) {
      return { success: false, error: 'Friendship not found' };
    }

    const friendship = friendshipDoc.data();
    const isUser1 = friendship.user1.userId === userId;
    
    // Check if user is actually bankrupt
    const myData = isUser1 ? friendship.user1Perspective : friendship.user2Perspective;
    if (myData.status !== 'bankrupt') {
      return { success: false, error: 'You are not bankrupt' };
    }

    // Check if there's already a pending request
    const existingQuery = query(
      collection(db, MERCY_REQUESTS_COLLECTION),
      where('friendshipId', '==', friendshipId),
      where('requesterId', '==', userId),
      where('status', '==', 'pending')
    );
    const existing = await getDocs(existingQuery);

    if (!existing.empty) {
      return { success: false, error: 'You already have a pending mercy request' };
    }

    const creditorId = isUser1 ? friendship.user2.userId : friendship.user1.userId;
    const creditorName = isUser1 ? friendship.user2.displayName : friendship.user1.displayName;

    const requestRef = await addDoc(collection(db, MERCY_REQUESTS_COLLECTION), {
      friendshipId,
      requesterId: userId,
      requesterName: isUser1 ? friendship.user1.displayName : friendship.user2.displayName,
      creditorId,
      creditorName,
      message,
      status: 'pending',
      response: null,
      condition: null,
      createdAt: serverTimestamp(),
      respondedAt: null
    });

    return {
      success: true,
      requestId: requestRef.id,
      message: 'Mercy request filed! Your creditor has been notified.'
    };
  } catch (error) {
    console.error('Error filing mercy request:', error);
    return { success: false, error: error.message };
  }
};

// Get pending mercy requests for a user (as creditor)
export const getPendingMercyRequests = async (userId) => {
  try {
    const q = query(
      collection(db, MERCY_REQUESTS_COLLECTION),
      where('creditorId', '==', userId),
      where('status', '==', 'pending'),
      orderBy('createdAt', 'desc')
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('Error getting mercy requests:', error);
    return [];
  }
};

// Respond to a mercy request
export const respondToMercyRequest = async (requestId, response, condition = null) => {
  try {
    const requestRef = doc(db, MERCY_REQUESTS_COLLECTION, requestId);
    const requestDoc = await getDoc(requestRef);

    if (!requestDoc.exists()) {
      return { success: false, error: 'Request not found' };
    }

    const request = requestDoc.data();

    await updateDoc(requestRef, {
      status: response,
      response,
      condition: condition,
      respondedAt: serverTimestamp()
    });

    // If granted, clear the bankruptcy
    if (response === 'granted') {
      const friendshipRef = doc(db, FRIENDSHIPS_COLLECTION, request.friendshipId);
      const friendshipDoc = await getDoc(friendshipRef);
      
      if (friendshipDoc.exists()) {
        const friendship = friendshipDoc.data();
        const isRequesterUser1 = friendship.user1.userId === request.requesterId;
        const perspective = isRequesterUser1 ? 'user1Perspective' : 'user2Perspective';

        await updateDoc(friendshipRef, {
          [`${perspective}.status`]: 'active',
          [`${perspective}.baseDebt`]: 0,
          [`${perspective}.lastInteraction`]: serverTimestamp(),
          [`${perspective}.bankruptcyResolvedAt`]: serverTimestamp()
        });

        // Update bankruptcy history
        const historyQuery = query(
          collection(db, BANKRUPTCY_HISTORY_COLLECTION),
          where('friendshipId', '==', request.friendshipId),
          where('userId', '==', request.requesterId),
          where('resolvedAt', '==', null)
        );
        const historySnapshot = await getDocs(historyQuery);
        
        if (!historySnapshot.empty) {
          const historyDoc = historySnapshot.docs[0];
          await updateDoc(doc(db, BANKRUPTCY_HISTORY_COLLECTION, historyDoc.id), {
            resolvedAt: serverTimestamp(),
            resolutionType: 'mercy'
          });
        }
      }
    }

    return {
      success: true,
      message: response === 'granted' 
        ? 'Mercy granted! Debt forgiven.' 
        : response === 'countered'
        ? 'Counter offer sent.'
        : 'Request declined.'
    };
  } catch (error) {
    console.error('Error responding to mercy request:', error);
    return { success: false, error: error.message };
  }
};

// Get bankruptcy history for a friendship
export const getBankruptcyHistory = async (friendshipId) => {
  try {
    const q = query(
      collection(db, BANKRUPTCY_HISTORY_COLLECTION),
      where('friendshipId', '==', friendshipId),
      orderBy('declaredAt', 'desc')
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('Error getting bankruptcy history:', error);
    return [];
  };
};

// Get user's bankruptcy stats
export const getUserBankruptcyStats = async (userId) => {
  try {
    const q = query(
      collection(db, BANKRUPTCY_HISTORY_COLLECTION),
      where('userId', '==', userId)
    );

    const snapshot = await getDocs(q);
    const bankruptcies = snapshot.docs.map(doc => doc.data());

    return {
      total: bankruptcies.length,
      resolved: bankruptcies.filter(b => b.resolvedAt).length,
      current: bankruptcies.filter(b => !b.resolvedAt).length
    };
  } catch (error) {
    console.error('Error getting bankruptcy stats:', error);
    return { total: 0, resolved: 0, current: 0 };
  }
};

// Resolve bankruptcy through check-ins (gradual repayment)
export const resolveBankruptcyByCheckin = async (friendshipId, userId) => {
  try {
    const friendshipRef = doc(db, FRIENDSHIPS_COLLECTION, friendshipId);
    const friendshipDoc = await getDoc(friendshipRef);

    if (!friendshipDoc.exists()) {
      return { success: false, error: 'Friendship not found' };
    }

    const friendship = friendshipDoc.data();
    const isUser1 = friendship.user1.userId === userId;
    const perspective = isUser1 ? 'user1Perspective' : 'user2Perspective';
    const myData = isUser1 ? friendship.user1Perspective : friendship.user2Perspective;

    // Check if still bankrupt
    if (myData.status !== 'bankrupt') {
      return { success: false, error: 'Not currently bankrupt' };
    }

    // Check if debt is paid off
    if ((myData.baseDebt || 0) <= 0) {
      // Clear bankruptcy status
      await updateDoc(friendshipRef, {
        [`${perspective}.status`]: 'active',
        [`${perspective}.bankruptcyResolvedAt`]: serverTimestamp()
      });

      // Update bankruptcy history
      const historyQuery = query(
        collection(db, BANKRUPTCY_HISTORY_COLLECTION),
        where('friendshipId', '==', friendshipId),
        where('userId', '==', userId),
        where('resolvedAt', '==', null)
      );
      const historySnapshot = await getDocs(historyQuery);
      
      if (!historySnapshot.empty) {
        const historyDoc = historySnapshot.docs[0];
        await updateDoc(doc(db, BANKRUPTCY_HISTORY_COLLECTION, historyDoc.id), {
          resolvedAt: serverTimestamp(),
          resolutionType: 'checkin'
        });
      }

      return { success: true, resolved: true, message: 'Bankruptcy resolved! You are debt free.' };
    }

    return { success: true, resolved: false, remainingDebt: myData.baseDebt };
  } catch (error) {
    console.error('Error resolving bankruptcy:', error);
    return { success: false, error: error.message };
  }
};

// Get bailout history for a user (bailouts they gave or received)
export const getUserBailoutHistory = async (userId) => {
  try {
    // Get bailouts where user was the giver
    const givenQuery = query(
      collection(db, 'bailouts'),
      where('fromUserId', '==', userId),
      orderBy('createdAt', 'desc')
    );
    
    // Get bailouts where user was the receiver
    const receivedQuery = query(
      collection(db, 'bailouts'),
      where('toUserId', '==', userId),
      orderBy('createdAt', 'desc')
    );
    
    const [givenSnapshot, receivedSnapshot] = await Promise.all([
      getDocs(givenQuery),
      getDocs(receivedQuery)
    ]);
    
    const given = givenSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      type: 'given'
    }));
    
    const received = receivedSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      type: 'received'
    }));
    
    // Combine and sort by date
    const allBailouts = [...given, ...received].sort((a, b) => {
      const dateA = a.createdAt?.toDate?.() || new Date(0);
      const dateB = b.createdAt?.toDate?.() || new Date(0);
      return dateB - dateA;
    });
    
    return { given, received, all: allBailouts };
  } catch (error) {
    console.error('Error getting bailout history:', error);
    return { given: [], received: [], all: [] };
  }
};

// Get bailout history for a specific friendship
export const getFriendshipBailoutHistory = async (friendshipId) => {
  try {
    const q = query(
      collection(db, 'bailouts'),
      where('friendshipId', '==', friendshipId),
      orderBy('createdAt', 'desc')
    );
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('Error getting friendship bailout history:', error);
    return [];
  }
};
