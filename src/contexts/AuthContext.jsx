import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../services/api';

const AuthContext = createContext(null);
const withUid = (value) => value ? { ...value, uid: value.id || value._id } : null;

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadUser = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        setUser(withUid(await api.get('/auth/user')));
      } catch (error) {
        console.error('Failed to restore session:', error);
        localStorage.removeItem('token');
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    loadUser();
  }, []);

  const authenticate = async (endpoint, payload) => {
    try {
      const res = await api.post(endpoint, payload);
      localStorage.setItem('token', res.token);
      const nextUser = withUid(res.user);
      setUser(nextUser);
      return { success: true, user: nextUser };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  const signup = (email, password, displayName) => authenticate('/auth/signup', { email, password, displayName });
  const login = (email, password) => authenticate('/auth/login', { email, password });

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  const refreshUser = async () => {
    try {
      const nextUser = withUid(await api.get('/auth/user'));
      setUser(nextUser);
      return { success: true, user: nextUser };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  const setNenType = async (nenType) => {
    try {
      const nextUser = withUid(await api.put('/auth/nen-type', { nenType }));
      setUser(nextUser);
      return { success: true, user: nextUser };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  const buyCard = async (card) => {
    try {
      const res = await api.post('/aura/buy-card', { cardId: card.id });
      setUser((current) => current ? { ...current, auraBalance: res.balance, inventory: res.inventory } : current);
      return { success: true, card: res.card };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  const useCard = async (cardId, targetFriendshipId = null) => {
    try {
      const res = await api.post('/aura/use-card', { cardId, targetFriendshipId });
      setUser((current) => current ? { ...current, auraBalance: res.balance ?? current.auraBalance, inventory: res.inventory } : current);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  const value = useMemo(() => ({
    user,
    userProfile: user,
    loading,
    signup,
    login,
    logout,
    refreshUser,
    setNenType,
    buyCard,
    useCard,
    isAuthenticated: Boolean(user)
  }), [user, loading]);

  return <AuthContext.Provider value={value}>{!loading && children}</AuthContext.Provider>;
};

export default AuthContext;
