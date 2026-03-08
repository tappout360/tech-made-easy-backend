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
  preferences: { type: Object, default: {} },
  // HIPAA §164.308(a)(5)(ii)(D) — Password Management
  passwordChangedAt: { type: Date, default: Date.now },
  passwordExpiryDays: { type: Number, default: 90 }, // Configurable per company
  // Login lockout (persistent across server restarts)
  loginAttempts: { type: Number, default: 0 },
  lockUntil: { type: Date, default: null },
}, { timestamps: true });

// Password hashing middleware
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(12); // Increased from 10 to 12 rounds for HIPAA
  this.password = await bcrypt.hash(this.password, salt);
  this.passwordChangedAt = new Date(); // Track rotation
  next();
});

// Match password methodology
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
