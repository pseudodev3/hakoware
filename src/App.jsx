import React, { useEffect, useRef, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { useAuth } from './contexts/AuthContext';
import {
  getContractMeta,
  getSocialPresence,
  getUserFriendships,
  pokeContract,
  reactToLatestCheckin,
  replyToLatestCheckin,
  respondToContractMoment
} from './services/friendshipService';
import { getUserAura } from './services/auraService';
import { Layout } from './shared/components/Layout';
import { ClaimUsername, Login, Signup } from './features/auth/Auth';
import { ResetPassword } from './features/auth/ResetPassword';
import { AddFriendModal } from './features/friendship/components/AddFriendModal';
import { FriendshipSettingsModal } from './features/friendship/components/FriendshipSettingsModal';
import { FriendSpace } from './features/friendship/components/FriendSpace';
import { ContractsView } from './features/friendship/components/ContractsView';
import { ContractRecapModal } from './features/friendship/components/ContractRecapModal';
import { CheckinModal } from './features/debt/components/CheckinModal';
import { VoiceCheckinModal } from './features/debt/components/VoiceCheckinModal';
import { LandingPage } from './features/landing/LandingPage';
import { HomeView } from './features/home/HomeView';
import { Arena } from './features/arena/components/Arena';
import { AfterHoursView } from './features/afterHours/AfterHoursView';
import { YouView } from './features/profile/YouView';
import { FounderLabPage } from './features/testlab/FounderLabPage';
import { LegalPage } from './features/legal/LegalPage';
import { returnToFounderSession } from './services/testLabService';
import { prefetchCheckinState, prefetchWarmTabs } from './services/prefetchService';
import Toast from './components/Toast';
import { applyCircleSeen, markCircleSeen, readCircleSeen } from './lib/circleActivity';

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
  const location = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(location.search);
  const requestedTab = params.get('view') || 'home';
  const activeTab = ['home', 'contracts', 'afterHours', 'arena', 'you'].includes(requestedTab) ? requestedTab : 'home';
  const friendKey = location.pathname.startsWith('/circle/') ? location.pathname.split('/')[2] : null;
  const returnFocusRef = useRef(null);
  const [friendships, setFriendships] = useState(bootstrapData?.contracts?.active || []);
  const [pendingReceived, setPendingReceived] = useState(bootstrapData?.contracts?.pendingReceived || []);
  const [pendingSent, setPendingSent] = useState(bootstrapData?.contracts?.pendingSent || []);
  const [pendingExternal, setPendingExternal] = useState(bootstrapData?.contracts?.pendingExternal || []);
  const [contractMeta, setContractMeta] = useState(bootstrapData?.meta || { templates: [], worldEvent: null });
  const [showSignup, setShowSignup] = useState(joining);
  const [modalType, setModalType] = useState(null);
  const [selectedFriendship, setSelectedFriendship] = useState(null);
  const [contractPrefill, setContractPrefill] = useState(null);
  const [afterHoursFocusId, setAfterHoursFocusId] = useState(null);
  const [socialPresence, setSocialPresence] = useState({ pulse: [], contracts: {} });
  const circleSeenRef = useRef({ userId: null, items: {} });

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


  const circleSeen = () => {
    const userId = String(user?.uid || user?.id || user?._id || '');
    if (circleSeenRef.current.userId !== userId) {
      circleSeenRef.current = {
        userId,
        items: readCircleSeen(localStorage, userId)
      };
    }
    return circleSeenRef.current;
  };

  const loadSocial = async () => {
    if (!isAuthenticated || !user) return;
    try {
      const viewerId = String(user.uid || user.id || user._id);
      circleSeen();
      const data = await getSocialPresence(new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString());
      if (circleSeenRef.current.userId && circleSeenRef.current.userId !== viewerId) return;
      setSocialPresence(applyCircleSeen(data || { pulse: [], contracts: {} }, circleSeen().items));
    } catch (error) {
      console.error('Could not load social presence:', error);
    }
  };

  const markActivitySeen = (items) => {
    if (!user) return;
    const state = circleSeen();
    state.items = markCircleSeen(localStorage, state.userId, state.items, items);
    setSocialPresence((current) => applyCircleSeen(current, state.items));
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
        return refreshed.data?.contracts || null;
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
      return contracts;
    } catch (error) {
      console.error('Failed to sync Hakoware:', error);
      showToast(error.message || 'Could not sync Hakoware', 'ERROR');
      return null;
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

  useEffect(() => {
    if (!isAuthenticated || !user) return undefined;

    const refreshSocial = () => {
      if (document.visibilityState === 'visible') void loadSocial();
    };
    const interval = window.setInterval(refreshSocial, 60000);
    document.addEventListener('visibilitychange', refreshSocial);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', refreshSocial);
    };
  }, [isAuthenticated, user?.uid, user?.id, user?._id]);

  const openFriend = (friendship, options = {}) => {
    const key = friendship.contractKey || friendship._id || friendship.id;
    const query = new URLSearchParams({ view: activeTab });
    if (activeTab === 'afterHours' && params.get('activity')) query.set('activity', params.get('activity'));
    if (options.focusEventId) query.set('event', options.focusEventId);
    if (options.contract) query.set('contract', '1');
    returnFocusRef.current = activeTab === 'afterHours' ? 'after-hours-heading' : `friend-open-${friendship._id || friendship.id}`;
    navigate(`/circle/${encodeURIComponent(key)}?${query}`);
  };
  const openAcceptedFriend = (invitation, contracts) => {
    const id = String(invitation?._id || invitation?.id || '');
    const accepted = (contracts?.active || []).find((item) => String(item._id || item.id) === id
      || (invitation?.contractKey && item.contractKey === invitation.contractKey));
    if (accepted) openFriend(accepted);
    else navigateTo('contracts');
  };
  const navigateTo = (tab, options = {}) => {
    if (tab === 'friend') {
      const match = friendships.find((item) => item.contractKey === options.contractKey);
      if (match) { openFriend(match, options); return; }
      tab = 'contracts';
    }
    setAfterHoursFocusId(tab === 'afterHours' ? (options?.focusActivityId || null) : null);
    const query = new URLSearchParams({ view: tab });
    if (tab === 'arena') { query.set('section', options.section || 'cards'); if (options.focusTradeId) query.set('trade', options.focusTradeId); }
    if (tab === 'afterHours' && (options.wall || options.retiredWall || options.focusPieceId || options.week)) query.set('retiredWall', '1');
    if (tab === 'afterHours' && options.focusActivityId) query.set('activity', options.focusActivityId);
    navigate(tab === 'home' ? '/' : `/?${query}`, { replace: Boolean(options.replace) });
  };

  const openedFriend = friendKey ? friendships.find((item) => String(item.contractKey || item._id || item.id) === friendKey) : null;
  useEffect(() => {
    if (friendKey || !returnFocusRef.current) return undefined;
    const frame = requestAnimationFrame(() => document.getElementById(returnFocusRef.current)?.focus({ preventScroll: true }));
    return () => cancelAnimationFrame(frame);
  }, [friendKey, activeTab]);

  const handleAction = async (type, friendship, payload = null) => {
    if (type === 'ARENA') {
      navigateTo('arena', { section: 'bounties' });
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
      const awakened = result.moment?.type === 'SPLIT_DECISION'
        ? 'Split Decision woke up.'
        : result.moment?.type === 'DOUBLE_DARE'
          ? 'Double Dare woke up.'
          : result.moment?.type === 'HOT_SEAT'
            ? 'Hot Seat woke up.'
            : null;
      const pokeMessage = result.success
        ? result.mutualMenace
          ? awakened
            ? `Mutual Menace. ${awakened}`
            : 'Mutual Menace.'
          : 'Poked them.'
        : result.error || 'Could not poke them';
      showToast(pokeMessage, result.success ? 'SUCCESS' : 'ERROR');
      if (result.success) await loadSocial();
      return result;
    }

    if (type === 'REPLY') {
      const result = await replyToLatestCheckin(friendshipId, payload);
      showToast(result.success ? 'Reply sent.' : result.error || 'Could not reply', result.success ? 'SUCCESS' : 'ERROR');
      if (result.success) await loadSocial();
      return result;
    }

    if (type === 'MOMENT_RESPONSE') {
      const result = await respondToContractMoment(friendshipId, payload?.momentId, payload?.value);
      const resolvedLabel = result.moment?.type === 'SPLIT_DECISION'
        ? 'Split Decision revealed.'
        : result.moment?.type === 'DOUBLE_DARE'
          ? 'Double Dare resolved.'
          : 'Hot Seat revealed.';
      const waitingLabel = result.moment?.type === 'DOUBLE_DARE'
        ? result.moment?.phase === 'WAITING'
          ? 'Dare sent. Waiting on them.'
          : 'Choice locked.'
        : 'Answer locked. Waiting on them.';
      const message = result.success
        ? result.moment?.status === 'RESOLVED'
          ? resolvedLabel
          : waitingLabel
        : result.error || 'Could not answer';
      showToast(message, result.success ? 'SUCCESS' : 'ERROR');
      if (result.success) await loadSocial();
      return result;
    }

    setSelectedFriendship(friendship);
    if (['CHECKIN', 'VOICE_CHECKIN', 'SETTINGS', 'RECAP'].includes(type)) setModalType(type);
    return { success: true };
  };

  const openNewContract = (person = null, source = 'DIRECT') => {
    setContractPrefill(person ? { person, source } : null);
    setModalType('ADD_FRIEND');
  };

  const closeModal = () => {
    setModalType(null);
    setSelectedFriendship(null);
    setContractPrefill(null);
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
      friendSpace={Boolean(friendKey)}
      onTabChange={navigateTo}
      onAddFriend={() => openNewContract()}
      pendingInvitations={pendingReceived}
      onRefresh={loadData}
      showToast={showToast}
    >
      <motion.div
        key={friendKey || activeTab}
        className="tab-stage"
        initial={shouldReduceMotion ? false : { opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: shouldReduceMotion ? 0 : .17, ease: [0.2, 0, 0, 1] }}
      >
        {openedFriend && <FriendSpace
          key={openedFriend._id || openedFriend.id}
          friendship={openedFriend}
          currentUserId={user.uid || user.id || user._id}
          socialState={socialPresence.contracts?.[openedFriend._id || openedFriend.id]}
          focusEventId={params.get('event')}
          initialContract={params.get('contract') === '1'}
          onBack={() => navigateTo(activeTab, { replace: true, focusActivityId: activeTab === 'afterHours' ? params.get('activity') : null })}
          onAction={handleAction}
          onRefresh={loadData}
          onActivitySeen={markActivitySeen}
        />}
        {friendKey && !openedFriend && <div className="friend-unavailable"><h1>This friend space is unavailable.</h1><p>It may have ended or your circle needs a refresh.</p><button onClick={() => void loadData()}>Refresh circle</button><button onClick={() => navigateTo('home')}>Back to your circle</button></div>}
        {!friendKey && activeTab === 'home' && (
          <HomeView
            user={user}
            friendships={friendships}
            pendingInvitations={pendingReceived}
            pendingOutboundCount={pendingSent.length + pendingExternal.length}
            worldEvent={contractMeta.worldEvent}
            onAction={handleAction}
            onAddFriend={() => openNewContract()}
            onNavigate={navigateTo}
            onRefresh={loadData}
            onAcceptedFriend={openAcceptedFriend}
            showToast={showToast}
            socialPresence={socialPresence}
            onActivitySeen={markActivitySeen}
            onOpenFriend={openFriend}
          />
        )}

        {!friendKey && activeTab === 'contracts' && (
          <ContractsView
            user={user}
            friendships={friendships}
            pendingReceived={pendingReceived}
            pendingSent={pendingSent}
            pendingExternal={pendingExternal}
            templates={contractMeta.templates}
            onAction={handleAction}
            onAddFriend={() => openNewContract()}
            onRefresh={loadData}
            onNavigate={navigateTo}
            showToast={showToast}
            socialContracts={socialPresence.contracts}
            onAcceptedFriend={openAcceptedFriend}
            onActivitySeen={markActivitySeen}
            onOpenFriend={openFriend}
          />
        )}

        {!friendKey && activeTab === 'afterHours' && (
          <AfterHoursView
            user={user}
            friendships={[...friendships, ...pendingReceived, ...pendingSent]}
            wallRetired={params.get('retiredWall') === '1' || params.get('surface') === 'wall' || params.has('piece') || params.has('week')}
            onDismissRetiredWall={() => navigateTo('afterHours', { replace: true })}
            focusActivityId={params.get('activity') || afterHoursFocusId}
            focusRequestKey={location.key}
            onFocusHandled={() => setAfterHoursFocusId(null)}
            onStartContract={(person) => openNewContract(person, 'AFTER_HOURS')}
            onOpenFriend={openFriend}
            onNavigate={navigateTo}
            showToast={showToast}
          />
        )}
        {!friendKey && activeTab === 'arena' && <Arena friendships={friendships} showToast={showToast} onNavigate={navigateTo} focusTradeId={params.get('trade')} initialView={['bounties','grudges','shame'].includes(params.get('section')) ? params.get('section') : 'cards'} />}
        {!friendKey && activeTab === 'you' && <YouView friendships={friendships} showToast={showToast} onNavigate={navigateTo} />}
      </motion.div>

      <AddFriendModal
        isOpen={modalType === 'ADD_FRIEND'}
        onClose={closeModal}
        onRefresh={loadData}
        showToast={showToast}
        templates={contractMeta.templates}
        prefillPerson={contractPrefill?.person || null}
        source={contractPrefill?.source || 'DIRECT'}
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
