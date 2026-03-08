const mongoose = require('mongoose');

/**
 * MFA Code Model — Database-backed MFA code storage
 * Replaces the in-memory mfaCodes {} store for production reliability.
 *
 * HIPAA §164.312(d) — Person or Entity Authentication
 * Codes auto-expire via MongoDB TTL index (5 minutes).
 */
const mfaCodeSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true }, // userId or email
  code: { type: String, required: true },
  createdAt: { type: Date, default: Date.now, expires: 300 }, // TTL: 5 min auto-delete
});

module.exports = mongoose.model('MfaCode', mfaCodeSchema);
