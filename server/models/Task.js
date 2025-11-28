const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Task title is required'],
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  assignedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['initiated', 'submitted', 'pm_reviewed', 'client_reviewed', 'rejected', 'completed'],
    default: 'initiated'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  },
  dueDate: {
    type: Date
  },
  submittedAt: {
    type: Date
  },
  submission: {
    work: String,
    files: [{
      filename: String,
      originalName: String,
      path: String,
      size: Number,
      mimeType: String
    }],
    submittedAt: Date
  },
  progressPercentage: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  pmRating: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  clientRating: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  pmFeedback: {
    type: String
  },
  clientFeedback: {
    type: String
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Get task color based on status
taskSchema.methods.getStatusColor = function() {
  const colorMap = {
    'initiated': '#8B4513', // brown
    'submitted': '#9370DB', // purple
    'rejected': '#DC143C', // red
    'pm_reviewed': this.pmRating === 'approved' ? '#4169E1' : '#DC143C', // blue or red
    'client_reviewed': this.clientRating === 'approved' ? '#228B22' : '#DC143C', // green or red
    'completed': '#228B22' // green
  };
  return colorMap[this.status] || '#999';
};

// Calculate progress percentage based on status
taskSchema.methods.calculateProgress = function() {
  if (this.status === 'initiated') {
    this.progressPercentage = 10;
  } else if (this.status === 'submitted') {
    this.progressPercentage = 30;
  } else if (this.status === 'pm_reviewed' && this.pmRating === 'approved') {
    this.progressPercentage = 60;
  } else if (this.status === 'client_reviewed' && this.clientRating === 'approved') {
    this.progressPercentage = 100;
  } else if (this.status === 'completed') {
    this.progressPercentage = 100;
  } else if (this.status === 'rejected') {
    // Keep previous percentage or set to 0
    if (!this.progressPercentage) this.progressPercentage = 0;
  }
  return this.progressPercentage;
};

module.exports = mongoose.model('Task', taskSchema);

