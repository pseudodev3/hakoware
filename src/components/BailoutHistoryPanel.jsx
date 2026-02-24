import { useState, useEffect } from 'react';
import { getUserBailoutHistory } from '../services/bankruptcyService';
import { useAuth } from '../contexts/AuthContext';
import { DollarIcon, ChevronDownIcon, ChevronUpIcon, ArrowRightIcon, ArrowLeftIcon } from './icons/Icons';

const BailoutHistoryPanel = () => {
  const { user } = useAuth();
  const [bailouts, setBailouts] = useState({ given: [], received: [], all: [] });
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [filter, setFilter] = useState('all'); // 'all', 'given', 'received'

  useEffect(() => {
    loadBailouts();
  }, [user]);

  const loadBailouts = async () => {
    setLoading(true);
    const data = await getUserBailoutHistory(user.uid);
    setBailouts(data);
    setLoading(false);
  };

  const getFilteredBailouts = () => {
    if (filter === 'given') return bailouts.given;
    if (filter === 'received') return bailouts.received;
    return bailouts.all;
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'Unknown';
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  const filteredBailouts = getFilteredBailouts();
  const totalGiven = Array.isArray(bailouts?.given) ? bailouts.given.reduce((sum, b) => sum + (b.amount || 0), 0) : 0;
  const totalReceived = Array.isArray(bailouts?.received) ? bailouts.received.reduce((sum, b) => sum + (b.amount || 0), 0) : 0;

  if (loading) return null;
  if (!Array.isArray(bailouts?.all) || bailouts.all.length === 0) return null;

  return (
    <div style={containerStyle}>
      <button 
        onClick={() => setExpanded(!expanded)}
        style={headerStyle}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <DollarIcon size={18} color="#00e676" />
          <span>Bailout history</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ color: '#666', fontSize: '0.8rem' }}>
            {bailouts?.all?.length || 0} total
          </span>
          {expanded ? (
            <ChevronUpIcon size={18} color="#666" />
          ) : (
            <ChevronDownIcon size={18} color="#666" />
          )}
        </div>
      </button>

      {expanded && (
        <div style={contentStyle}>
          {/* Summary Stats */}
          <div style={{
            display: 'flex',
            gap: '15px',
            marginBottom: '15px',
            padding: '12px',
            background: 'rgba(0,0,0,0.2)',
            borderRadius: '8px'
          }}>
            <div style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ fontSize: '0.7rem', color: '#555', marginBottom: '4px' }}>Given</div>
              <div style={{ color: '#ff4444', fontWeight: 'bold', fontSize: '1.1rem' }}>
                -{totalGiven} APR
              </div>
            </div>
            <div style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ fontSize: '0.7rem', color: '#555', marginBottom: '4px' }}>Received</div>
              <div style={{ color: '#00e676', fontWeight: 'bold', fontSize: '1.1rem' }}>
                +{totalReceived} APR
              </div>
            </div>
            <div style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ fontSize: '0.7rem', color: '#555', marginBottom: '4px' }}>NET</div>
              <div style={{ 
                color: totalReceived - totalGiven >= 0 ? '#00e676' : '#ff4444', 
                fontWeight: 'bold',
                fontSize: '1.1rem'
              }}>
                {totalReceived - totalGiven >= 0 ? '+' : ''}{totalReceived - totalGiven} APR
              </div>
            </div>
          </div>

          {/* Filter Tabs */}
          <div style={{ 
            display: 'flex', 
            gap: '8px', 
            marginBottom: '15px'
          }}>
            {['all', 'given', 'received'].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                style={{
                  flex: 1,
                  padding: '8px',
                  background: filter === f ? 'rgba(0,230,118,0.1)' : 'transparent',
                  color: filter === f ? '#00e676' : '#666',
                  border: `1px solid ${filter === f ? '#00e676' : '#333'}`,
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '0.75rem',
                  textTransform: 'uppercase',
                  fontWeight: 600
                }}
              >
                {f}
              </button>
            ))}
          </div>

          {/* Bailout List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {filteredBailouts.slice(0, 10).map((bailout) => (
              <div 
                key={bailout.id} 
                style={{
                  padding: '12px',
                  background: 'rgba(0,0,0,0.2)',
                  borderRadius: '8px',
                  borderLeft: `3px solid ${bailout.type === 'given' ? '#ff4444' : '#00e676'}`,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px'
                }}
              >
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  background: bailout.type === 'given' 
                    ? 'rgba(255,68,68,0.1)' 
                    : 'rgba(0,230,118,0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  {bailout.type === 'given' ? (
                    <ArrowRightIcon size={16} color="#ff4444" />
                  ) : (
                    <ArrowLeftIcon size={16} color="#00e676" />
                  )}
                </div>

                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#fff', fontWeight: 600, fontSize: '0.9rem' }}>
                      {bailout.type === 'given' ? (
                        <>You → {bailout.toUserName}</>
                      ) : (
                        <>{bailout.fromUserName} → You</>
                      )}
                    </span>
                    <span style={{ 
                      color: bailout.type === 'given' ? '#ff4444' : '#00e676',
                      fontWeight: 'bold',
                      fontSize: '0.9rem'
                    }}>
                      {bailout.type === 'given' ? '-' : '+'}{bailout.amount} APR
                    </span>
                  </div>
                  
                  {/* Message is now more prominent */}
                  {bailout.message && (
                    <div style={{ 
                      background: bailout.type === 'given' ? 'rgba(255,68,68,0.1)' : 'rgba(0,230,118,0.1)',
                      border: bailout.type === 'given' ? '1px solid rgba(255,68,68,0.2)' : '1px solid rgba(0,230,118,0.2)',
                      borderRadius: '6px',
                      padding: '8px 10px',
                      marginTop: '8px',
                      marginBottom: '6px'
                    }}>
                      <div style={{ 
                        color: bailout.type === 'given' ? '#ff8888' : '#00e676', 
                        fontSize: '0.7rem', 
                        marginBottom: '2px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px'
                      }}>
                        {bailout.type === 'given' ? 'Your message to them' : 'Their message to you'}
                      </div>
                      <div style={{ 
                        color: '#ccc', 
                        fontSize: '0.85rem',
                        fontStyle: 'italic'
                      }}>
                        "{bailout.message}"
                      </div>
                    </div>
                  )}
                  
                  <div style={{ color: '#555', fontSize: '0.7rem' }}>
                    {formatDate(bailout.createdAt)}
                  </div>
                </div>
              </div>
            ))}

            {filteredBailouts.length === 0 && (
              <div style={{ textAlign: 'center', padding: '20px', color: '#666' }}>
                No bailouts found
              </div>
            )}

            {filteredBailouts.length > 10 && (
              <div style={{ textAlign: 'center', padding: '10px', color: '#555', fontSize: '0.8rem' }}>
                +{filteredBailouts.length - 10} more bailouts
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const containerStyle = {
  margin: '0 20px 20px',
  background: 'rgba(0,230,118,0.02)',
  border: '1px solid rgba(0,230,118,0.1)',
  borderRadius: '12px',
  overflow: 'hidden'
};

const headerStyle = {
  width: '100%',
  padding: '16px 20px',
  background: 'transparent',
  border: 'none',
  color: '#888',
  fontSize: '0.85rem',
  fontWeight: 600,
  cursor: 'pointer',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  letterSpacing: '1px',
  transition: 'color 0.2s'
};

const contentStyle = {
  padding: '0 20px 20px'
};

export default BailoutHistoryPanel;
