/**
 * Aura Wallet - Currency Management
 * 
 * Shows Aura Balance (spendable currency)
 * Note: Aura Score (credit score) is separate, shown on NenCards
 */

import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getAuraBalance, getAuraTransactions, getAuraStats } from '../services/auraService';
import { DollarIcon, TrendingUpIcon, TrendingDownIcon, ClockIcon } from './icons/Icons';

const AuraWallet = () => {
  const { user } = useAuth();
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    if (user) {
      loadAuraData();
    }
  }, [user]);

  const loadAuraData = async () => {
    setLoading(true);
    try {
      const [balanceData, txs, statsData] = await Promise.all([
        getAuraBalance(user.uid),
        getAuraTransactions(user.uid, 20),
        getAuraStats(user.uid)
      ]);
      
      setBalance(balanceData.balance);
      setTransactions(txs);
      setStats(statsData);
    } catch (error) {
      console.error('Error loading aura data:', error);
    }
    setLoading(false);
  };

  const formatTimeAgo = (date) => {
    const now = new Date();
    const diff = now - date;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <div style={containerStyle}>
        <div style={{ padding: '40px', textAlign: 'center', color: '#666' }}>
          Loading Aura Wallet...
        </div>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      {/* Header */}
      <div style={headerStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '50px',
            height: '50px',
            borderRadius: '14px',
            background: 'linear-gradient(135deg, #ffd700, #ffaa00)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 20px rgba(255,215,0,0.3)'
          }}>
            <DollarIcon size={28} color="#000" />
          </div>
          <div>
            <h2 style={{ margin: 0, color: '#ffd700', fontSize: '1.3rem' }}>AURA WALLET</h2>
            <p style={{ margin: '4px 0 0 0', color: '#666', fontSize: '0.75rem' }}>
              Spendable Currency • Earn & Use
            </p>
          </div>
        </div>
        
        {/* Balance Display */}
        <div style={balanceDisplayStyle}>
          <span style={{ color: '#ffd700', fontSize: '2.5rem', fontWeight: 'bold' }}>
            {balance}
          </span>
          <span style={{ color: '#888', fontSize: '0.9rem' }}>AURA</span>
        </div>
      </div>

      {/* Tabs */}
      <div style={tabsContainerStyle}>
        <button
          onClick={() => setActiveTab('overview')}
          style={{
            ...tabButtonStyle,
            borderBottomColor: activeTab === 'overview' ? '#ffd700' : 'transparent',
            color: activeTab === 'overview' ? '#ffd700' : '#666'
          }}
        >
          Overview
        </button>
        <button
          onClick={() => setActiveTab('transactions')}
          style={{
            ...tabButtonStyle,
            borderBottomColor: activeTab === 'transactions' ? '#ffd700' : 'transparent',
            color: activeTab === 'transactions' ? '#ffd700' : '#666'
          }}
        >
          History
        </button>
        <button
          onClick={() => setActiveTab('earn')}
          style={{
            ...tabButtonStyle,
            borderBottomColor: activeTab === 'earn' ? '#ffd700' : 'transparent',
            color: activeTab === 'earn' ? '#ffd700' : '#666'
          }}
        >
          Earn More
        </button>
      </div>

      {/* Content */}
      <div style={contentStyle}>
        {activeTab === 'overview' && (
          <div>
            {/* Stats Grid */}
            {stats && (
              <div style={statsGridStyle}>
                <StatCard
                  icon={<TrendingUpIcon size={20} color="#00e676" />}
                  label="Total Earned"
                  value={stats.totalEarned}
                  color="#00e676"
                />
                <StatCard
                  icon={<TrendingDownIcon size={20} color="#ff4444" />}
                  label="Total Spent"
                  value={stats.totalSpent}
                  color="#ff4444"
                />
                <StatCard
                  icon={<ClockIcon size={20} color="#888" />}
                  label="Transactions"
                  value={stats.totalTransactions}
                  color="#888"
                />
              </div>
            )}

            {/* Top Earning Sources */}
            {stats && stats.earningsByType && Object.keys(stats.earningsByType).length > 0 && (
              <div style={sectionStyle}>
                <h3 style={{ margin: '0 0 15px 0', color: '#fff', fontSize: '0.9rem' }}>
                  Top Earning Sources
                </h3>
                {Object.entries(stats.earningsByType)
                  .sort(([,a], [,b]) => b - a)
                  .slice(0, 5)
                  .map(([type, amount]) => (
                    <div key={type} style={earningRowStyle}>
                      <span style={{ color: '#888', fontSize: '0.85rem', textTransform: 'capitalize' }}>
                        {type.replace(/_/g, ' ')}
                      </span>
                      <span style={{ color: '#00e676', fontWeight: 'bold' }}>
                        +{amount} AURA
                      </span>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'transactions' && (
          <div>
            {transactions.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
                <div style={{ fontSize: '2rem', marginBottom: '10px' }}>📭</div>
                <p>No transactions yet</p>
              </div>
            ) : (
              <div style={transactionsListStyle}>
                {transactions.map((tx) => (
                  <div key={tx.id} style={transactionItemStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '50%',
                        background: tx.amount > 0 ? 'rgba(0,230,118,0.1)' : 'rgba(255,68,68,0.1)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '1rem'
                      }}>
                        {tx.amount > 0 ? '↓' : '↑'}
                      </div>
                      <div>
                        <div style={{ color: '#fff', fontSize: '0.9rem', fontWeight: '500' }}>
                          {tx.description}
                        </div>
                        <div style={{ color: '#666', fontSize: '0.75rem' }}>
                          {formatTimeAgo(tx.timestamp)}
                        </div>
                      </div>
                    </div>
                    <span style={{
                      color: tx.amount > 0 ? '#00e676' : '#ff4444',
                      fontWeight: 'bold',
                      fontSize: '0.95rem'
                    }}>
                      {tx.amount > 0 ? '+' : ''}{tx.amount} AURA
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'earn' && (
          <div>
            <h3 style={{ margin: '0 0 15px 0', color: '#fff', fontSize: '0.9rem' }}>
              Ways to Earn Aura
            </h3>
            
            <EarnMethodCard
              icon="🏆"
              title="Unlock Achievements"
              description="Earn Aura points equal to achievement points"
              reward="+Variable"
              color="#ffd700"
            />
            
            <EarnMethodCard
              icon="🔥"
              title="Maintain Streaks"
              description="Earn 5 Aura per streak day"
              reward="+5/day"
              color="#ff8800"
            />
            
            <EarnMethodCard
              icon="📅"
              title="Daily Check-ins"
              description="Check in with friends daily"
              reward="+5/check-in"
              color="#00e676"
            />
            
            <EarnMethodCard
              icon="🎯"
              title="Claim Bounties"
              description="Hunt down ghosting friends"
              reward="+Bounty amount"
              color="#ff8800"
            />
            
            <EarnMethodCard
              icon="👥"
              title="Add Friends"
              description="Expand your network"
              reward="+10/friend"
              color="#9c27b0"
            />
          </div>
        )}
      </div>
    </div>
  );
};

// Helper Components
const StatCard = ({ icon, label, value, color }) => (
  <div style={statCardStyle}>
    <div style={{ marginBottom: '8px' }}>{icon}</div>
    <div style={{ color, fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '4px' }}>
      {value}
    </div>
    <div style={{ color: '#666', fontSize: '0.7rem' }}>{label}</div>
  </div>
);

const EarnMethodCard = ({ icon, title, description, reward, color }) => (
  <div style={earnCardStyle}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
      <div style={{ fontSize: '1.8rem' }}>{icon}</div>
      <div style={{ flex: 1 }}>
        <div style={{ color: '#fff', fontWeight: 'bold', marginBottom: '4px' }}>{title}</div>
        <div style={{ color: '#888', fontSize: '0.8rem' }}>{description}</div>
      </div>
      <div style={{
        padding: '6px 12px',
        background: `${color}15`,
        border: `1px solid ${color}30`,
        borderRadius: '20px',
        color,
        fontSize: '0.8rem',
        fontWeight: 'bold'
      }}>
        {reward}
      </div>
    </div>
  </div>
);

// Styles
const containerStyle = {
  background: 'linear-gradient(145deg, #111, #0a0a0a)',
  border: '1px solid #222',
  borderRadius: '16px',
  overflow: 'hidden',
  marginBottom: '20px'
};

const headerStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '20px 25px',
  borderBottom: '1px solid #222',
  background: 'linear-gradient(90deg, rgba(255,215,0,0.05) 0%, transparent 100%)',
  flexWrap: 'wrap',
  gap: '15px'
};

const balanceDisplayStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  padding: '10px 20px',
  background: 'rgba(255,215,0,0.1)',
  border: '1px solid #ffd700',
  borderRadius: '12px'
};

const tabsContainerStyle = {
  display: 'flex',
  borderBottom: '1px solid #222',
  background: '#0a0a0a'
};

const tabButtonStyle = {
  flex: 1,
  padding: '15px',
  background: 'transparent',
  border: 'none',
  borderBottom: '2px solid',
  color: '#666',
  fontSize: '0.85rem',
  fontWeight: 'bold',
  cursor: 'pointer',
  transition: 'all 0.2s'
};

const contentStyle = {
  padding: '20px',
  maxHeight: '400px',
  overflowY: 'auto'
};

const statsGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, 1fr)',
  gap: '15px',
  marginBottom: '25px'
};

const statCardStyle = {
  padding: '20px',
  background: 'rgba(255,255,255,0.02)',
  border: '1px solid #222',
  borderRadius: '12px',
  textAlign: 'center'
};

const sectionStyle = {
  marginBottom: '20px'
};

const earningRowStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '12px 0',
  borderBottom: '1px solid #1a1a1a'
};

const transactionsListStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: '10px'
};

const transactionItemStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '12px',
  background: 'rgba(255,255,255,0.02)',
  borderRadius: '10px',
  border: '1px solid #1a1a1a'
};

const earnCardStyle = {
  padding: '16px',
  background: 'linear-gradient(145deg, #111, #0a0a0a)',
  border: '1px solid #222',
  borderRadius: '12px',
  marginBottom: '12px'
};

export default AuraWallet;
