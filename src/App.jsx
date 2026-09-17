import React, { useState, useEffect, Suspense } from 'react';
import { useAuth } from './contexts/AuthContext';
import { getUserFriendships } from './services/friendshipService';
import { getUserAura } from './services/auraService';
import { Layout } from './shared/components/Layout';
import { NenCard } from './features/debt/components/NenCard';
import { Button } from './shared/components/Button';
import { Login, Signup } from './features/auth/Auth';
import { ResetPassword } from './features/auth/ResetPassword';
import { AddFriendModal } from './features/friendship/components/AddFriendModal';
import { FriendshipSettingsModal } from './features/friendship/components/FriendshipSettingsModal';
import { CheckinModal } from './features/debt/components/CheckinModal';
import { VoiceCheckinModal } from './features/debt/components/VoiceCheckinModal';
import { Potclean } from './features/debt/components/Potclean';
import { LandingPage } from './features/landing/LandingPage';
import { WaterDivinationModal } from './features/auth/components/WaterDivinationModal';
import { AchievementShowcase } from './features/achievements/components/AchievementShowcase';
import { Arena } from './features/arena/components/Arena';
import { ShameWall } from './features/shame/components/ShameWall';
import { AuraWallet } from './features/aura/components/AuraWallet';
import Toast from './components/Toast';
import { Loader2, Plus, RefreshCw, Zap, TrendingUp, Users, ShieldAlert } from 'lucide-react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import './App.css';

