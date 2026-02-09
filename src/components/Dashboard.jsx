import { useRef, useState, useEffect } from 'react';
import CountUp from './CountUp';
import { calculateDebt, getDebtStatus } from '../utils/gameLogic';
import { UsersIcon, FlameIcon, Skull2Icon, TrendingUpIcon, AlertIcon, CrownIcon, ArrowUpIcon, ArrowDownIcon, TargetIcon } from './icons/Icons';

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

  // Calculate friends needing check-in
  const friendsNeedingCheckin = friendships.filter(f => {
    const myData = f.myPerspective === 'user1' ? f.user1Perspective : f.user2Perspective;
    const stats = calculateDebt({
      baseDebt: myData.baseDebt,
      lastInteraction: myData.lastInteraction,
      bankruptcyLimit: myData.limit
    });
    return stats.totalDebt > 0 && !stats.isBankrupt;
  }).length;

  // Simulate trend (in real app, compare with yesterday's data)
  const debtTrend = totalAPR > 0 ? 'up' : 'down';
  const trendColor = debtTrend === 'up' ? '#ff4444' : '#00e676';

  return (
    <div style={dashboardStyle}>
      {/* Mini Ticker - Thin strip at top */}
      <div style={miniTickerStyle}>
        <div className="ticker-wrap" style={{ border: 'none', background: 'transparent', padding: '4px 0' }}>
          <div className="ticker" style={{ color: '#00e676', fontSize: '0.7rem' }}>
            <span>{fullText}</span>
          </div>
        </div>
      </div>

      {/* Hero Section - Total Debt with Action */}
      <div style={heroSectionStyle}>
        <div style={{ 
          ...heroCardStyle, 
          borderColor: overallStatus.color,
          boxShadow: `0 0 40px ${overallStatus.color}15, inset 0 1px 0 ${overallStatus.color}20`
        }}>
          <div style={heroHeaderStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <TrendingUpIcon size={24} color={overallStatus.color} />
              <span style={{ ...heroLabelStyle, color: overallStatus.color }}>
                TOTAL OUTSTANDING
              </span>
            </div>
            {/* Mini Trend Indicator */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '4px 10px',
              background: `${trendColor}15`,
              borderRadius: '20px',
              fontSize: '0.75rem',
              color: trendColor
            }}>
              {debtTrend === 'up' ? <ArrowUpIcon size={14} /> : <ArrowDownIcon size={14} />}
              <span>vs yesterday</span>
            </div>
          </div>
          
          <div style={heroValueStyle}>
            <CountUp end={totalAPR} duration={2000} onFinish={handleFinish} />
            <span style={heroUnitStyle}>APR</span>
          </div>
          
          <div style={heroFooterStyle}>
            <div style={statusBadgeStyle(overallStatus.color, overallStatus.color + '20')}>
              {overallStatus.label}
            </div>
            
            {/* Quick Action */}
            {friendsNeedingCheckin > 0 && (
              <button 
                style={{
                  ...quickActionStyle,
                  background: overallStatus.color,
                  boxShadow: `0 4px 15px ${overallStatus.color}40`
                }}
                onClick={() => {
                  // Scroll to friends or trigger check-in
                  window.scrollTo({ top: 400, behavior: 'smooth' });
                }}
                onMouseEnter={(e) => {
                  e.target.style.transform = 'translateY(-2px)';
                  e.target.style.boxShadow = `0 6px 20px ${overallStatus.color}60`;
                }}
                onMouseLeave={(e) => {
                  e.target.style.transform = 'translateY(0)';
                  e.target.style.boxShadow = `0 4px 15px ${overallStatus.color}40`;
                }}
              >
                Check In Now ({friendsNeedingCheckin})
              </button>
            )}
          </div>
        </div>

        {/* Secondary Stats - Compact Row */}
        <div style={secondaryStatsStyle}>
          <CompactStat 
            icon={<UsersIcon size={16} color="#888" />}
            label="Friends"
            value={totalFriends}
            subValue={activeStreaks > 0 ? `${activeStreaks} streaking` : null}
          />
          <CompactStat 
            icon={<FlameIcon size={16} color="#ffd700" />}
            label="Streaks"
            value={activeStreaks}
            color="#ffd700"
          />
          <CompactStat 
            icon={<Skull2Icon size={16} color={bankruptcies > 0 ? '#ff4444' : '#666'} />}
            label="Bankrupt"
            value={bankruptcies}
            color={bankruptcies > 0 ? '#ff4444' : '#666'}
            alert={warningZone > 0 ? `${warningZone} warning` : null}
          />
        </div>
      </div>

      {/* Spotlight Section - Horizontal Row */}
      {(mostWanted || cleanest) && (
        <div style={spotlightRowStyle}>
          {mostWanted && (
            <SpotlightCard
              icon={<TargetIcon size={20} color="#ff4444" />}
              label="Most wanted"
              name={mostWanted.friend?.displayName}
              subtext={(() => {
                const isUser1 = mostWanted.myPerspective === 'user1';
                const myData = isUser1 ? mostWanted.user1Perspective : mostWanted.user2Perspective;
                const stats = calculateDebt({
                  baseDebt: myData.baseDebt,
                  lastInteraction: myData.lastInteraction,
                  bankruptcyLimit: myData.limit
                });
                return `${stats.totalDebt} APR owed`;
              })()}
              color="#ff4444"
            />
          )}

          {cleanest && (
            <SpotlightCard
              icon={<CrownIcon size={20} color="#ffd700" />}
              label="Hunter star"
              name={cleanest.friend?.displayName}
              subtext={`Debt free • ${cleanest.streak || 0} day streak`}
              color="#ffd700"
            />
          )}
        </div>
      )}
    </div>
  );
};

