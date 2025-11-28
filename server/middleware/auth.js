const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Verify JWT token
exports.authenticate = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key-change-in-production');
    const user = await User.findById(decoded.userId).select('-password');
    
    if (!user || !user.isActive) {
      return res.status(401).json({ message: 'User not found or inactive' });
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Invalid token' });
  }
};

// Role-based authorization
exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Access denied. Insufficient permissions.' });
    }

    next();
  };
};

// Check if user is project manager of a project
exports.isProjectManager = async (req, res, next) => {
  try {
    const Project = require('../models/Project');
    const mongoose = require('mongoose');
    
    // Check for project ID in params.id (for routes like /:id/team-members) or params.projectId or body.projectId
    const projectId = req.params.id || req.params.projectId || req.body.projectId;
    
    if (!projectId) {
      return res.status(400).json({ message: 'Project ID is required' });
    }

    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      return res.status(400).json({ message: 'Invalid project ID format' });
    }

    // Try to find the project
    let project;
    try {
      project = await Project.findById(projectId);
    } catch (dbError) {
      console.error('Database error finding project:', dbError);
      return res.status(500).json({ message: 'Database error while finding project', error: dbError.message });
    }
    
    if (!project) {
      console.error(`Project not found with ID: ${projectId}, User: ${req.user._id}, Role: ${req.user.role}`);
      return res.status(404).json({ message: 'Project not found' });
    }

    // Check if user is project manager or admin
    const isProjectManager = project.projectManager.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';
    
    if (!isProjectManager && !isAdmin) {
      return res.status(403).json({ message: 'Only project manager or admin can perform this action' });
    }

    req.project = project;
    next();
  } catch (error) {
    console.error('Error in isProjectManager middleware:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

