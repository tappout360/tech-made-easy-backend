const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

async function createTeamUser() {
  await mongoose.connect('mongodb+srv://tappout360_db_user:JakylieTechnical@cluster0.2lxphyo.mongodb.net/techMadeEasy?retryWrites=true&w=majority');
  console.log('Connected to MongoDB');

  const hash = await bcrypt.hash('TechnicalTeamFirst4388', 12);

  // Check if user already exists
  const existing = await User.findOne({ email: 'TeamTechnical' });
  if (existing) {
    console.log('User TeamTechnical already exists, updating password...');
    existing.password = hash;
    await existing.save();
    console.log('Password updated for TeamTechnical');
  } else {
    const user = await User.create({
      name: 'Team Technical',
      email: 'TeamTechnical',
      password: hash,
      role: 'COMPANY',
      companyId: 'comp-precision-medical',
      accountNumber: null,
      preferences: {},
    });
    console.log('Created user:', user.name, '| Login:', user.email, '| Role:', user.role);
  }

  await mongoose.disconnect();
  console.log('Done!');
}

createTeamUser().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
