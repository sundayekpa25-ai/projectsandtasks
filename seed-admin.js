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
