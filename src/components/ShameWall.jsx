import { useState, useEffect } from 'react';
import { SkullIcon, FlameIcon, MessageIcon } from './icons/Icons';

const ShameWall = () => {
  const [bankruptcies, setBankruptcies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTimeframe, setSelectedTimeframe] = useState('week');
  const [roasts, setRoasts] = useState({});

  const roastTemplates = [
    "Couldn't even text back... embarrassing.",
    "Their phone must be a decorative object at this point.",
    "Ghosted so hard they entered the spirit realm.",
    "Friendship? Never heard of her.",
    "Probably too busy... doing nothing.",
    "Should have bought the 'Being a Friend' DLC.",
    "Their read receipts are just for decoration.",
    "Living that Chapter 7 lifestyle.",
    "Even Toritaten is disappointed.",
    "Phone battery: 100%. Effort: 0%."
  ];

  useEffect(() => {
    loadBankruptcies();
    
    // Real-time listener for new bankruptcies (simplified query without composite index)
    const unsubscribe = onSnapshot(
      query(
        collection( 'bankruptcyHistory'),
        where('resolvedAt', '==', null)
      ),
      (snapshot) => {
        // Sort client-side
        const data = snapshot.docs
          .map(doc => ({
            id: doc.id,
            ...doc.data(),
            declaredAt: doc.data().declaredAt?.toDate?.() || new Date()
          }))
          .sort((a, b) => b.declaredAt - a.declaredAt)
          .slice(0, 20);
        setBankruptcies(data);
        setLoading(false);
        
        // Generate roasts for each
        const newRoasts = {};
        data.forEach(b => {
          if (!roasts[b.id]) {
            newRoasts[b.id] = roastTemplates[Math.floor(Math.random() * roastTemplates.length)];
          }
        });
        setRoasts(prev => ({ ...prev, ...newRoasts }));
      }
    );

    return () => unsubscribe();
  }, []);

  const loadBankruptcies = async () => {
    setLoading(true);
    try {
      // Simple query without composite index requirement
      const q = query(
        collection( 'bankruptcyHistory'),
        where('resolvedAt', '==', null)
      );
      
      const snapshot = await getDocs(q);
      const data = snapshot.docs
        .map(doc => ({
          id: doc.id,
          ...doc.data(),
          declaredAt: doc.data().declaredAt?.toDate?.() || new Date()
        }))
        .sort((a, b) => b.declaredAt - a.declaredAt)
        .slice(0, 20);
      
      setBankruptcies(data);
      
      // Generate random roasts
      const newRoasts = {};
      data.forEach(b => {
        newRoasts[b.id] = roastTemplates[Math.floor(Math.random() * roastTemplates.length)];
      });
      setRoasts(newRoasts);
    } catch (error) {
      console.error('Error loading shame wall:', error);
    }
    setLoading(false);
  };

  const formatTimeAgo = (date) => {
    const now = new Date();
    const diff = now - date;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor(diff / (1000 * 60));
    
    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'just now';
  };

  if (loading) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
        Loading Wall of Shame...
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      {/* Header */}
      <div style={headerStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <SkullIcon size={28} color="#ff4444" />
          <div>
            <h2 style={{ margin: 0, color: '#ff4444', fontSize: '1.3rem' }}>Wall of Shame</h2>
            <p style={{ margin: '4px 0 0 0', color: '#666', fontSize: '0.75rem' }}>
              Public Bankruptcies • Live Feed
            </p>
          </div>
        </div>
        
        <div style={liveIndicatorStyle}>
          <span style={pulseDotStyle} />
          LIVE
        </div>
      </div>

      {/* Stats Bar */}
      <div style={statsBarStyle}>
        <div style={statItemStyle}>
          <span style={{ color: '#ff4444', fontSize: '1.5rem', fontWeight: 'bold' }}>
            {bankruptcies.length}
          </span>
          <span style={{ color: '#666', fontSize: '0.7rem' }}>Currently bankrupt</span>
        </div>
        <div style={{ width: '1px', height: '30px', background: '#333' }} />
        <div style={statItemStyle}>
          <span style={{ color: '#ffd700', fontSize: '1.5rem', fontWeight: 'bold' }}>
            {bankruptcies.reduce((acc, b) => acc + (b.debtAtBankruptcy || 0), 0)}
          </span>
          <span style={{ color: '#666', fontSize: '0.7rem' }}>Total APR lost</span>
        </div>
        <div style={{ width: '1px', height: '30px', background: '#333' }} />
        <div style={statItemStyle}>
          <span style={{ color: '#ff8800', fontSize: '1.5rem', fontWeight: 'bold' }}>
            {bankruptcies.length > 0 
              ? Math.round(bankruptcies.reduce((acc, b) => acc + (b.debtAtBankruptcy || 0), 0) / bankruptcies.length)
              : 0}
          </span>
          <span style={{ color: '#666', fontSize: '0.7rem' }}>Avg debt</span>
        </div>
      </div>

      {/* Bankruptcy List */}
      <div style={listStyle}>
        {bankruptcies.length === 0 ? (
          <div style={emptyStateStyle}>
            <div style={{ fontSize: '3rem', marginBottom: '10px' }}>✨</div>
            <p style={{ color: '#666', margin: 0 }}>No bankruptcies currently!</p>
            <p style={{ color: '#444', fontSize: '0.8rem', margin: '5px 0 0 0' }}>
              Everyone is being a good friend for once.
            </p>
          </div>
        ) : (
          bankruptcies.map((bankruptcy, index) => (
            <div 
              key={bankruptcy.id}
              style={{
                ...itemStyle,
                animationDelay: `${index * 0.1}s`
              }}
            >
              {/* Rank */}
              <div style={rankStyle}>
                #{index + 1}
              </div>

              {/* Avatar Placeholder */}
              <div style={avatarStyle}>
                <span style={{ fontSize: '1.5rem' }}>
                  {index < 3 ? '💀' : '👤'}
                </span>
              </div>

              {/* Content */}
              <div style={contentStyle}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '5px' }}>
                  <span style={{ color: '#fff', fontWeight: 'bold', fontSize: '1rem' }}>
                    {bankruptcy.userName}
                  </span>
                  <span style={{ color: '#444' }}>→</span>
                  <span style={{ color: '#888', fontSize: '0.9rem' }}>
                    {bankruptcy.friendName}
                  </span>
                </div>
                
                <p style={{ 
                  margin: '0 0 8px 0', 
                  color: '#ff6666', 
                  fontSize: '0.85rem',
                  fontStyle: 'italic'
                }}>
                  "{roasts[bankruptcy.id] || roastTemplates[0]}"
                </p>

                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                  <span style={{ 
                    color: '#ff4444', 
                    fontWeight: 'bold',
                    fontSize: '0.9rem'
                  }}>
                    {bankruptcy.debtAtBankruptcy} APR
                  </span>
                  <span style={{ color: '#444', fontSize: '0.75rem' }}>•</span>
                  <span style={{ color: '#666', fontSize: '0.75rem' }}>
                    {bankruptcy.daysGhosted} days ghosted
                  </span>
                  <span style={{ color: '#444', fontSize: '0.75rem' }}>•</span>
                  <span style={{ color: '#888', fontSize: '0.75rem' }}>
                    {formatTimeAgo(bankruptcy.declaredAt)}
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div style={actionsStyle}>
                <button style={shameButtonStyle}>
                  <FlameIcon size={16} color="#ff4444" />
                  <span style={{ fontSize: '0.75rem' }}>Shame</span>
                </button>
                <button style={roastButtonStyle}>
                  <MessageIcon size={16} color="#888" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div style={footerStyle}>
        <p style={{ margin: 0, color: '#444', fontSize: '0.75rem' }}>
          💡 Tip: Check in daily to avoid appearing here. Or don't. We're not your mom.
        </p>
      </div>
    </div>
  );
};

// Styles
const containerStyle = {
  background: 'linear-gradient(145deg, #111, #0a0a0a)',
  border: '1px solid #222',
  borderRadius: '16px',
  overflow: 'hidden',
  marginBottom: '20px'
};

const headerStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '20px 25px',
  borderBottom: '1px solid #222',
  background: 'linear-gradient(90deg, rgba(255,68,68,0.05) 0%, transparent 100%)'
};

const liveIndicatorStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  color: '#ff4444',
  fontSize: '0.75rem',
  fontWeight: 'bold',
  letterSpacing: '2px'
};