function MainApp({ showToast }) {
  const { user, isAuthenticated, refreshUser } = useAuth();
  const [hasEntered, setHasEntered] = useState(() => localStorage.getItem('hakoware_visited') === 'true');
  const [activeTab, setActiveTab] = useState('dashboard');
  const [friendships, setFriendships] = useState([]);
  const [pendingInvitations, setPendingInvitations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showSignup, setShowSignup] = useState(false);
  const [modalType, setModalType] = useState(null);
  const [selectedFriendship, setSelectedFriendship] = useState(null);

  const loadData = async () => {
    if (!isAuthenticated || !user) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const data = await getUserFriendships(user.uid || user.id);
      setFriendships(data.active || []);
      setPendingInvitations(data.pendingReceived || []);

      const oldBalance = user.auraBalance || 0;
      await getUserAura(user.uid || user.id);
      const refreshResult = await refreshUser();

      if (refreshResult.success && refreshResult.user.auraBalance > oldBalance) {
        showToast(`DAILY BONUS AWARDED: +${refreshResult.user.auraBalance - oldBalance} AURA`, 'SUCCESS');
      }
    } catch (error) {
      console.error('Failed to load friendships:', error);
      showToast('SYNC ERROR: DATABASE UNREACHABLE', 'ERROR');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) loadData();
  }, [isAuthenticated]);

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

  if (!isAuthenticated) {
    if (!hasEntered) return <LandingPage onEnter={handleEnter} />;
    return showSignup ? (
      <Signup onToggle={() => setShowSignup(false)} showToast={showToast} />
    ) : (
      <Login onToggle={() => setShowSignup(true)} showToast={showToast} />
    );
  }

  const systemStats = friendships.reduce((acc, friendship) => {
    const currentUserId = user.uid || user.id;
    const isUser1 = friendship.user1._id === currentUserId || friendship.user1 === currentUserId;
    const perspective = isUser1 ? friendship.user1Perspective : friendship.user2Perspective;
    if (!perspective) return acc;

    const interactionDate = new Date(perspective.lastInteraction || 0);
    const daysMissed = Math.floor(Math.max(0, new Date() - interactionDate) / (1000 * 60 * 60 * 24));
    const limit = perspective.limit || 7;
    const totalDebt = (perspective.baseDebt || 0) + Math.max(0, daysMissed - limit);

    return {
      totalDebt: acc.totalDebt + totalDebt,
      bankruptCount: acc.bankruptCount + (totalDebt >= limit * 2 ? 1 : 0),
      activeCount: acc.activeCount + 1
    };
  }, { totalDebt: 0, bankruptCount: 0, activeCount: 0 });

  return (
    <Layout
      activeTab={activeTab}
      onTabChange={setActiveTab}
      onAddFriend={() => setModalType('ADD_FRIEND')}
      pendingInvitations={pendingInvitations}
      onRefresh={loadData}
      showToast={showToast}
    >
      <Suspense fallback={<div className="loading-screen"><Loader2 className="animate-spin" /></div>}>
        {activeTab === 'dashboard' && (
          <div className="dashboard-view">
            <div className="stats-overview">
              <div className="overview-card aura-pulse">
                <div className="card-icon gold"><Zap size={19} strokeWidth={1.8} /></div>
                <div className="card-data">
                  <span className="label">Total APR debt</span>
                  <span className="value">{systemStats.totalDebt}</span>
                </div>
              </div>
              <div className="overview-card">
                <div className="card-icon red"><TrendingUp size={19} strokeWidth={1.8} /></div>
                <div className="card-data">
                  <span className="label">Bankruptcy risk</span>
                  <span className="value">{systemStats.bankruptCount}</span>
                </div>
              </div>
              <div className="overview-card">
                <div className="card-icon blue"><Users size={19} strokeWidth={1.8} /></div>
                <div className="card-data">
                  <span className="label">Active contracts</span>
                  <span className="value">{systemStats.activeCount}</span>
                </div>
              </div>
            </div>

            {systemStats.bankruptCount > 0 && (
              <div className="nen-sealed-alert">
                <ShieldAlert size={20} strokeWidth={1.8} />
                <div className="alert-content">
                  <span className="alert-title">Nen sealed · Zetsu mode</span>
                  <span className="alert-desc">Critical debt detected. System abilities and market access are revoked.</span>
                </div>
              </div>
            )}

            <div className="view-header dashboard-contract-header">
              <div className="header-label-group">
                <h3>Urgent contracts</h3>
                <button className="refresh-btn" onClick={loadData} disabled={loading} aria-label="Refresh contracts">
                  <RefreshCw size={14} className={loading ? 'animate-spin' : ''} strokeWidth={1.8} />
                </button>
              </div>
              <Button variant="secondary" size="sm" onClick={() => setActiveTab('friends')}>View all</Button>
            </div>

            {loading && friendships.length === 0 ? (
              <div className="loading-container" aria-live="polite">
                <Loader2 className="animate-spin" size={28} />
                <p>Syncing contracts…</p>
              </div>
            ) : friendships.length === 0 ? (
              <div className="empty-state">
                <img className="empty-mark" src="/hakoware-mark.svg" alt="" />
                <h3>No active contracts</h3>
                <p>Start a contract to begin tracking check-ins and Aura debt.</p>
                <Button variant="aura" icon={Plus} onClick={() => setModalType('ADD_FRIEND')}>
                  New contract
                </Button>
              </div>
            ) : (
              <div className="nen-grid">
                {friendships.slice(0, 3).map((friendship) => (
                  <NenCard
                    key={friendship.id || friendship._id}
                    friendship={friendship}
                    currentUserId={user.uid || user.id}
                    onAction={handleAction}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'friends' && (
          <div className="dashboard-view">
            <div className="view-header">
              <h3>Hunter contracts</h3>
              <div className="header-actions contract-actions">
                <button className="refresh-btn" onClick={loadData} disabled={loading} aria-label="Refresh contracts">
                  <RefreshCw size={14} className={loading ? 'animate-spin' : ''} strokeWidth={1.8} />
                </button>
                <Button variant="aura" size="sm" icon={Plus} onClick={() => setModalType('ADD_FRIEND')}>New contract</Button>
              </div>
            </div>
            <div className="nen-grid">
              {friendships.map((friendship) => (
                <NenCard
                  key={friendship.id || friendship._id}
                  friendship={friendship}
                  currentUserId={user.uid || user.id}
                  onAction={handleAction}
                />
              ))}
            </div>
          </div>
        )}

        {activeTab === 'achievements' && <AchievementShowcase />}
        {activeTab === 'arena' && <Arena friendships={friendships} showToast={showToast} />}
        {activeTab === 'shame' && <ShameWall />}
        {activeTab === 'wallet' && <AuraWallet friendships={friendships} showToast={showToast} />}
      </Suspense>

      <AddFriendModal
        isOpen={modalType === 'ADD_FRIEND'}
        onClose={closeModal}
        onRefresh={loadData}
        showToast={showToast}
      />

      <FriendshipSettingsModal
        isOpen={modalType === 'SETTINGS'}
        onClose={closeModal}
        friendship={selectedFriendship}
        currentUserId={user.uid || user.id}
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

      <WaterDivinationModal />
      {user && <Potclean friendships={friendships} />}
    </Layout>
  );
}

function App() {
  const [toast, setToast] = useState(null);
  const showToast = (msg, type = 'SUCCESS') => setToast({ msg, type });

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/reset-password/:token" element={<ResetPassword showToast={showToast} />} />
        <Route path="/*" element={<MainApp showToast={showToast} />} />
      </Routes>
      {toast && (
        <Toast
          message={toast.msg}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </BrowserRouter>
  );
}

export default App;
