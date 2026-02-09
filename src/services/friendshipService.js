import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp,
  addDoc
} from 'firebase/firestore';
import { db } from './firebase';

const FRIENDSHIPS_COLLECTION = 'friendships';
const INVITATIONS_COLLECTION = 'invitations';

// Send a friend invitation
export const sendFriendInvitation = async (fromUserId, toEmail) => {
  try {
    // First, find the user with this email
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('email', '==', toEmail));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      return { 
        success: false, 
        error: 'USER_NOT_FOUND',
        message: 'No user found with this email. They need to sign up first.' 
      };
    }

    const toUser = querySnapshot.docs[0];
    const toUserId = toUser.id;

    // Can't invite yourself
    if (fromUserId === toUserId) {
      return { 
        success: false, 
        error: 'SELF_INVITE',
        message: 'You cannot invite yourself.' 
      };
    }

    // Check if invitation already exists (check both directions)
    const existingInviteQuery1 = query(
      collection(db, INVITATIONS_COLLECTION),
      where('fromUserId', '==', fromUserId),
      where('toUserId', '==', toUserId),
      where('status', '==', 'pending')
    );
    const existingInviteQuery2 = query(
      collection(db, INVITATIONS_COLLECTION),
      where('fromUserId', '==', toUserId),
      where('toUserId', '==', fromUserId),
      where('status', '==', 'pending')
    );
    
    const [existingInvites1, existingInvites2] = await Promise.all([
      getDocs(existingInviteQuery1),
      getDocs(existingInviteQuery2)
    ]);

    if (!existingInvites1.empty || !existingInvites2.empty) {
      return { 
        success: false, 
        error: 'INVITE_EXISTS',
        message: 'An invitation already exists between you and this user.' 
      };
    }

    // Check if friendship already exists
    const existingFriendship = await getFriendship(fromUserId, toUserId);
    if (existingFriendship) {
      return { 
        success: false, 
        error: 'ALREADY_FRIENDS',
        message: 'You are already friends with this user.' 
      };
    }

    // Create the invitation
    const invitationRef = await addDoc(collection(db, INVITATIONS_COLLECTION), {
      fromUserId,
      toUserId,
      toEmail,
      status: 'pending',
      createdAt: serverTimestamp(),
      respondedAt: null
    });

    return { 
      success: true, 
      invitationId: invitationRef.id,
      message: 'Invitation sent successfully!' 
    };
  } catch (error) {
    console.error('Error sending invitation:', error);
    return { success: false, error: error.code || error.message, message: error.message };
  }
};

// Get pending invitations for a user
export const getPendingInvitations = async (userId) => {
  try {
    // Get invitations sent to this user
    const receivedQuery = query(
      collection(db, INVITATIONS_COLLECTION),
      where('toUserId', '==', userId),
      where('status', '==', 'pending')
    );
    const receivedSnapshot = await getDocs(receivedQuery);

    // Get invitations sent by this user
    const sentQuery = query(
      collection(db, INVITATIONS_COLLECTION),
      where('fromUserId', '==', userId),
      where('status', '==', 'pending')
    );
    const sentSnapshot = await getDocs(sentQuery);

    // Fetch user details for received invitations
    const received = await Promise.all(
      receivedSnapshot.docs.map(async (docSnap) => {
        const data = docSnap.data();
        const fromUserDoc = await getDoc(doc(db, 'users', data.fromUserId));
        return {
          id: docSnap.id,
          ...data,
          fromUser: fromUserDoc.exists() ? fromUserDoc.data() : null,
          direction: 'received'
        };
      })
    );

    // Fetch user details for sent invitations
    const sent = await Promise.all(
      sentSnapshot.docs.map(async (docSnap) => {
        const data = docSnap.data();
        const toUserDoc = await getDoc(doc(db, 'users', data.toUserId));
        return {
          id: docSnap.id,
          ...data,
          toUser: toUserDoc.exists() ? toUserDoc.data() : null,
          direction: 'sent'
        };
      })
    );

    return { received, sent };
  } catch (error) {
    console.error('Error getting invitations:', error);
    return { received: [], sent: [] };
  }
};

// Respond to an invitation
export const respondToInvitation = async (invitationId, response, currentUserId) => {
  try {
    const invitationRef = doc(db, INVITATIONS_COLLECTION, invitationId);
    const invitationDoc = await getDoc(invitationRef);

    if (!invitationDoc.exists()) {
      return { success: false, error: 'Invitation not found' };
    }

    const invitation = invitationDoc.data();

    // Only the recipient can accept/decline
    if (invitation.toUserId !== currentUserId) {
      return { success: false, error: 'Not authorized to respond to this invitation' };
    }

    if (response === 'accepted') {
      // Create friendship for both users
      await createFriendship(invitation.fromUserId, invitation.toUserId);
    }

    // Update invitation status
    await updateDoc(invitationRef, {
      status: response,
      respondedAt: serverTimestamp()
    });

    return { success: true, status: response };
  } catch (error) {
    console.error('Error responding to invitation:', error);
    return { success: false, error: error.message };
  }
};

