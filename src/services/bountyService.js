import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  getDocs,
  serverTimestamp,
  increment,
  orderBy,
  addDoc
} from 'firebase/firestore';
import { db } from './firebase';

const BOUNTIES_COLLECTION = 'bounties';
const BOUNTY_CLAIMS_COLLECTION = 'bountyClaims';

// Create a bounty on a friend who has ghosted you
export const createBounty = async (creatorId, creatorName, targetId, targetName, friendshipId, amount, message = '') => {
  try {
    // Validate minimum bounty amount
    if (amount < 5) {
      return { success: false, error: 'Minimum bounty is 5 Aura Points' };
    }

    // Check if bounty already exists for this friendship
    const existingQuery = query(
      collection(db, BOUNTIES_COLLECTION),
      where('friendshipId', '==', friendshipId),
      where('status', '==', 'active')
    );
    const existing = await getDocs(existingQuery);
    
    if (!existing.empty) {
      return { success: false, error: 'A bounty already exists for this friendship' };
    }

    const bountyRef = await addDoc(collection(db, BOUNTIES_COLLECTION), {
      creatorId,
      creatorName,
      targetId,
      targetName,
      friendshipId,
      amount,
      message: message || `${creatorName} wants ${targetName} to check in!`,
      status: 'active',
      claimedBy: null,
      claimedAt: null,
      proofOfContact: null,
      createdAt: serverTimestamp(),
      expiresAt: null // We'll calculate this on the client from createdAt
    });

    return {
      success: true,
      bountyId: bountyRef.id,
      message: `Bounty placed on ${targetName} for ${amount} Aura Points!`
    };
  } catch (error) {
    console.error('Error creating bounty:', error);
    return { success: false, error: error.message };
  }
};

// Get all active bounties
export const getActiveBounties = async (limit_count = 20) => {
  try {
    // Simple query without composite index requirement
    const q = query(
      collection(db, BOUNTIES_COLLECTION),
      where('status', '==', 'active')
    );

    const snapshot = await getDocs(q);
    const bounties = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.() || new Date()
    }));
    
    // Sort client-side by amount (descending)
    return bounties.sort((a, b) => (b.amount || 0) - (a.amount || 0)).slice(0, limit_count);
  } catch (error) {
    console.error('Error getting active bounties:', error);
    return [];
  }
};

// Get bounties created by a user
export const getUserCreatedBounties = async (userId) => {
  try {
    const q = query(
      collection(db, BOUNTIES_COLLECTION),
      where('creatorId', '==', userId),
      orderBy('createdAt', 'desc')
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.() || new Date()
    }));
  } catch (error) {
    console.error('Error getting user bounties:', error);
    return [];
  }
};

// Get bounties where user is the target
export const getBountiesOnUser = async (userId) => {
  try {
    const q = query(
      collection(db, BOUNTIES_COLLECTION),
      where('targetId', '==', userId),
      where('status', '==', 'active')
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.() || new Date()
    }));
  } catch (error) {
    console.error('Error getting bounties on user:', error);
    return [];
  }
};

// Claim a bounty (hunt down the target)
export const claimBounty = async (bountyId, hunterId, hunterName, proofOfContact = '') => {
  try {
    const bountyRef = doc(db, BOUNTIES_COLLECTION, bountyId);
    const bountyDoc = await getDoc(bountyRef);

    if (!bountyDoc.exists()) {
      return { success: false, error: 'Bounty not found' };
    }

    const bounty = bountyDoc.data();

    if (bounty.status !== 'active') {
      return { success: false, error: 'This bounty has already been claimed or expired' };
    }

    if (bounty.targetId === hunterId) {
      return { success: false, error: 'You cannot claim a bounty on yourself' };
    }

    // Update bounty status
    await updateDoc(bountyRef, {
      status: 'claimed',
      claimedBy: hunterId,
      claimedByName: hunterName,
      claimedAt: serverTimestamp(),
      proofOfContact
    });

    // Record the claim
    await addDoc(collection(db, BOUNTY_CLAIMS_COLLECTION), {
      bountyId,
      hunterId,
      hunterName,
      targetId: bounty.targetId,
      targetName: bounty.targetName,
      amount: bounty.amount,
      claimedAt: serverTimestamp()
    });

    return {
      success: true,
      message: `Bounty claimed! You earned ${bounty.amount} Aura Points!`,
      reward: bounty.amount
    };
  } catch (error) {
    console.error('Error claiming bounty:', error);
    return { success: false, error: error.message };
  }
};

