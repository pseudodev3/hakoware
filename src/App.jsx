import React, { useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { getContractMeta, getUserFriendships } from './services/friendshipService';
import { getUserAura } from './services/auraService';
import { Layout } from './shared/components/Layout';
import { Login, Signup } from './features/auth/Auth';
import { ResetPassword } from './features/auth/ResetPassword';
import { AddFriendModal } from './features/friendship/components/AddFriendModal';
import { FriendshipSettingsModal } from './features/friendship/components/FriendshipSettingsModal';
import { ContractsView } from './features/friendship/components/ContractsView';
import { ContractRecapModal } from './features/friendship/components/ContractRecapModal';
import { CheckinModal } from './features/debt/components/CheckinModal';
import { VoiceCheckinModal } from './features/debt/components/VoiceCheckinModal';
import { LandingPage } from './features/landing/LandingPage';
import { WaterDivinationModal } from './features/auth/components/WaterDivinationModal';
import { HomeView } from './features/home/HomeView';
import { Arena } from './features/arena/components/Arena';
import { YouView } from './features/profile/YouView';
import { FounderLabPage } from './features/testlab/FounderLabPage';
import { returnToFounderSession } from './services/testLabService';
import Toast from './components/Toast';

const isJoinLink = () => new URLSearchParams(window.location.search).get('join') === '1';

function FounderRoute({ showToast }) {
  const { isAuthenticated, user } = useAuth();
  if (!isAuthenticated) return <Navigate to="/" replace />;
  if (user?.isTestAccount) return <Navigate to="/" replace />;
  return <FounderLabPage showToast={showToast} />;
}

const TestSessionBar = ({ user }) => {
  if (!user?.isTestAccount || !localStorage.getItem('hakoware_founder_token')) return null;
  return (
    <div className="test-session-bar">
      <span><strong>TEST SESSION</strong> · {user.displayName}</span>
      <button type="button" onClick={returnToFounderSession}>Return to Founder</button>
    </div>
  );
};

function MainApp({ showToast }) {
  const { user, isAuthenticated, refreshUser } = useAuth();
  const joining = isJoinLink();
  const [hasEntered, setHasEntered] = useState(joining);
  const [activeTab, setActiveTab] = useState('home');
  const [friendships, setFriendships] = useState([]);
  const [pendingReceived, setPendingReceived] = useState([]);
  const [pendingSent, setPendingSent] = useState([]);
  const [pendingExternal, setPendingExternal] = useState([]);
  const [contractMeta, setContractMeta] = useState({ templates: [], worldEvent: null });
  const [showSignup, setShowSignup] = useState(joining);
  const [modalType, setModalType] = useState(null);
  const [selectedFriendship, setSelectedFriendship] = useState(null);

  const loadData = async () => {
    if (!isAuthenticated || !user) return;

    try {
      const oldBalance = Number(user.auraBalance) || 0;
      const [contracts, meta] = await Promise.all([
        getUserFriendships(),
        getContractMeta().catch((error) => {
          console.error('Contract meta sync failed:', error);
          return null;
        })
      ]);

      setFriendships(contracts.active || []);
      setPendingReceived(contracts.pendingReceived || []);
      setPendingSent(contracts.pendingSent || []);
      setPendingExternal(contracts.pendingExternal || []);
      if (meta) setContractMeta(meta);

      try {
        await getUserAura();
      } catch (auraError) {
        console.error('Aura summary sync failed:', auraError);
      }

      const refreshed = await refreshUser();
      const nextBalance = Number(refreshed.user?.auraBalance ?? oldBalance) || 0;
      if (nextBalance > oldBalance) {
        showToast(`+${nextBalance - oldBalance} Aura`, 'SUCCESS');
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
    if (['CHECKIN', 'VOICE_CHECKIN', 'SETTINGS', 'RECAP'].includes(type)) setModalType(type);
  };

  const closeModal = () => {
    setModalType(null);
    setSelectedFriendship(null);
  };

  const handleEnter = () => setHasEntered(true);
  const handleBackToLanding = () => {
    setShowSignup(false);
    setHasEntered(false);
  };

  if (!isAuthenticated) {
    if (!hasEntered) return <LandingPage onEnter={handleEnter} />;
    return showSignup
      ? <Signup onToggle={() => setShowSignup(false)} onBack={handleBackToLanding} showToast={showToast} />
      : <Login onToggle={() => setShowSignup(true)} onBack={handleBackToLanding} showToast={showToast} />;
  }

  return (
    <>
      <TestSessionBar user={user} />
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
          pendingOutboundCount={pendingSent.length + pendingExternal.length}
          worldEvent={contractMeta.worldEvent}
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
          pendingExternal={pendingExternal}
          templates={contractMeta.templates}
          worldEvent={contractMeta.worldEvent}
          onAction={handleAction}
          onAddFriend={() => setModalType('ADD_FRIEND')}
          onRefresh={loadData}
          showToast={showToast}
        />
      )}

      {activeTab === 'arena' && <Arena friendships={friendships} worldEvent={contractMeta.worldEvent} showToast={showToast} />}
      {activeTab === 'you' && <YouView friendships={friendships} worldEvent={contractMeta.worldEvent} showToast={showToast} />}

      <AddFriendModal
        isOpen={modalType === 'ADD_FRIEND'}
        onClose={closeModal}
        onRefresh={loadData}
        showToast={showToast}
        templates={contractMeta.templates}
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

      <ContractRecapModal
        isOpen={modalType === 'RECAP'}
        onClose={closeModal}
        friendship={selectedFriendship}
        onRefresh={loadData}
        showToast={showToast}
      />

      <WaterDivinationModal />
      </Layout>
    </>
  );
}

function App() {
  const [toast, setToast] = useState(null);
  const showToast = (message, type = 'SUCCESS') => setToast({ message, type, id: Date.now() });

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/reset-password/:token" element={<ResetPassword showToast={showToast} />} />
        <Route path="/founder" element={<FounderRoute showToast={showToast} />} />
        <Route path="/*" element={<MainApp showToast={showToast} />} />
      </Routes>
      {toast && <Toast key={toast.id} message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </BrowserRouter>
  );
}

export default App;
