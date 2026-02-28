const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  role: { type: String, required: true }, // 'OWNER', 'COMPANY', 'ADMIN', 'OFFICE', 'TECH', 'CLIENT'
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  companyId: { type: String, default: null },
  accountNumber: { type: String, default: null }, // For Clients
  avatar: { type: String, default: '' },
  techSkill: { type: String, default: null },
  rating: { type: Number, default: 0 },
  clientCompany: { type: String, default: null },
  active: { type: Boolean, default: true },  // HIPAA §164.308(a)(3)(ii) — Access Termination
  preferences: { type: Object, default: {} }
}, { timestamps: true });

// Password hashing middleware
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Match password methodology
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
