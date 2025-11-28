import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { FiHome, FiFolder, FiCheckSquare, FiUsers, FiBell, FiLogOut, FiMenu, FiX, FiSettings } from 'react-icons/fi';
import axios from 'axios';
import './Layout.css';

const Layout = ({ children }) => {
  const { user, logout } = useAuth();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [companyLogo, setCompanyLogo] = useState(null);
  const [companyName, setCompanyName] = useState('GIC Projects');
  const location = useLocation();
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

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getRoleDisplay = (role) => {
    const roleMap = {
      admin: 'Administrator',
      project_manager: 'Project Manager',
      team_member: 'Team Member',
      client: 'Client'
    };
    return roleMap[role] || role;
  };

  const menuItems = [
    { path: '/dashboard', icon: FiHome, label: 'Dashboard' },
    { path: '/projects', icon: FiFolder, label: 'Projects' },
    { path: '/tasks', icon: FiCheckSquare, label: 'Tasks' },
    ...(user?.role === 'admin' || user?.role === 'project_manager'
      ? [{ path: '/users', icon: FiUsers, label: 'Users' }]
      : []),
    ...(user?.role === 'admin'
      ? [{ path: '/settings', icon: FiSettings, label: 'Settings' }]
      : [])
  ];

  return (
    <div className="layout">
      <nav className={`sidebar ${sidebarOpen ? 'open' : 'closed'}`}>
        <div className="sidebar-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
            {companyLogo && (
              <img
                src={`${process.env.REACT_APP_API_URL || 'http://localhost:5000'}${companyLogo.path}`}
                alt="Company logo"
                style={{
                  width: '40px',
                  height: '40px',
                  objectFit: 'contain',
                  borderRadius: '8px',
                  flexShrink: 0
                }}
              />
            )}
            {sidebarOpen && <h2>{companyName}</h2>}
          </div>
          <button className="toggle-btn" onClick={() => setSidebarOpen(!sidebarOpen)}>
            {sidebarOpen ? <FiX /> : <FiMenu />}
          </button>
        </div>
        <ul className="sidebar-menu">
          {menuItems.map(item => (
            <li key={item.path}>
              <Link
                to={item.path}
                className={location.pathname === item.path ? 'active' : ''}
              >
                <item.icon />
                {sidebarOpen && <span>{item.label}</span>}
              </Link>
            </li>
          ))}
        </ul>
        <div className="sidebar-footer">
          <div className="user-info">
            <div className="user-avatar">{user?.name?.charAt(0).toUpperCase()}</div>
            {sidebarOpen && (
              <div className="user-details">
                <div className="user-name">{user?.name}</div>
                <div className="user-role">{getRoleDisplay(user?.role)}</div>
              </div>
            )}
          </div>
        </div>
      </nav>

      <div className="main-content">
        <header className="topbar">
          <div className="topbar-left">
            <button className="mobile-menu-btn" onClick={() => setSidebarOpen(!sidebarOpen)}>
              <FiMenu />
            </button>
          </div>
          <div className="topbar-right">
            <div className="notifications-container">
              <button
                className="notification-btn"
                onClick={() => setNotificationsOpen(!notificationsOpen)}
              >
                <FiBell />
                {unreadCount > 0 && <span className="badge">{unreadCount}</span>}
              </button>
              {notificationsOpen && (
                <div className="notifications-dropdown">
                  <div className="notifications-header">
                    <h3>Notifications</h3>
                    {unreadCount > 0 && (
                      <button onClick={markAllAsRead}>Mark all as read</button>
                    )}
                  </div>
                  <div className="notifications-list">
                    {notifications.length === 0 ? (
                      <div className="no-notifications">No notifications</div>
                    ) : (
                      notifications.slice(0, 10).map(notification => (
                        <div
                          key={notification._id}
                          className={`notification-item ${!notification.isRead ? 'unread' : ''}`}
                          onClick={() => {
                            markAsRead(notification._id);
                            if (notification.relatedProject) {
                              navigate(`/projects/${notification.relatedProject._id || notification.relatedProject}`);
                              setNotificationsOpen(false);
                            }
                          }}
                        >
                          <div className="notification-title">{notification.title}</div>
                          <div className="notification-message">{notification.message}</div>
                          <div className="notification-time">
                            {new Date(notification.createdAt).toLocaleString()}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
            <button className="logout-btn" onClick={handleLogout}>
              <FiLogOut />
              Logout
            </button>
          </div>
        </header>

        <main className="content">{children}</main>
      </div>
    </div>
  );
};

export default Layout;

