const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authenticate } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');
const File = require('../models/File');
const Project = require('../models/Project');

const router = express.Router();

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  // Allow all common file types - images, documents, videos, audio, archives
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
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit for media files
  fileFilter: fileFilter
});

// Helper function to determine file category
const getFileCategory = (mimetype, filename) => {
  if (mimetype.startsWith('image/')) return 'image';
  if (mimetype.startsWith('video/')) return 'video';
  if (mimetype.startsWith('audio/')) return 'audio';
  if (mimetype.includes('pdf') || mimetype.includes('document') || mimetype.includes('text') || 
      /\.(doc|docx|xls|xlsx|ppt|pptx|txt|csv)$/i.test(filename)) return 'document';
  if (/\.(zip|rar|7z|tar|gz)$/i.test(filename)) return 'archive';
  return 'other';
};

// Upload file to project
router.post('/', authenticate, upload.single('file'), [
  body('projectId').isMongoId().withMessage('Valid project ID is required'),
  body('description').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const { projectId, description } = req.body;

    // Verify project exists
    const project = await Project.findById(projectId);
    if (!project) {
      // Delete uploaded file if project doesn't exist
      fs.unlinkSync(req.file.path);
      return res.status(404).json({ message: 'Project not found' });
    }

    // Check if user has access to the project
    const hasAccess = 
      req.user.role === 'admin' ||
      (project.projectManager && project.projectManager.toString() === req.user._id.toString()) ||
      (project.client && project.client.toString() === req.user._id.toString()) ||
      (Array.isArray(project.teamMembers) && project.teamMembers.some(m => {
        const memberId = m._id ? m._id.toString() : m.toString();
        return memberId === req.user._id.toString();
      }));

    if (!hasAccess) {
      // Delete uploaded file if user doesn't have access
      fs.unlinkSync(req.file.path);
      return res.status(403).json({ message: 'Access denied. You do not have permission to upload files to this project.' });
    }

    // Determine file category
    const category = getFileCategory(req.file.mimetype, req.file.originalname);

    // Save file record to database
    const fileRecord = new File({
      filename: req.file.filename,
      originalName: req.file.originalname,
      path: `/uploads/${req.file.filename}`,
      size: req.file.size,
      mimeType: req.file.mimetype,
      project: projectId,
      uploadedBy: req.user._id,
      category: category,
      description: description || ''
    });

    await fileRecord.save();

    // Populate uploadedBy for response
    await fileRecord.populate('uploadedBy', 'name email');

    res.status(201).json({
      id: fileRecord._id,
      filename: fileRecord.filename,
      originalName: fileRecord.originalName,
      path: fileRecord.path,
      size: fileRecord.size,
      mimeType: fileRecord.mimeType,
      category: fileRecord.category,
      description: fileRecord.description,
      uploadedBy: fileRecord.uploadedBy,
      createdAt: fileRecord.createdAt
    });
  } catch (error) {
    // Delete uploaded file if there's an error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ message: 'Upload error', error: error.message });
  }
});

// Get all files for a project
router.get('/project/:projectId', authenticate, async (req, res) => {
  try {
    const project = await Project.findById(req.params.projectId);
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    // Check if user has access to the project
    const hasAccess = 
      req.user.role === 'admin' ||
      (project.projectManager && project.projectManager.toString() === req.user._id.toString()) ||
      (project.client && project.client.toString() === req.user._id.toString()) ||
      (Array.isArray(project.teamMembers) && project.teamMembers.some(m => {
        const memberId = m._id ? m._id.toString() : m.toString();
        return memberId === req.user._id.toString();
      }));

    if (!hasAccess) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const files = await File.find({ project: req.params.projectId })
      .populate('uploadedBy', 'name email')
      .sort({ createdAt: -1 });

    res.json(files);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching files', error: error.message });
  }
});

// Get file (with project access check)
router.get('/:filename', authenticate, async (req, res) => {
  try {
    const fileRecord = await File.findOne({ filename: req.params.filename });
    
    if (!fileRecord) {
      return res.status(404).json({ message: 'File not found' });
    }

    // Check if user has access to the project
    const project = await Project.findById(fileRecord.project);
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    const hasAccess = 
      req.user.role === 'admin' ||
      project.projectManager.toString() === req.user._id.toString() ||
      project.client?.toString() === req.user._id.toString() ||
      project.teamMembers.some(m => m.toString() === req.user._id.toString());

    if (!hasAccess) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const filePath = path.join(uploadsDir, req.params.filename);
    if (fs.existsSync(filePath)) {
      res.sendFile(filePath);
    } else {
      res.status(404).json({ message: 'File not found on disk' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving file', error: error.message });
  }
});

// Delete file
router.delete('/:fileId', authenticate, async (req, res) => {
  try {
    const fileRecord = await File.findById(req.params.fileId);
    if (!fileRecord) {
      return res.status(404).json({ message: 'File not found' });
    }

    // Check if user has access to the project
    const project = await Project.findById(fileRecord.project);
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    // Only admin, project manager, or the uploader can delete
    const canDelete = 
      req.user.role === 'admin' ||
      project.projectManager.toString() === req.user._id.toString() ||
      fileRecord.uploadedBy.toString() === req.user._id.toString();

    if (!canDelete) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Delete file from disk
    const filePath = path.join(uploadsDir, fileRecord.filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // Delete file record
    await fileRecord.deleteOne();

    res.json({ message: 'File deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting file', error: error.message });
  }
});

module.exports = router;

