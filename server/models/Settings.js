const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
  companyName: {
    type: String,
    default: 'GIC Projects',
    trim: true
  },
  companyLogo: {
    filename: String,
    path: String,
    originalName: String,
    mimeType: String,
    size: Number
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Ensure only one settings document exists
settingsSchema.statics.getSettings = async function() {
  let settings = await this.findOne();
  if (!settings) {
    settings = new this({});
    await settings.save();
  }
  return settings;
};

module.exports = mongoose.model('Settings', settingsSchema);

