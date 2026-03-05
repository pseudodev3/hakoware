import React, { useState, useEffect, Suspense } from 'react';
import { useAuth } from './contexts/AuthContext';
import { getUserFriendships } from './services/friendshipService';
import { Layout } from './shared/components/Layout';
import { NenCard } from './features/debt/components/NenCard';
import { Button } from './shared/components/Button';
import { Login, Signup } from './features/auth/Auth';
import { AddFriendModal } from './features/friendship/components/AddFriendModal';
import { CheckinModal } from './features/debt/components/CheckinModal';
import { VoiceCheckinModal } from './features/debt/components/VoiceCheckinModal';
import { VoiceNotesInbox } from './features/debt/components/VoiceNotesInbox';
import { LandingPage } from './features/landing/LandingPage';
import { AchievementShowcase } from './features/achievements/components/AchievementShowcase';
import { Arena } from './features/arena/components/Arena';
import { AuraWallet } from './features/aura/components/AuraWallet';
import Toast from './components/Toast';
import { Loader2, Plus, RefreshCw, Zap, TrendingUp, Users } from 'lucide-react';
import { motion } from 'framer-motion';
import './App.css';

function App() {
  const { user, isAuthenticated } = useAuth();
  const [hasEntered, setHasEntered] = useState(() => {
    return localStorage.getItem('hakoware_visited') === 'true';
  });
  
  // UI State
  const [activeTab, setActiveTab] = useState('dashboard');
  const [friendships, setFriendships] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [showSignup, setShowSignup] = useState(false);

  // Modal State
  const [modalType, setModalType] = useState(null);
  const [selectedFriendship, setSelectedFriendship] = useState(null);

  // Load Data
  const loadData = async () => {
    if (!isAuthenticated || !user) {
      setLoading(false);
      return;
    }
    
    setLoading(true);
    try {
      const data = await getUserFriendships(user.uid || user.id);
      setFriendships(data || []);
    } catch (error) {
      console.error('Failed to load friendships:', error);
      showToast('SYNC ERROR: DATABASE UNREACHABLE', 'ERROR');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) loadData();
  }, [isAuthenticated, user]);

  const showToast = (msg, type = 'SUCCESS') => {
    setToast({ msg, type });
  };

  const handleAction = (type, friendship) => {
    setSelectedFriendship(friendship);
    if (type === 'CHECKIN') setModalType('CHECKIN');
    else if (type === 'VOICE_CHECKIN') setModalType('VOICE_CHECKIN');
    else if (type === 'SETTINGS') setModalType('SETTINGS');
    else if (type === 'BAILOUT') setModalType('BAILOUT');
  };

  const closeModal = () => {
    setModalType(null);
    setSelectedFriendship(null);
  };

  const handleEnter = () => {
    localStorage.setItem('hakoware_visited', 'true');
    setHasEntered(true);
  };

  // Auth Guard
  if (!isAuthenticated) {
    if (!hasEntered) {
      return <LandingPage onEnter={handleEnter} />;
    }
    return showSignup ? (
      <Signup onToggle={() => setShowSignup(false)} />
    ) : (
      <Login onToggle={() => setShowSignup(true)} />
    );
  }

  // Calculate System Stats
  const systemStats = friendships.reduce((acc, f) => {
    const isUser1 = f.user1._id === (user.uid || user.id) || f.user1 === (user.uid || user.id);
    const perspective = isUser1 ? f.user1Perspective : f.user2Perspective;
    if (!perspective) return acc;

    const interactionDate = new Date(perspective.lastInteraction || 0);
    const now = new Date();
    const daysMissed = Math.floor(Math.max(0, now - interactionDate) / (1000 * 60 * 60 * 24));
    const daysOverLimit = Math.max(0, daysMissed - (perspective.limit || 7));
    const totalDebt = (perspective.baseDebt || 0) + daysOverLimit;

    return {
      totalDebt: acc.totalDebt + totalDebt,
      bankruptCount: acc.bankruptCount + (totalDebt >= (perspective.limit || 7) * 2 ? 1 : 0),
      activeCount: acc.activeCount + 1
    };
  }, { totalDebt: 0, bankruptCount: 0, activeCount: 0 });

  return (
    <Layout 
      activeTab={activeTab} 
      onTabChange={setActiveTab}
      onAddFriend={() => setModalType('ADD_FRIEND')}
    >
      <Suspense fallback={<div className="loading-screen"><Loader2 className="animate-spin" /></div>}>
        
        {/* DASHBOARD MODULE */}
        {activeTab === 'dashboard' && (
          <div className="dashboard-view">
             <div className="stats-overview">
                <motion.div className="overview-card glass aura-pulse" initial={{opacity: 0, y: 10}} animate={{opacity: 1, y: 0}}>
                   <div className="card-icon"><Zap size={20} color="var(--aura-gold)" /></div>
                   <div className="card-data">
                      <span className="label">TOTAL APR DEBT</span>
                      <span className="value">{systemStats.totalDebt}</span>
                   </div>
                </motion.div>
                <motion.div className="overview-card glass" initial={{opacity: 0, y: 10}} animate={{opacity: 1, y: 0}} transition={{delay: 0.1}}>
                   <div className="card-icon"><TrendingUp size={20} color="var(--aura-red)" /></div>
                   <div className="card-data">
                      <span className="label">BANKRUPTCY RISK</span>
                      <span className="value">{systemStats.bankruptCount} ALERTS</span>
                   </div>
                </motion.div>
                <motion.div className="overview-card glass" initial={{opacity: 0, y: 10}} animate={{opacity: 1, y: 0}} transition={{delay: 0.2}}>
                   <div className="card-icon"><Users size={20} color="var(--aura-blue)" /></div>
                   <div className="card-data">
                      <span className="label">ACTIVE CONTRACTS</span>
                      <span className="value">{systemStats.activeCount}</span>
                   </div>
                </motion.div>
             </div>

             <div className="view-header" style={{marginTop: '20px'}}>
              <div className="header-label-group">
                <h3>URGENT CONTRACTS</h3>
                <button className="refresh-btn" onClick={loadData} disabled={loading}>
                  <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                </button>
              </div>
              <Button variant="secondary" size="sm" onClick={() => setActiveTab('friends')}>VIEW ALL</Button>
            </div>

            {loading && friendships.length === 0 ? (
              <div className="loading-container">
                <Loader2 className="animate-spin" size={32} />
                <p>SYNCHRONIZING WITH SERVER...</p>
              </div>
            ) : friendships.length === 0 ? (
              <div className="empty-state glass">
                <div className="empty-icon">H</div>
                <h3>NO ACTIVE CONTRACTS</h3>
                <p>Initiate a new contract to start tracking aura debt.</p>
                <Button variant="aura" icon={Plus} onClick={() => setModalType('ADD_FRIEND')}>
                  INITIATE NEW CONTRACT
                </Button>
              </div>
            ) : (
              <div className="nen-grid">
                {friendships.slice(0, 3).map((f) => (
                  <NenCard 
                    key={f.id || f._id} 
                    friendship={f} 
                    currentUserId={user.uid || user.id}
                    onAction={handleAction}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* FRIENDS MODULE */}
        {activeTab === 'friends' && (
          <div className="dashboard-view">
             <div className="view-header">
                <h3>ALL HUNTER CONTRACTS</h3>
                <div className="header-actions" style={{display: 'flex', gap: '12px'}}>
                   <button className="refresh-btn" onClick={loadData} disabled={loading}>
                      <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                   </button>
                   <Button variant="aura" size="sm" icon={Plus} onClick={() => setModalType('ADD_FRIEND')}>NEW CONTRACT</Button>
                </div>
             </div>
             <div className="nen-grid">
                {friendships.map((f) => (
                  <NenCard 
                    key={f.id || f._id} 
                    friendship={f} 
                    currentUserId={user.uid || user.id}
                    onAction={handleAction}
                  />
                ))}
              </div>
          </div>
        )}

        {/* ACHIEVEMENTS MODULE */}
        {activeTab === 'achievements' && <AchievementShowcase />}

        {/* ARENA MODULE */}
        {activeTab === 'arena' && <Arena friendships={friendships} showToast={showToast} />}

        {/* WALLET MODULE */}
        {activeTab === 'wallet' && <AuraWallet />}
        
      </Suspense>

      {/* MODALS */}
      <AddFriendModal 
        isOpen={modalType === 'ADD_FRIEND'}
        onClose={closeModal}
        onRefresh={loadData}
        showToast={showToast}
      />

      <CheckinModal
        isOpen={modalType === 'CHECKIN'}
        onClose={closeModal}
        friendship={selectedFriendship}
        currentUserId={user.uid || user.id}
        onRefresh={loadData}
        showToast={showToast}
      />

      <VoiceCheckinModal
        isOpen={modalType === 'VOICE_CHECKIN'}
        onClose={closeModal}
        friendship={selectedFriendship}
        currentUserId={user.uid || user.id}
        onRefresh={loadData}
        showToast={showToast}
      />

      {toast && (
        <Toast 
          message={toast.msg} 
          type={toast.type} 
          onClose={() => setToast(null)} 
        />
      )}
    </Layout>
  );
}

export default App;
