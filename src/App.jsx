import { useState, useEffect, useRef } from 'react'
import { useAuth } from './contexts/AuthContext'
import { getUserFriendships } from './services/friendshipService'

import { getRandomQuote } from './utils/quotes' 
import './index.css' 
import { calculateDebt } from './utils/gameLogic'
import { checkAchievements } from './services/achievementService'

// Pages
import LandingPage from './pages/LandingPage'
import Login from './pages/auth/Login'
import Signup from './pages/auth/Signup'
import VerificationRequired from './pages/auth/VerificationRequired'

// Components
import Dashboard from './components/Dashboard'
import NenCard from './components/NenCard'
import InvitationsPanel from './components/InvitationsPanel'
import MercyPanel from './components/MercyPanel'
import BailoutHistoryPanel from './components/BailoutHistoryPanel'
import NotificationsPanel from './components/NotificationsPanel'
import HamburgerMenu from './components/HamburgerMenu'
import AuraMarketplaceModal from './components/Modals/AuraMarketplaceModal'
import AdminPanel from './components/AdminPanel'
import AdminLock from './components/AdminLock'
import Toast from './components/Toast'
import AddFriendModal from './components/Modals/AddFriendModal'
import CheckinModal from './components/Modals/CheckinModal'
import MercyRequestModal from './components/Modals/MercyRequestModal'
import BailoutModal from './components/Modals/BailoutModal'
import SettleModal from './components/Modals/SettleModal'
import PetitionModal from './components/Modals/PetitionModal'
import FriendshipSettingsModal from './components/Modals/FriendshipSettingsModal'

// NEW: Fun Features
import AchievementShowcase from './components/AchievementShowcase'
import Arena from './components/Arena'
import Tools from './components/Tools'
import CreateBountyModal from './components/Modals/CreateBountyModal'
import AchievementUnlockModal from './components/Modals/AchievementUnlockModal'
import VoiceCheckinModal from './components/Modals/VoiceCheckinModal'
import FlexModal from './components/Modals/FlexModal'
import DebtRouletteModal from './components/Modals/DebtRouletteModal'
import Potclean from './components/Potclean'
import NenSealedStatus from './components/NenSealedStatus'
import AuraWallet from './components/AuraWallet'
import { initializeAuraBalance } from './services/auraService'
import { UsersIcon, AwardIcon, TrophyIcon, WrenchIcon, DollarIcon } from './components/icons/Icons'

