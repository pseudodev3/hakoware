import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  query,
  where,
  getDocs,
  serverTimestamp,
  increment,
  arrayUnion,
  orderBy
} from 'firebase/firestore';
import { db } from './firebase';

const ACHIEVEMENTS_COLLECTION = 'userAchievements';

// Achievement Definitions - The "Collection Plaques"
export const ACHIEVEMENTS = {
  // Bankruptcy Achievements
  FIRST_BANKRUPTCY: {
    id: 'FIRST_BANKRUPTCY',
    name: 'Chapter 7 Initiate',
    description: 'Experience your first bankruptcy. The journey begins.',
    icon: '💀',
    rarity: 'common',
    points: 100,
    color: '#ff4444',
    condition: (stats) => stats.totalBankruptcies >= 1
  },
  SERIAL_BANKRUPT: {
    id: 'SERIAL_BANKRUPT',
    name: 'Repeat Offender',
    description: 'Go bankrupt 5 times. Some people never learn.',
    icon: '🔥',
    rarity: 'uncommon',
    points: 250,
    color: '#ff6600',
    condition: (stats) => stats.totalBankruptcies >= 5
  },
  LEGENDARY_DEBTOR: {
    id: 'LEGENDARY_DEBTOR',
    name: 'The Walking Default',
    description: 'Go bankrupt 10 times. You are the debt.',
    icon: '👑',
    rarity: 'rare',
    points: 500,
    color: '#ff0000',
    condition: (stats) => stats.totalBankruptcies >= 10
  },
  
  // Debt Amount Achievements
  THE_ONE_PERCENT: {
    id: 'THE_ONE_PERCENT',
    name: 'The 1%',
    description: 'Accumulate 100 APR in total debt. Predatory rates apply.',
    icon: '📈',
    rarity: 'rare',
    points: 300,
    color: '#ff00ff',
    condition: (stats) => stats.highestDebt >= 100
  },
  MAXIMUM_OVERDRIVE: {
    id: 'MAXIMUM_OVERDRIVE',
    name: 'Maximum Overdrive',
    description: 'Hit 200 APR. The system cannot compute your irresponsibility.',
    icon: '⚡',
    rarity: 'legendary',
    points: 1000,
    color: '#ffd700',
    condition: (stats) => stats.highestDebt >= 200
  },
  
  // Clean Record Achievements
  CLEAN_START: {
    id: 'CLEAN_START',
    name: 'Clean Slate',
    description: 'Go 7 days without any debt.',
    icon: '✨',
    rarity: 'common',
    points: 50,
    color: '#00e676',
    condition: (stats) => stats.maxCleanStreak >= 7
  },
  SAINT_STATUS: {
    id: 'SAINT_STATUS',
    name: 'Financial Saint',
    description: 'Maintain 30 days of clean record. You are an anomaly.',
    icon: '😇',
    rarity: 'rare',
    points: 400,
    color: '#ffffff',
    condition: (stats) => stats.maxCleanStreak >= 30
  },
  
  // Bailout Achievements
  GOOD_SAMARITAN: {
    id: 'GOOD_SAMARITAN',
    name: 'Good Samaritan',
    description: 'Bail out a friend in need.',
    icon: '🦸',
    rarity: 'common',
    points: 75,
    color: '#33b5e5',
    condition: (stats) => stats.bailoutsGiven >= 1
  },
  RESCUE_RANGER: {
    id: 'RESCUE_RANGER',
    name: 'Rescue Ranger',
    description: 'Bail out 5 friends. The debt collector of debt collectors.',
    icon: '🚁',
    rarity: 'uncommon',
    points: 200,
    color: '#00e5ff',
    condition: (stats) => stats.bailoutsGiven >= 5
  },
  DEBT_SAVIOR: {
    id: 'DEBT_SAVIOR',
    name: 'Debt Savior',
    description: 'Bail out 20 friends. You are the bank now.',
    icon: '🏦',
    rarity: 'legendary',
    points: 750,
    color: '#ffd700',
    condition: (stats) => stats.bailoutsGiven >= 20
  },
  
  // Received Bailouts (Shame/Achievement)
  PROFESSIONAL_BEGGAR: {
    id: 'PROFESSIONAL_BEGGAR',
    name: 'Professional Beggar',
    description: 'Receive 5 bailouts. Your friends are enablers.',
    icon: '🥺',
    rarity: 'uncommon',
    points: 150,
    color: '#ff8800',
    condition: (stats) => stats.bailoutsReceived >= 5
  },
  
  // Check-in Achievements
  DEDICATED: {
    id: 'DEDICATED',
    name: 'Dedicated',
    description: 'Complete 50 check-ins. Showing up is half the battle.',
    icon: '📅',
    rarity: 'common',
    points: 100,
    color: '#4caf50',
    condition: (stats) => stats.totalCheckins >= 50
  },
  CHECKIN_MACHINE: {
    id: 'CHECKIN_MACHINE',
    name: 'Check-in Machine',
    description: 'Complete 200 check-ins. You are the routine.',
    icon: '🤖',
    rarity: 'rare',
    points: 400,
    color: '#00e676',
    condition: (stats) => stats.totalCheckins >= 200
  },
  
  // Streak Achievements
  STREAK_MASTER: {
    id: 'STREAK_MASTER',
    name: 'Streak Master',
    description: 'Achieve a 14-day streak with any friend. Unbreakable.',
    icon: '🔥',
    rarity: 'uncommon',
    points: 200,
    color: '#ff5722',
    condition: (stats) => stats.longestStreak >= 14
  },
  STREAK_LEGEND: {
    id: 'STREAK_LEGEND',
    name: 'Streak Legend',
    description: 'Achieve a 30-day streak. You two are inseparable.',
    icon: '💎',
    rarity: 'legendary',
    points: 600,
    color: '#e91e63',
    condition: (stats) => stats.longestStreak >= 30
  },
  
  // Friendship Achievements
  POPULAR: {
    id: 'POPULAR',
    name: 'Socialite',
    description: 'Have 10 active friendships. Everyone knows you.',
    icon: '🌟',
    rarity: 'uncommon',
    points: 150,
    color: '#9c27b0',
    condition: (stats) => stats.totalFriends >= 10
  },
  INFLUENCER: {
    id: 'INFLUENCER',
    name: 'Influencer',
    description: 'Have 25 active friendships. Are you famous?',
    icon: '📱',
    rarity: 'rare',
    points: 350,
    color: '#673ab7',
    condition: (stats) => stats.totalFriends >= 25
  },
  
  // Mercy Achievements
  MERCY_MEEK: {
    id: 'MERCY_MEEK',
    name: 'Mercy of the Meek',
    description: 'Have a mercy request granted. Shameful but effective.',
    icon: '🙏',
    rarity: 'common',
    points: 50,
    color: '#ffc107',
    condition: (stats) => stats.mercyGranted >= 1
  },
  MERCY_GRANTER: {
    id: 'MERCY_GRANTER',
    name: 'Merciful Creditor',
    description: 'Grant 3 mercy requests. You have a soft heart.',
    icon: '❤️',
    rarity: 'uncommon',
    points: 150,
    color: '#f44336',
    condition: (stats) => stats.mercyGiven >= 3
  },
  
  // Special Achievements
  NIGHT_OWL: {
    id: 'NIGHT_OWL',
    name: 'Night Owl',
    description: 'Check in between 2AM and 5AM. Suspicious hours.',
    icon: '🦉',
    rarity: 'uncommon',
    points: 100,
    color: '#3f51b5',
    condition: (stats) => stats.nightCheckins >= 1
  },
  PERFECT_WEEK: {
    id: 'PERFECT_WEEK',
    name: 'Perfect Week',
    description: 'Check in with all friends every day for a week.',
    icon: '📊',
    rarity: 'rare',
    points: 300,
    color: '#009688',
    condition: (stats) => stats.perfectWeeks >= 1
  },
  PHOENIX: {
    id: 'PHOENIX',
    name: 'Phoenix Rising',
    description: 'Go from bankruptcy to 7-day clean streak. Redeemed.',
    icon: '🐦',
    rarity: 'legendary',
    points: 500,
    color: '#ff9800',
    condition: (stats) => stats.phoenixRises >= 1
  }
};

