const express = require('express');
const User = require('../models/User');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// Get all users (filtered by role permissions)
router.get('/', authenticate, async (req, res) => {
  try {
    let query = {};

    // Filter based on role
    if (req.user.role === 'admin') {
      // Admin can see all users
    } else if (req.user.role === 'project_manager') {
      // PM can see team members and clients
      query.role = { $in: ['team_member', 'client'] };
    } else {
      // Others can only see users in their projects
      return res.status(403).json({ message: 'Access denied' });
    }

    const users = await User.find(query).select('-password');
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get user by ID
router.get('/:id', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;

