# Quick Start Guide

## Prerequisites
- Node.js (v14 or higher)
- MongoDB (running locally or cloud instance)
- npm or yarn

## Installation Steps

1. **Install dependencies**
   ```bash
   npm run install-all
   ```

2. **Set up environment variables**
   
   Create a `.env` file in the root directory:
   ```env
   PORT=5000
   CLIENT_URL=http://localhost:3000
   MONGODB_URI=mongodb://localhost:27017/projects-dashboard
   JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
   NODE_ENV=development
   ```

3. **Start MongoDB**
   
   Make sure MongoDB is running. If using a cloud instance, update `MONGODB_URI` in `.env`.

4. **Create admin user**
   ```bash
   npm run seed-admin
   ```
   
   This creates an admin user with:
   - Email: `admin@example.com`
   - Password: `Admin123!`
   
   ⚠️ **Change the password after first login!**

5. **Start the application**
   ```bash
   npm run dev
   ```
   
   This starts both backend (port 5000) and frontend (port 3000).

6. **Access the application**
   
   Open `http://localhost:3000` in your browser and login with the admin credentials.

## Workflow

1. **Admin** logs in and onboards a **Project Manager**
2. **Project Manager** creates a project and adds a **Client**
3. **Project Manager** onboards **Team Members**
4. **Project Manager** assigns tasks to team members
5. **Team Members** submit their work
6. **Project Manager** reviews and rates the work
7. **Client** reviews and rates the work
8. Progress updates automatically on the dashboard

## Task Status Colors

- **Brown** (#8B4513): Task initiated
- **Purple** (#9370DB): Work submitted
- **Red** (#DC143C): Task rejected
- **Blue** (#4169E1): Approved by Project Manager
- **Green** (#228B22): Approved by Client / Completed

## Troubleshooting

### MongoDB Connection Error
- Ensure MongoDB is running
- Check `MONGODB_URI` in `.env` file
- Verify MongoDB connection string format

### Port Already in Use
- Change `PORT` in `.env` for backend
- Change port in `client/package.json` for frontend

### Authentication Issues
- Clear browser localStorage
- Check JWT_SECRET in `.env`
- Verify token expiration settings

### Socket.io Connection Issues
- Ensure backend is running on port 5000
- Check CORS settings in `server/index.js`
- Verify `CLIENT_URL` in `.env`

## Next Steps

1. Change the default admin password
2. Create project managers
3. Set up your first project
4. Onboard team members and clients
5. Start assigning tasks!

For more details, see the main [README.md](README.md) file.

