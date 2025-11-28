const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { body, validationResult } = require('express-validator');
const Task = require('../models/Task');
const Project = require('../models/Project');
const { authenticate, authorize, isProjectManager } = require('../middleware/auth');
const { createNotification, createBulkNotifications } = require('../utils/notifications');

const router = express.Router();

// Configure multer for task submission files
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'task-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|bmp|webp|svg|pdf|doc|docx|xls|xlsx|ppt|pptx|txt|csv|zip|rar|7z|tar|gz|mp4|avi|mov|wmv|flv|webm|mp3|wav|ogg|m4a|aac/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype) || file.mimetype.startsWith('video/') || file.mimetype.startsWith('audio/');

  if (extname || mimetype) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Please upload a valid media file.'));
  }
};

const upload = multer({
  storage: storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit
  fileFilter: fileFilter
});

// All routes require authentication
router.use(authenticate);

// Get all tasks (filtered by role and project)
router.get('/', async (req, res) => {
  try {
    let query = {};

    if (req.query.projectId) {
      query.project = req.query.projectId;
    }

    // Filter based on role
    if (req.user.role === 'admin') {
      // Admin sees all tasks
    } else if (req.user.role === 'project_manager') {
      const projects = await Project.find({ projectManager: req.user._id });
      query.project = { $in: projects.map(p => p._id) };
    } else if (req.user.role === 'team_member') {
      query.assignedTo = req.user._id;
    } else if (req.user.role === 'client') {
      const projects = await Project.find({ client: req.user._id });
      query.project = { $in: projects.map(p => p._id) };
    }

    const tasks = await Task.find(query)
      .populate('project', 'title projectManager client')
      .populate('assignedTo', 'name email')
      .populate('assignedBy', 'name email')
      .sort({ createdAt: -1 });

    // Ensure progress is calculated for all tasks
    for (let task of tasks) {
      if (task.progressPercentage === undefined || task.progressPercentage === null) {
        task.calculateProgress();
        await task.save();
      }
    }

    res.json(tasks);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get single task
router.get('/:id', async (req, res) => {
  try {
    const task = await Task.findById(req.params.id)
      .populate('project', 'title projectManager client teamMembers')
      .populate('assignedTo', 'name email')
      .populate('assignedBy', 'name email');

    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    // Check access - submitter, PM/initiator, and admins can access
    const project = task.project;
    const isSubmitter = task.assignedTo && (task.assignedTo._id || task.assignedTo).toString() === req.user._id.toString();
    const isPM = project.projectManager && (project.projectManager._id || project.projectManager).toString() === req.user._id.toString();
    const isClient = project.client && (project.client._id || project.client).toString() === req.user._id.toString();
    const isTeamMember = Array.isArray(project.teamMembers) && project.teamMembers.some(m => {
      const memberId = m._id ? m._id.toString() : m.toString();
      return memberId === req.user._id.toString();
    });
    const isAdmin = req.user.role === 'admin';
    
    const hasAccess = isAdmin || isPM || isClient || isSubmitter || isTeamMember;

    if (!hasAccess) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Ensure progress is calculated
    if (task.progressPercentage === undefined || task.progressPercentage === null) {
      task.calculateProgress();
      await task.save();
    }

    res.json(task);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Create task (only PM or Admin)
router.post('/', [
  body('title').trim().notEmpty().withMessage('Task title is required'),
  body('projectId').isMongoId().withMessage('Valid project ID is required'),
  body('assignedTo').optional().isMongoId()
], authorize('admin', 'project_manager'), async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { title, description, projectId, assignedTo, priority, dueDate } = req.body;

    // Verify project
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    // Check if user is PM of this project or admin
    const isProjectManager = project.projectManager.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';
    
    if (!isProjectManager && !isAdmin) {
      return res.status(403).json({ message: 'Only project manager or admin can create tasks' });
    }

    // Verify assigned user is team member
    if (assignedTo) {
      const isTeamMember = project.teamMembers.some(
        memberId => memberId.toString() === assignedTo.toString()
      );
      if (!isTeamMember) {
        return res.status(400).json({ message: 'Assigned user must be a team member of the project' });
      }
    }

    const task = new Task({
      title,
      description,
      project: projectId,
      assignedTo: assignedTo || null,
      assignedBy: req.user._id,
      priority: priority || 'medium',
      dueDate: dueDate ? new Date(dueDate) : null,
      status: 'initiated'
    });

    // Set initial progress
    task.calculateProgress();
    await task.save();

    // Notify assigned team member
    if (assignedTo) {
      await createNotification(
        assignedTo,
        'task_assigned',
        'New Task Assigned',
        `You have been assigned a new task: ${title}`,
        projectId,
        task._id
      );
    }

    // Update project status if first task
    if (project.status === 'not_started') {
      project.status = 'in_progress';
      project.startDate = new Date();
      await project.save();
    }

    res.status(201).json(task);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Submit work (team member) with file upload support
router.post('/:id/submit', upload.array('files', 10), [
  body('work').trim().notEmpty().withMessage('Work description is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      // Clean up uploaded files if validation fails
      if (req.files && req.files.length > 0) {
        req.files.forEach(file => {
          if (fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
          }
        });
      }
      return res.status(400).json({ errors: errors.array() });
    }

    const task = await Task.findById(req.params.id).populate('project');
    if (!task) {
      // Clean up uploaded files if task not found
      if (req.files && req.files.length > 0) {
        req.files.forEach(file => {
          if (fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
          }
        });
      }
      return res.status(404).json({ message: 'Task not found' });
    }

    // Check if user is assigned to this task, or is PM/initiator, client, or admin
    const isAssigned = task.assignedTo?.toString() === req.user._id.toString();
    const isPM = task.project.projectManager?.toString() === req.user._id.toString();
    const isClient = task.project.client?.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';
    
    if (!isAssigned && !isPM && !isClient && !isAdmin) {
      // Clean up uploaded files if access denied
      if (req.files && req.files.length > 0) {
        req.files.forEach(file => {
          if (fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
          }
        });
      }
      return res.status(403).json({ message: 'Only assigned team member, project manager, client, or admin can submit work' });
    }

    const { work } = req.body;

    // Process uploaded files
    const uploadedFiles = (req.files || []).map(file => ({
      filename: file.filename,
      originalName: file.originalname,
      path: `/uploads/${file.filename}`,
      size: file.size,
      mimeType: file.mimetype
    }));

    task.status = 'submitted';
    task.submission = {
      work,
      files: uploadedFiles,
      submittedAt: new Date()
    };
    task.submittedAt = new Date();
    task.calculateProgress(); // Update progress percentage

    await task.save();

    // Notify PM and client
    const notifyUsers = [];
    if (task.project.projectManager) {
      notifyUsers.push(task.project.projectManager._id || task.project.projectManager);
    }
    if (task.project.client) {
      notifyUsers.push(task.project.client._id || task.project.client);
    }

    if (notifyUsers.length > 0) {
      await createBulkNotifications(
        notifyUsers,
        'task_submitted',
        'Task Submitted',
        `Task "${task.title}" has been submitted for review`,
        task.project._id,
        task._id
      );
    }

    // Reload task with populated fields
    const updatedTask = await Task.findById(task._id)
      .populate('project', 'title projectManager client teamMembers')
      .populate('assignedTo', 'name email')
      .populate('assignedBy', 'name email');

    res.json(updatedTask);
  } catch (error) {
    // Clean up uploaded files on error
    if (req.files && req.files.length > 0) {
      req.files.forEach(file => {
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
      });
    }
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Review task (PM or Client)
router.post('/:id/review', [
  body('rating').isIn(['approved', 'rejected']).withMessage('Rating must be approved or rejected'),
  body('feedback').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const task = await Task.findById(req.params.id).populate('project');
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    const { rating, feedback } = req.body;
    const isPM = task.project.projectManager.toString() === req.user._id.toString();
    const isClient = task.project.client?.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';

    if (!isPM && !isClient && !isAdmin) {
      return res.status(403).json({ message: 'Only PM, client, or admin can review tasks' });
    }

    // PM can review when task is submitted
    if (isPM || isAdmin) {
      if (task.status === 'submitted' || task.status === 'pm_reviewed') {
        task.pmRating = rating;
        task.pmFeedback = feedback || '';
        task.status = rating === 'approved' ? 'pm_reviewed' : 'rejected';
      } else {
        return res.status(400).json({ message: 'Task is not in a state for PM review' });
      }
    }

    // Client can review when PM has approved (pm_reviewed with approved rating)
    if (isClient || (isAdmin && task.status === 'pm_reviewed' && task.pmRating === 'approved')) {
      if (task.status === 'pm_reviewed' && task.pmRating === 'approved') {
        task.clientRating = rating;
        task.clientFeedback = feedback || '';
        task.status = rating === 'approved' ? 'client_reviewed' : 'rejected';
      } else {
        return res.status(400).json({ message: 'Task must be approved by PM before client review' });
      }
    }

    if (task.status === 'client_reviewed' && task.clientRating === 'approved') {
      task.status = 'completed';
    }

    // Update progress percentage
    task.calculateProgress();
    await task.save();

    // Update project progress - reload project to ensure we have the latest instance
    const updatedProject = await Project.findById(task.project._id);
    if (updatedProject) {
      await updatedProject.calculateProgress();
    }

    // Notify assigned team member
    if (task.assignedTo) {
      await createNotification(
        task.assignedTo,
        'task_reviewed',
        'Task Reviewed',
        `Your task "${task.title}" has been ${rating}${isPM ? ' by PM' : ' by client'}`,
        task.project._id,
        task._id
      );
    }

    // Reload task with populated fields
    const updatedTask = await Task.findById(task._id)
      .populate('project', 'title projectManager client teamMembers')
      .populate('assignedTo', 'name email')
      .populate('assignedBy', 'name email');

    res.json(updatedTask);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update task (PM only)
router.put('/:id', authorize('admin', 'project_manager'), async (req, res) => {
  try {
    const task = await Task.findById(req.params.id).populate('project');
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    // Check if user is PM of this project
    if (task.project.projectManager.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Only project manager can update tasks' });
    }

    const { title, description, assignedTo, priority, dueDate } = req.body;

    if (title) task.title = title;
    if (description !== undefined) task.description = description;
    if (priority) task.priority = priority;
    if (dueDate) task.dueDate = new Date(dueDate);

    if (assignedTo) {
      const isTeamMember = task.project.teamMembers.some(
        memberId => memberId.toString() === assignedTo.toString()
      );
      if (!isTeamMember) {
        return res.status(400).json({ message: 'Assigned user must be a team member' });
      }
      task.assignedTo = assignedTo;
    }

    await task.save();
    res.json(task);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;

