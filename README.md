# Projects & Tasks Dashboard

A robust, secure projects and tasks management system with role-based access control, real-time notifications, and comprehensive workflow management.

## Features

### Role-Based Access Control
- **Admin**: Full system access, can onboard project managers
- **Project Manager**: Can create projects, onboard team members and clients, assign tasks, review submissions
- **Team Member**: Can view assigned tasks, submit work for review
- **Client**: Can view projects, review completed work

### Workflow Management
1. Admin onboards Project Manager
2. Project Manager creates project and adds client
3. Project Manager onboards team members
4. Project Manager assigns tasks to team members
5. Team members submit work
6. Project Manager reviews and rates work
7. Client reviews and rates work
8. Progress reflects on dashboard with color-coded status

### Task Status Colors
- **Brown**: Initiated task
- **Purple**: Task submitted
- **Red**: Task rejected
- **Blue**: Approved by Project Manager
- **Green**: Approved by Client / Completed

### Additional Features
- Real-time notifications for all activities
- Internal chat and comment system within projects
- Progress tracking with visual indicators
- File upload support for task submissions
- Secure authentication with JWT
- Responsive design for all devices

## Tech Stack

### Backend
- Node.js with Express
- MongoDB with Mongoose
- Socket.io for real-time features
- JWT for authentication
- Bcrypt for password hashing
- Helmet for security headers
- Express Rate Limit for API protection

### Frontend
- React 18
- React Router for navigation
- Axios for API calls
- Socket.io Client for real-time communication
- React Icons for UI icons

## Installation

### Prerequisites
- Node.js (v14 or higher)
- MongoDB (local or cloud instance)
- npm or yarn

### Setup Steps

1. **Clone or navigate to the project directory**

2. **Install backend dependencies**
   ```bash
   npm install
   ```

3. **Install frontend dependencies**
   ```bash
   cd client
   npm install
   cd ..
   ```

4. **Configure environment variables**
   
   Create a `.env` file in the root directory:
   ```env
   PORT=5000
   CLIENT_URL=http://localhost:3000
   MONGODB_URI=mongodb://localhost:27017/projects-dashboard
   JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
   NODE_ENV=development
   ```

5. **Start MongoDB**
   
   Make sure MongoDB is running on your system. If using a cloud instance, update `MONGODB_URI` in `.env`.

6. **Run the application**
   
   For development (runs both server and client):
   ```bash
   npm run dev
   ```
   
   Or run separately:
   ```bash
   # Terminal 1 - Backend
   npm run server
   
   # Terminal 2 - Frontend
   npm run client
   ```

7. **Access the application**
   
   Open your browser and navigate to `http://localhost:3000`

## Initial Setup

### Create First Admin User

You'll need to create the first admin user manually. You can do this by:

1. Using MongoDB shell or a GUI tool like MongoDB Compass
2. Or creating a simple script to seed the database

Here's a sample script you can run once:

```javascript
// seed-admin.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const userSchema = new mongoose.Schema({
  name: String,
  email: String,
  password: String,
  role: String,
  isActive: Boolean
});

const User = mongoose.model('User', userSchema);

async function createAdmin() {
  await mongoose.connect(process.env.MONGODB_URI);
  
  const hashedPassword = await bcrypt.hash('Admin123!', 12);
  
  const admin = new User({
    name: 'Admin User',
    email: 'admin@example.com',
    password: hashedPassword,
    role: 'admin',
    isActive: true
  });
  
  await admin.save();
  console.log('Admin user created!');
  console.log('Email: admin@example.com');
  console.log('Password: Admin123!');
  
  await mongoose.disconnect();
}

createAdmin();
```

Run it with: `node seed-admin.js`

## Security Features

- Password hashing with bcrypt (12 rounds)
- JWT token-based authentication
- Role-based authorization middleware
- Input validation with express-validator
- Helmet.js for security headers
- Rate limiting on API endpoints
- CORS configuration
- XSS protection
- SQL injection prevention (MongoDB parameterized queries)

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register/Onboard user
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Get current user

### Users
- `GET /api/users` - Get all users (filtered by role)
- `GET /api/users/:id` - Get user by ID

### Projects
- `GET /api/projects` - Get all projects
- `GET /api/projects/:id` - Get project by ID
- `POST /api/projects` - Create project (PM/Admin)
- `PUT /api/projects/:id` - Update project (PM)
- `POST /api/projects/:id/team-members` - Add team member
- `DELETE /api/projects/:id/team-members/:userId` - Remove team member

### Tasks
- `GET /api/tasks` - Get all tasks
- `GET /api/tasks/:id` - Get task by ID
- `POST /api/tasks` - Create task (PM/Admin)
- `PUT /api/tasks/:id` - Update task (PM)
- `POST /api/tasks/:id/submit` - Submit work (Team Member)
- `POST /api/tasks/:id/review` - Review task (PM/Client)

### Comments
- `GET /api/comments/project/:projectId` - Get project comments
- `POST /api/comments` - Create comment
- `POST /api/comments/:id/reply` - Reply to comment

### Notifications
- `GET /api/notifications` - Get user notifications
- `PUT /api/notifications/:id/read` - Mark as read
- `PUT /api/notifications/read-all` - Mark all as read
- `GET /api/notifications/unread/count` - Get unread count

### Upload
- `POST /api/upload` - Upload file
- `GET /api/upload/:filename` - Get file

## Project Structure

```
projects-tasks-dashboard/
├── server/
│   ├── index.js              # Express server setup
│   ├── models/               # MongoDB models
│   │   ├── User.js
│   │   ├── Project.js
│   │   ├── Task.js
│   │   ├── Comment.js
│   │   └── Notification.js
│   ├── routes/               # API routes
│   │   ├── auth.js
│   │   ├── users.js
│   │   ├── projects.js
│   │   ├── tasks.js
│   │   ├── comments.js
│   │   ├── notifications.js
│   │   └── upload.js
│   ├── middleware/           # Custom middleware
│   │   ├── auth.js
│   │   └── validation.js
│   ├── utils/                # Utility functions
│   │   └── notifications.js
│   └── socket.js             # Socket.io setup
├── client/
│   ├── public/
│   ├── src/
│   │   ├── components/       # React components
│   │   ├── pages/            # Page components
│   │   ├── context/          # React context
│   │   └── App.js
│   └── package.json
├── .env.example
├── .gitignore
├── package.json
└── README.md
```

## Development

### Running in Development Mode
```bash
npm run dev
```

This will start both the backend server (port 5000) and frontend development server (port 3000) concurrently.

### Building for Production
```bash
cd client
npm run build
```

The production build will be in `client/build/`.

## License

ISC

## Support

For issues or questions, please check the code comments or create an issue in the repository.

