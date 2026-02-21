const mongoose = require('mongoose');

const extensionReportSchema = new mongoose.Schema({
  scanId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  targetPath: {
    type: String,
    required: true,
  },
  htmlReport: {
    type: String,
    default: null,
  },
  status: {
    type: String,
    enum: ['completed', 'failed'],
    default: 'completed',
  },
  createdAt: {
    type: String,
  },
  completedAt: {
    type: String,
    default: null,
  },
  vulnerabilityCount: {
    type: Number,
    default: 0,
  },
  riskScore: {
    type: Number,
    default: 0,
  },
  bySeverity: {
    critical: { type: Number, default: 0 },
    high:     { type: Number, default: 0 },
    medium:   { type: Number, default: 0 },
    low:      { type: Number, default: 0 },
    info:     { type: Number, default: 0 },
  },
  summary: {
    type: mongoose.Schema.Types.Mixed,
    default: null,
  },
}, { timestamps: false });

module.exports = mongoose.model('ExtensionReport', extensionReportSchema);
