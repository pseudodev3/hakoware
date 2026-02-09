import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { calculateDebt } from '../utils/gameLogic';
import { CrystalBallIcon, SkullIcon, AlertIcon, TrendingUpIcon } from './icons/Icons';

const GhostPredictor = ({ friendships }) => {
  const { user } = useAuth();
  const [predictions, setPredictions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!friendships || friendships.length === 0) {
      setLoading(false);
      return;
    }

    // Calculate bankruptcy risk for each friendship
    const analyzed = friendships.map(f => {
      const isUser1 = f.myPerspective === 'user1';
      const myData = isUser1 ? f.user1Perspective : f.user2Perspective;
      const friend = isUser1 ? f.user2 : f.user1;
      
      const stats = calculateDebt({
        baseDebt: myData.baseDebt,
        lastInteraction: myData.lastInteraction,
        bankruptcyLimit: myData.limit
      });

      // Risk score: 0-100 (higher = more likely to go bankrupt)
      let riskScore = 0;
      let riskLevel = 'low';
      let prediction = '';

      if (stats.isBankrupt) {
        riskScore = 100;
        riskLevel = 'bankrupt';
        prediction = 'ALREADY BANKRUPT';
      } else if (stats.isInWarningZone) {
        riskScore = 75 + (stats.totalDebt / (myData.limit * 2)) * 25;
        riskLevel = 'critical';
        prediction = `Bankruptcy in ~${stats.daysUntilBankrupt} days`;
      } else if (stats.totalDebt > 0) {
        riskScore = (stats.totalDebt / myData.limit) * 50;
        riskLevel = riskScore > 25 ? 'medium' : 'low';
        prediction = riskScore > 25 ? 'Heading for trouble' : 'Safe for now';
      } else {
        riskScore = 0;
        riskLevel = 'safe';
        prediction = 'Debt free champion';
      }

      return {
        friendshipId: f.id,
        friendName: friend.displayName,
        riskScore: Math.round(riskScore),
        riskLevel,
        prediction,
        currentDebt: stats.totalDebt,
        daysUntilBankrupt: stats.daysUntilBankrupt,
        avatar: friend.displayName?.charAt(0)?.toUpperCase() || '?'
      };
    });

    // Sort by risk score (highest first)
    const sorted = analyzed.sort((a, b) => b.riskScore - a.riskScore);
    setPredictions(sorted);
    setLoading(false);
  }, [friendships]);

  const getRiskColor = (level) => {
    const colors = {
      safe: '#00e676',
      low: '#ffd700',
      medium: '#ff8800',
      critical: '#ff4444',
      bankrupt: '#880000'
    };
    return colors[level] || '#888';
  };

  const getRiskIcon = (level) => {
    switch (level) {
      case 'bankrupt': return <SkullIcon size={20} color="#ff4444" />;
      case 'critical': return <AlertIcon size={20} color="#ff4444" />;
      case 'medium': return <TrendingUpIcon size={20} color="#ff8800" />;
      default: return <CrystalBallIcon size={20} color="#00e676" />;
    }
  };

  if (loading) {
    return (
      <div style={containerStyle}>
        <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
          <div style={{ fontSize: '2rem', marginBottom: '10px' }}>🔮</div>
          <p>Consulting the spirits...</p>
        </div>
      </div>
    );
  }

  if (predictions.length === 0) {
    return (
      <div style={containerStyle}>
        <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
          <div style={{ fontSize: '2rem', marginBottom: '10px' }}>🔮</div>
          <p>No friendships to analyze.</p>
          <p style={{ fontSize: '0.8rem', color: '#444' }}>Add friends to see predictions!</p>
        </div>
      </div>
    );
  }

  const mostAtRisk = predictions[0];

  return (
    <div style={containerStyle}>
      {/* Header */}
      <div style={headerStyle}>
        <div style={crystalBallStyle}>
          <CrystalBallIcon size={28} color="#9c27b0" />
        </div>
        <div>
          <h2 style={{ margin: 0, color: '#9c27b0', fontSize: '1.2rem' }}>GHOST PREDICTOR</h2>
          <p style={{ margin: '5px 0 0 0', color: '#666', fontSize: '0.75rem' }}>
            AI-powered bankruptcy forecasting
          </p>
        </div>
      </div>

      {/* Most At Risk Card */}
      <div style={{
        ...featuredCardStyle,
        borderColor: getRiskColor(mostAtRisk.riskLevel),
        background: `${getRiskColor(mostAtRisk.riskLevel)}08`
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
          {getRiskIcon(mostAtRisk.riskLevel)}
          <span style={{ 
            color: getRiskColor(mostAtRisk.riskLevel), 
            fontSize: '0.7rem', 
            fontWeight: 'bold',
            letterSpacing: '1px'
          }}>
            MOST LIKELY TO GHOST
          </span>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <div style={{
            ...avatarStyle,
            borderColor: getRiskColor(mostAtRisk.riskLevel),
            boxShadow: `0 0 15px ${getRiskColor(mostAtRisk.riskLevel)}30`
          }}>
            {mostAtRisk.avatar}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ color: '#fff', fontWeight: 'bold', fontSize: '1.1rem' }}>
              {mostAtRisk.friendName}
            </div>
            <div style={{ color: getRiskColor(mostAtRisk.riskLevel), fontSize: '0.9rem' }}>
              {mostAtRisk.prediction}
            </div>
            <div style={{ color: '#666', fontSize: '0.75rem', marginTop: '3px' }}>
              Risk Score: {mostAtRisk.riskScore}/100 • {mostAtRisk.currentDebt} APR
            </div>
          </div>
        </div>
      </div>

      {/* Risk Meter */}
      <div style={riskMeterContainerStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
          <span style={{ fontSize: '0.7rem', color: '#666' }}>BANKRUPTCY RISK</span>
          <span style={{ fontSize: '0.7rem', color: getRiskColor(mostAtRisk.riskLevel) }}>
            {mostAtRisk.riskScore}%
          </span>
        </div>
        <div style={riskMeterTrackStyle}>
          <div style={{
            ...riskMeterFillStyle,
            width: `${mostAtRisk.riskScore}%`,
            background: `linear-gradient(90deg, ${getRiskColor('safe')}, ${getRiskColor('medium')}, ${getRiskColor('critical')})`
          }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '5px' }}>
          <span style={{ fontSize: '0.6rem', color: '#444' }}>Safe</span>
          <span style={{ fontSize: '0.6rem', color: '#444' }}>Doomed</span>
        </div>
      </div>

      {/* Full List */}
      <div style={listStyle}>
        <div style={{ fontSize: '0.7rem', color: '#666', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '1px' }}>
          All Predictions
        </div>
        {predictions.slice(0, 5).map((p, idx) => (
          <div key={p.friendshipId} style={predictionItemStyle}>
            <span style={{ color: '#444', fontSize: '0.8rem', width: '20px' }}>#{idx + 1}</span>
            <span style={{ color: '#fff', flex: 1, textAlign: 'left' }}>{p.friendName}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{
                ...riskDotStyle,
                background: getRiskColor(p.riskLevel),
                boxShadow: `0 0 8px ${getRiskColor(p.riskLevel)}`
              }} />
              <span style={{ color: getRiskColor(p.riskLevel), fontSize: '0.75rem', minWidth: '35px' }}>
                {p.riskScore}%
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div style={{ marginTop: '15px', padding: '12px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px' }}>
        <p style={{ margin: 0, fontSize: '0.7rem', color: '#555', textAlign: 'center' }}>
          💀 Prediction accuracy: ~73% | Updated in real-time
        </p>
      </div>
    </div>
  );
};

const containerStyle = {
  background: 'linear-gradient(145deg, #111, #0a0a0a)',
  border: '1px solid #222',
  borderRadius: '16px',
  padding: '20px',
  marginBottom: '20px'
};

const headerStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  marginBottom: '20px',
  paddingBottom: '15px',
  borderBottom: '1px solid #222'
};