const pulseDotStyle = {
  width: '8px',
  height: '8px',
  background: '#ff4444',
  borderRadius: '50%',
  animation: 'pulse 2s infinite'
};

const statsBarStyle = {
  display: 'flex',
  justifyContent: 'space-around',
  padding: '15px',
  background: '#0a0a0a',
  borderBottom: '1px solid #1a1a1a'
};

const statItemStyle = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '4px'
};

const listStyle = {
  maxHeight: '400px',
  overflowY: 'auto',
  padding: '15px'
};

const itemStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '15px',
  padding: '15px',
  background: 'rgba(255,68,68,0.03)',
  border: '1px solid #2a1a1a',
  borderRadius: '12px',
  marginBottom: '10px',
  transition: 'all 0.3s ease',
  animation: 'slideIn 0.5s ease forwards',
  ':hover': {
    background: 'rgba(255,68,68,0.08)',
    borderColor: '#3a1a1a'
  }
};

const rankStyle = {
  width: '30px',
  height: '30px',
  borderRadius: '50%',
  background: '#1a1a1a',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: '#666',
  fontSize: '0.75rem',
  fontWeight: 'bold',
  flexShrink: 0
};

const avatarStyle = {
  width: '45px',
  height: '45px',
  borderRadius: '50%',
  background: '#1a0000',
  border: '1px solid #3a0000',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0
};

const contentStyle = {
  flex: 1,
  minWidth: 0
};

const actionsStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: '8px'
};

const shameButtonStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  padding: '8px 12px',
  background: 'rgba(255,68,68,0.1)',
  border: '1px solid #ff4444',
  borderRadius: '6px',
  color: '#ff4444',
  cursor: 'pointer',
  transition: 'all 0.2s',
  ':hover': {
    background: 'rgba(255,68,68,0.2)'
  }
};

const roastButtonStyle = {
  padding: '8px',
  background: 'transparent',
  border: '1px solid #333',
  borderRadius: '6px',
  cursor: 'pointer',
  transition: 'all 0.2s'
};

const emptyStateStyle = {
  textAlign: 'center',
  padding: '40px 20px'
};

const footerStyle = {
  padding: '15px 25px',
  background: '#0a0a0a',
  borderTop: '1px solid #1a1a1a',
  textAlign: 'center'
};

// Add keyframes once
if (typeof document !== 'undefined' && !document.getElementById('shame-wall-styles')) {
  const styleSheet = document.createElement('style');
  styleSheet.id = 'shame-wall-styles';
  styleSheet.textContent = `
    @keyframes pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.5; transform: scale(1.1); }
    }
    @keyframes slideIn {
      from { opacity: 0; transform: translateX(-20px); }
      to { opacity: 1; transform: translateX(0); }
    }
  `;
  document.head.appendChild(styleSheet);
}

export default ShameWall;
