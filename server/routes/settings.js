const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authenticate, authorize } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');
const Settings = require('../models/Settings');

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for logo uploads
const logoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'logo-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const logoFilter = (req, file, cb) => {
  // Only allow image files
  const allowedTypes = /jpeg|jpg|png|gif|bmp|webp|svg/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype) || file.mimetype.startsWith('image/');

  if (extname || mimetype) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Please upload an image file (JPEG, PNG, GIF, etc.).'));
  }
};

const logoUpload = multer({
  storage: logoStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit for logos
  fileFilter: logoFilter
});

// Get settings (public, but logo only visible to authenticated users)
router.get('/', async (req, res) => {
  try {
    const settings = await Settings.getSettings();
    res.json(settings);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update company logo (admin only)
router.post('/logo', authorize('admin'), logoUpload.single('logo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No logo file uploaded' });
    }

    const settings = await Settings.getSettings();

    // Delete old logo if exists
    if (settings.companyLogo && settings.companyLogo.filename) {
      const oldLogoPath = path.join(uploadsDir, settings.companyLogo.filename);
      if (fs.existsSync(oldLogoPath)) {
        fs.unlinkSync(oldLogoPath);
      }
    }

    // Update settings with new logo
    settings.companyLogo = {
      filename: req.file.filename,
      path: `/uploads/${req.file.filename}`,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size
    };
    settings.updatedBy = req.user._id;

    await settings.save();

    res.json({
      message: 'Company logo uploaded successfully',
      logo: settings.companyLogo
    });
  } catch (error) {
    // Clean up uploaded file on error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update company name (admin only)
router.put('/', authorize('admin'), [
  body('companyName').optional().trim().notEmpty()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const settings = await Settings.getSettings();
    
    if (req.body.companyName) {
      settings.companyName = req.body.companyName;
    }
    settings.updatedBy = req.user._id;

    await settings.save();

    res.json(settings);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;