function App() {
  const { user, isAuthenticated, isEmailVerified } = useAuth();
  const [hasEntered, setHasEntered] = useState(() => {
    return localStorage.getItem('hakoware_visited') === 'true';
  });
  const [showSignup, setShowSignup] = useState(false);

  const handleEnter = () => {
    localStorage.setItem('hakoware_visited', 'true');
    setHasEntered(true);
  };
  
  // App state
  const [friendships, setFriendships] = useState([])
  const [loading, setLoading] = useState(true)
  
  // --- AUTH STATE ---
  const [isAdmin, setIsAdmin] = useState(false)
  const [adminUnlocked, setAdminUnlocked] = useState(false)

  // --- UI STATE ---
  const [selectedFriendship, setSelectedFriendship] = useState(null)
  const [modalType, setModalType] = useState(null) 
  const [showAddFriend, setShowAddFriend] = useState(false)
  const [showMarketplace, setShowMarketplace] = useState(false)
  const [toast, setToast] = useState(null)
  const [recentActivity, setRecentActivity] = useState("SYSTEM: MONITORING TRANSACTIONS...");

  // NEW: Feature States
  const [showCreateBounty, setShowCreateBounty] = useState(false);
  const [newAchievement, setNewAchievement] = useState(null);
  const [activeTab, setActiveTab] = useState('friends'); // 'friends', 'achievements', 'shame', 'bounties'

  const sfxReset = useRef(new Audio('https://www.myinstants.com/media/sounds/discord-notification.mp3'));
  const sfxAchievement = useRef(new Audio('https://www.myinstants.com/media/sounds/level-up.mp3'));

  // Check for admin mode
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('mode') === 'admin') setIsAdmin(true);
  }, []);

  const showToast = (msg, type = 'SUCCESS') => {
      setToast({ msg, type });
  };

  const loadData = async () => {
    if (!isAuthenticated || !user) {
      setLoading(false);
      return;
    }
    
    setLoading(true);
    try {
        // Initialize Aura balance for new users
        await initializeAuraBalance(user.uid);
        
        // Load friendships using the new service
        const userFriendships = await getUserFriendships(user.uid);
        
        // Calculate total APR for sorting
        const friendshipsWithStats = userFriendships.map(f => {
          const isUser1 = f.myPerspective === 'user1';
          const myData = isUser1 ? f.user1Perspective : f.user2Perspective;
          const stats = calculateDebt({
            baseDebt: myData.baseDebt,
            lastInteraction: myData.lastInteraction,
            bankruptcyLimit: myData.limit
          });
          return { ...f, myDebt: stats.totalDebt };
        });

        // Sort by urgency (highest debt first)
        const sorted = friendshipsWithStats.sort((a, b) => b.myDebt - a.myDebt);
        setFriendships(sorted);
        setLoading(false);
    } catch (e) {
        console.error(e);
        showToast("Database Error", "ERROR");
        setLoading(false);
    }
  };

  useEffect(() => { 
    loadData(); 
  }, [isAuthenticated, user]) 

  // --- HANDLERS ---

  const handlePoke = (name, isBankrupt, isClean) => {
      sfxReset.current.volume = 0.5;
      sfxReset.current.currentTime = 0;
      sfxReset.current.play().catch(e => console.log("Audio Blocked:", e));
      
      const msg = getRandomQuote(isBankrupt, isClean);
      const type = isBankrupt ? "ERROR" : isClean ? "SUCCESS" : "INFO";
      
      showToast(msg, type);
  };

  const handleAction = (type, friendship) => {
      // SECURITY CHECK: If Admin is present but locked, BLOCK EVERYTHING
      if (isAdmin && !adminUnlocked) {
          showToast("SYSTEM LOCKED: ENTER PIN", "ERROR");
          return;
      }

      setSelectedFriendship(friendship);
      
      if (type === 'CHECKIN') {
        setModalType('CHECKIN');
      } else if (type === 'VOICE_CHECKIN') {
        setModalType('VOICE_CHECKIN');
      } else if (type === 'BEG') {
        setModalType('MERCY_REQUEST');
      } else if (type === 'FLEX') {
        setModalType('FLEX');
      } else if (type === 'ROULETTE') {
        setModalType('ROULETTE');
      } else if (type === 'BAILOUT') {
        setModalType('BAILOUT');
      } else if (type === 'SETTINGS') {
        setModalType('SETTINGS');
      }
  };

  const handleRefreshData = (actionMsg) => {
      if(actionMsg) setRecentActivity(actionMsg); 
      loadData(); 
  };

  // NEW: Check achievements after actions
  const checkForAchievements = async (activityType, activityData = {}) => {
    if (!user) return;
    const result = await checkAchievements(user.uid, activityType, activityData);
    if (result.newlyUnlocked && result.newlyUnlocked.length > 0) {
      // Show the first new achievement (or queue them)
      setNewAchievement(result.newlyUnlocked[0]);
      // Play achievement sound
      sfxAchievement.current.volume = 0.5;
      sfxAchievement.current.play().catch(e => console.log("Audio Blocked:", e));
    }
  };

  const closeModal = () => {
      setSelectedFriendship(null);
      setModalType(null);
  };

  // Show landing page if first visit
  if (!hasEntered) {
    return <LandingPage onEnter={handleEnter} />;
  }

  // Show auth screens if not logged in
  if (!isAuthenticated) {
    return showSignup ? (
      <Signup onToggle={() => setShowSignup(false)} />
    ) : (
      <Login onToggle={() => setShowSignup(true)} />
    );
  }

  // Show verification required screen if email not verified
  if (!isEmailVerified()) {
    return <VerificationRequired />;
  }

  return (
    <div className="app-container">
      {/* HEADER SECTION */}
      <header style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        padding: '20px 30px',
        marginBottom: '20px',
        borderBottom: '1px solid #222'
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'left' }}>
          <h1 className="glitch" data-text="HAKOWARE" style={{margin: 0, fontSize: '1.5rem', letterSpacing: '4px'}}>
            HAKOWARE 
          </h1>
          <div className="sub-header" style={{fontSize: '0.7rem', marginTop: '2px'}}>
            CHAPTER 7 BANKRUPTCY
          </div>
        </div>

        {/* Hamburger Menu */}
        <HamburgerMenu 
          onAddFriend={() => setShowAddFriend(true)}
          onRefresh={loadData}
          onOpenMarketplace={() => setShowMarketplace(true)}
        />
      </header>

      {/* Notifications, Invitations, Mercy & Bailout Panels */}
      <NotificationsPanel />
      <InvitationsPanel onUpdate={loadData} />
      <MercyPanel onUpdate={loadData} />
      <BailoutHistoryPanel />

      {/* Nen Sealed Status - Shows when bankrupt */}
      <NenSealedStatus friendships={friendships} />

      {/* Simplified Tab Navigation - 4 Tabs Only */}
      <div style={tabContainerStyle}>
        <button 
          style={{...tabButtonStyle, ...(activeTab === 'friends' ? tabActiveStyle : {})}}
          onClick={() => setActiveTab('friends')}
        >
          <UsersIcon size={16} color={activeTab === 'friends' ? '#ffd700' : '#666'} />
          <span style={{ marginLeft: '8px' }}>FRIENDS</span>
        </button>
        <button 
          style={{...tabButtonStyle, ...(activeTab === 'achievements' ? tabActiveStyle : {})}}
          onClick={() => setActiveTab('achievements')}
        >
          <AwardIcon size={16} color={activeTab === 'achievements' ? '#ffd700' : '#666'} />
          <span style={{ marginLeft: '8px' }}>ACHIEVEMENTS</span>
        </button>
        <button 
          style={{...tabButtonStyle, ...(activeTab === 'arena' ? tabActiveStyle : {})}}
          onClick={() => setActiveTab('arena')}
        >
          <TrophyIcon size={16} color={activeTab === 'arena' ? '#ff4444' : '#666'} />
          <span style={{ marginLeft: '8px' }}>ARENA</span>
        </button>
        <button 
          style={{...tabButtonStyle, ...(activeTab === 'tools' ? tabActiveStyle : {})}}
          onClick={() => setActiveTab('tools')}
        >
          <WrenchIcon size={16} color={activeTab === 'tools' ? '#33b5e5' : '#666'} />
          <span style={{ marginLeft: '8px' }}>TOOLS</span>
        </button>
        <button 
          style={{...tabButtonStyle, ...(activeTab === 'wallet' ? tabActiveStyle : {})}}
          onClick={() => setActiveTab('wallet')}
        >
          <DollarIcon size={16} color={activeTab === 'wallet' ? '#ffd700' : '#666'} />
          <span style={{ marginLeft: '8px' }}>WALLET</span>
        </button>
      </div>

      {/* Stats Dashboard */}
      {!loading && activeTab === 'friends' && <Dashboard friendships={friendships} recentActivity={recentActivity} />}
      
      {/* --- ADMIN LOCK SYSTEM --- */}
      {isAdmin && (
          !adminUnlocked ? (
              <AdminLock onUnlock={() => {
                  setAdminUnlocked(true);
                  showToast("ADMIN PRIVILEGES GRANTED", "SUCCESS");
              }} />
          ) : (
              <AdminPanel onRefresh={() => handleRefreshData("SYSTEM: NEW CONTRACT ISSUED")} />
          )
      )}

      {/* TAB CONTENT */}
      {activeTab === 'friends' && (
        loading ? (
          <div style={{color: 'white', textAlign: 'center', marginTop: '50px', fontFamily: 'var(--font-main)'}}>
              Connecting to Nen Network...
          </div>
        ) : friendships.length === 0 ? (
          <div style={{
            color: '#666', 
            textAlign: 'center', 
            marginTop: '50px', 
            fontFamily: 'var(--font-main)',
            padding: '40px'
          }}>
            <p style={{ fontSize: '1.2rem', marginBottom: '20px' }}>No friendships yet.</p>
            <p>Click "+ Add Friend" to get started!</p>
          </div>
        ) : (
          <div className="grid-container">
            {friendships.map((friendship, index) => (
              <NenCard 
                key={friendship.id}
                friendship={friendship}
                currentUserId={user.uid}
                index={index}
                isAdmin={isAdmin && adminUnlocked}
                onAction={handleAction}
                onPoke={handlePoke}
              />
            ))}
          </div>
        )
      )}
      {activeTab === 'achievements' && <AchievementShowcase />}
      {activeTab === 'arena' && (
        <Arena 
          friendships={friendships} 
          showToast={showToast}
          onCreateBounty={(friendship) => {
            setSelectedFriendship(friendship);
            setShowCreateBounty(true);
          }}
        />
      )}
      {activeTab === 'tools' && <Tools friendships={friendships} />}
      {activeTab === 'wallet' && <AuraWallet />}

      {/* Potclean - The Debt Collector Mascot */}
      {user && <Potclean friendships={friendships} />}

      {/* --- MODALS --- */}
      <AddFriendModal 
        isOpen={showAddFriend}
        onClose={() => setShowAddFriend(false)}
        showToast={showToast}
      />

      <CreateBountyModal
        isOpen={showCreateBounty}
        onClose={() => setShowCreateBounty(false)}
        friendship={selectedFriendship}
        showToast={showToast}
        onBountyCreated={() => checkForAchievements('BOUNTY_CREATED')}
      />

      <AchievementUnlockModal
        achievement={newAchievement}
        onClose={() => setNewAchievement(null)}
      />

      {(isAdmin && adminUnlocked) && (
        <SettleModal 
            isOpen={modalType === 'SETTLE'} 
            contract={selectedFriendship}
            friendship={selectedFriendship}
            onClose={closeModal} 
            onRefresh={handleRefreshData} 
            showToast={showToast} 
        />
      )}
      
      <CheckinModal
        isOpen={modalType === 'CHECKIN'}
        onClose={closeModal}
        friendship={selectedFriendship}
        showToast={showToast}
        onCheckinComplete={() => {
          loadData();
          checkForAchievements('CHECKIN', { hour: new Date().getHours() });
        }}
      />

      <VoiceCheckinModal
        isOpen={modalType === 'VOICE_CHECKIN'}
        onClose={closeModal}
        friendship={selectedFriendship}
        showToast={showToast}
        onCheckinComplete={() => {
          loadData();
          checkForAchievements('CHECKIN', { hour: new Date().getHours() });
        }}
      />

      <MercyRequestModal
        isOpen={modalType === 'MERCY_REQUEST'}
        onClose={closeModal}
        friendship={selectedFriendship}
        showToast={showToast}
        onRequestComplete={loadData}
      />

      <BailoutModal
        isOpen={modalType === 'BAILOUT'}
        onClose={closeModal}
        friendship={selectedFriendship}
        showToast={showToast}
        onBailoutComplete={loadData}
      />

      <AuraMarketplaceModal
        isOpen={showMarketplace}
        onClose={() => setShowMarketplace(false)}
        onBailout={(friendship) => {
          setShowMarketplace(false);
          handleAction('BAILOUT', friendship);
        }}
      />

      <PetitionModal 
          isOpen={modalType === 'PETITION'} 
          contract={selectedFriendship}
          friendship={selectedFriendship}
          onClose={closeModal}
          showToast={showToast}
      />

      <FriendshipSettingsModal
          isOpen={modalType === 'SETTINGS'}
          onClose={closeModal}
          friendship={selectedFriendship}
          showToast={showToast}
          onUpdate={loadData}
      />

      <DebtRouletteModal
          isOpen={modalType === 'ROULETTE'}
          onClose={closeModal}
          friendship={selectedFriendship}
          showToast={showToast}
          onRouletteComplete={() => {
            handleRefreshData('Debt Roulette spun');
            checkForAchievements('ROULETTE');
          }}
      />

      <FlexModal
          isOpen={modalType === 'FLEX'}
          onClose={closeModal}
          friendship={selectedFriendship}
          showToast={showToast}
      />

      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  )
}

// Tab Styles
const tabContainerStyle = {
  display: 'flex',
  gap: '10px',
  padding: '0 0 20px 0',
  overflowX: 'auto',
  borderBottom: '1px solid #222',
  marginBottom: '20px'
};

const tabButtonStyle = {
  display: 'flex',
  alignItems: 'center',
  padding: '12px 20px',
  background: 'transparent',
  border: '1px solid #333',
  borderRadius: '8px',
  color: '#666',
  fontSize: '0.8rem',
  fontWeight: 'bold',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  transition: 'all 0.3s ease',
  fontFamily: 'inherit'
};

const tabActiveStyle = {
  background: 'linear-gradient(145deg, #1a1a1a, #0a0a0a)',
  borderColor: '#ffd700',
  color: '#ffd700',
  boxShadow: '0 0 15px rgba(255, 215, 0, 0.2)'
};

export default App
