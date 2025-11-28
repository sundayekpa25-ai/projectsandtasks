import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { FiFolder, FiCheckSquare, FiUsers, FiTrendingUp } from 'react-icons/fi';
import './Dashboard.css';

const Dashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    projects: 0,
    tasks: 0,
    completedTasks: 0,
    teamMembers: 0
  });
  const [recentProjects, setRecentProjects] = useState([]);
  const [recentTasks, setRecentTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const [projectsRes, tasksRes] = await Promise.all([
        axios.get('/api/projects'),
        axios.get('/api/tasks')
      ]);

      const projects = projectsRes.data;
      const tasks = tasksRes.data;

      // Calculate team members count (handle both populated objects and IDs)
      const allTeamMemberIds = projects.flatMap(p => {
        if (!p.teamMembers || !Array.isArray(p.teamMembers)) return [];
        return p.teamMembers.map(tm => {
          // Handle both populated objects (tm._id) and plain IDs (tm)
          return tm._id ? tm._id.toString() : tm.toString();
        });
      });
      const uniqueTeamMembers = new Set(allTeamMemberIds);

      setStats({
        projects: projects.length,
        tasks: tasks.length,
        completedTasks: tasks.filter(t => t.status === 'completed').length,
        teamMembers: uniqueTeamMembers.size
      });

      setRecentProjects(projects.slice(0, 5));
      setRecentTasks(tasks.slice(0, 10));
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getTaskColor = (status, pmRating, clientRating) => {
    if (status === 'initiated') return '#8B4513';
    if (status === 'submitted') return '#9370DB';
    if (status === 'rejected') return '#DC143C';
    if (status === 'pm_reviewed' && pmRating === 'approved') return '#4169E1';
    if (status === 'client_reviewed' && clientRating === 'approved') return '#228B22';
    if (status === 'completed') return '#228B22';
    return '#999';
  };

  const getProgressPercentage = (project) => {
    return project.progress || 0;
  };

  if (loading) {
    return <div className="loading">Loading dashboard...</div>;
  }

  return (
    <div className="dashboard">
      <h1>Dashboard</h1>
      <p className="welcome-message">Welcome back, {user?.name}!</p>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#3498db' }}>
            <FiFolder />
          </div>
          <div className="stat-content">
            <div className="stat-value">{stats.projects}</div>
            <div className="stat-label">Projects</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#9b59b6' }}>
            <FiCheckSquare />
          </div>
          <div className="stat-content">
            <div className="stat-value">{stats.tasks}</div>
            <div className="stat-label">Total Tasks</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#27ae60' }}>
            <FiTrendingUp />
          </div>
          <div className="stat-content">
            <div className="stat-value">{stats.completedTasks}</div>
            <div className="stat-label">Completed</div>
          </div>
        </div>

        {(user?.role === 'admin' || user?.role === 'project_manager') && (
          <div className="stat-card">
            <div className="stat-icon" style={{ background: '#e67e22' }}>
              <FiUsers />
            </div>
            <div className="stat-content">
              <div className="stat-value">{stats.teamMembers}</div>
              <div className="stat-label">Team Members</div>
            </div>
          </div>
        )}
      </div>

      <div className="dashboard-grid">
        <div className="dashboard-section">
          <div className="section-header">
            <h2>Recent Projects</h2>
            <Link to="/projects" className="view-all">View All</Link>
          </div>
          <div className="projects-list">
            {recentProjects.length === 0 ? (
              <div className="empty-state">No projects yet</div>
            ) : (
              recentProjects.map(project => (
                <Link
                  key={project._id}
                  to={`/projects/${project._id}`}
                  className="project-card"
                >
                  <div className="project-header">
                    <h3>{project.title}</h3>
                    <span className={`status-badge status-${project.status}`}>
                      {project.status.replace('_', ' ')}
                    </span>
                  </div>
                  <p className="project-description">{project.description}</p>
                  <div className="project-progress">
                    <div className="progress-bar">
                      <div
                        className="progress-fill"
                        style={{ width: `${getProgressPercentage(project)}%` }}
                      />
                    </div>
                    <span className="progress-text">{getProgressPercentage(project)}%</span>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>

        <div className="dashboard-section">
          <div className="section-header">
            <h2>Recent Tasks</h2>
            <Link to="/tasks" className="view-all">View All</Link>
          </div>
          <div className="tasks-list">
            {recentTasks.length === 0 ? (
              <div className="empty-state">No tasks yet</div>
            ) : (
              recentTasks.map(task => (
                <div key={task._id} className="task-item">
                  <div className="task-header">
                    <h4>{task.title}</h4>
                    <span
                      className="task-status"
                      style={{
                        backgroundColor: getTaskColor(
                          task.status,
                          task.pmRating,
                          task.clientRating
                        )
                      }}
                    >
                      {task.status.replace('_', ' ')}
                    </span>
                  </div>
                  {task.project && (
                    <p className="task-project">
                      Project: {task.project?.title || 'N/A'}
                    </p>
                  )}
                  {task.assignedTo && (
                    <p className="task-assigned">
                      Assigned to: {task.assignedTo?.name || 'Unassigned'}
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;

