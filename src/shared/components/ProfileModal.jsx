import React from 'react';
import { motion } from 'framer-motion';
import { User, Mail, Zap, ShieldCheck, Award, Package, Flame, Wind, Droplets, BrainCircuit, Sparkles, TrendingUp } from 'lucide-react';
import { Modal } from '../../../shared/components/Modal';
import { Button } from '../../../shared/components/Button';
import { useAuth } from '../../../contexts/AuthContext';
import './ProfileModal.css';

const NEN_CONFIG = {
  'ENHANCER': { icon: Flame, color: '#ff4444' },
  'TRANSMUTER': { icon: Zap, color: '#ffd700' },
  'CONJURER': { icon: Droplets, color: '#00e676' },
  'EMITTER': { icon: Wind, color: '#00e5ff' },
  'MANIPULATOR': { icon: BrainCircuit, color: '#9d00ff' },
  'SPECIALIST': { icon: Sparkles, color: '#ff00ff' }
};

export const ProfileModal = ({ isOpen, onClose }) => {
  const { user, logout } = useAuth();
  
  if (!user) return null;

  const nen = NEN_CONFIG[user.nenType] || { icon: User, color: 'var(--text-muted)' };

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title="HUNTER LICENSE"
      size="md"
    >
      <div className="profile-container">
        {/* Profile Header */}
        <div className="profile-header-main glass">
          <div className="profile-avatar-large" style={{ borderColor: nen.color }}>
             {user.displayName[0]}
             <div className="nen-badge-mini" style={{ backgroundColor: nen.color }}>
                <nen.icon size={12} color="#000" />
             </div>
          </div>
          <div className="profile-identity">
            <h2>{user.displayName.toUpperCase()}</h2>
            <p className="profile-email"><Mail size={12} /> {user.email}</p>
            <div className="nen-type-label" style={{ color: nen.color }}>
               {user.nenType || 'UNKNOWN AFFINITY'}
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="profile-stats-grid">
           <div className="p-stat-card glass">
              <span className="p-stat-lbl">AURA BALANCE</span>
              <span className="p-stat-val aura">{user.auraBalance || 0}</span>
           </div>
           <div className="p-stat-card glass">
              <span className="p-stat-lbl">CREDIT SCORE</span>
              <span className="p-stat-val score">{user.auraScore || 850}</span>
           </div>
           <div className="p-stat-card glass">
              <span className="p-stat-lbl">INVENTORY</span>
              <span className="p-stat-val">{user.inventory?.length || 0} CARDS</span>
           </div>
        </div>

        {/* Additional Info */}
        <div className="profile-info-list">
           <div className="info-item">
              <Award size={16} color="var(--aura-gold)" />
              <div className="info-body">
                 <span className="info-lbl">ASSOCIATION STATUS</span>
                 <span className="info-val">PROVISIONAL HUNTER</span>
              </div>
           </div>
           <div className="info-item">
              <TrendingUp size={16} color="var(--aura-green)" />
              <div className="info-body">
                 <span className="info-lbl">JOINED DATE</span>
                 <span className="info-val">{new Date(user.createdAt).toLocaleDateString()}</span>
              </div>
           </div>
        </div>

        <div className="profile-actions-bottom">
           <Button variant="danger" className="logout-action" onClick={logout}>
              TERMINATE SESSION
           </Button>
        </div>
      </div>
    </Modal>
  );
};
