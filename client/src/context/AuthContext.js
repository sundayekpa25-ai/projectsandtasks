import React, { createContext, useState, useContext, useEffect } from 'react';
import axios from 'axios';

// Configure axios base URL
axios.defaults.baseURL = process.env.REACT_APP_API_URL || 'https://projectsandtasks-backend.vercel.app';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(localStorage.getItem('token'));

  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      fetchUser();
    } else {
      setLoading(false);
    }
  }, [token]);

  const fetchUser = async () => {
    try {
      const response = await axios.get('/api/auth/me');
      setUser(response.data.user);
    } catch (error) {
      localStorage.removeItem('token');
      setToken(null);
      delete axios.defaults.headers.common['Authorization'];
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    try {
      // Normalize email (trim whitespace)
      const normalizedEmail = email.trim();
      
      if (!normalizedEmail || !password) {
        return {
          success: false,
          message: 'Email and password are required'
        };
      }

      console.log('Attempting login for:', normalizedEmail);
      
      const response = await axios.post('/api/auth/login', { 
        email: normalizedEmail, 
        password 
      });
      
      const { token: newToken, user: userData } = response.data;
      
      if (!newToken || !userData) {
        return {
          success: false,
          message: 'Invalid response from server'
        };
      }
      
      localStorage.setItem('token', newToken);
      setToken(newToken);
      axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
      setUser(userData);
      
      return { success: true };
    } catch (error) {
      console.error('Login error:', error);
      
      // Handle validation errors
      if (error.response?.data?.errors) {
        const errorMessages = error.response.data.errors.map(err => err.msg || err.message).join(', ');
        return {
          success: false,
          message: errorMessages || 'Validation failed'
        };
      }
      // Handle network errors
      if (!error.response) {
        return {
          success: false,
          message: 'Unable to connect to server. Please check if the server is running on port 5000.'
        };
      }
      // Handle authentication errors
      if (error.response?.status === 401) {
        return {
          success: false,
          message: error.response?.data?.message || 'Invalid email or password'
        };
      }
      // Handle other errors
      return {
        success: false,
        message: error.response?.data?.message || 'Login failed. Please try again.'
      };
    }
  };

  const register = async (userData) => {
    try {
      const response = await axios.post('/api/auth/register', userData);
      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Registration failed'
      };
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
    delete axios.defaults.headers.common['Authorization'];
  };

  const value = {
    user,
    loading,
    login,
    register,
    logout,
    isAuthenticated: !!user
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

