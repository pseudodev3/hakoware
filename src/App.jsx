import React, { useState, useEffect, Suspense } from 'react';
import { useAuth } from './contexts/AuthContext';
import { getUserFriendships } from './services/friendshipService';
import { Layout } from './shared/components/Layout';
import { NenCard } from './features/debt/components/NenCard';
import { Button } from './shared/components/Button';
import { Login, Signup } from './features/auth/Auth';
import { AddFriendModal } from './features/friendship/components/AddFriendModal';
import { CheckinModal } from './features/debt/components/CheckinModal';
import Toast from './components/Toast';
import { Loader2, Plus, RefreshCw } from 'lucide-react';
import './App.css';

function App() {
  const { user, isAuthenticated, isEmailVerified } = useAuth();
  
  // UI State
  const [activeTab, setActiveTab] = useState('friends');
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

  // Auth Guard
  if (!isAuthenticated) {
    return showSignup ? (
      <Signup onToggle={() => setShowSignup(false)} />
    ) : (
      <Login onToggle={() => setShowSignup(true)} />
    );
  }

  // Calculate Total Debt (using the same logic as the hook for consistency)
  const totalDebt = friendships.reduce((acc, f) => {
    const isUser1 = f.user1._id === (user.uid || user.id) || f.user1 === (user.uid || user.id);
    const perspective = isUser1 ? f.user1Perspective : f.user2Perspective;
    if (!perspective) return acc;

    const interactionDate = new Date(perspective.lastInteraction || 0);
    const now = new Date();
    const daysMissed = Math.floor(Math.max(0, now - interactionDate) / (1000 * 60 * 60 * 24));
    const daysOverLimit = Math.max(0, daysMissed - (perspective.limit || 7));
    return acc + (perspective.baseDebt || 0) + daysOverLimit;
  }, 0);

  return (
    <Layout 
      activeTab={activeTab} 
      onTabChange={setActiveTab}
      onAddFriend={() => setModalType('ADD_FRIEND')}
    >
      <Suspense fallback={<div className="loading-screen"><Loader2 className="animate-spin" /></div>}>
        {activeTab === 'friends' && (
          <div className="dashboard-view">
            <div className="view-header">
              <div className="header-label-group">
                <h3>ACTIVE CONTRACTS</h3>
                <button className="refresh-btn" onClick={loadData} disabled={loading}>
                  <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                </button>
              </div>
              <div className="stats-summary">
                <div className="summary-item">
                  <span className="label">TOTAL SYSTEM DEBT</span>
                  <span className="value">{totalDebt} APR</span>
                </div>
              </div>
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
                {friendships.map((f) => (
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
        
        {activeTab !== 'friends' && (
          <div className="empty-state glass">
            <h2>{activeTab.toUpperCase()} MODULE</h2>
            <p>This module is currently being optimized for high-performance aura tracking.</p>
            <Button variant="secondary" onClick={() => setActiveTab('friends')}>
              RETURN TO DASHBOARD
            </Button>
          </div>
        )}
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
