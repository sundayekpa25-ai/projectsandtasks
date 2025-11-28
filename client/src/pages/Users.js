import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { FiPlus, FiSearch } from 'react-icons/fi';
import './Users.css';

const Users = () => {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [error, setError] = useState('');
  // Get initial default role based on user permissions
  const getInitialDefaultRole = () => {
    if (user?.role === 'admin') {
      return 'team_member'; // Default to team_member for admin
    } else if (user?.role === 'project_manager') {
      return 'team_member'; // Default to team_member for project manager
    }
    return 'team_member';
  };

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: getInitialDefaultRole()
  });

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await axios.get('/api/users');
      setUsers(response.data);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await axios.post('/api/auth/register', formData);
      setShowCreateModal(false);
      const defaultRole = getDefaultRole();
      setFormData({ name: '', email: '', password: '', role: defaultRole });
      setError('');
      fetchUsers();
      alert('User onboarded successfully!');
    } catch (error) {
      // Handle validation errors
      if (error.response?.data?.errors) {
        const errorMessages = error.response.data.errors.map(err => err.msg || err.message).join(', ');
        setError(errorMessages);
      } else if (!error.response) {
        setError('Unable to connect to server. Please check if the server is running.');
      } else {
        setError(error.response?.data?.message || 'Error onboarding user');
      }
    }
  };

  const getRoleOptions = () => {
    if (user?.role === 'admin') {
      return [
        { value: 'admin', label: 'Administrator' },
        { value: 'project_manager', label: 'Project Manager' },
        { value: 'team_member', label: 'Team Member' },
        { value: 'client', label: 'Client' }
      ];
    } else if (user?.role === 'project_manager') {
      return [
        { value: 'team_member', label: 'Team Member' },
        { value: 'client', label: 'Client' }
      ];
    }
    return [];
  };

  // Get default role based on available options
  const getDefaultRole = () => {
    const options = getRoleOptions();
    return options.length > 0 ? options[0].value : 'team_member';
  };

  const filteredUsers = users.filter(u =>
    u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return <div className="loading">Loading users...</div>;
  }

  const canOnboard = user?.role === 'admin' || user?.role === 'project_manager';

  return (
    <div className="users-page">
      <div className="page-header">
        <h1>Users</h1>
        {canOnboard && (
          <button
            className="create-btn"
            onClick={() => {
              // Reset form with appropriate default role
              const defaultRole = getDefaultRole();
              setFormData({ 
                name: '', 
                email: '', 
                password: '', 
                role: defaultRole 
              });
              setError('');
              setShowCreateModal(true);
            }}
          >
            <FiPlus /> Onboard User
          </button>
        )}
      </div>

      <div className="search-bar">
        <FiSearch />
        <input
          type="text"
          placeholder="Search users..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="users-grid">
        {filteredUsers.length === 0 ? (
          <div className="empty-state">No users found</div>
        ) : (
          filteredUsers.map(userItem => (
            <div key={userItem._id} className="user-card">
              <div className="user-avatar-large">
                {userItem.name.charAt(0).toUpperCase()}
              </div>
              <div className="user-info">
                <h3>{userItem.name}</h3>
                <p className="user-email">{userItem.email}</p>
                <span className={`role-badge role-${userItem.role}`}>
                  {userItem.role.replace('_', ' ')}
                </span>
              </div>
              <div className="user-status">
                <span className={userItem.isActive ? 'status-active' : 'status-inactive'}>
                  {userItem.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Onboard New User</h2>
            {error && (
              <div className="error-message" style={{ marginBottom: '20px', padding: '12px', background: '#fee', color: '#c33', borderRadius: '5px', border: '1px solid #fcc' }}>
                {error}
              </div>
            )}
            <form onSubmit={handleCreateUser}>
              <div className="form-group">
                <label>Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Email *</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Password *</label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                  minLength={8}
                />
                <small>Must be at least 8 characters with uppercase, lowercase, and number</small>
              </div>
              <div className="form-group">
                <label>Role *</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  required
                >
                  {getRoleOptions().length === 0 ? (
                    <option value="">No roles available</option>
                  ) : (
                    getRoleOptions().map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))
                  )}
                </select>
                {user?.role === 'admin' && (
                  <small style={{ display: 'block', marginTop: '5px', color: '#666' }}>
                    Administrators can onboard all user types
                  </small>
                )}
                {user?.role === 'project_manager' && (
                  <small style={{ display: 'block', marginTop: '5px', color: '#666' }}>
                    Project Managers can onboard Team Members and Clients
                  </small>
                )}
              </div>
              <div className="modal-actions">
                <button type="button" onClick={() => {
                  setShowCreateModal(false);
                  setError('');
                  const defaultRole = getDefaultRole();
                  setFormData({ name: '', email: '', password: '', role: defaultRole });
                }}>
                  Cancel
                </button>
                <button type="submit">Onboard</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Users;