// Create a mutual friendship between two users
export const createFriendship = async (userId1, userId2) => {
  try {
    // Get user profiles
    const user1Doc = await getDoc(doc(db, 'users', userId1));
    const user2Doc = await getDoc(doc(db, 'users', userId2));

    if (!user1Doc.exists() || !user2Doc.exists()) {
      throw new Error('One or both users not found');
    }

    const user1Data = user1Doc.data();
    const user2Data = user2Doc.data();

    // Get default limit from user1's settings
    const defaultLimit = user1Data.defaultLimit || 7;

    // Create friendship ID (sorted to ensure consistency)
    const friendshipId = [userId1, userId2].sort().join('_');

    const friendshipData = {
      friendshipId,
      user1: {
        userId: userId1,
        displayName: user1Data.displayName,
        email: user1Data.email,
        avatar: user1Data.avatar
      },
      user2: {
        userId: userId2,
        displayName: user2Data.displayName,
        email: user2Data.email,
        avatar: user2Data.avatar
      },
      createdAt: serverTimestamp(),
      // Each user's perspective (mutual tracking)
      user1Perspective: {
        limit: defaultLimit,
        baseDebt: 0,
        lastInteraction: serverTimestamp(),
        ghostingStartDate: null,
        status: 'active' // active, ghosting, bankrupt
      },
      user2Perspective: {
        limit: defaultLimit,
        baseDebt: 0,
        lastInteraction: serverTimestamp(),
        ghostingStartDate: null,
        status: 'active'
      },
      // Shared data
      streak: 0,
      longestStreak: 0,
      totalCheckins: 0
    };

    await setDoc(doc(db, FRIENDSHIPS_COLLECTION, friendshipId), friendshipData);

    return { success: true, friendshipId };
  } catch (error) {
    console.error('Error creating friendship:', error);
    return { success: false, error: error.message };
  }
};

// Get friendship between two users
export const getFriendship = async (userId1, userId2) => {
  try {
    const friendshipId = [userId1, userId2].sort().join('_');
    const friendshipDoc = await getDoc(doc(db, FRIENDSHIPS_COLLECTION, friendshipId));
    
    if (friendshipDoc.exists()) {
      return { id: friendshipDoc.id, ...friendshipDoc.data() };
    }
    return null;
  } catch (error) {
    console.error('Error getting friendship:', error);
    return null;
  }
};

// Get all friendships for a user
export const getUserFriendships = async (userId) => {
  try {
    // Query friendships where user is user1
    const q1 = query(
      collection(db, FRIENDSHIPS_COLLECTION),
      where('user1.userId', '==', userId)
    );
    const snapshot1 = await getDocs(q1);

    // Query friendships where user is user2
    const q2 = query(
      collection(db, FRIENDSHIPS_COLLECTION),
      where('user2.userId', '==', userId)
    );
    const snapshot2 = await getDocs(q2);

    // Combine and format results
    const friendships = [];

    snapshot1.docs.forEach(doc => {
      const data = doc.data();
      friendships.push({
        id: doc.id,
        ...data,
        myPerspective: 'user1',
        friend: data.user2,
        myData: data.user1Perspective,
        friendData: data.user2Perspective
      });
    });

    snapshot2.docs.forEach(doc => {
      const data = doc.data();
      friendships.push({
        id: doc.id,
        ...data,
        myPerspective: 'user2',
        friend: data.user1,
        myData: data.user2Perspective,
        friendData: data.user1Perspective
      });
    });

    return friendships;
  } catch (error) {
    console.error('Error getting user friendships:', error);
    return [];
  }
};

// Remove a friendship
export const removeFriendship = async (friendshipId, userId) => {
  try {
    const friendshipRef = doc(db, FRIENDSHIPS_COLLECTION, friendshipId);
    const friendshipDoc = await getDoc(friendshipRef);

    if (!friendshipDoc.exists()) {
      return { success: false, error: 'Friendship not found' };
    }

    const data = friendshipDoc.data();
    
    // Verify user is part of this friendship
    if (data.user1.userId !== userId && data.user2.userId !== userId) {
      return { success: false, error: 'Not authorized' };
    }

    await deleteDoc(friendshipRef);

    // Delete any related invitations
    const invitationsQuery = query(
      collection(db, INVITATIONS_COLLECTION),
      where('status', 'in', ['accepted', 'declined'])
    );
    // Note: We can't easily query by friendship, but the invitation 
    // should already be marked as accepted

    return { success: true };
  } catch (error) {
    console.error('Error removing friendship:', error);
    return { success: false, error: error.message };
  }
};

// Update friendship limit (the user sets their own limit for this friendship)
export const updateFriendshipLimit = async (friendshipId, userId, newLimit) => {
  try {
    const friendshipRef = doc(db, FRIENDSHIPS_COLLECTION, friendshipId);
    const friendshipDoc = await getDoc(friendshipRef);

    if (!friendshipDoc.exists()) {
      return { success: false, error: 'Friendship not found' };
    }

    const data = friendshipDoc.data();
    const perspective = data.user1.userId === userId ? 'user1Perspective' : 'user2Perspective';

    await updateDoc(friendshipRef, {
      [`${perspective}.limit`]: newLimit,
      [`${perspective}.limitUpdatedAt`]: serverTimestamp()
    });

    return { success: true };
  } catch (error) {
    console.error('Error updating limit:', error);
    return { success: false, error: error.message };
  }
};
