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
            setUser(res);
            setUserProfile(res); // For now, profile is same as user object
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
        setUser(res.user);
        setUserProfile(res.user);
        return { success: true, user: res.user };
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
        setUser(res.user);
        setUserProfile(res.user);
        return { success: true, user: res.user };
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

  const value = {
    user,
    userProfile,
    loading,
    signup,
    login,
    logout,
    updateUserProfile,
    isAuthenticated: !!user
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
