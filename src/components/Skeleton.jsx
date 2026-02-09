/**
 * Skeleton Loading Component
 * Shimmer effect for loading states
 */

const Skeleton = ({ 
  width = '100%', 
  height = '20px', 
  circle = false,
  style = {} 
}) => {
  return (
    <div
      style={{
        width,
        height,
        borderRadius: circle ? '50%' : '4px',
        background: 'linear-gradient(90deg, #1a1a1a 25%, #2a2a2a 50%, #1a1a1a 75%)',
        backgroundSize: '200% 100%',
        animation: 'shimmer 1.5s infinite',
        ...style
      }}
    />
  );
};

// Pre-built skeleton layouts
export const CardSkeleton = () => (
  <div style={{
    background: 'linear-gradient(145deg, #111, #0a0a0a)',
    border: '1px solid #222',
    borderRadius: '16px',
    padding: '20px'
  }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
      <Skeleton width="40px" height="40px" circle />
      <div style={{ flex: 1 }}>
        <Skeleton width="60%" height="16px" style={{ marginBottom: '8px' }} />
        <Skeleton width="40%" height="12px" />
      </div>
    </div>
    <Skeleton width="100%" height="60px" style={{ marginBottom: '20px' }} />
    <div style={{ display: 'flex', gap: '8px' }}>
      <Skeleton width="50%" height="40px" />
      <Skeleton width="25%" height="40px" />
      <Skeleton width="25%" height="40px" />
    </div>
  </div>
);

export const AchievementSkeleton = () => (
  <div style={{
    background: 'linear-gradient(145deg, #111, #0a0a0a)',
    border: '1px solid #222',
    borderRadius: '16px',
    padding: '25px'
  }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '20px' }}>
      <Skeleton width="32px" height="32px" />
      <div style={{ flex: 1 }}>
        <Skeleton width="150px" height="20px" />
      </div>
      <Skeleton width="100px" height="8px" />
    </div>
    <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
      <Skeleton width="80px" height="32px" style={{ borderRadius: '20px' }} />
      <Skeleton width="80px" height="32px" style={{ borderRadius: '20px' }} />
      <Skeleton width="80px" height="32px" style={{ borderRadius: '20px' }} />
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '15px' }}>
      {[1, 2, 3].map(i => (
        <div key={i} style={{ display: 'flex', gap: '15px', padding: '15px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px' }}>
          <Skeleton width="60px" height="60px" style={{ borderRadius: '12px' }} />
          <div style={{ flex: 1 }}>
            <Skeleton width="80%" height="14px" style={{ marginBottom: '8px' }} />
            <Skeleton width="60%" height="12px" />
          </div>
        </div>
      ))}
    </div>
  </div>
);

export const BountySkeleton = () => (
  <div style={{
    background: 'linear-gradient(145deg, #111, #0a0a0a)',
    border: '1px solid #222',
    borderRadius: '16px'
  }}>
    <div style={{ padding: '20px 25px', borderBottom: '1px solid #222' }}>
      <Skeleton width="200px" height="24px" />
    </div>
    <div style={{ padding: '15px' }}>
      {[1, 2, 3].map(i => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '15px', padding: '15px', marginBottom: '10px', background: 'rgba(255,136,0,0.03)', borderRadius: '12px' }}>
          <Skeleton width="70px" height="50px" style={{ borderRadius: '10px' }} />
          <div style={{ flex: 1 }}>
            <Skeleton width="120px" height="16px" style={{ marginBottom: '8px' }} />
            <Skeleton width="80%" height="12px" />
          </div>
          <Skeleton width="80px" height="36px" style={{ borderRadius: '8px' }} />
        </div>
      ))}
    </div>
  </div>
);

// Add shimmer animation
if (typeof document !== 'undefined' && !document.getElementById('skeleton-styles')) {
  const styleSheet = document.createElement('style');
  styleSheet.id = 'skeleton-styles';
  styleSheet.textContent = `
    @keyframes shimmer {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }
  `;
  document.head.appendChild(styleSheet);
}

export default Skeleton;