// Rarity tiers for display
export const RARITY_TIERS = {
  common: { color: '#888', label: 'COMMON', glow: '0 0 10px rgba(136, 136, 136, 0.3)' },
  uncommon: { color: '#00e676', label: 'UNCOMMON', glow: '0 0 15px rgba(0, 230, 118, 0.4)' },
  rare: { color: '#33b5e5', label: 'RARE', glow: '0 0 20px rgba(51, 181, 229, 0.5)' },
  legendary: { color: '#ffd700', label: 'LEGENDARY', glow: '0 0 25px rgba(255, 215, 0, 0.6)' }
};

// Initialize user achievements document
export const initializeUserAchievements = async (userId) => {
  try {
    const achievementRef = doc(db, ACHIEVEMENTS_COLLECTION, userId);
    const achievementDoc = await getDoc(achievementRef);
    
    if (!achievementDoc.exists()) {
      await setDoc(achievementRef, {
        userId,
        unlockedAchievements: [],
        totalPoints: 0,
        stats: {
          totalBankruptcies: 0,
          highestDebt: 0,
          maxCleanStreak: 0,
          bailoutsGiven: 0,
          bailoutsReceived: 0,
          totalCheckins: 0,
          longestStreak: 0,
          totalFriends: 0,
          mercyGranted: 0,
          mercyGiven: 0,
          nightCheckins: 0,
          perfectWeeks: 0,
          phoenixRises: 0
        },
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    }
    
    return { success: true };
  } catch (error) {
    console.error('Error initializing achievements:', error);
    return { success: false, error: error.message };
  }
};

// Get user achievements and stats
export const getUserAchievements = async (userId) => {
  try {
    const achievementRef = doc(db, ACHIEVEMENTS_COLLECTION, userId);
    const achievementDoc = await getDoc(achievementRef);
    
    if (!achievementDoc.exists()) {
      await initializeUserAchievements(userId);
      return {
        unlockedAchievements: [],
        totalPoints: 0,
        stats: {},
        allAchievements: ACHIEVEMENTS
      };
    }
    
    const data = achievementDoc.data();
    return {
      unlockedAchievements: data.unlockedAchievements || [],
      totalPoints: data.totalPoints || 0,
      stats: data.stats || {},
      allAchievements: ACHIEVEMENTS
    };
  } catch (error) {
    console.error('Error getting achievements:', error);
    return { unlockedAchievements: [], totalPoints: 0, stats: {}, allAchievements: ACHIEVEMENTS };
  }
};

// Check and unlock achievements
export const checkAchievements = async (userId, activityType, activityData = {}) => {
  try {
    const achievementRef = doc(db, ACHIEVEMENTS_COLLECTION, userId);
    const achievementDoc = await getDoc(achievementRef);
    
    if (!achievementDoc.exists()) {
      await initializeUserAchievements(userId);
      return { newlyUnlocked: [] };
    }
    
    const data = achievementDoc.data();
    const currentStats = { ...data.stats };
    const unlockedIds = data.unlockedAchievements.map(a => a.id);
    
    // Update stats based on activity
    switch (activityType) {
      case 'BANKRUPTCY':
        currentStats.totalBankruptcies = (currentStats.totalBankruptcies || 0) + 1;
        currentStats.highestDebt = Math.max(currentStats.highestDebt || 0, activityData.debt || 0);
        break;
      case 'DEBT_INCREASE':
        currentStats.highestDebt = Math.max(currentStats.highestDebt || 0, activityData.debt || 0);
        break;
      case 'CLEAN_STREAK':
        currentStats.maxCleanStreak = Math.max(currentStats.maxCleanStreak || 0, activityData.days || 0);
        break;
      case 'BAILOUT_GIVEN':
        currentStats.bailoutsGiven = (currentStats.bailoutsGiven || 0) + 1;
        break;
      case 'BAILOUT_RECEIVED':
        currentStats.bailoutsReceived = (currentStats.bailoutsReceived || 0) + 1;
        break;
      case 'CHECKIN':
        currentStats.totalCheckins = (currentStats.totalCheckins || 0) + 1;
        if (activityData.hour >= 2 && activityData.hour <= 5) {
          currentStats.nightCheckins = (currentStats.nightCheckins || 0) + 1;
        }
        break;
      case 'STREAK':
        currentStats.longestStreak = Math.max(currentStats.longestStreak || 0, activityData.streak || 0);
        break;
      case 'FRIEND_ADDED':
        currentStats.totalFriends = activityData.totalFriends || (currentStats.totalFriends || 0) + 1;
        break;
      case 'MERCY_GRANTED':
        currentStats.mercyGranted = (currentStats.mercyGranted || 0) + 1;
        break;
      case 'MERCY_GIVEN':
        currentStats.mercyGiven = (currentStats.mercyGiven || 0) + 1;
        break;
      case 'PERFECT_WEEK':
        currentStats.perfectWeeks = (currentStats.perfectWeeks || 0) + 1;
        break;
      case 'PHOENIX':
        currentStats.phoenixRises = (currentStats.phoenixRises || 0) + 1;
        break;
    }
    
    // Check which achievements should be unlocked
    const newlyUnlocked = [];
    let additionalPoints = 0;
    
    Object.values(ACHIEVEMENTS).forEach(achievement => {
      if (!unlockedIds.includes(achievement.id)) {
        if (achievement.condition(currentStats)) {
          newlyUnlocked.push({
            ...achievement,
            unlockedAt: new Date().toISOString()
          });
          additionalPoints += achievement.points;
        }
      }
    });
    
    // Update Firestore if new achievements unlocked
    if (newlyUnlocked.length > 0) {
      await updateDoc(achievementRef, {
        unlockedAchievements: arrayUnion(...newlyUnlocked),
        stats: currentStats,
        totalPoints: increment(additionalPoints),
        updatedAt: serverTimestamp()
      });
    } else {
      // Just update stats
      await updateDoc(achievementRef, {
        stats: currentStats,
        updatedAt: serverTimestamp()
      });
    }
    
    return {
      newlyUnlocked,
      totalNewPoints: additionalPoints,
      currentStats
    };
  } catch (error) {
    console.error('Error checking achievements:', error);
    return { newlyUnlocked: [] };
  }
};

// Get leaderboard by achievement points
export const getAchievementLeaderboard = async (limit_count = 10) => {
  try {
    const q = query(
      collection(db, ACHIEVEMENTS_COLLECTION),
      orderBy('totalPoints', 'desc'),
      limit(limit_count)
    );
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      userId: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error getting leaderboard:', error);
    return [];
  }
};

// Get recently unlocked achievements (for feed)
export const getRecentAchievements = async (limit_count = 20) => {
  try {
    const q = query(
      collection(db, ACHIEVEMENTS_COLLECTION),
      orderBy('updatedAt', 'desc'),
      limit(limit_count)
    );
    
    const snapshot = await getDocs(q);
    const recent = [];
    
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data.unlockedAchievements && data.unlockedAchievements.length > 0) {
        // Get the most recent unlock
        const sorted = [...data.unlockedAchievements].sort(
          (a, b) => new Date(b.unlockedAt) - new Date(a.unlockedAt)
        );
        if (sorted[0]) {
          recent.push({
            userId: doc.id,
            achievement: sorted[0],
            unlockedAt: sorted[0].unlockedAt
          });
        }
      }
    });
    
    return recent.sort((a, b) => 
      new Date(b.unlockedAt) - new Date(a.unlockedAt)
    ).slice(0, limit_count);
  } catch (error) {
    console.error('Error getting recent achievements:', error);
    return [];
  }
};
