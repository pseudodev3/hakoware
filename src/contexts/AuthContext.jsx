import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { clearResourceCache, seedResource } from '../lib/resourceCache';
import { getBootstrap, RESOURCE_KEYS, seedBootstrap } from '../services/bootstrapService';

const AuthContext = createContext(null);
const withUid = (value) => value ? { ...value, uid: value.id || value._id } : null;

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [bootstrapData, setBootstrapData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadUser = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const payload = await getBootstrap({ force: true });
        const normalized = { ...payload, user: withUid(payload.user) };
        seedBootstrap(normalized);
        setBootstrapData(normalized);
        setUser(normalized.user);
      } catch (bootstrapError) {
        console.warn('Bootstrap restore failed, falling back to account restore:', bootstrapError.message);
        try {
          const nextUser = withUid(await api.get('/auth/user'));
          seedResource(RESOURCE_KEYS.user, nextUser);
          setBootstrapData(null);
          setUser(nextUser);
        } catch (error) {
          console.error('Failed to restore session:', error);
          const founderToken = localStorage.getItem('hakoware_founder_token');
          if (founderToken) {
            localStorage.setItem('token', founderToken);
            localStorage.removeItem('hakoware_founder_token');
            window.location.assign('/founder');
            return;
          }
          localStorage.removeItem('token');
          setUser(null);
        }
      } finally {
        setLoading(false);
      }
    };
    loadUser();
  }, []);

  const authenticate = async (endpoint, payload) => {
    try {
      const res = await api.post(endpoint, payload);
      clearResourceCache();
      localStorage.setItem('token', res.token);
      const nextUser = withUid(res.user);
      seedResource(RESOURCE_KEYS.user, nextUser);
      setBootstrapData(null);
      setUser(nextUser);
      return { success: true, user: nextUser };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  const signup = (username, email, password) => authenticate('/auth/signup', { username, email, password });
  const login = (identifier, password) => authenticate('/auth/login', { identifier, password });

  const claimUsername = async (username) => {
    try {
      const nextUser = withUid(await api.put('/auth/username', { username }));
      seedResource(RESOURCE_KEYS.user, nextUser);
      setBootstrapData((current) => current ? { ...current, user: nextUser } : current);
      setUser(nextUser);
      return { success: true, user: nextUser };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('hakoware_founder_token');
    clearResourceCache();
    setBootstrapData(null);
    setUser(null);
  };

  const refreshUser = async () => {
    try {
      const nextUser = withUid(await api.get('/auth/user'));
      seedResource(RESOURCE_KEYS.user, nextUser);
      setBootstrapData((current) => current ? { ...current, user: nextUser } : current);
      setUser(nextUser);
      return { success: true, user: nextUser };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  const refreshBootstrap = async () => {
    try {
      const payload = await getBootstrap({ force: true });
      const normalized = { ...payload, user: withUid(payload.user) };
      seedBootstrap(normalized);
      setBootstrapData(normalized);
      setUser(normalized.user);
      return { success: true, data: normalized, user: normalized.user };
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
      return { success: true, effect: res.effect || null };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  const value = useMemo(() => ({
    user,
    bootstrapData,
    loading,
    signup,
    login,
    claimUsername,
    logout,
    refreshUser,
    refreshBootstrap,
    setNenType,
    buyCard,
    useCard,
    isAuthenticated: Boolean(user)
  }), [user, bootstrapData, loading]);

  return <AuthContext.Provider value={value}>{!loading && children}</AuthContext.Provider>;
};

export default AuthContext;
