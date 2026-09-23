import React, { useEffect, useRef, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { useAuth } from './contexts/AuthContext';
import {
  getContractMeta,
  getSocialPresence,
  getUserFriendships,
  pokeContract,
  reactToLatestCheckin,
  replyToLatestCheckin
} from './services/friendshipService';
import { getUserAura } from './services/auraService';
import { Layout } from './shared/components/Layout';
import { ClaimUsername, Login, Signup } from './features/auth/Auth';
import { ResetPassword } from './features/auth/ResetPassword';
import { AddFriendModal } from './features/friendship/components/AddFriendModal';
import { FriendshipSettingsModal } from './features/friendship/components/FriendshipSettingsModal';
import { ContractsView } from './features/friendship/components/ContractsView';
import { ContractRecapModal } from './features/friendship/components/ContractRecapModal';
import { CheckinModal } from './features/debt/components/CheckinModal';
import { VoiceCheckinModal } from './features/debt/components/VoiceCheckinModal';
import { LandingPage } from './features/landing/LandingPage';
import { HomeView } from './features/home/HomeView';
import { Arena } from './features/arena/components/Arena';
import { YouView } from './features/profile/YouView';
import { FounderLabPage } from './features/testlab/FounderLabPage';
import { LegalPage } from './features/legal/LegalPage';
import { returnToFounderSession } from './services/testLabService';
import { prefetchCheckinState, prefetchWarmTabs } from './services/prefetchService';
import Toast from './components/Toast';

const isJoinLink = () => new URLSearchParams(window.location.search).get('join') === '1';

function FounderRoute({ showToast }) {
  const { isAuthenticated, user } = useAuth();
  if (!isAuthenticated) return <Navigate to="/" replace />;
  if (user?.isTestAccount) return <Navigate to="/" replace />;
  if (user && !user.username) return <ClaimUsername />;
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
  const { user, isAuthenticated, bootstrapData, refreshBootstrap, refreshUser } = useAuth();
  const shouldReduceMotion = useReducedMotion();
  const joining = isJoinLink();
  const [hasEntered, setHasEntered] = useState(joining);
  const [activeTab, setActiveTab] = useState('home');
  const [friendships, setFriendships] = useState(bootstrapData?.contracts?.active || []);
  const [pendingReceived, setPendingReceived] = useState(bootstrapData?.contracts?.pendingReceived || []);
  const [pendingSent, setPendingSent] = useState(bootstrapData?.contracts?.pendingSent || []);
  const [pendingExternal, setPendingExternal] = useState(bootstrapData?.contracts?.pendingExternal || []);
  const [contractMeta, setContractMeta] = useState(bootstrapData?.meta || { templates: [], worldEvent: null });
  const [showSignup, setShowSignup] = useState(joining);
  const [modalType, setModalType] = useState(null);
  const [selectedFriendship, setSelectedFriendship] = useState(null);
  const [socialPresence, setSocialPresence] = useState({ pulse: [], contracts: {} });
  const socialSinceRef = useRef(null);

  const applyBootstrap = (payload) => {
    if (!payload) return;
    const contracts = payload.contracts || {};
    const activeContracts = contracts.active || [];
    setFriendships(activeContracts);
    prefetchCheckinState(activeContracts);
    setPendingReceived(contracts.pendingReceived || []);
    setPendingSent(contracts.pendingSent || []);
    setPendingExternal(contracts.pendingExternal || []);
    if (payload.meta) setContractMeta(payload.meta);
  };


  const socialWindow = () => {
    const userId = String(user?.uid || user?.id || user?._id || '');
    const key = `hakoware-pulse-seen:${userId}`;
    if (!socialSinceRef.current || socialSinceRef.current.userId !== userId) {
      socialSinceRef.current = {
        userId,
        key,
        since: localStorage.getItem(key) || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      };
    }
    return socialSinceRef.current;
  };

  const loadSocial = async () => {
    if (!isAuthenticated || !user) return;
    try {
      const data = await getSocialPresence(socialWindow().since);
      setSocialPresence(data || { pulse: [], contracts: {} });
    } catch (error) {
      console.error('Could not load social presence:', error);
    }
  };

  const markPulseSeen = () => {
    if (!user) return;
    localStorage.setItem(socialWindow().key, new Date().toISOString());
  };

  const loadData = async () => {
    if (!isAuthenticated || !user) return;

    try {
      const oldBalance = Number(user.auraBalance) || 0;
      const refreshed = await refreshBootstrap();

      if (refreshed.success) {
        applyBootstrap(refreshed.data);
        void loadSocial();
        const nextBalance = Number(refreshed.user?.auraBalance ?? oldBalance) || 0;
        if (nextBalance > oldBalance) {
          showToast(`+${nextBalance - oldBalance} Aura`, 'SUCCESS');
        }
        return;
      }

      console.warn('Bootstrap sync failed, using legacy data endpoints:', refreshed.error);
      const [contracts, meta] = await Promise.all([
        getUserFriendships(),
        getContractMeta()
      ]);

      const activeContracts = contracts.active || [];
      setFriendships(activeContracts);
      prefetchCheckinState(activeContracts);
      setPendingReceived(contracts.pendingReceived || []);
      setPendingSent(contracts.pendingSent || []);
      setPendingExternal(contracts.pendingExternal || []);
      setContractMeta(meta || { templates: [], worldEvent: null });
      void loadSocial();

      await getUserAura({ force: true }).catch((auraError) => {
        console.error('Fallback Aura sync failed:', auraError);
      });

      const userResult = await refreshUser();
      const nextBalance = Number(userResult.user?.auraBalance ?? oldBalance) || 0;
      if (nextBalance > oldBalance) {
        showToast(`+${nextBalance - oldBalance} Aura`, 'SUCCESS');
      }
      prefetchWarmTabs();
    } catch (error) {
      console.error('Failed to sync Hakoware:', error);
      showToast(error.message || 'Could not sync Hakoware', 'ERROR');
    }
  };

  useEffect(() => {
    if (!isAuthenticated) return undefined;

    if (bootstrapData) {
      applyBootstrap(bootstrapData);
      void loadSocial();
      return prefetchWarmTabs();
    }

    void loadData();
    return undefined;
  }, [isAuthenticated, bootstrapData?.generatedAt]);

  const handleAction = async (type, friendship, payload = null) => {
    if (type === 'ARENA') {
      setActiveTab('arena');
      return { success: true };
    }

    const friendshipId = friendship?._id || friendship?.id;
    if (type === 'REACT') {
      const result = await reactToLatestCheckin(friendshipId, payload);
      showToast(result.success ? `Reacted ${payload}` : result.error || 'Could not react', result.success ? 'SUCCESS' : 'ERROR');
      if (result.success) await loadSocial();
      return result;
    }

    if (type === 'POKE') {
      const result = await pokeContract(friendshipId);
      showToast(result.success ? 'Poked them.' : result.error || 'Could not poke them', result.success ? 'SUCCESS' : 'ERROR');
      if (result.success) await loadSocial();
      return result;
    }

    if (type === 'REPLY') {
      const result = await replyToLatestCheckin(friendshipId, payload);
      showToast(result.success ? 'Reply sent.' : result.error || 'Could not reply', result.success ? 'SUCCESS' : 'ERROR');
      if (result.success) await loadSocial();
      return result;
    }

    setSelectedFriendship(friendship);
    if (['CHECKIN', 'VOICE_CHECKIN', 'SETTINGS', 'RECAP'].includes(type)) setModalType(type);
    return { success: true };
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

  if (isAuthenticated && user && !user.username && !user.isTestAccount) {
    return <ClaimUsername />;
  }

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
      <motion.div
        key={activeTab}
        className="tab-stage"
        initial={shouldReduceMotion ? false : { opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: shouldReduceMotion ? 0 : .17, ease: [0.2, 0, 0, 1] }}
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
            socialPresence={socialPresence}
            onPulseSeen={markPulseSeen}
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
            onAction={handleAction}
            onAddFriend={() => setModalType('ADD_FRIEND')}
            onRefresh={loadData}
            onNavigate={setActiveTab}
            showToast={showToast}
            socialContracts={socialPresence.contracts}
          />
        )}

        {activeTab === 'arena' && <Arena friendships={friendships} showToast={showToast} />}
        {activeTab === 'you' && <YouView friendships={friendships} showToast={showToast} />}
      </motion.div>

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
        <Route path="/reset-password" element={<ResetPassword showToast={showToast} />} />
        <Route path="/reset-password/:token" element={<ResetPassword showToast={showToast} />} />
        <Route path="/founder" element={<FounderRoute showToast={showToast} />} />
        <Route path="/privacy" element={<LegalPage type="privacy" />} />
        <Route path="/terms" element={<LegalPage type="terms" />} />
        <Route path="/community" element={<LegalPage type="community" />} />
        <Route path="/contact" element={<LegalPage type="contact" />} />
        <Route path="/*" element={<MainApp showToast={showToast} />} />
      </Routes>
      {toast && <Toast key={toast.id} message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </BrowserRouter>
  );
}

export default App;
