const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { body, validationResult } = require('express-validator');
const Project = require('../models/Project');
const User = require('../models/User');
const { authenticate, authorize, isProjectManager } = require('../middleware/auth');
const { createNotification, createBulkNotifications } = require('../utils/notifications');

const router = express.Router();

// Configure multer for client logo uploads
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const logoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'client-logo-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const logoFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|bmp|webp|svg/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype) || file.mimetype.startsWith('image/');

  if (extname || mimetype) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Please upload an image file.'));
  }
};

const logoUpload = multer({
  storage: logoStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: logoFilter
});

// All routes require authentication
router.use(authenticate);

// Get all projects (filtered by role)
router.get('/', async (req, res) => {
  try {
    let query = {};

    if (req.user.role === 'admin') {
      // Admin sees all projects
    } else if (req.user.role === 'project_manager') {
      query.projectManager = req.user._id;
    } else if (req.user.role === 'team_member') {
      query.teamMembers = req.user._id;
    } else if (req.user.role === 'client') {
      query.client = req.user._id;
    }

    const projects = await Project.find(query)
      .populate('projectManager', 'name email')
      .populate('client', 'name email')
      .populate('teamMembers', 'name email')
      .sort({ createdAt: -1 });

    res.json(projects);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get single project
router.get('/:id', async (req, res) => {
  try {
    const project = await Project.findById(req.params.id)
      .populate('projectManager', 'name email')
      .populate('client', 'name email')
      .populate('teamMembers', 'name email');

    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    // Check access
    const hasAccess = 
      req.user.role === 'admin' ||
      project.projectManager._id.toString() === req.user._id.toString() ||
      project.client?._id.toString() === req.user._id.toString() ||
      project.teamMembers.some(m => m._id.toString() === req.user._id.toString());

    if (!hasAccess) {
      return res.status(403).json({ message: 'Access denied' });
    }

    res.json(project);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Create project (only PM or Admin) with optional client logo
router.post('/', logoUpload.single('clientLogo'), 
[
  body('title').trim().notEmpty().withMessage('Project title is required'),
  body('description').optional().trim()
], authorize('admin', 'project_manager'), 
// logoUpload.single('clientLogo'), 

async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      // Clean up uploaded file if validation fails
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(400).json({ errors: errors.array() });
    }

    const { title, description, clientId, startDate, endDate } = req.body;

    // Verify client if provided
    if (clientId) {
      const client = await User.findById(clientId);
      if (!client || client.role !== 'client') {
        // Clean up uploaded file if client invalid
        if (req.file && fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
        return res.status(400).json({ message: 'Invalid client ID' });
      }
    }

    const projectData = {
      title,
      description,
      projectManager: req.user._id,
      client: clientId || null,
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
      status: 'not_started'
    };

    // Add client logo if uploaded
    if (req.file) {
      projectData.clientLogo = {
        filename: req.file.filename,
        path: `/uploads/${req.file.filename}`,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size
      };
    }

    const project = new Project(projectData);
    await project.save();

    // Notify client if added
    if (clientId) {
      await createNotification(
        clientId,
        'project_created',
        'New Project',
        `You have been added to project: ${title}`
      );
    }

    const populatedProject = await Project.findById(project._id)
      .populate('projectManager', 'name email')
      .populate('client', 'name email')
      .populate('teamMembers', 'name email');

    res.status(201).json(populatedProject);
  } catch (error) {
    // Clean up uploaded file on error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update project (with optional client logo update)
router.put('/:id', isProjectManager, [
  body('title').optional().trim().notEmpty(),
  body('description').optional().trim()
], logoUpload.single('clientLogo'), async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { title, description, clientId, status, startDate, endDate } = req.body;

    if (title) req.project.title = title;
    if (description !== undefined) req.project.description = description;
    if (status) {
      req.project.status = status;
      // Automatically set start date when project is started
      if (status === 'in_progress' && !req.project.startDate) {
        req.project.startDate = new Date();
      }
      // Automatically set end date when project is completed
      if (status === 'completed' && !req.project.endDate) {
        req.project.endDate = new Date();
      }
      // Recalculate progress when status changes
      if (status === 'completed') {
        await req.project.calculateProgress();
      }
    }
    if (startDate) req.project.startDate = new Date(startDate);
    if (endDate) req.project.endDate = new Date(endDate);

    // Update client if provided
    if (clientId) {
      const client = await User.findById(clientId);
      if (!client || client.role !== 'client') {
        // Clean up uploaded file if client invalid
        if (req.file && fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
        return res.status(400).json({ message: 'Invalid client ID' });
      }
      req.project.client = clientId;
    }

    // Update client logo if uploaded
    if (req.file) {
      // Delete old logo if exists
      if (req.project.clientLogo && req.project.clientLogo.filename) {
        const oldLogoPath = path.join(uploadsDir, req.project.clientLogo.filename);
        if (fs.existsSync(oldLogoPath)) {
          fs.unlinkSync(oldLogoPath);
        }
      }
      
      req.project.clientLogo = {
        filename: req.file.filename,
        path: `/uploads/${req.file.filename}`,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size
      };
    }

    await req.project.save();

    // Populate and return the updated project
    const updatedProject = await Project.findById(req.project._id)
      .populate('projectManager', 'name email')
      .populate('client', 'name email')
      .populate('teamMembers', 'name email');

    // Notify team members (handle both populated objects and IDs)
    const notifyUsers = req.project.teamMembers.map(tm => {
      // Handle both populated objects (tm._id) and plain IDs (tm)
      return tm._id ? tm._id : tm;
    });
    if (req.project.client) {
      notifyUsers.push(req.project.client._id || req.project.client);
    }
    
    if (notifyUsers.length > 0) {
      const statusMessages = {
        'in_progress': 'has been started',
        'completed': 'has been completed',
        'on_hold': 'has been put on hold',
        'not_started': 'status has been updated'
      };
      const message = status && statusMessages[status] 
        ? `Project "${req.project.title}" ${statusMessages[status]}`
        : `Project "${req.project.title}" has been updated`;
      
      await createBulkNotifications(
        notifyUsers,
        'project_updated',
        'Project Updated',
        message,
        req.project._id
      );
    }

    res.json(updatedProject);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Add team member to project
router.post('/:id/team-members', isProjectManager, [
  body('userId').isMongoId().withMessage('Valid user ID is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { userId } = req.body;

    const user = await User.findById(userId);
    if (!user || user.role !== 'team_member') {
      return res.status(400).json({ message: 'Invalid team member ID' });
    }

    // Check if team member is already in project (handle both ObjectId and string comparison)
    const isAlreadyMember = req.project.teamMembers.some(
      memberId => memberId.toString() === userId.toString()
    );
    if (isAlreadyMember) {
      return res.status(400).json({ message: 'Team member already in project' });
    }

    req.project.teamMembers.push(userId);
    await req.project.save();

    // Create notification (non-blocking)
    try {
      await createNotification(
        userId,
        'team_member_added',
        'Added to Project',
        `You have been added to project: ${req.project.title}`,
        req.project._id
      );
    } catch (notificationError) {
      console.error('Failed to create notification:', notificationError);
      // Continue even if notification creation fails
    }

    // Populate and return the updated project
    const updatedProject = await Project.findById(req.project._id)
      .populate('projectManager', 'name email')
      .populate('client', 'name email')
      .populate('teamMembers', 'name email');

    res.json(updatedProject);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Remove team member from project (only after completion or by admin)
router.delete('/:id/team-members/:userId', isProjectManager, async (req, res) => {
  try {
    // Check if project is completed or user is admin
    const isAdmin = req.user.role === 'admin';
    const isCompleted = req.project.status === 'completed';
    
    if (!isCompleted && !isAdmin) {
      return res.status(403).json({ 
        message: 'Team members can only be removed after project completion or by admin' 
      });
    }

    req.project.teamMembers = req.project.teamMembers.filter(
      memberId => memberId.toString() !== req.params.userId.toString()
    );
    await req.project.save();

    await createNotification(
      req.params.userId,
      'team_member_removed',
      'Removed from Project',
      `You have been removed from project: ${req.project.title}`,
      req.project._id
    );

    // Populate and return the updated project
    const updatedProject = await Project.findById(req.project._id)
      .populate('projectManager', 'name email')
      .populate('client', 'name email')
      .populate('teamMembers', 'name email');

    res.json(updatedProject);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Remove client from project (only after completion or by admin)
router.delete('/:id/client', isProjectManager, async (req, res) => {
  try {
    // Check if project is completed or user is admin
    const isAdmin = req.user.role === 'admin';
    const isCompleted = req.project.status === 'completed';
    
    if (!isCompleted && !isAdmin) {
      return res.status(403).json({ 
        message: 'Client can only be removed after project completion or by admin' 
      });
    }

    const clientId = req.project.client;
    req.project.client = null;
    await req.project.save();

    if (clientId) {
      await createNotification(
        clientId,
        'client_removed',
        'Removed from Project',
        `You have been removed from project: ${req.project.title}`,
        req.project._id
      );
    }

    // Populate and return the updated project
    const updatedProject = await Project.findById(req.project._id)
      .populate('projectManager', 'name email')
      .populate('client', 'name email')
      .populate('teamMembers', 'name email');

    res.json(updatedProject);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;