// Helper Components
const CompactStat = ({ icon, label, value, subValue, color = '#fff', alert }) => (
  <div style={compactStatStyle}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
      {icon}
      <span style={{ fontSize: '0.65rem', color: '#666', letterSpacing: '1px' }}>{label}</span>
    </div>
    <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color, lineHeight: '1' }}>
      {value}
    </div>
    {subValue && (
      <div style={{ fontSize: '0.7rem', color: '#00e676', marginTop: '2px' }}>{subValue}</div>
    )}
    {alert && (
      <div style={{ fontSize: '0.7rem', color: '#ff8800', marginTop: '2px' }}>⚠️ {alert}</div>
    )}
  </div>
);

const SpotlightCard = ({ icon, label, name, subtext, color }) => (
  <div style={{
    ...spotlightCardNewStyle,
    borderColor: `${color}30`,
    background: `linear-gradient(145deg, rgba(17,17,17,0.8), ${color}08)`
  }}>
    <div style={{
      width: '40px',
      height: '40px',
      borderRadius: '10px',
      background: `${color}15`,
      border: `1px solid ${color}30`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '1.2rem'
    }}>
      {icon}
    </div>
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: '0.6rem', letterSpacing: '1.5px', color: '#666', fontWeight: 'bold', marginBottom: '2px' }}>
        {label}
      </div>
      <div style={{ fontSize: '0.95rem', color: '#fff', fontWeight: 'bold', marginBottom: '2px' }}>
        {name}
      </div>
      <div style={{ fontSize: '0.75rem', color }}>
        {subtext}
      </div>
    </div>
  </div>
);

// Styles
const dashboardStyle = {
  marginBottom: '25px'
};

const miniTickerStyle = {
  background: '#0a0a0a',
  borderRadius: '8px',
  border: '1px solid #1a1a1a',
  marginBottom: '15px',
  overflow: 'hidden'
};

const heroSectionStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: '15px',
  marginBottom: '20px'
};

const heroCardStyle = {
  padding: '30px',
  borderRadius: '20px',
  border: '2px solid',
  background: 'linear-gradient(145deg, rgba(17,17,17,0.9), rgba(10,10,10,0.95))',
  backdropFilter: 'blur(20px)',
  display: 'flex',
  flexDirection: 'column',
  gap: '15px'
};

const heroHeaderStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center'
};

const heroLabelStyle = {
  fontSize: '0.8rem',
  letterSpacing: '2px',
  fontWeight: 'bold'
};

const heroValueStyle = {
  fontSize: '4.5rem',
  fontWeight: '900',
  color: '#fff',
  fontFamily: 'var(--font-main)',
  lineHeight: '1',
  textShadow: '0 0 30px rgba(255, 255, 255, 0.15)',
  display: 'flex',
  alignItems: 'baseline',
  gap: '12px'
};

const heroUnitStyle = {
  fontSize: '1.2rem',
  color: '#666',
  fontWeight: 'normal'
};

const heroFooterStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginTop: '5px'
};

const quickActionStyle = {
  padding: '10px 20px',
  border: 'none',
  borderRadius: '10px',
  color: '#000',
  fontSize: '0.85rem',
  fontWeight: 'bold',
  cursor: 'pointer',
  transition: 'all 0.2s ease'
};

const secondaryStatsStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, 1fr)',
  gap: '12px'
};

const compactStatStyle = {
  padding: '16px',
  background: 'linear-gradient(145deg, #111, #0a0a0a)',
  border: '1px solid #222',
  borderRadius: '12px',
  textAlign: 'center'
};

const spotlightRowStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
  gap: '12px'
};

const spotlightCardNewStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '15px',
  padding: '16px 20px',
  borderRadius: '14px',
  border: '1px solid',
  transition: 'all 0.2s ease'
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
