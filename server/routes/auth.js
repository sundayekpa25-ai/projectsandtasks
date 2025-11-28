const express = require('express');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { authenticate, authorize } = require('../middleware/auth');
const { createNotification } = require('../utils/notifications');

const router = express.Router();

// Generate JWT token
const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET || 'your-secret-key-change-in-production', {
    expiresIn: '7d'
  });
};

// Register/Onboard user
router.post('/register', [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).withMessage('Password must contain uppercase, lowercase, and number'),
  body('role').isIn(['admin', 'project_manager', 'team_member', 'client']).withMessage('Valid role is required')
], authenticate, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, email, password, role } = req.body;

    // Check permissions
    if (role === 'admin' && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Only admins can create admin users' });
    }

    if (role === 'project_manager' && !['admin'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Only admins can onboard project managers' });
    }

    if (role === 'team_member' && !['admin', 'project_manager'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Only admins and project managers can onboard team members' });
    }

    if (role === 'client' && !['admin', 'project_manager'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Only admins and project managers can onboard clients' });
    }

    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User with this email already exists' });
    }

    // Create user
    const user = new User({
      name,
      email,
      password,
      role,
      onboardedBy: req.user._id
    });

    await user.save();

    // Create notification (non-blocking - don't fail if notification creation fails)
    try {
      await createNotification(
        user._id,
        'user_onboarded',
        'Welcome!',
        `You have been onboarded by ${req.user.name}`
      );
    } catch (notificationError) {
      console.error('Failed to create notification:', notificationError);
      // Continue even if notification creation fails
    }

    res.status(201).json({
      message: 'User onboarded successfully',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Login
router.post('/login', [
  body('email').isEmail().withMessage('Please provide a valid email'),
  body('password').notEmpty().withMessage('Password is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;
    
    // Validate inputs
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }
    
    // Normalize email (lowercase, trim)
    const normalizedEmail = email.toLowerCase().trim();

    if (!normalizedEmail || normalizedEmail.length === 0) {
      return res.status(400).json({ message: 'Valid email is required' });
    }

    // Find user by email (case-insensitive search)
    const user = await User.findOne({ email: normalizedEmail }).select('+password');
    
    if (!user) {
      console.log(`Login attempt failed: User not found for email: ${normalizedEmail}`);
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    if (!user.isActive) {
      console.log(`Login attempt failed: Account inactive for email: ${normalizedEmail}`);
      return res.status(401).json({ message: 'Account is inactive. Please contact your administrator.' });
    }

    // Verify password field exists
    if (!user.password) {
      console.error(`Login error: Password field missing for user: ${user._id}`);
      return res.status(500).json({ message: 'Server error: User password not found' });
    }

    // Compare password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      console.log(`Login attempt failed: Invalid password for email: ${normalizedEmail}`);
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    console.log(`Login successful for user: ${user.email} (${user.role})`);

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    const token = generateToken(user._id);

    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get current user
router.get('/me', authenticate, async (req, res) => {
  res.json({
    user: {
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role
    }
  });
});

module.exports = router;

