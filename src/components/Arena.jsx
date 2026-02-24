/**
 * Arena - Competitive & Social Hub
 * 
 * Consolidates all competitive features:
 * - Wall of Shame
 * - Bounties  
 * - Challenges
 * - Rankings
 */

import { useState } from 'react';
import { calculateDebt } from '../utils/gameLogic';
import { SkullIcon, TargetIcon, TrophyIcon, UsersIcon, ChevronRightIcon } from './icons/Icons';
import ShameWall from './ShameWall';
import BountyBoard from './BountyBoard';
import FriendChallenges from './FriendChallenges';
import Leaderboard from './Leaderboard';

const Arena = ({ friendships = [], showToast, onCreateBounty }) => {
  const [activeView, setActiveView] = useState('hub');

  const views = {
    hub: { label: 'Arena', component: null },
    shame: { label: 'Wall of Shame', component: ShameWall },
    bounties: { label: 'Bounties', component: BountyBoard },
    challenges: { label: 'Challenges', component: FriendChallenges },
    rankings: { label: 'Rankings', component: Leaderboard }
  };

  const ActiveComponent = views[activeView]?.component;

  if (activeView !== 'hub' && ActiveComponent) {
    return (
      <div>
        {/* Back Navigation */}
        <button
          onClick={() => setActiveView('hub')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 16px',
            background: 'transparent',
            border: '1px solid #333',
            borderRadius: '8px',
            color: '#888',
            fontSize: '0.85rem',
            cursor: 'pointer',
            marginBottom: '15px',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            e.target.style.borderColor = '#444';
            e.target.style.color = '#aaa';
          }}
          onMouseLeave={(e) => {
            e.target.style.borderColor = '#333';
            e.target.style.color = '#888';
          }}
        >
          <span>←</span>
          Back to Arena
        </button>

        {/* Active View */}
        {activeView === 'bounties' ? (
          <BountyBoard 
            friendships={friendships}
            onCreateBounty={() => {
              // Find a friendship with debt to create bounty on
              const targetFriendship = friendships.find(f => {
                const isUser1 = f.myPerspective === 'user1';
                const friendData = isUser1 ? f.user2Perspective : f.user1Perspective;
                const friendStats = calculateDebt({
                  baseDebt: friendData.baseDebt,
                  lastInteraction: friendData.lastInteraction,
                  bankruptcyLimit: friendData.limit
                });
                return friendStats.totalDebt > 0;
              });
              if (targetFriendship) {
                onCreateBounty?.(targetFriendship);
              } else {
                showToast("No friends with debt to place bounty on!", "INFO");
              }
            }}
          />
        ) : activeView === 'challenges' ? (
          <FriendChallenges 
            friendships={friendships}
            showToast={showToast}
          />
        ) : (
          <ActiveComponent />
        )}
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      {/* Arena Header */}
      <div style={headerStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '45px',
            height: '45px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #ffd700, #ffaa00)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 15px rgba(255,215,0,0.3)'
          }}>
            <TrophyIcon size={24} color="#fff" />
          </div>
          <div>
            <h2 style={{ margin: 0, color: '#fff', fontSize: '1.3rem' }}>The Arena</h2>
            <p style={{ margin: '4px 0 0 0', color: '#888', fontSize: '0.8rem' }}>
              Compete, hunt, rise in the ranks
            </p>
          </div>
        </div>
      </div>

      {/* Arena Grid */}
      <div style={gridStyle}>
        {/* Wall of Shame */}
        <ArenaCard
          icon={<SkullIcon size={28} color="#ff4444" />}
          title="Wall of Shame"
          description="Public bankruptcies and community roasts"
          color="#ff4444"
          onClick={() => setActiveView('shame')}
        />

        {/* Bounties */}
        <ArenaCard
          icon={<TargetIcon size={28} color="#ffd700" />}
          title="Bounty Board"
          description="Hunt ghosting friends for Aura rewards"
          color="#ffd700"
          onClick={() => setActiveView('bounties')}
        />

        {/* Challenges */}
        <ArenaCard
          icon={<UsersIcon size={28} color="#ffd700" />}
          title="Challenges"
          description="Compete 1v1 with friends"
          color="#9c27b0"
          onClick={() => setActiveView('challenges')}
        />

        {/* Rankings */}
        <ArenaCard
          icon={<TrophyIcon size={28} color="#ffd700" />}
          title="Rankings"
          description="Global leaderboards and stats"
          color="#ffd700"
          onClick={() => setActiveView('rankings')}
        />
      </div>

      {/* Quick Stats */}
      <div style={statsContainerStyle}>
        <h3 style={{ margin: '0 0 15px 0', color: '#888', fontSize: '0.85rem' }}>
          YOUR STANDING
        </h3>
        <div style={statsGridStyle}>
          <StatBox label="Hunter Rank" value="Rookie" color="#ff8800" />
          <StatBox label="Active Bounties" value="0" color="#ff4444" />
          <StatBox label="Challenges" value="0" color="#9c27b0" />
          <StatBox label="Global Rank" value="--" color="#ffd700" />
        </div>
      </div>
    </div>
  );
};

