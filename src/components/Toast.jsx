import { useEffect } from 'react';

const Toast = ({ message, type, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 3000); // Disappears after 3 seconds
    return () => clearTimeout(timer);
  }, [onClose]);

  // Styles based on type
  let borderColor = '#00e676'; // Default Green
  let icon = '✅';
  
  if (type === 'ERROR') {
      borderColor = '#ff4444'; 
      icon = '⚠️';
  } else if (type === 'MERCY') {
      borderColor = '#ffd700';
      icon = '🧚';
  }

  return (
    <div style={{
      position: 'fixed',
      bottom: '20px',
      left: '50%',
      transform: 'translateX(-50%)',
      background: '#111',
      border: `1px solid ${borderColor}`,
      borderLeft: `5px solid ${borderColor}`,
      padding: '15px 25px',
      borderRadius: '8px',
      boxShadow: '0 5px 20px rgba(0,0,0,0.5)',
      color: 'white',
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      zIndex: 2000,
      minWidth: '250px',
      animation: 'slideUp 0.3s ease-out'
    }}>
      <span style={{fontSize: '1.2rem'}}>{icon}</span>
      <span style={{fontWeight: 600, fontFamily: 'var(--font-main)'}}>{message}</span>
      
      {/* Quick CSS for animation inside the component for simplicity */}
      <style>{`
        @keyframes slideUp {
          from { transform: translate(-50%, 100%); opacity: 0; }
          to { transform: translate(-50%, 0); opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default Toast;
