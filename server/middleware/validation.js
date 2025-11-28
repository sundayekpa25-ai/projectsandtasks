const { body, validationResult } = require('express-validator');

// Handle validation errors
exports.handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// User validation rules
exports.validateUser = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).withMessage('Password must contain uppercase, lowercase, and number'),
  exports.handleValidationErrors
];

// Project validation rules
exports.validateProject = [
  body('title').trim().notEmpty().withMessage('Project title is required'),
  body('description').optional().trim(),
  exports.handleValidationErrors
];

// Task validation rules
exports.validateTask = [
  body('title').trim().notEmpty().withMessage('Task title is required'),
  body('description').optional().trim(),
  body('projectId').isMongoId().withMessage('Valid project ID is required'),
  exports.handleValidationErrors
];

// Comment validation rules
exports.validateComment = [
  body('content').trim().notEmpty().withMessage('Comment content is required'),
  body('projectId').isMongoId().withMessage('Valid project ID is required'),
  exports.handleValidationErrors
];

