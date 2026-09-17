import React, { useEffect, useState } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { getUserFriendships } from './services/friendshipService';
import { getUserAura } from './services/auraService';
import { Layout } from './shared/components/Layout';
import { Login, Signup } from './features/auth/Auth';
import { ResetPassword } from './features/auth/ResetPassword';
import { AddFriendModal } from './features/friendship/components/AddFriendModal';
import { FriendshipSettingsModal } from './features/friendship/components/FriendshipSettingsModal';
import { ContractsView } from './features/friendship/components/ContractsView';
import { CheckinModal } from './features/debt/components/CheckinModal';
import { VoiceCheckinModal } from './features/debt/components/VoiceCheckinModal';
import { LandingPage } from './features/landing/LandingPage';
import { WaterDivinationModal } from './features/auth/components/WaterDivinationModal';
import { HomeView } from './features/home/HomeView';
import { Arena } from './features/arena/components/Arena';
import { YouView } from './features/profile/YouView';
import Toast from './components/Toast';
import './App.css';

const isJoinLink = () => new URLSearchParams(window.location.search).get('join') === '1';

function MainApp({ showToast }) {
  const { user, isAuthenticated, refreshUser } = useAuth();
  const joining = isJoinLink();
  const [hasEntered, setHasEntered] = useState(() => joining || localStorage.getItem('hakoware_visited') === 'true');
  const [activeTab, setActiveTab] = useState('home');
  const [friendships, setFriendships] = useState([]);
  const [pendingReceived, setPendingReceived] = useState([]);
  const [pendingSent, setPendingSent] = useState([]);
  const [showSignup, setShowSignup] = useState(joining);
  const [modalType, setModalType] = useState(null);
  const [selectedFriendship, setSelectedFriendship] = useState(null);

  const loadData = async () => {
    if (!isAuthenticated || !user) return;

    try {
      const oldBalance = user.auraBalance || 0;
      const [contracts] = await Promise.all([getUserFriendships(), getUserAura()]);
      setFriendships(contracts.active || []);
      setPendingReceived(contracts.pendingReceived || []);
      setPendingSent(contracts.pendingSent || []);

      const refreshed = await refreshUser();
      const nextBalance = refreshed.user?.auraBalance ?? oldBalance;
      if (nextBalance > oldBalance) {
        showToast(`+${nextBalance - oldBalance} Aura for keeping your contracts clean`, 'SUCCESS');
      }
    } catch (error) {
      console.error('Failed to sync Hakoware:', error);
      showToast(error.message || 'Could not sync Hakoware', 'ERROR');
    }
  };

  useEffect(() => {
    if (isAuthenticated) loadData();
  }, [isAuthenticated]);

  const handleAction = (type, friendship) => {
    setSelectedFriendship(friendship);
    if (['CHECKIN', 'VOICE_CHECKIN', 'SETTINGS'].includes(type)) setModalType(type);
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
    return showSignup
      ? <Signup onToggle={() => setShowSignup(false)} showToast={showToast} />
      : <Login onToggle={() => setShowSignup(true)} showToast={showToast} />;
  }

  return (
    <Layout
      activeTab={activeTab}
      onTabChange={setActiveTab}
      onAddFriend={() => setModalType('ADD_FRIEND')}
      pendingInvitations={pendingReceived}
      onRefresh={loadData}
      showToast={showToast}
    >
      {activeTab === 'home' && (
        <HomeView
          user={user}
          friendships={friendships}
          pendingInvitations={pendingReceived}
          onAction={handleAction}
          onAddFriend={() => setModalType('ADD_FRIEND')}
          onNavigate={setActiveTab}
        />
      )}

      {activeTab === 'contracts' && (
        <ContractsView
          user={user}
          friendships={friendships}
          pendingReceived={pendingReceived}
          pendingSent={pendingSent}
          onAction={handleAction}
          onAddFriend={() => setModalType('ADD_FRIEND')}
          onRefresh={loadData}
          showToast={showToast}
        />
      )}

      {activeTab === 'arena' && <Arena friendships={friendships} showToast={showToast} />}
      {activeTab === 'you' && <YouView friendships={friendships} showToast={showToast} />}

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
        currentUserId={user.uid || user.id || user._id}
        onRefresh={loadData}
        showToast={showToast}
      />

      <CheckinModal
        isOpen={modalType === 'CHECKIN'}
        onClose={closeModal}
        friendship={selectedFriendship}
        currentUserId={user.uid || user.id || user._id}
        onRefresh={loadData}
        showToast={showToast}
      />

      <VoiceCheckinModal
        isOpen={modalType === 'VOICE_CHECKIN'}
        onClose={closeModal}
        friendship={selectedFriendship}
        currentUserId={user.uid || user.id || user._id}
        onRefresh={loadData}
        showToast={showToast}
      />

      <WaterDivinationModal />
    </Layout>
  );
}

function App() {
  const [toast, setToast] = useState(null);
  const showToast = (message, type = 'SUCCESS') => setToast({ message, type });

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/reset-password/:token" element={<ResetPassword showToast={showToast} />} />
        <Route path="/*" element={<MainApp showToast={showToast} />} />
      </Routes>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </BrowserRouter>
  );
}

export default App;
