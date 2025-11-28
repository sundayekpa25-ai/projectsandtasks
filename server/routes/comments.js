const express = require('express');
const { body, validationResult } = require('express-validator');
const Comment = require('../models/Comment');
const Project = require('../models/Project');
const { authenticate } = require('../middleware/auth');
const { createBulkNotifications } = require('../utils/notifications');

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Get comments for a project
router.get('/project/:projectId', async (req, res) => {
  try {
    const project = await Project.findById(req.params.projectId);
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    // Check access
    const hasAccess = 
      req.user.role === 'admin' ||
      project.projectManager.toString() === req.user._id.toString() ||
      project.client?.toString() === req.user._id.toString() ||
      project.teamMembers.some(m => m.toString() === req.user._id.toString());

    if (!hasAccess) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const comments = await Comment.find({ project: req.params.projectId })
      .populate('author', 'name email role')
      .populate('task', 'title')
      .sort({ createdAt: -1 });

    res.json(comments);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Create comment
router.post('/', [
  body('content').trim().notEmpty().withMessage('Comment content is required'),
  body('projectId').isMongoId().withMessage('Valid project ID is required'),
  body('taskId').optional().isMongoId()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { content, projectId, taskId } = req.body;

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    // Check access
    const hasAccess = 
      req.user.role === 'admin' ||
      project.projectManager.toString() === req.user._id.toString() ||
      project.client?.toString() === req.user._id.toString() ||
      project.teamMembers.some(m => m.toString() === req.user._id.toString());

    if (!hasAccess) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const comment = new Comment({
      content,
      project: projectId,
      task: taskId || null,
      author: req.user._id
    });

    await comment.save();
    await comment.populate('author', 'name email role');

    // Notify project participants (except comment author)
    const notifyUsers = [
      project.projectManager,
      ...(Array.isArray(project.teamMembers) ? project.teamMembers : []),
      project.client
    ].filter(u => {
      if (!u) return false;
      const userId = u._id ? u._id.toString() : u.toString();
      return userId !== req.user._id.toString();
    });

    if (notifyUsers.length > 0) {
      await createBulkNotifications(
        notifyUsers,
        'comment_added',
        'New Comment',
        `${req.user.name} commented on project "${project.title}"`,
        projectId,
        taskId || null
      );
    }

    res.status(201).json(comment);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Reply to comment
router.post('/:id/reply', [
  body('content').trim().notEmpty().withMessage('Reply content is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const comment = await Comment.findById(req.params.id).populate('project');
    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    // Check access
    const project = comment.project;
    const hasAccess = 
      req.user.role === 'admin' ||
      project.projectManager.toString() === req.user._id.toString() ||
      project.client?.toString() === req.user._id.toString() ||
      project.teamMembers.some(m => m.toString() === req.user._id.toString());

    if (!hasAccess) {
      return res.status(403).json({ message: 'Access denied' });
    }

    comment.replies.push({
      content: req.body.content,
      author: req.user._id
    });

    await comment.save();
    await comment.populate('author', 'name email role');
    await comment.populate('replies.author', 'name email role');

    res.json(comment);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;