const crystalBallStyle = {
  width: '45px',
  height: '45px',
  borderRadius: '50%',
  background: 'rgba(156,39,176,0.1)',
  border: '1px solid rgba(156,39,176,0.3)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  animation: 'pulse-glow 2s ease-in-out infinite'
};

const featuredCardStyle = {
  padding: '20px',
  border: '1px solid',
  borderRadius: '12px',
  marginBottom: '15px'
};

const avatarStyle = {
  width: '45px',
  height: '45px',
  borderRadius: '50%',
  background: 'rgba(0,0,0,0.3)',
  border: '2px solid',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: '#fff',
  fontWeight: 'bold',
  fontSize: '1.2rem'
};

const riskMeterContainerStyle = {
  marginBottom: '15px'
};

const riskMeterTrackStyle = {
  height: '8px',
  background: '#1a1a1a',
  borderRadius: '4px',
  overflow: 'hidden'
};

const riskMeterFillStyle = {
  height: '100%',
  borderRadius: '4px',
  transition: 'width 1s ease'
};

const listStyle = {
  maxHeight: '200px',
  overflowY: 'auto'
};

const predictionItemStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  padding: '10px',
  background: 'rgba(0,0,0,0.2)',
  borderRadius: '8px',
  marginBottom: '8px'
};

const riskDotStyle = {
  width: '8px',
  height: '8px',
  borderRadius: '50%'
};

export default GhostPredictor;
