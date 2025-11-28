const Project = require('../models/Project');
const { createBulkNotifications } = require('./notifications');

// Check and auto-complete projects that have reached their end date
exports.checkAndCompleteProjects = async () => {
  try {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Find projects that have reached their end date and are not yet completed
    const projectsToComplete = await Project.find({
      endDate: { $lte: today },
      status: { $ne: 'completed' }
    })
      .populate('projectManager', 'name email')
      .populate('client', 'name email')
      .populate('teamMembers', 'name email');

    for (const project of projectsToComplete) {
      // Update project status
      project.status = 'completed';
      if (!project.endDate) {
        project.endDate = today;
      }
      
      // Recalculate progress
      await project.calculateProgress();
      await project.save();

      // Notify all project participants
      const notifyUsers = [
        project.projectManager._id || project.projectManager,
        ...(Array.isArray(project.teamMembers) ? project.teamMembers.map(tm => tm._id || tm) : []),
        project.client ? (project.client._id || project.client) : null
      ].filter(Boolean);

      if (notifyUsers.length > 0) {
        await createBulkNotifications(
          notifyUsers,
          'project_updated',
          'Project Auto-Completed',
          `Project "${project.title}" has been automatically completed as the end date has been reached.`,
          project._id
        );
      }

      console.log(`Auto-completed project: ${project.title} (${project._id})`);
    }

    return { completed: projectsToComplete.length };
  } catch (error) {
    console.error('Error in checkAndCompleteProjects:', error);
    return { error: error.message };
  }
};

// Start scheduler to check projects daily
exports.startScheduler = () => {
  // Check immediately on startup
  exports.checkAndCompleteProjects();

  // Then check every 24 hours
  setInterval(() => {
    exports.checkAndCompleteProjects();
  }, 24 * 60 * 60 * 1000); // 24 hours in milliseconds

  // Also check every hour for more timely completion
  setInterval(() => {
    exports.checkAndCompleteProjects();
  }, 60 * 60 * 1000); // 1 hour in milliseconds

  console.log('Project auto-completion scheduler started');
};

