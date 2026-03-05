import React from 'react';
import { motion } from 'framer-motion';
import { 
  AlertTriangle, 
  ShieldAlert, 
  User, 
  Calendar, 
  Zap, 
  MessageSquare, 
  Settings,
  DollarSign
} from 'lucide-react';
import { useDebt } from '../../../hooks/useDebt';
import { Button } from '../../../shared/components/Button';
import './NenCard.css';

/**
 * The core friend card. Professional UI with visual hierarchy.
 */
export const NenCard = ({ friendship, currentUserId, onAction }) => {
  const isUser1 = friendship.user1._id === currentUserId || friendship.user1 === currentUserId;
  const perspective = isUser1 ? friendship.user1Perspective : friendship.user2Perspective;
  const friend = isUser1 ? friendship.user2 : friendship.user1;
  
  const stats = useDebt(perspective);

  if (!stats) return null;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`nen-card glass ${stats.status.toLowerCase()}`}
      style={{ '--aura-color': stats.color, '--aura-glow': stats.glow }}
    >
      {/* Header with status badge */}
      <div className="card-header">
        <div className="status-badge" style={{ borderColor: stats.color, color: stats.color }}>
          <span className="dot" style={{ backgroundColor: stats.color }}></span>
          {stats.status}
        </div>
        <button className="settings-trigger" onClick={() => onAction('SETTINGS', friendship)}>
          <Settings size={16} />
        </button>
      </div>

      {/* Profile Section */}
      <div className="profile-section">
        <div className="avatar-aura" style={{ boxShadow: `0 0 20px ${stats.glow}` }}>
          {friend.avatar ? (
            <img src={friend.avatar} alt={friend.displayName} className="avatar" />
          ) : (
            <div className="avatar-placeholder"><User size={24} /></div>
          )}
        </div>
        <div className="profile-info">
          <h3 className="friend-name">{friend.displayName}</h3>
          <p className="friend-email">{friend.email}</p>
        </div>
      </div>

      {/* Main Stats Display */}
      <div className="debt-display">
        <div className="debt-value-container">
          <span className="debt-value">{stats.totalDebt}</span>
          <span className="debt-unit">APR</span>
        </div>
        <div className="debt-label">TOTAL ACCUMULATED DEBT</div>
      </div>

      {/* Progress / Urgency Bar */}
      <div className="urgency-container">
        <div className="urgency-bar-bg">
          <motion.div 
            className="urgency-bar-fill"
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(100, (stats.totalDebt / (stats.limit * 2)) * 100)}%` }}
            transition={{ duration: 1, ease: "easeOut" }}
            style={{ backgroundColor: stats.color }}
          />
        </div>
        <div className="urgency-labels">
          <span>STABLE</span>
          <span>LIMIT</span>
          <span>BANKRUPT</span>
        </div>
      </div>

      {/* Detailed Stats Grid */}
      <div className="stats-grid">
        <div className="stat-item">
          <div className="stat-label">
            <Calendar size={12} />
            <span>DAYS MISSED</span>
          </div>
          <div className="stat-value">{stats.daysMissed}</div>
        </div>
        <div className="stat-item">
          <div className="stat-label">
            <AlertTriangle size={12} />
            <span>WARNING LIMIT</span>
          </div>
          <div className="stat-value">{stats.limit} DAYS</div>
        </div>
      </div>

      {/* Call to Action */}
      <div className="card-actions">
        {stats.isBankrupt ? (
          <Button 
            variant="danger" 
            className="w-full"
            icon={ShieldAlert}
            onClick={() => onAction('BAILOUT', friendship)}
          >
            CHAPTER 7 BAILOUT
          </Button>
        ) : (
          <>
            <Button 
              variant="secondary" 
              className="flex-1"
              icon={MessageSquare}
              onClick={() => onAction('VOICE_CHECKIN', friendship)}
            >
              VOICE CHECKIN
            </Button>
            <Button 
              variant="aura" 
              className="flex-1"
              icon={Zap}
              onClick={() => onAction('CHECKIN', friendship)}
            >
              HAKOWARE
            </Button>
          </>
        )}
      </div>
    </motion.div>
  );
};
