import { useState } from 'react';

const AdminLock = ({ onUnlock }) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);

  // --- 🔒 SET YOUR SECRET PIN HERE ---
  const SECRET_CODE = "685160"; 

  const handleCheck = () => {
    if (pin === SECRET_CODE) {
        onUnlock();
    } else {
        setError(true);
        setPin('');
        setTimeout(() => setError(false), 1000);
    }
  };

  return (
    <div style={{
        background: '#111', padding: '30px', borderRadius: '12px', 
        border: `1px solid ${error ? 'red' : '#333'}`, 
        textAlign: 'center', margin: '20px auto', maxWidth: '300px',
        animation: error ? 'shake 0.3s' : 'none',
        boxShadow: '0 10px 30px rgba(0,0,0,0.5)'
    }}>
        <div style={{fontSize: '3rem', marginBottom: '10px'}}>🔒</div>
        <h3 style={{color: '#ffd700', marginTop: 0, fontFamily: 'var(--font-main)'}}>RESTRICTED ACCESS</h3>
        <p style={{color: '#666', fontSize: '0.8rem'}}>ENTER ADMIN OVERRIDE CODE</p>
        
        <input 
            type="password" 
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="****"
            style={{
                background: '#000', border: '1px solid #444', color: 'white',
                padding: '15px', width: '120px', textAlign: 'center', fontSize: '1.5rem',
                letterSpacing: '8px', marginBottom: '20px', borderRadius: '8px', outline: 'none'
            }}
        />
        <br/>
        <button onClick={handleCheck} className="action-btn" style={{width: '100%'}}>
            UNLOCK TERMINAL
        </button>
        
        <style>{`
          @keyframes shake {
            0% { transform: translateX(0); }
            25% { transform: translateX(-10px); }
            75% { transform: translateX(10px); }
            100% { transform: translateX(0); }
          }
        `}</style>
    </div>
  );
};

export default AdminLock;
