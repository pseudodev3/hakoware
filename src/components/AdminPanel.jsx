import { useState, useEffect } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../services/firebase';
import { calculateDebt } from '../utils/gameLogic';
import { sendSystemEmail } from '../services/emailService';
import { calculateDailyInterest } from '../services/checkinService';
import { RefreshIcon, MailIcon, AlertIcon, DollarIcon } from './icons/Icons';

const AdminPanel = ({ onRefresh, showToast }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [sendingEmails, setSendingEmails] = useState(false);
  const [calculatingInterest, setCalculatingInterest] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadStats();
    }
  }, [isOpen]);

  const loadStats = async () => {
    setLoading(true);
    try {
      // Get all friendships
      const friendshipsSnapshot = await getDocs(collection(db, 'friendships'));
      const friendships = friendshipsSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));

      // Get all users
      const usersSnapshot = await getDocs(collection(db, 'users'));
      const users = usersSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));

      // Calculate bankruptcy stats
      let totalBankruptcies = 0;
      let warningZoneCount = 0;
      let totalDebt = 0;

      friendships.forEach(f => {
        // Check user1 perspective
        if (f.user1Perspective) {
          const stats1 = calculateDebt({
            baseDebt: f.user1Perspective.baseDebt,
            lastInteraction: f.user1Perspective.lastInteraction,
            bankruptcyLimit: f.user1Perspective.limit
          });
          if (stats1.isBankrupt) totalBankruptcies++;
          else if (stats1.isInWarningZone) warningZoneCount++;
          totalDebt += stats1.totalDebt;
        }
        // Check user2 perspective
        if (f.user2Perspective) {
          const stats2 = calculateDebt({
            baseDebt: f.user2Perspective.baseDebt,
            lastInteraction: f.user2Perspective.lastInteraction,
            bankruptcyLimit: f.user2Perspective.limit
          });
          if (stats2.isBankrupt) totalBankruptcies++;
          else if (stats2.isInWarningZone) warningZoneCount++;
          totalDebt += stats2.totalDebt;
        }
      });

      setStats({
        totalFriendships: friendships.length,
        totalUsers: users.length,
        totalBankruptcies,
        warningZoneCount,
        totalDebt
      });
    } catch (error) {
      console.error('Error loading admin stats:', error);
    }
    setLoading(false);
  };

  const handleSendReminders = async () => {
    setSendingEmails(true);
    try {
      // Get all friendships
      const friendshipsSnapshot = await getDocs(collection(db, 'friendships'));
      const friendships = friendshipsSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));

      let emailsSent = 0;

      for (const f of friendships) {
        // Check both perspectives for warning/bankruptcy
        const perspectives = [
          { user: f.user1, data: f.user1Perspective },
          { user: f.user2, data: f.user2Perspective }
        ];

        for (const p of perspectives) {
          if (!p.data || !p.user?.email) continue;

          const debtStats = calculateDebt({
            baseDebt: p.data.baseDebt,
            lastInteraction: p.data.lastInteraction,
            bankruptcyLimit: p.data.limit
          });

          // Send email if bankrupt or in warning zone
          if (debtStats.isBankrupt) {
            sendSystemEmail('BANKRUPTCY', {
              name: p.user.displayName || p.user.email,
              email: p.user.email,
              totalDebt: debtStats.totalDebt,
              daysMissed: debtStats.daysMissed
            }, null, true);
            emailsSent++;
          } else if (debtStats.isInWarningZone) {
            sendSystemEmail('RESET', {
              name: p.user.displayName || p.user.email,
              email: p.user.email,
              totalDebt: debtStats.totalDebt,
              daysMissed: debtStats.daysMissed
            }, null, true);
            emailsSent++;
          }
        }
      }

      showToast(`Sent ${emailsSent} reminder emails`, 'SUCCESS');
    } catch (error) {
      console.error('Error sending reminders:', error);
      showToast('Error sending emails', 'ERROR');
    }
    setSendingEmails(false);
  };

  const handleCalculateInterest = async () => {
    setCalculatingInterest(true);
    try {
      const result = await calculateDailyInterest();
      if (result.success) {
        showToast(`Interest calculated. ${result.updates.length} users affected.`, 'SUCCESS');
        loadStats();
        onRefresh("SYSTEM: INTEREST CALCULATED");
      }
    } catch (error) {
      console.error('Error calculating interest:', error);
      showToast('Error calculating interest', 'ERROR');
    }
    setCalculatingInterest(false);
  };

  if (!isOpen) {
    return (
      <div style={{ margin: '20px', textAlign: 'center' }}>
        <button 
          onClick={() => setIsOpen(true)} 
          className="action-btn" 
          style={{ 
            width: '100%',
            background: 'linear-gradient(45deg, #1a0000, #330000)',
            color: '#ff4444',
            border: '1px solid #ff4444'
          }}
        >
          ⚡ SYSTEM CONTROLS
        </button>
      </div>
    );
  }

  return (
    <div style={{ 
      margin: '20px', 
      background: '#1a0a0a',
      border: '1px solid #ff4444',
      borderRadius: '8px',
      overflow: 'hidden'
    }}>
      <div style={{ 
        padding: '15px', 
        background: 'linear-gradient(45deg, #330000, #1a0000)',
        borderBottom: '1px solid #ff4444',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <h3 style={{ margin: 0, color: '#ff4444' }}>⚡ SYSTEM CONTROLS</h3>
        <button 
          onClick={() => setIsOpen(false)}
          style={{ 
            background: 'none', 
            border: 'none', 
            color: '#ff4444', 
            cursor: 'pointer',
            fontSize: '1.2rem'
          }}
        >
          ✕
        </button>
      </div>

      <div style={{ padding: '15px' }}>
        {loading ? (
          <div style={{ color: '#888', textAlign: 'center', padding: '20px' }}>
            Loading system stats...
          </div>
        ) : stats ? (
          <>
            {/* Stats Grid */}
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(2, 1fr)', 
              gap: '10px',
              marginBottom: '20px'
            }}>
              <StatBox 
                label="Friendships" 
                value={stats.totalFriendships}
                icon="👥"
              />
              <StatBox 
                label="Users" 
                value={stats.totalUsers}
                icon="👤"
              />
              <StatBox 
                label="Bankruptcies" 
                value={stats.totalBankruptcies}
                icon="💀"
                color="#ff4444"
              />
              <StatBox 
                label="Warnings" 
                value={stats.warningZoneCount}
                icon="⚠️"
                color="#ff8800"
              />
            </div>

            <div style={{ 
              background: 'rgba(255,68,68,0.1)', 
              padding: '12px', 
              borderRadius: '6px',
              marginBottom: '20px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '0.7rem', color: '#ff8888', marginBottom: '4px' }}>
                TOTAL SYSTEM DEBT
              </div>
              <div style={{ fontSize: '1.5rem', color: '#ff4444', fontWeight: 'bold' }}>
                {stats.totalDebt.toLocaleString()} APR
              </div>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <ActionButton
                onClick={handleSendReminders}
                loading={sendingEmails}
                icon={<MailIcon size={18} color="#fff" />}
                label="SEND REMINDER EMAILS"
                color="#4444ff"
              />
              
              <ActionButton
                onClick={handleCalculateInterest}
                loading={calculatingInterest}
                icon={<DollarIcon size={18} color="#fff" />}
                label="CALCULATE DAILY INTEREST"
                color="#00aa00"
              />
              
              <ActionButton
                onClick={loadStats}
                loading={loading}
                icon={<RefreshIcon size={18} color="#fff" />}
                label="REFRESH STATS"
                color="#666"
              />
            </div>
          </>
        ) : (
          <div style={{ color: '#888', textAlign: 'center', padding: '20px' }}>
            Error loading stats
          </div>
        )}
      </div>
    </div>
  );
};

const StatBox = ({ label, value, icon, color = '#fff' }) => (
  <div style={{ 
    background: 'rgba(0,0,0,0.3)', 
    padding: '12px', 
    borderRadius: '6px',
    textAlign: 'center'
  }}>
    <div style={{ fontSize: '1.5rem', marginBottom: '4px' }}>{icon}</div>
    <div style={{ 
      fontSize: '1.3rem', 
      fontWeight: 'bold', 
      color: color,
      fontFamily: 'var(--font-main)'
    }}>
      {value}
    </div>
    <div style={{ fontSize: '0.65rem', color: '#666', textTransform: 'uppercase' }}>
      {label}
    </div>
  </div>
);

const ActionButton = ({ onClick, loading, icon, label, color }) => (
  <button
    onClick={onClick}
    disabled={loading}
    style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '10px',
      width: '100%',
      padding: '12px',
      background: loading ? '#333' : color,
      color: loading ? '#666' : '#fff',
      border: 'none',
      borderRadius: '6px',
      cursor: loading ? 'not-allowed' : 'pointer',
      fontSize: '0.85rem',
      fontWeight: '600',
      letterSpacing: '1px'
    }}
  >
    {icon}
    {loading ? 'Processing...' : label}
  </button>
);

export default AdminPanel;