// Arena Card Component
const ArenaCard = ({ icon, title, description, color, onClick }) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        ...cardStyle,
        borderColor: isHovered ? color : '#222',
        boxShadow: isHovered ? `0 0 20px ${color}20` : 'none',
        transform: isHovered ? 'translateY(-4px)' : 'translateY(0)'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '15px' }}>
        <div style={{
          ...iconContainerStyle,
          background: `${color}15`,
          borderColor: `${color}30`
        }}>
          {icon}
        </div>
        <div style={{ flex: 1, textAlign: 'left' }}>
          <h3 style={{ margin: '0 0 6px 0', color: '#fff', fontSize: '1rem' }}>
            {title}
          </h3>
          <p style={{ margin: 0, color: '#666', fontSize: '0.8rem', lineHeight: 1.4 }}>
            {description}
          </p>
        </div>
        <ChevronRightIcon size={20} color="#444" />
      </div>
    </button>
  );
};

// Stat Box Component
const StatBox = ({ label, value, color }) => (
  <div style={statBoxStyle}>
    <span style={{ color: '#666', fontSize: '0.75rem', marginBottom: '4px', textTransform: 'capitalize' }}>
      {label}
    </span>
    <span style={{ color, fontSize: '1.1rem', fontWeight: '600' }}>
      {value}
    </span>
  </div>
);

// Styles
const containerStyle = {
  background: 'linear-gradient(145deg, #111, #0a0a0a)',
  borderRadius: '16px',
  overflow: 'hidden',
  marginBottom: '20px',
  boxShadow: '0 2px 8px rgba(0,0,0,0.4)'
};

const headerStyle = {
  padding: '20px 25px',
  background: 'linear-gradient(90deg, rgba(255,215,0,0.03) 0%, transparent 100%)'
};

const gridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
  gap: '15px',
  padding: '20px'
};

const cardStyle = {
  background: 'linear-gradient(145deg, #151515, #0d0d0d)',
  borderRadius: '12px',
  padding: '20px',
  cursor: 'pointer',
  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  textAlign: 'left',
  boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
};

const iconContainerStyle = {
  width: '50px',
  height: '50px',
  borderRadius: '12px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0
};

const statsContainerStyle = {
  padding: '20px',
  background: 'linear-gradient(180deg, rgba(0,0,0,0.15), rgba(0,0,0,0.05))'
};

const statsGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(4, 1fr)',
  gap: '15px'
};

const statBoxStyle = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  padding: '15px',
  background: 'rgba(255,255,255,0.02)',
  borderRadius: '10px',
  border: '1px solid #222'
};

export default Arena;