// Cancel a bounty (only creator can cancel)
export const cancelBounty = async (bountyId, userId) => {
  try {
    const bountyRef = doc(db, BOUNTIES_COLLECTION, bountyId);
    const bountyDoc = await getDoc(bountyRef);

    if (!bountyDoc.exists()) {
      return { success: false, error: 'Bounty not found' };
    }

    const bounty = bountyDoc.data();

    if (bounty.creatorId !== userId) {
      return { success: false, error: 'Only the bounty creator can cancel it' };
    }

    if (bounty.status !== 'active') {
      return { success: false, error: 'This bounty cannot be cancelled' };
    }

    await updateDoc(bountyRef, {
      status: 'cancelled',
      cancelledAt: serverTimestamp()
    });

    return {
      success: true,
      message: 'Bounty cancelled. Your Aura Points have been refunded.'
    };
  } catch (error) {
    console.error('Error cancelling bounty:', error);
    return { success: false, error: error.message };
  }
};

// Get bounty claim history for a user
export const getUserBountyClaims = async (userId) => {
  try {
    const q = query(
      collection(db, BOUNTY_CLAIMS_COLLECTION),
      where('hunterId', '==', userId),
      orderBy('claimedAt', 'desc')
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      claimedAt: doc.data().claimedAt?.toDate?.() || new Date()
    }));
  } catch (error) {
    console.error('Error getting bounty claims:', error);
    return [];
  }
};

// Get top bounty hunters leaderboard
export const getBountyHunterLeaderboard = async (limit_count = 10) => {
  try {
    const q = query(
      collection(db, BOUNTY_CLAIMS_COLLECTION),
      orderBy('claimedAt', 'desc')
    );

    const snapshot = await getDocs(q);
    const claims = snapshot.docs.map(doc => doc.data());
    
    // Aggregate by hunter
    const hunterStats = {};
    claims.forEach(claim => {
      if (!hunterStats[claim.hunterId]) {
        hunterStats[claim.hunterId] = {
          hunterId: claim.hunterId,
          hunterName: claim.hunterName,
          totalClaims: 0,
          totalEarnings: 0
        };
      }
      hunterStats[claim.hunterId].totalClaims++;
      hunterStats[claim.hunterId].totalEarnings += claim.amount;
    });

    return Object.values(hunterStats)
      .sort((a, b) => b.totalEarnings - a.totalEarnings)
      .slice(0, limit_count);
  } catch (error) {
    console.error('Error getting hunter leaderboard:', error);
    return [];
  }
};

// Get bounty stats for a user
export const getUserBountyStats = async (userId) => {
  try {
    const createdQuery = query(
      collection(db, BOUNTIES_COLLECTION),
      where('creatorId', '==', userId)
    );
    
    const claimsQuery = query(
      collection(db, BOUNTY_CLAIMS_COLLECTION),
      where('hunterId', '==', userId)
    );
    
    const [createdSnapshot, claimsSnapshot] = await Promise.all([
      getDocs(createdQuery),
      getDocs(claimsQuery)
    ]);

    const created = createdSnapshot.docs.map(d => d.data());
    const claims = claimsSnapshot.docs.map(d => d.data());

    return {
      bountiesCreated: created.length,
      bountiesActive: created.filter(b => b.status === 'active').length,
      bountiesClaimed: created.filter(b => b.status === 'claimed').length,
      totalSpent: created.reduce((acc, b) => acc + (b.amount || 0), 0),
      huntsCompleted: claims.length,
      totalEarned: claims.reduce((acc, c) => acc + (c.amount || 0), 0),
      hunterRank: claims.length > 0 ? 'Ghost Hunter' : 'Rookie'
    };
  } catch (error) {
    console.error('Error getting bounty stats:', error);
    return {
      bountiesCreated: 0,
      bountiesActive: 0,
      bountiesClaimed: 0,
      totalSpent: 0,
      huntsCompleted: 0,
      totalEarned: 0,
      hunterRank: 'Rookie'
    };
  }
};
