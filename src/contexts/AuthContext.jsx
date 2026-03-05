import { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../services/api';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // Check for token on mount
  useEffect(() => {
    const loadUser = async () => {
      const token = localStorage.getItem('token');
      if (token) {
        try {
          const res = await api.get('/auth/user');
          if (res.msg) {
            // Token invalid or expired
            localStorage.removeItem('token');
            setUser(null);
          } else {
            const userWithUid = { ...res, uid: res.id || res._id };
            setUser(userWithUid);
            setUserProfile(userWithUid); // For now, profile is same as user object
          }
        } catch (error) {
          console.error('Error loading user:', error);
          localStorage.removeItem('token');
          setUser(null);
        }
      }
      setLoading(false);
    };

    loadUser();
  }, []);

  // Sign up new user
  const signup = async (email, password, displayName) => {
    try {
      const res = await api.post('/auth/signup', { email, password, displayName });
      if (res.token) {
        localStorage.setItem('token', res.token);
        const userWithUid = { ...res.user, uid: res.user.id || res.user._id };
        setUser(userWithUid);
        setUserProfile(userWithUid);
        return { success: true, user: userWithUid };
      }
      return { success: false, error: res.msg || 'Signup failed' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  // Login existing user
  const login = async (email, password) => {
    try {
      const res = await api.post('/auth/login', { email, password });
      if (res.token) {
        localStorage.setItem('token', res.token);
        const userWithUid = { ...res.user, uid: res.user.id || res.user._id };
        setUser(userWithUid);
        setUserProfile(userWithUid);
        return { success: true, user: userWithUid };
      }
      return { success: false, error: res.msg || 'Login failed' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  // Logout user
  const logout = async () => {
    localStorage.removeItem('token');
    setUser(null);
    setUserProfile(null);
    return { success: true };
  };

  const updateUserProfile = async (updates) => {
    // To be implemented in backend
    return { success: true };
  };

  const setNenType = async (nenType) => {
    try {
      const res = await api.put('/auth/nen-type', { nenType });
      if (res && (res._id || res.id)) {
        const userWithUid = { ...res, uid: res.id || res._id };
        setUser(userWithUid);
        return { success: true };
      }
      return { success: false, error: 'Malformed response from server' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  const buyCard = async (card) => {
    try {
      const res = await api.post('/aura/buy-card', { 
        cardId: card.id, 
        cardName: card.name, 
        cost: card.cost 
      });
      if (res.success) {
        setUser({ ...user, auraBalance: res.balance, inventory: res.inventory });
        return { success: true };
      }
      return { success: false, error: res.msg || 'Purchase failed' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  const useCard = async (cardId, targetFriendshipId = null) => {
    try {
      const res = await api.post('/aura/use-card', { cardId, targetFriendshipId });
      if (res.success) {
        setUser({ ...user, inventory: res.inventory });
        return { success: true };
      }
      return { success: false, error: res.msg || 'Failed to use card' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  const resetPassword = async (email) => {
    return { success: true };
  };

  const resendVerificationEmail = async () => {
    return { success: true };
  };

  const isEmailVerified = () => {
    return user?.emailVerified ?? true; // Default to true for new system
  };

  const value = {
    user,
    userProfile,
    loading,
    signup,
    login,
    logout,
    resetPassword,
    resendVerificationEmail,
    updateUserProfile,
    setNenType,
    buyCard,
    useCard,
    isEmailVerified,
    isAuthenticated: !!user
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
