import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import './Login.css';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [companyLogo, setCompanyLogo] = useState(null);
  const [companyName, setCompanyName] = useState('GIC Projects');
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await axios.get('/api/settings');
      if (response.data) {
        setCompanyName(response.data.companyName || 'GIC Projects');
        if (response.data.companyLogo && response.data.companyLogo.path) {
          setCompanyLogo(response.data.companyLogo);
        }
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const result = await login(email, password);
    if (result.success) {
      navigate('/dashboard');
    } else {
      setError(result.message);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        {companyLogo && (
          <div style={{ textAlign: 'center', marginBottom: '20px' }}>
            <img
              src={`${process.env.REACT_APP_API_URL || 'http://localhost:5000'}${companyLogo.path}`}
              alt="Company logo"
              style={{
                maxWidth: '120px',
                maxHeight: '120px',
                objectFit: 'contain',
                borderRadius: '12px',
                margin: '0 auto'
              }}
            />
          </div>
        )}
        <h1>{companyName}</h1>
        <h2>Login</h2>
        {error && <div className="error-message">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="Enter your email"
            />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="Enter your password"
            />
          </div>
          <button type="submit" className="login-btn">Login</button>
        </form>
        <p className="login-note">
          Note: Please contact your administrator to get your account credentials.
        </p>
      </div>
    </div>
  );
};

export default Login;

