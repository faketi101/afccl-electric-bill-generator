require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI);
  const exists = await User.findOne({ username: 'admin' });
  if (exists) { console.log('Admin already exists'); process.exit(0); }
  await new User({ username: 'admin', password: 'ChangeMe123!' }).save();
  console.log('Admin created: admin / ChangeMe123!');
  process.exit(0);
}

seed().catch(console.error);
