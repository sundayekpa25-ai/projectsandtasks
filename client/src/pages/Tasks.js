import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { FiCheckCircle, FiXCircle, FiUpload } from 'react-icons/fi';
import './Tasks.css';

const Tasks = () => {
  const [searchParams] = useSearchParams();
  const taskId = searchParams.get('taskId');
  const { user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [selectedTask, setSelectedTask] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [submitData, setSubmitData] = useState({ work: '', files: [] });
  const [reviewData, setReviewData] = useState({ rating: 'approved', feedback: '' });
  const [uploadingFiles, setUploadingFiles] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchTasks();
  }, []);

  useEffect(() => {
    if (taskId) {
      const task = tasks.find(t => t._id === taskId);
      if (task) {
        setSelectedTask(task);
      }
    }
  }, [taskId, tasks]);

  const fetchTasks = async () => {
    try {
      const response = await axios.get('/api/tasks');
      setTasks(response.data);
      if (taskId) {
        const task = response.data.find(t => t._id === taskId);
        if (task) setSelectedTask(task);
      }
    } catch (error) {
      console.error('Error fetching tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitWork = async (e) => {
    e.preventDefault();
    if (submitting) return;
    
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('work', submitData.work);
      
      // Append files if any
      if (uploadingFiles.length > 0) {
        uploadingFiles.forEach(file => {
          formData.append('files', file);
        });
      }

      await axios.post(`/api/tasks/${selectedTask._id}/submit`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      
      setShowSubmitModal(false);
      setSubmitData({ work: '', files: [] });
      setUploadingFiles([]);
      fetchTasks();
      alert('Work submitted successfully!');
    } catch (error) {
      if (error.response?.data?.errors) {
        const errorMessages = error.response.data.errors.map(err => err.msg || err.message).join(', ');
        alert(errorMessages);
      } else {
        alert(error.response?.data?.message || 'Error submitting work');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    setUploadingFiles(files);
  };

  const handleReview = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`/api/tasks/${selectedTask._id}/review`, reviewData);
      setShowReviewModal(false);
      setReviewData({ rating: 'approved', feedback: '' });
      fetchTasks();
      alert('Review submitted successfully!');
    } catch (error) {
      alert(error.response?.data?.message || 'Error submitting review');
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

  const canReview = (task) => {
    if (user?.role === 'admin') return true;
    // PM can review when task is submitted
    if (user?.role === 'project_manager' && (task.status === 'submitted' || task.status === 'pm_reviewed')) {
      // Check if this PM is the project manager
      const pmId = task.project?.projectManager?._id || task.project?.projectManager;
      if (pmId === (user?.id || user?._id)) {
        return task.status === 'submitted' || (task.status === 'pm_reviewed' && task.pmRating !== 'approved');
      }
    }
    // Client can review when PM has reviewed and approved
    if (user?.role === 'client' && task.status === 'pm_reviewed' && task.pmRating === 'approved') {
      // Check if this client is the project client
      const clientId = task.project?.client?._id || task.project?.client;
      if (clientId === (user?.id || user?._id)) {
        return true;
      }
    }
    return false;
  };

  if (loading) {
    return <div className="loading">Loading tasks...</div>;
  }

  return (
    <div className="tasks-page">
      <div className="tasks-header">
        <h1>Tasks</h1>
      </div>

      <div className="tasks-layout">
        <div className="tasks-list-panel">
          <h2>All Tasks</h2>
          {tasks.length === 0 ? (
            <div className="empty-state">No tasks found</div>
          ) : (
            <div className="tasks-list">
              {tasks.map(task => (
                <div
                  key={task._id}
                  className={`task-item ${selectedTask?._id === task._id ? 'active' : ''}`}
                  onClick={() => setSelectedTask(task)}
                >
                  <div className="task-item-header">
                    <h3>{task.title}</h3>
                    <span
                      className="task-status-badge"
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
                  <p className="task-project-name">Project: {task.project?.title}</p>
                  {task.assignedTo && (
                    <p className="task-assigned-name">
                      Assigned to: {task.assignedTo.name}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="task-detail-panel">
          {selectedTask ? (
            <>
              <div className="task-detail-header">
                <h2>{selectedTask.title}</h2>
                <span
                  className="task-status"
                  style={{
                    backgroundColor: getTaskColor(
                      selectedTask.status,
                      selectedTask.pmRating,
                      selectedTask.clientRating
                    )
                  }}
                >
                  {selectedTask.status.replace('_', ' ')}
                </span>
              </div>

              <div className="task-detail-content">
                <div className="detail-section">
                  <h3>Description</h3>
                  <p>{selectedTask.description || 'No description provided'}</p>
                </div>

                <div className="detail-section">
                  <h3>Project</h3>
                  <Link to={`/projects/${selectedTask.project?._id || selectedTask.project}`}>
                    {selectedTask.project?.title || 'N/A'}
                  </Link>
                </div>

                {selectedTask.assignedTo && (
                  <div className="detail-section">
                    <h3>Assigned To</h3>
                    <p>{selectedTask.assignedTo.name} ({selectedTask.assignedTo.email})</p>
                  </div>
                )}

                {selectedTask.submission && (
                  <div className="detail-section">
                    <h3>Submitted Work</h3>
                    <p>{selectedTask.submission.work}</p>
                    {selectedTask.submission.files?.length > 0 && (
                      <div className="submission-files">
                        <strong>Attached Files:</strong>
                        <ul className="submission-files-list">
                          {selectedTask.submission.files.map((file, idx) => {
                            // Handle both object format (new) and string format (old)
                            const fileObj = typeof file === 'string' ? { path: file, originalName: file } : file;
                            const filePath = fileObj.path || fileObj;
                            const fileName = fileObj.originalName || fileObj.filename || fileObj;
                            const fileSize = fileObj.size;
                            
                            return (
                              <li key={idx} className="submission-file-item">
                                <a
                                  href={`${process.env.REACT_APP_API_URL || 'http://localhost:5000'}${filePath}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="file-link"
                                >
                                  {fileName}
                                </a>
                                {fileSize && (
                                  <span className="file-size">
                                    {' '}({(fileSize / 1024).toFixed(2)} KB)
                                  </span>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )}
                    <p className="submission-date">
                      Submitted: {new Date(selectedTask.submission.submittedAt).toLocaleString()}
                    </p>
                  </div>
                )}

                {selectedTask.pmFeedback && (
                  <div className="detail-section">
                    <h3>PM Feedback</h3>
                    <p>{selectedTask.pmFeedback}</p>
                    <p className="rating-badge">
                      Rating: {selectedTask.pmRating}
                    </p>
                  </div>
                )}

                {selectedTask.clientFeedback && (
                  <div className="detail-section">
                    <h3>Client Feedback</h3>
                    <p>{selectedTask.clientFeedback}</p>
                    <p className="rating-badge">
                      Rating: {selectedTask.clientRating}
                    </p>
                  </div>
                )}

                {/* Progress Line */}
                <div className="detail-section">
                  <h3>Progress</h3>
                  <div className="task-progress-container">
                    <div className="task-progress-bar">
                      <div
                        className="task-progress-fill"
                        style={{
                          width: `${selectedTask.progressPercentage || 0}%`,
                          backgroundColor: getTaskColor(
                            selectedTask.status,
                            selectedTask.pmRating,
                            selectedTask.clientRating
                          )
                        }}
                      />
                    </div>
                    <div className="task-progress-percentage">
                      {selectedTask.progressPercentage || 0}%
                    </div>
                  </div>
                </div>

                <div className="task-actions">
                  {/* Allow submitter, PM, client, or admin to submit work */}
                  {((selectedTask.assignedTo?._id === (user?.id || user?._id) ||
                      selectedTask.assignedTo?.toString() === (user?.id || user?._id)?.toString() ||
                      (selectedTask.project?.projectManager?._id || selectedTask.project?.projectManager) === (user?.id || user?._id) ||
                      (selectedTask.project?.client?._id || selectedTask.project?.client) === (user?.id || user?._id) ||
                      user?.role === 'admin') &&
                    (selectedTask.status === 'initiated' || selectedTask.status === 'rejected')) && (
                      <button
                        className="action-btn submit-btn"
                        onClick={() => setShowSubmitModal(true)}
                      >
                        <FiUpload /> Submit Work
                      </button>
                    )}

                  {canReview(selectedTask) && (
                    <button
                      className="action-btn review-btn"
                      onClick={() => setShowReviewModal(true)}
                    >
                      <FiCheckCircle /> Review Task
                    </button>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="no-selection">
              <p>Select a task to view details</p>
            </div>
          )}
        </div>
      </div>

      {showSubmitModal && (
        <div className="modal-overlay" onClick={() => !submitting && setShowSubmitModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Submit Work</h2>
            <form onSubmit={handleSubmitWork}>
              <div className="form-group">
                <label>Work Description *</label>
                <textarea
                  value={submitData.work}
                  onChange={(e) => setSubmitData({ ...submitData, work: e.target.value })}
                  required
                  rows="6"
                  placeholder="Describe the work you've completed..."
                  disabled={submitting}
                />
              </div>
              <div className="form-group">
                <label>Attach Files (Optional)</label>
                <input
                  type="file"
                  multiple
                  onChange={handleFileChange}
                  accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.rar,.7z,.tar,.gz"
                  disabled={submitting}
                />
                <small>You can select multiple files. Maximum file size: 100MB per file.</small>
                {uploadingFiles.length > 0 && (
                  <div className="selected-files">
                    <strong>Selected files:</strong>
                    <ul>
                      {uploadingFiles.map((file, idx) => (
                        <li key={idx}>{file.name} ({(file.size / 1024).toFixed(2)} KB)</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
              <div className="modal-actions">
                <button 
                  type="button" 
                  onClick={() => setShowSubmitModal(false)}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button type="submit" disabled={submitting}>
                  {submitting ? 'Submitting...' : 'Submit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showReviewModal && (
        <div className="modal-overlay" onClick={() => setShowReviewModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Review Task</h2>
            <form onSubmit={handleReview}>
              <div className="form-group">
                <label>Rating *</label>
                <select
                  value={reviewData.rating}
                  onChange={(e) => setReviewData({ ...reviewData, rating: e.target.value })}
                  required
                >
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
              <div className="form-group">
                <label>Feedback</label>
                <textarea
                  value={reviewData.feedback}
                  onChange={(e) => setReviewData({ ...reviewData, feedback: e.target.value })}
                  rows="4"
                  placeholder="Provide feedback on the submitted work..."
                />
              </div>
              <div className="modal-actions">
                <button type="button" onClick={() => setShowReviewModal(false)}>
                  Cancel
                </button>
                <button type="submit">Submit Review</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Tasks;

