import { useRef } from 'react';
import CountUp from './CountUp';
import { calculateDebt, getDebtStatus } from '../utils/gameLogic';
import { UsersIcon, FlameIcon, Skull2Icon, TrendingUpIcon, AlertIcon, CrownIcon } from './icons/Icons';

const Dashboard = ({ friendships, recentActivity }) => {
  const sfxCoin = useRef(new Audio('https://www.myinstants.com/media/sounds/ka-ching.mp3'));

  // Calculate total APR across all friendships (what user owes)
  const totalAPR = friendships.reduce((acc, friendship) => {
    const isUser1 = friendship.myPerspective === 'user1';
    const myData = isUser1 ? friendship.user1Perspective : friendship.user2Perspective;
    const stats = calculateDebt({
      baseDebt: myData.baseDebt,
      lastInteraction: myData.lastInteraction,
      bankruptcyLimit: myData.limit
    });
    return acc + stats.totalDebt;
  }, 0);

  // Find most wanted (highest debt)
  const mostWanted = [...friendships].sort((a, b) => {
    const aStats = calculateDebt({
      baseDebt: a.myPerspective === 'user1' ? a.user1Perspective.baseDebt : a.user2Perspective.baseDebt,
      lastInteraction: a.myPerspective === 'user1' ? a.user1Perspective.lastInteraction : a.user2Perspective.lastInteraction,
      bankruptcyLimit: a.myPerspective === 'user1' ? a.user1Perspective.limit : a.user2Perspective.limit
    });
    const bStats = calculateDebt({
      baseDebt: b.myPerspective === 'user1' ? b.user1Perspective.baseDebt : b.user2Perspective.baseDebt,
      lastInteraction: b.myPerspective === 'user1' ? b.user1Perspective.lastInteraction : b.user2Perspective.lastInteraction,
      bankruptcyLimit: b.myPerspective === 'user1' ? b.user1Perspective.limit : b.user2Perspective.limit
    });
    return bStats.totalDebt - aStats.totalDebt;
  })[0];

  // Find cleanest friend (debt free)
  const cleanest = friendships.find(f => {
    const myData = f.myPerspective === 'user1' ? f.user1Perspective : f.user2Perspective;
    const stats = calculateDebt({
      baseDebt: myData.baseDebt,
      lastInteraction: myData.lastInteraction,
      bankruptcyLimit: myData.limit
    });
    return stats.totalDebt === 0;
  });

  // Calculate stats
  const totalFriends = friendships.length;
  const activeStreaks = friendships.filter(f => f.streak > 0).length;
  const bankruptcies = friendships.filter(f => {
    const myData = f.myPerspective === 'user1' ? f.user1Perspective : f.user2Perspective;
    const stats = calculateDebt({
      baseDebt: myData.baseDebt,
      lastInteraction: myData.lastInteraction,
      bankruptcyLimit: myData.limit
    });
    return stats.isBankrupt;
  }).length;

  const warningZone = friendships.filter(f => {
    const myData = f.myPerspective === 'user1' ? f.user1Perspective : f.user2Perspective;
    const stats = calculateDebt({
      baseDebt: myData.baseDebt,
      lastInteraction: myData.lastInteraction,
      bankruptcyLimit: myData.limit
    });
    return stats.isInWarningZone && !stats.isBankrupt;
  }).length;

  const handleFinish = () => {
    sfxCoin.current.volume = 1.0; 
    sfxCoin.current.play().catch(e => console.log("Sound blocked:", e));
  };

  // Determine overall status
  const overallStatus = getDebtStatus(totalAPR, 7);
  
  // Calculate debt for most wanted (for ticker display)
  const getMostWantedDebt = () => {
    if (!mostWanted) return 0;
    const myData = mostWanted.myPerspective === 'user1' ? mostWanted.user1Perspective : mostWanted.user2Perspective;
    const stats = calculateDebt({
      baseDebt: myData.baseDebt,
      lastInteraction: myData.lastInteraction,
      bankruptcyLimit: myData.limit
    });
    return stats.totalDebt;
  };

  // Ticker Text Parts
  const msg1 = ":: NEN CONSUMER FINANCE :: INTEREST RATES AT 1% DAILY";
  const msg2 = mostWanted ? `MOST WANTED: ${mostWanted.friend?.displayName?.toUpperCase() || 'UNKNOWN'} (${getMostWantedDebt()} APR)` : "";
  const msg3 = cleanest ? `HUNTER STAR: ${cleanest.friend?.displayName?.toUpperCase() || 'UNKNOWN'}` : "";
  const msg4 = recentActivity ? ` // ${recentActivity} // ` : "";
  const msg5 = `STATS: ${totalFriends} FRIENDS | ${activeStreaks} STREAKS | ${bankruptcies} BANKRUPTCIES`;

  const fullText = `${msg1}   ${msg4}   ${msg2}   ${msg3}   ${msg5}   :: FAILURE TO PAY WILL RESULT IN EXCOMMUNICATION ::`;

  return (
    <div style={dashboardStyle}>
      {/* Main Stats Grid */}
      <div style={statsGridStyle}>
        {/* Total Debt Card */}
        <div style={{ ...cardStyle, ...glassCardStyle, borderColor: overallStatus.color }}>
          <div style={cardHeaderStyle}>
            <TrendingUpIcon size={18} color={overallStatus.color} />
            <span style={{ ...cardLabelStyle, color: overallStatus.color }}>
              TOTAL OUTSTANDING
            </span>
          </div>
          <div style={mainValueStyle}>
            <CountUp end={totalAPR} duration={2000} onFinish={handleFinish} />
            <span style={unitStyle}>APR</span>
          </div>
          <div style={statusBadgeStyle(overallStatus.color, overallStatus.color + '20')}>
            {overallStatus.label}
          </div>
        </div>

        {/* Friends Card */}
        <div style={{ ...cardStyle, ...glassCardStyle }}>
          <div style={cardHeaderStyle}>
            <UsersIcon size={18} color="#888" />
            <span style={cardLabelStyle}>ACTIVE FRIENDSHIPS</span>
          </div>
          <div style={secondaryValueStyle}>{totalFriends}</div>
          <div style={subInfoStyle}>
            {activeStreaks > 0 && (
              <span style={{ color: '#00e676' }}>{activeStreaks} with streaks</span>
            )}
          </div>
        </div>

        {/* Streaks Card */}
        <div style={{ ...cardStyle, ...glassCardStyle }}>
          <div style={cardHeaderStyle}>
            <FlameIcon size={18} color="#ff8800" />
            <span style={cardLabelStyle}>ACTIVE STREAKS</span>
          </div>
          <div style={{ ...secondaryValueStyle, color: activeStreaks > 0 ? '#ff8800' : '#666' }}>
            {activeStreaks}
          </div>
          <div style={subInfoStyle}>
            {activeStreaks === 0 && 'Start checking in daily!'}
          </div>
        </div>

        {/* Bankruptcies Card */}
        <div style={{ 
          ...cardStyle, 
          ...glassCardStyle, 
          ...(bankruptcies > 0 ? glassRedStyle : {})
        }}>
          <div style={cardHeaderStyle}>
            <Skull2Icon size={18} color={bankruptcies > 0 ? '#ff4444' : '#666'} />
            <span style={{ ...cardLabelStyle, color: bankruptcies > 0 ? '#ff4444' : '#888' }}>
              BANKRUPTCIES
            </span>
          </div>
          <div style={{ ...secondaryValueStyle, color: bankruptcies > 0 ? '#ff4444' : '#666' }}>
            {bankruptcies}
          </div>
          <div style={subInfoStyle}>
            {warningZone > 0 && (
              <span style={{ color: '#ff8800' }}>⚠️ {warningZone} in warning zone</span>
            )}
          </div>
        </div>
      </div>

      {/* Spotlight Section */}
      {(mostWanted || cleanest) && (
        <div style={spotlightGridStyle}>
          {mostWanted && (
            <div style={{ ...spotlightCardStyle, ...glassRedStyle }}>
              <div style={spotlightIconStyle}>🎯</div>
              <div>
                <div style={spotlightLabelStyle}>MOST WANTED</div>
                <div style={spotlightValueStyle}>{mostWanted.friend?.displayName}</div>
                <div style={{ ...spotlightSubStyle, color: '#ff4444' }}>
                  {(() => {
                    const isUser1 = mostWanted.myPerspective === 'user1';
                    const myData = isUser1 ? mostWanted.user1Perspective : mostWanted.user2Perspective;
                    const stats = calculateDebt({
                      baseDebt: myData.baseDebt,
                      lastInteraction: myData.lastInteraction,
                      bankruptcyLimit: myData.limit
                    });
                    return `${stats.totalDebt} APR owed`;
                  })()}
                </div>
              </div>
            </div>
          )}

          {cleanest && (
            <div style={{ ...spotlightCardStyle, ...glassGreenStyle }}>
              <div style={spotlightIconStyle}>
                <CrownIcon size={24} color="#00e676" />
              </div>
              <div>
                <div style={spotlightLabelStyle}>HUNTER STAR</div>
                <div style={spotlightValueStyle}>{cleanest.friend?.displayName}</div>
                <div style={{ ...spotlightSubStyle, color: '#00e676' }}>
                  Debt Free • {cleanest.streak || 0} day streak
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Ticker */}
      <div style={tickerContainerStyle}>
        <div className="ticker-wrap" style={{ border: 'none', background: 'transparent' }}>
          <div className="ticker" style={{ color: '#00e676' }}>
            <span>{fullText}</span>
            <span style={{ display: 'inline-block', width: '50px' }}></span>
            <span>{fullText}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

// Styles
const dashboardStyle = {
  marginBottom: '25px'
};

const statsGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
  gap: '15px',
  marginBottom: '15px'
};

const spotlightGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
  gap: '15px',
  marginBottom: '15px'
};

const cardStyle = {
  padding: '20px',
  borderRadius: '16px',
  border: '1px solid #222',
  display: 'flex',
  flexDirection: 'column',
  gap: '10px'
};

const glassCardStyle = {
  background: 'rgba(17, 17, 17, 0.6)',
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
  boxShadow: '0 4px 30px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.05)'
};

const glassRedStyle = {
  background: 'rgba(255, 68, 68, 0.08)',
  borderColor: 'rgba(255, 68, 68, 0.2)',
  boxShadow: '0 0 30px rgba(255, 68, 68, 0.1), inset 0 1px 0 rgba(255, 68, 68, 0.1)'
};

const glassGreenStyle = {
  background: 'rgba(0, 230, 118, 0.08)',
  borderColor: 'rgba(0, 230, 118, 0.2)',
  boxShadow: '0 0 30px rgba(0, 230, 118, 0.1), inset 0 1px 0 rgba(0, 230, 118, 0.1)'
};

const cardHeaderStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  marginBottom: '5px'
};

const cardLabelStyle = {
  fontSize: '0.7rem',
  letterSpacing: '1.5px',
  color: '#888',
  fontWeight: 'bold'
};

const mainValueStyle = {
  fontSize: '3rem',
  fontWeight: '900',
  color: '#fff',
  fontFamily: 'var(--font-main)',
  lineHeight: '1',
  textShadow: '0 0 20px rgba(255, 255, 255, 0.1)'
};

const secondaryValueStyle = {
  fontSize: '2rem',
  fontWeight: 'bold',
  color: '#fff',
  fontFamily: 'var(--font-main)',
  lineHeight: '1'
};

const unitStyle = {
  fontSize: '0.9rem',
  color: '#666',
  marginLeft: '8px',
  fontWeight: 'normal'
};

const subInfoStyle = {
  fontSize: '0.75rem',
  color: '#666',
  minHeight: '16px'
};

const statusBadgeStyle = (color, bgColor) => ({
  display: 'inline-flex',
  alignSelf: 'flex-start',
  padding: '4px 12px',
  borderRadius: '20px',
  fontSize: '0.65rem',
  fontWeight: 'bold',
  letterSpacing: '1px',
  color: color,
  background: bgColor,
  border: `1px solid ${color}40`,
  marginTop: '5px'
});

const spotlightCardStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '15px',
  padding: '20px',
  borderRadius: '16px',
  border: '1px solid #222'
};

const spotlightIconStyle = {
  width: '50px',
  height: '50px',
  borderRadius: '12px',
  background: 'rgba(0,0,0,0.3)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '1.5rem'
};

const spotlightLabelStyle = {
  fontSize: '0.65rem',
  letterSpacing: '2px',
  color: '#888',
  fontWeight: 'bold',
  marginBottom: '4px'
};

const spotlightValueStyle = {
  fontSize: '1.1rem',
  color: '#fff',
  fontWeight: 'bold',
  marginBottom: '2px'
};

const spotlightSubStyle = {
  fontSize: '0.8rem'
};

const tickerContainerStyle = {
  background: '#0a0a0a',
  borderRadius: '12px',
  border: '1px solid #1a1a1a',
  overflow: 'hidden',
  padding: '8px 0'
};

export default Dashboard;
