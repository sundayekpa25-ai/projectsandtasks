import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { FiUsers, FiPlus, FiX, FiSend, FiUpload, FiFile, FiDownload, FiTrash2 } from 'react-icons/fi';
import './ProjectDetail.css';

const ProjectDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { socket } = useNotifications();
  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [comments, setComments] = useState([]);
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [showClientLogoModal, setShowClientLogoModal] = useState(false);
  const [clientLogoFile, setClientLogoFile] = useState(null);
  const [clientLogoPreview, setClientLogoPreview] = useState(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [availableMembers, setAvailableMembers] = useState([]);
  const [addingMember, setAddingMember] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [taskFormData, setTaskFormData] = useState({
    title: '',
    description: '',
    assignedTo: '',
    priority: 'medium',
    dueDate: ''
  });

  // useEffect(() => {
  //   fetchProjectData();
  //   if (socket) {
  //     socket.emit('join-project', id);
  //     socket.on('new-message', handleNewMessage);
  //     return () => {
  //       socket.emit('leave-project', id);
  //       socket.off('new-message');
  //     };
  //   }
  // }, [id, socket]);

  // const fetchProjectData = async () => {
  //   try {
  //     const [projectRes, tasksRes, commentsRes, filesRes] = await Promise.all([
  //       axios.get(`/api/projects/${id}`),
  //       axios.get(`/api/tasks?projectId=${id}`),
  //       axios.get(`/api/comments/project/${id}`),
  //       axios.get(`/api/upload/project/${id}`).catch(() => ({ data: [] })) // Handle if no files
  //     ]);

  //     setProject(projectRes.data);
  //     setTasks(tasksRes.data);
  //     setComments(commentsRes.data);
  //     setFiles(filesRes.data || []);

  //     if (user?.role === 'admin' || user?.role === 'project_manager') {
  //       fetchAvailableMembers();
  //     }
  //   } catch (error) {
  //     console.error('Error fetching project data:', error);
  //   } finally {
  //     setLoading(false);
  //   }
  // };

  useEffect(() => {
  let pollingInterval;

  // Function to fetch all project-related data
  const fetchData = async () => {
    try {
      const [projectRes, tasksRes, commentsRes, filesRes] = await Promise.all([
        axios.get(`/api/projects/${id}`),
        axios.get(`/api/tasks?projectId=${id}`),
        axios.get(`/api/comments/project/${id}`),
        axios.get(`/api/upload/project/${id}`).catch(() => ({ data: [] }))
      ]);

      setProject(projectRes.data);
      setTasks(tasksRes.data);
      setComments(commentsRes.data);
      setFiles(filesRes.data || []);

      if (user?.role === 'admin' || user?.role === 'project_manager') {
        fetchAvailableMembers();
      }
    } catch (error) {
      console.error('Error fetching project data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Initial fetch
  fetchData();

  pollingInterval = setInterval(fetchData, 15000);

  // Socket updates
  const handleNewMessage = (data) => {
    setChatMessages(prev => {
      // Avoid duplicates
      if (prev.some(msg => msg._id === data._id)) return prev;
      return [...prev, data];
    });
  };

  if (socket) {
    socket.emit('join-project', id);
    socket.on('new-message', handleNewMessage);
  }

  // Cleanup
  return () => {
    clearInterval(pollingInterval);
    if (socket) {
      socket.emit('leave-project', id);
      socket.off('new-message', handleNewMessage);
    }
  };
}, [id, socket, user]);


  const fetchAvailableMembers = async () => {
    try {
      const response = await axios.get('/api/users');
      // Get current team member IDs (handle both populated objects and IDs)
      const currentMemberIds = (project?.teamMembers || []).map(tm => {
        // Handle both populated objects (tm._id) and plain IDs (tm)
        const id = tm._id || tm;
        return id.toString();
      });
      
      const members = response.data.filter(
        u => u.role === 'team_member' && !currentMemberIds.includes(u._id.toString())
      );
      setAvailableMembers(members);
    } catch (error) {
      console.error('Error fetching members:', error);
      setAvailableMembers([]);
    }
  };

  const handleAddMember = async (memberId) => {
    if (addingMember) return; // Prevent double clicks
    
    setAddingMember(true);
    try {
      const response = await axios.post(`/api/projects/${id}/team-members`, { userId: memberId });
      // Refresh project data to get updated team members
      await fetchProjectData();
      // Refresh available members list
      await fetchAvailableMembers();
      setShowAddMember(false);
    } catch (error) {
      // Handle validation errors
      if (error.response?.data?.errors) {
        const errorMessages = error.response.data.errors.map(err => err.msg || err.message).join(', ');
        alert(errorMessages);
      } else if (!error.response) {
        alert('Unable to connect to server. Please check if the server is running.');
      } else {
        alert(error.response?.data?.message || 'Error adding team member');
      }
    } finally {
      setAddingMember(false);
    }
  };

  const handleRemoveMember = async (memberId) => {
    if (!window.confirm('Are you sure you want to remove this team member?')) return;
    try {
      await axios.delete(`/api/projects/${id}/team-members/${memberId}`);
      fetchProjectData();
      alert('Team member removed successfully!');
    } catch (error) {
      if (error.response?.data?.message) {
        alert(error.response.data.message);
      } else {
        alert('Error removing team member');
      }
    }
  };

  const handleRemoveClient = async () => {
    if (!window.confirm('Are you sure you want to remove the client from this project?')) return;
    try {
      await axios.delete(`/api/projects/${id}/client`);
      fetchProjectData();
      alert('Client removed successfully!');
    } catch (error) {
      if (error.response?.data?.message) {
        alert(error.response.data.message);
      } else {
        alert('Error removing client');
      }
    }
  };

  const handleUpdateStatus = async (newStatus) => {
    try {
      // Use project._id if available, otherwise fall back to id from URL
      const projectId = project?._id || project?.id || id;
      
      if (!projectId) {
        alert('Project ID is missing. Please refresh the page.');
        return;
      }

      if (!project) {
        alert('Project data is not loaded. Please refresh the page.');
        return;
      }

      const updateData = { status: newStatus };
      
      // If starting the project, set the start date
      if (newStatus === 'in_progress' && project.status === 'not_started' && !project.startDate) {
        updateData.startDate = new Date().toISOString().split('T')[0];
      }
      
      console.log('Updating project status:', { 
        projectId, 
        urlId: id, 
        projectIdFromProject: project._id || project.id,
        newStatus, 
        updateData 
      });
      
      const response = await axios.put(`/api/projects/${projectId}`, updateData);
      
      // Refresh project data to get updated status
      await fetchProjectData();
    } catch (error) {
      console.error('Error updating project status:', error);
      console.error('Error details:', {
        status: error.response?.status,
        data: error.response?.data,
        projectId: project?._id || project?.id || id,
        urlId: id
      });
      
      // Handle validation errors
      if (error.response?.data?.errors) {
        const errorMessages = error.response.data.errors.map(err => err.msg || err.message).join(', ');
        alert(errorMessages);
      } else if (!error.response) {
        alert('Unable to connect to server. Please check if the server is running.');
      } else {
        const errorMessage = error.response?.data?.message || 'Error updating project status';
        alert(errorMessage);
      }
    }
  };

  const handleCreateTask = async (e) => {
    e.preventDefault();
    try {
      const projectId = project?._id || project?.id || id;
      await axios.post('/api/tasks', {
        ...taskFormData,
        projectId: projectId
      });
      setShowCreateTask(false);
      setTaskFormData({ title: '', description: '', assignedTo: '', priority: 'medium', dueDate: '' });
      fetchProjectData();
    } catch (error) {
      if (error.response?.data?.errors) {
        const errorMessages = error.response.data.errors.map(err => err.msg || err.message).join(', ');
        alert(errorMessages);
      } else {
        alert(error.response?.data?.message || 'Error creating task');
      }
    }
  };

  const handleFileUpload = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const projectId = project?._id || project?.id || id;
    formData.append('projectId', projectId);

    setUploadingFile(true);
    try {
      await axios.post('/api/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      setShowUploadModal(false);
      e.target.reset();
      fetchProjectData();
      alert('File uploaded successfully!');
    } catch (error) {
      if (error.response?.data?.errors) {
        const errorMessages = error.response.data.errors.map(err => err.msg || err.message).join(', ');
        alert(errorMessages);
      } else {
        alert(error.response?.data?.message || 'Error uploading file');
      }
    } finally {
      setUploadingFile(false);
    }
  };

  const handleDeleteFile = async (fileId) => {
    if (!window.confirm('Are you sure you want to delete this file?')) return;
    try {
      await axios.delete(`/api/upload/${fileId}`);
      fetchProjectData();
      alert('File deleted successfully!');
    } catch (error) {
      alert(error.response?.data?.message || 'Error deleting file');
    }
  };

  const handleClientLogoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setClientLogoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setClientLogoPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleClientLogoUpload = async (e) => {
    e.preventDefault();
    if (!clientLogoFile) {
      alert('Please select a logo file');
      return;
    }

    setUploadingLogo(true);
    try {
      const formData = new FormData();
      formData.append('clientLogo', clientLogoFile);
      // Keep existing project data
      if (project.title) formData.append('title', project.title);
      if (project.description) formData.append('description', project.description);
      if (project.client) formData.append('clientId', project.client._id || project.client);
      if (project.status) formData.append('status', project.status);

      await axios.put(`/api/projects/${id}`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      setShowClientLogoModal(false);
      setClientLogoFile(null);
      setClientLogoPreview(null);
      fetchProjectData();
      alert('Client logo updated successfully!');
    } catch (error) {
      alert(error.response?.data?.message || 'Error updating client logo');
    } finally {
      setUploadingLogo(false);
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    try {
      await axios.post('/api/comments', {
        content: newComment,
        projectId: id
      });
      setNewComment('');
      fetchProjectData();
    } catch (error) {
      alert(error.response?.data?.message || 'Error adding comment');
    }
  };

  const handleSendChat = (e) => {
    e.preventDefault();
    if (!chatInput.trim() || !socket) return;

    socket.emit('chat-message', {
      projectId: id,
      message: chatInput,
      userName: user.name
    });
    setChatInput('');
  };

  const handleNewMessage = (data) => {
    setChatMessages(prev => [...prev, data]);
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

  if (loading) {
    return <div className="loading">Loading project...</div>;
  }

  if (!project) {
    return <div className="error">Project not found</div>;
  }

  const canManage = user?.role === 'admin' || (project.projectManager?._id || project.projectManager?.id) === (user?.id || user?._id);

  return (
    <div className="project-detail">
      <div className="project-header-section">
        <button className="back-btn" onClick={() => navigate('/projects')}>
          ← Back to Projects
        </button>
        <div className="project-title-section">
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px', flexWrap: 'wrap' }}>
            {project.clientLogo && (
              <img
                src={`${process.env.REACT_APP_API_URL || 'http://localhost:5000'}${project.clientLogo.path}`}
                alt={`${project.client?.name || 'Client'} logo`}
                style={{
                  width: '56px',
                  height: '56px',
                  objectFit: 'contain',
                  borderRadius: '12px',
                  border: '2px solid var(--gray-200)',
                  padding: '6px',
                  background: 'white',
                  boxShadow: 'var(--shadow-sm)',
                  flexShrink: 0
                }}
              />
            )}
            <h1 style={{ margin: 0 }}>{project.title}</h1>
            <span className={`status-badge status-${project.status}`}>
              {project.status.replace('_', ' ')}
            </span>
            {canManage && project.status === 'not_started' && (
              <button
                className="start-project-btn"
                onClick={() => {
                  if (window.confirm('Start this project? This will change the status to "In Progress".')) {
                    handleUpdateStatus('in_progress');
                  }
                }}
                style={{
                  padding: '8px 16px',
                  background: '#28a745',
                  color: 'white',
                  border: 'none',
                  borderRadius: '5px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500'
                }}
              >
                ▶ Start Project
              </button>
            )}
            {canManage && project.status !== 'not_started' && (
              <select
                value={project.status}
                onChange={(e) => {
                  const newStatus = e.target.value;
                  const statusLabels = {
                    'not_started': 'Not Started',
                    'in_progress': 'In Progress',
                    'on_hold': 'On Hold',
                    'completed': 'Completed'
                  };
                  if (window.confirm(`Change project status to "${statusLabels[newStatus]}"?`)) {
                    handleUpdateStatus(newStatus);
                  } else {
                    e.target.value = project.status; // Reset select
                  }
                }}
                style={{
                  padding: '8px 12px',
                  border: '1px solid #ddd',
                  borderRadius: '5px',
                  fontSize: '14px',
                  cursor: 'pointer'
                }}
              >
                <option value="not_started">Not Started</option>
                <option value="in_progress">In Progress</option>
                <option value="on_hold">On Hold</option>
                <option value="completed">Completed</option>
              </select>
            )}
          </div>
        </div>
        <p className="project-description">{project.description}</p>
        <div className="project-meta">
          <div className="meta-item">
            <strong>Project Manager:</strong> {project.projectManager?.name || 'N/A'}
          </div>
          {project.client && (
            <div className="meta-item" style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {project.clientLogo && (
                  <img
                    src={`${process.env.REACT_APP_API_URL || 'http://localhost:5000'}${project.clientLogo.path}`}
                    alt={`${project.client?.name || 'Client'} logo`}
                    style={{
                      width: '48px',
                      height: '48px',
                      objectFit: 'contain',
                      borderRadius: '8px',
                      border: '1px solid var(--gray-200)',
                      padding: '4px',
                      background: 'white',
                      flexShrink: 0,
                      cursor: (canManage || user?.role === 'admin') ? 'pointer' : 'default'
                    }}
                    onClick={() => {
                      if (canManage || user?.role === 'admin') {
                        setShowClientLogoModal(true);
                      }
                    }}
                    title={(canManage || user?.role === 'admin') ? 'Click to update client logo' : ''}
                  />
                )}
                <div>
                  <strong>Client:</strong> {project.client?.name || 'N/A'}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                {(canManage || user?.role === 'admin') && (
                  <button
                    onClick={() => setShowClientLogoModal(true)}
                    style={{
                      padding: '4px 8px',
                      background: 'var(--primary)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '12px',
                      fontWeight: '600'
                    }}
                    title="Update client logo"
                  >
                    {project.clientLogo ? 'Update Logo' : 'Add Logo'}
                  </button>
                )}
                {(canManage || user?.role === 'admin') && 
                 (project.status === 'completed' || user?.role === 'admin') && (
                  <button
                    onClick={handleRemoveClient}
                    style={{
                      padding: '4px 8px',
                      background: '#e74c3c',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '12px'
                    }}
                    title="Remove client (only allowed after project completion)"
                  >
                    Remove Client
                  </button>
                )}
              </div>
            </div>
          )}
          <div className="meta-item">
            <strong>Progress:</strong> {project.progress || 0}%
          </div>
        </div>
      </div>

      <div className="project-content-grid">
        <div className="project-main">
          <div className="section">
            <div className="section-header">
              <h2>Team Members</h2>
              {canManage && (
                <button
                  className="add-btn"
                  onClick={async () => {
                    setShowAddMember(true);
                    // Wait for project data to be available before fetching members
                    if (project) {
                      await fetchAvailableMembers();
                    } else {
                      // If project not loaded yet, fetch it first
                      await fetchProjectData();
                      await fetchAvailableMembers();
                    }
                  }}
                >
                  <FiPlus /> Add Member
                </button>
              )}
            </div>
            <div className="team-members">
              {!project.teamMembers || project.teamMembers.length === 0 ? (
                <div className="empty-state">No team members yet</div>
              ) : (
                project.teamMembers
                  .filter(member => member && (member._id || member)) // Filter out null/undefined
                  .map(member => {
                    // Handle both populated objects and plain IDs
                    const memberId = member._id || member;
                    const memberName = member.name || 'Unknown';
                    const memberEmail = member.email || '';
                    
                    return (
                      <div key={memberId} className="member-card">
                        <div className="member-avatar">{memberName.charAt(0).toUpperCase()}</div>
                        <div className="member-info">
                          <div className="member-name">{memberName}</div>
                          {memberEmail && <div className="member-email">{memberEmail}</div>}
                        </div>
                        {(canManage || user?.role === 'admin') && 
                         (project.status === 'completed' || user?.role === 'admin') && (
                          <button
                            className="remove-btn"
                            onClick={() => handleRemoveMember(memberId)}
                            title="Remove team member (only allowed after project completion)"
                          >
                            <FiX />
                          </button>
                        )}
                      </div>
                    );
                  })
              )}
            </div>
          </div>

          <div className="section">
            <div className="section-header">
              <h2>Tasks</h2>
              {canManage && (
                <button
                  className="add-btn"
                  onClick={() => setShowCreateTask(true)}
                >
                  <FiPlus /> Create Task
                </button>
              )}
            </div>
            <div className="tasks-list">
              {tasks.length === 0 ? (
                <div className="empty-state">No tasks yet</div>
              ) : (
                tasks
                  .filter(task => task && task._id)
                  .map(task => {
                    const assignedToName = task.assignedTo?.name || (task.assignedTo ? 'Unknown' : null);
                    return (
                      <div
                        key={task._id}
                        className="task-card"
                        onClick={() => navigate(`/tasks?taskId=${task._id}`)}
                      >
                        <div className="task-header">
                          <h3>{task.title || 'Untitled Task'}</h3>
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
                            {task.status ? task.status.replace('_', ' ') : 'Unknown'}
                          </span>
                        </div>
                        {assignedToName && (
                          <p className="task-assigned">Assigned to: {assignedToName}</p>
                        )}
                    <div className="task-progress-container" style={{ marginTop: '10px' }}>
                      <div className="task-progress-bar" style={{ height: '8px', background: '#ecf0f1', borderRadius: '4px', overflow: 'hidden' }}>
                        <div
                          className="task-progress-fill"
                          style={{
                            width: `${task.progressPercentage || 0}%`,
                            height: '100%',
                            backgroundColor: getTaskColor(
                              task.status,
                              task.pmRating,
                              task.clientRating
                            ),
                            transition: 'width 0.3s ease, background-color 0.3s ease'
                          }}
                        />
                      </div>
                      <div style={{ fontSize: '12px', fontWeight: '600', color: '#2c3e50', minWidth: '40px', textAlign: 'right' }}>
                        {task.progressPercentage || 0}%
                      </div>
                    </div>
                  </div>
                    );
                  })
              )}
            </div>
          </div>

          <div className="section">
            <div className="section-header">
              <h2>Files & Media</h2>
              <button
                className="add-btn"
                onClick={() => setShowUploadModal(true)}
              >
                <FiUpload /> Upload File
              </button>
            </div>
            <div className="files-list">
              {files.length === 0 ? (
                <div className="empty-state">No files uploaded yet</div>
              ) : (
                files.map(file => (
                  <div key={file._id} className="file-item">
                    <div className="file-icon">
                      <FiFile size={24} />
                    </div>
                    <div className="file-info">
                      <div className="file-name">{file.originalName}</div>
                      <div className="file-meta">
                        {formatFileSize(file.size)} • {file.category} • Uploaded by {file.uploadedBy?.name || 'Unknown'} • {new Date(file.createdAt).toLocaleDateString()}
                      </div>
                      {file.description && (
                        <div className="file-description">{file.description}</div>
                      )}
                    </div>
                    <div className="file-actions">
                      <a
                        href={`${process.env.REACT_APP_API_URL || 'http://localhost:5000'}${file.path}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="file-action-btn"
                        title="Download"
                      >
                        <FiDownload />
                      </a>
                      {(canManage || (file.uploadedBy?._id || file.uploadedBy?.id) === (user?.id || user?._id)) && (
                        <button
                          className="file-action-btn delete-btn"
                          onClick={() => handleDeleteFile(file._id)}
                          title="Delete"
                        >
                          <FiTrash2 />
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="section">
            <h2>Comments</h2>
            <form onSubmit={handleAddComment} className="comment-form">
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Add a comment..."
                rows="3"
              />
              <button type="submit" className="submit-btn">
                <FiSend /> Post Comment
              </button>
            </form>
            <div className="comments-list">
              {comments.length === 0 ? (
                <div className="empty-state">No comments yet</div>
              ) : (
                comments
                  .filter(comment => comment && comment._id)
                  .map(comment => {
                    const authorName = comment.author?.name || 'Unknown';
                    return (
                      <div key={comment._id} className="comment-item">
                        <div className="comment-author">
                          <div className="author-avatar">
                            {authorName.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="author-name">{authorName}</div>
                            <div className="comment-time">
                              {comment.createdAt ? new Date(comment.createdAt).toLocaleString() : 'N/A'}
                            </div>
                          </div>
                        </div>
                        <div className="comment-content">{comment.content || ''}</div>
                      </div>
                    );
                  })
              )}
            </div>
          </div>
        </div>

        <div className="project-sidebar">
          <div className="section">
            <h2>Progress</h2>
            <div className="progress-display">
              <div className="progress-circle">
                <div className="progress-value">{project.progress || 0}%</div>
              </div>
              <div className="progress-bar-full">
                <div
                  className="progress-fill-full"
                  style={{ width: `${project.progress || 0}%` }}
                />
              </div>
            </div>
          </div>

          <div className="section">
            <h2>Chat</h2>
            <div className="chat-messages">
              {chatMessages.map((msg, idx) => (
                <div key={idx} className="chat-message">
                  <strong>{msg.userName}:</strong> {msg.message}
                </div>
              ))}
            </div>
            <form onSubmit={handleSendChat} className="chat-form">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Type a message..."
              />
              <button type="submit">
                <FiSend />
              </button>
            </form>
          </div>
        </div>
      </div>

      {showAddMember && (
        <div className="modal-overlay" onClick={() => setShowAddMember(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Add Team Member</h2>
            <div className="members-list">
              {availableMembers.length === 0 ? (
                <div className="empty-state">No available members</div>
              ) : (
                availableMembers
                  .filter(member => member && member._id)
                  .map(member => {
                    const memberName = member.name || 'Unknown';
                    const memberEmail = member.email || '';
                    return (
                      <div
                        key={member._id}
                        className={`member-select-item ${addingMember ? 'disabled' : ''}`}
                        onClick={() => !addingMember && handleAddMember(member._id)}
                        style={{ opacity: addingMember ? 0.6 : 1, cursor: addingMember ? 'not-allowed' : 'pointer' }}
                      >
                        <div className="member-avatar">{memberName.charAt(0).toUpperCase()}</div>
                        <div>
                          <div className="member-name">{memberName}</div>
                          {memberEmail && <div className="member-email">{memberEmail}</div>}
                        </div>
                      </div>
                    );
                  })
              )}
            </div>
            <button
              className="close-btn"
              onClick={() => setShowAddMember(false)}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {showCreateTask && (
        <div className="modal-overlay" onClick={() => setShowCreateTask(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Create New Task</h2>
            <form onSubmit={handleCreateTask}>
              <div className="form-group">
                <label>Title *</label>
                <input
                  type="text"
                  value={taskFormData.title}
                  onChange={(e) => setTaskFormData({ ...taskFormData, title: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea
                  value={taskFormData.description}
                  onChange={(e) => setTaskFormData({ ...taskFormData, description: e.target.value })}
                  rows="4"
                />
              </div>
              <div className="form-group">
                <label>Assign To (Optional)</label>
                <select
                  value={taskFormData.assignedTo}
                  onChange={(e) => setTaskFormData({ ...taskFormData, assignedTo: e.target.value })}
                >
                  <option value="">Select team member</option>
                  {project?.teamMembers
                    ?.filter(member => member && (member._id || member))
                    ?.map(member => {
                      const memberId = member._id || member;
                      const memberName = member.name || 'Unknown';
                      return (
                        <option key={memberId} value={memberId}>
                          {memberName}
                        </option>
                      );
                    })}
                </select>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Priority</label>
                  <select
                    value={taskFormData.priority}
                    onChange={(e) => setTaskFormData({ ...taskFormData, priority: e.target.value })}
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Due Date</label>
                  <input
                    type="date"
                    value={taskFormData.dueDate}
                    onChange={(e) => setTaskFormData({ ...taskFormData, dueDate: e.target.value })}
                  />
                </div>
              </div>
              <div className="modal-actions">
                <button type="button" onClick={() => setShowCreateTask(false)}>
                  Cancel
                </button>
                <button type="submit">Create Task</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showUploadModal && (
        <div className="modal-overlay" onClick={() => setShowUploadModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Upload File</h2>
            <form onSubmit={handleFileUpload}>
              <div className="form-group">
                <label>File *</label>
                <input
                  type="file"
                  name="file"
                  required
                  accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.rar,.7z,.tar,.gz"
                />
                <small>Maximum file size: 100MB. All file types are supported.</small>
              </div>
              <div className="form-group">
                <label>Description (Optional)</label>
                <textarea
                  name="description"
                  rows="3"
                  placeholder="Add a description for this file..."
                />
              </div>
              <div className="modal-actions">
                <button type="button" onClick={() => setShowUploadModal(false)} disabled={uploadingFile}>
                  Cancel
                </button>
                <button type="submit" disabled={uploadingFile}>
                  {uploadingFile ? 'Uploading...' : 'Upload File'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showClientLogoModal && (
        <div className="modal-overlay" onClick={() => !uploadingLogo && setShowClientLogoModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Update Client Logo</h2>
            <form onSubmit={handleClientLogoUpload}>
              <div className="form-group">
                <label>Client Company Logo</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleClientLogoChange}
                  disabled={uploadingLogo}
                />
                <small style={{ display: 'block', marginTop: '8px', color: 'var(--gray-600)' }}>
                  Recommended: Square image, max 5MB (PNG, JPG, GIF, SVG)
                </small>
                {clientLogoPreview && (
                  <div style={{ marginTop: '12px' }}>
                    <img
                      src={clientLogoPreview}
                      alt="Logo preview"
                      style={{
                        maxWidth: '200px',
                        maxHeight: '200px',
                        borderRadius: '8px',
                        border: '1px solid var(--gray-200)',
                        padding: '8px',
                        background: 'white'
                      }}
                    />
                  </div>
                )}
                {project?.clientLogo && !clientLogoPreview && (
                  <div style={{ marginTop: '12px' }}>
                    <p style={{ marginBottom: '8px', color: 'var(--gray-600)' }}>Current logo:</p>
                    <img
                      src={`${process.env.REACT_APP_API_URL || 'http://localhost:5000'}${project.clientLogo.path}`}
                      alt="Current logo"
                      style={{
                        maxWidth: '200px',
                        maxHeight: '200px',
                        borderRadius: '8px',
                        border: '1px solid var(--gray-200)',
                        padding: '8px',
                        background: 'white'
                      }}
                    />
                  </div>
                )}
              </div>
              <div className="modal-actions">
                <button
                  type="button"
                  onClick={() => {
                    setShowClientLogoModal(false);
                    setClientLogoFile(null);
                    setClientLogoPreview(null);
                  }}
                  disabled={uploadingLogo}
                >
                  Cancel
                </button>
                <button type="submit" disabled={uploadingLogo || !clientLogoFile}>
                  {uploadingLogo ? 'Uploading...' : 'Update Logo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectDetail;

