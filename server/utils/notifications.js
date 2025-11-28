const Notification = require('../models/Notification');
const User = require('../models/User');
const { sendNotificationEmail } = require('./email');

// Create notification and send email
exports.createNotification = async (userId, type, title, message, relatedProject = null, relatedTask = null) => {
  try {
    const notification = new Notification({
      user: userId,
      type,
      title,
      message,
      relatedProject,
      relatedTask
    });
    await notification.save();

    // Send email notification (non-blocking)
    try {
      const user = await User.findById(userId).select('name email');
      if (user && user.email) {
        await sendNotificationEmail(user, notification);
      }
    } catch (emailError) {
      console.error('Error sending email notification:', emailError);
      // Continue even if email fails
    }

    return notification;
  } catch (error) {
    console.error('Error creating notification:', error);
    return null;
  }
};

// Create notifications for multiple users and send emails
exports.createBulkNotifications = async (userIds, type, title, message, relatedProject = null, relatedTask = null) => {
  try {
    const notifications = userIds.map(userId => ({
      user: userId,
      type,
      title,
      message,
      relatedProject,
      relatedTask
    }));
    await Notification.insertMany(notifications);

    // Send email notifications (non-blocking)
    try {
      const users = await User.find({ _id: { $in: userIds } }).select('name email');
      const notificationObj = { title, message };
      
      // Send emails in parallel (but don't wait for them)
      Promise.all(
        users.map(user => {
          if (user && user.email) {
            return sendNotificationEmail(user, notificationObj).catch(err => {
              console.error(`Error sending email to ${user.email}:`, err);
            });
          }
        })
      ).catch(err => {
        console.error('Error in bulk email sending:', err);
      });
    } catch (emailError) {
      console.error('Error sending bulk email notifications:', emailError);
      // Continue even if email fails
    }

    return notifications;
  } catch (error) {
    console.error('Error creating bulk notifications:', error);
    return [];
  }
};

