import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { FiPlus, FiSearch } from 'react-icons/fi';
import './Projects.css';

const Projects = () => {
  const { user } = useAuth();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    clientId: '',
    startDate: '',
    endDate: ''
  });
  const [clients, setClients] = useState([]);
  const [clientLogo, setClientLogo] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);

  useEffect(() => {
  fetchProjects();
    if (user?.role === 'admin' || user?.role === 'project_manager') {
      fetchClients();
    }

    const interval = setInterval(() => {
      fetchProjects();
    }, 15000);

    return () => clearInterval(interval);
  }, []);

  const fetchProjects = async () => {
    try {
      const response = await axios.get('/api/projects');
      setProjects(response.data);
    } catch (error) {
      console.error('Error fetching projects:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchClients = async () => {
    try {
      const response = await axios.get('/api/users');
      setClients(response.data.filter(u => u.role === 'client'));
    } catch (error) {
      console.error('Error fetching clients:', error);
    }
  };

  
  const handleCreateProject = async (e) => {
  e.preventDefault();

  const title = formData.title?.trim();
  if (!title) {
    alert('Project title is required');
    return;
  }

  try {
          const formDataToSend = new FormData();
          // formDataToSend.append('title', formData.title.trim());
          formDataToSend.append('title', title);
          formDataToSend.append('description', formData.description || '');
          if (formData.clientId) formDataToSend.append('clientId', formData.clientId);
          if (formData.startDate) formDataToSend.append('startDate', formData.startDate);
          if (formData.endDate) formDataToSend.append('endDate', formData.endDate);
          if (clientLogo) formDataToSend.append('clientLogo', clientLogo);

          // Debugging log
          for (let pair of formDataToSend.entries()) {
                console.log(pair[0], pair[1]);
              }

          // await axios.post('/api/projects', formDataToSend);
          await axios.post('/api/projects', formDataToSend, {
            headers: { 'Content-Type': 'multipart/form-data' }
          });

          setShowCreateModal(false);
          setFormData({ title: '', description: '', clientId: '', startDate: '', endDate: '' });
          setClientLogo(null);
          setLogoPreview(null);
          fetchProjects();
          alert('Project created successfully!');
        } catch (error) {
          if (error.response?.data?.errors) {
            const errorMessages = error.response.data.errors.map(err => err.msg).join(', ');
            alert(errorMessages);
          } else if (!error.response) {
            alert('Unable to connect to server. Please check if the server is running.');
          } else {
            alert(error.response?.data?.message || 'Error creating project');
          }
        }
      };



  const handleLogoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setClientLogo(file);
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const filteredProjects = projects.filter(project =>
    project.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    project.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return <div className="loading">Loading projects...</div>;
  }

  return (
    <div className="projects-page">
      <div className="page-header">
        <h1>Projects</h1>
        {(user?.role === 'admin' || user?.role === 'project_manager') && (
          <button
            className="create-btn"
            onClick={() => setShowCreateModal(true)}
          >
            <FiPlus /> Create Project
          </button>
        )}
      </div>

      <div className="search-bar">
        <FiSearch />
        <input
          type="text"
          placeholder="Search projects..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="projects-grid">
        {filteredProjects.length === 0 ? (
          <div className="empty-state">No projects found</div>
        ) : (
          filteredProjects.map(project => (
            <Link
              key={project._id}
              to={`/projects/${project._id}`}
              className="project-card"
            >
              <div className="project-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                  {project.clientLogo && (
                    <img
                      src={`${process.env.REACT_APP_API_URL || 'https://projectsandtasks-backend.vercel.app' || 'http://localhost:5000'}${project.clientLogo.path}`}
                      alt={`${project.client?.name || 'Client'} logo`}
                      style={{
                        width: '40px',
                        height: '40px',
                        objectFit: 'contain',
                        borderRadius: '8px',
                        border: '1px solid var(--gray-200)',
                        padding: '4px',
                        background: 'white'
                      }}
                    />
                  )}
                  <h3>{project.title}</h3>
                </div>
                <span className={`status-badge status-${project.status}`}>
                  {project.status.replace('_', ' ')}
                </span>
              </div>
              <p className="project-description">{project.description}</p>
              <div className="project-info">
                <div className="info-item">
                  <strong>PM:</strong> {project.projectManager?.name}
                </div>
                {project.client && (
                  <div className="info-item">
                    <strong>Client:</strong> {project.client.name}
                  </div>
                )}
                <div className="info-item">
                  <strong>Team:</strong> {project.teamMembers?.length || 0} members
                </div>
              </div>
              <div className="project-progress">
                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{ width: `${project.progress || 0}%` }}
                  />
                </div>
                <span className="progress-text">{project.progress || 0}%</span>
              </div>
            </Link>
          ))
        )}
      </div>

      {showCreateModal && (
        // <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
        // <div
        //   className="modal-overlay"
        //   onMouseDown={(e) => {
        //     if (e.target.classList.contains("modal-overlay")) {
        //       setShowCreateModal(false);
        //     }
        //   }}
        // >

        <div className="modal-overlay">
          <button
            type="button"
            className="close-button"
            onClick={() => setShowCreateModal(false)}
          >
            ×
          </button>


          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Create New Project</h2>
            <form onSubmit={handleCreateProject}>
              <div className="form-group">
                <label>Title *</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows="4"
                />
              </div>
              <div className="form-group">
                <label>Client (Optional)</label>
                <select
                  value={formData.clientId}
                  onChange={(e) => setFormData({ ...formData, clientId: e.target.value })}
                >
                  <option value="">Select a client</option>
                  {clients.map(client => (
                    <option key={client._id} value={client._id}>
                      {client.name}
                    </option>
                  ))}
                </select>
              </div>
              {formData.clientId && (
                <div className="form-group">
                  <label>Client Company Logo (Optional)</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoChange}
                  />
                  <small style={{ display: 'block', marginTop: '8px', color: 'var(--gray-600)' }}>
                    Recommended: Square image, max 5MB (PNG, JPG, GIF, SVG)
                  </small>
                  {logoPreview && (
                    <div style={{ marginTop: '12px' }}>
                      <img
                        src={logoPreview}
                        alt="Logo preview"
                        style={{
                          maxWidth: '150px',
                          maxHeight: '150px',
                          borderRadius: '8px',
                          border: '1px solid var(--gray-200)',
                          padding: '8px',
                          background: 'white'
                        }}
                      />
                    </div>
                  )}
                </div>
              )}
              <div className="form-row">
                <div className="form-group">
                  <label>Start Date</label>
                  <input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>End Date</label>
                  <input
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  />
                </div>
              </div>
              <div className="modal-actions">
                <button type="button" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </button>
                <button type="submit">Create</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Projects;

