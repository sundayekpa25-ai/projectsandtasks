const jwt = require('jsonwebtoken');
const User = require('./models/User');
const Project = require('./models/Project');

module.exports = (io) => {
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error('Authentication error'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key-change-in-production');
      const user = await User.findById(decoded.userId);
      
      if (!user || !user.isActive) {
        return next(new Error('User not found or inactive'));
      }

      socket.userId = user._id.toString();
      socket.userRole = user.role;
      next();
    } catch (error) {
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.userId}`);

    // Join project room with access verification
    socket.on('join-project', async (projectId) => {
      try {
        const project = await Project.findById(projectId);
        if (!project) {
          socket.emit('error', { message: 'Project not found' });
          return;
        }

        // Check if user has access to this project
        const hasAccess = 
          socket.userRole === 'admin' ||
          (project.projectManager && project.projectManager.toString() === socket.userId) ||
          (project.client && project.client.toString() === socket.userId) ||
          (Array.isArray(project.teamMembers) && project.teamMembers.some(m => {
            const memberId = m._id ? m._id.toString() : m.toString();
            return memberId === socket.userId;
          }));

        if (!hasAccess) {
          socket.emit('error', { message: 'Access denied to this project' });
          return;
        }

        socket.join(`project-${projectId}`);
        console.log(`User ${socket.userId} joined project ${projectId}`);
      } catch (error) {
        socket.emit('error', { message: 'Error joining project' });
      }
    });

    // Leave project room
    socket.on('leave-project', (projectId) => {
      socket.leave(`project-${projectId}`);
      console.log(`User ${socket.userId} left project ${projectId}`);
    });

    // Handle chat messages with access verification
    socket.on('chat-message', async (data) => {
      try {
        const project = await Project.findById(data.projectId);
        if (!project) {
          socket.emit('error', { message: 'Project not found' });
          return;
        }

        // Verify user has access to this project
        const hasAccess = 
          socket.userRole === 'admin' ||
          (project.projectManager && project.projectManager.toString() === socket.userId) ||
          (project.client && project.client.toString() === socket.userId) ||
          (Array.isArray(project.teamMembers) && project.teamMembers.some(m => {
            const memberId = m._id ? m._id.toString() : m.toString();
            return memberId === socket.userId;
          }));

        if (!hasAccess) {
          socket.emit('error', { message: 'Access denied to this project' });
          return;
        }

        // Broadcast to all users in the project room (only project participants)
        io.to(`project-${data.projectId}`).emit('new-message', {
          ...data,
          userId: socket.userId,
          timestamp: new Date()
        });
      } catch (error) {
        socket.emit('error', { message: 'Error sending message' });
      }
    });

    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.userId}`);
    });
  });
};

