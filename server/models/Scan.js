const mongoose = require('mongoose');

const findingSchema = new mongoose.Schema({
  type:             { type: String },
  severity:         { type: String },
  endpoint:         { type: String },
  parameter:        { type: String },
  description:      { type: String },
  evidence:         { type: String },
  remediation:      { type: String },
  cvssScore:        { type: Number },
  reproductionSteps:[{ type: String }],
  tags:             [{ type: String }],
}, { _id: false });

const logSchema = new mongoose.Schema({
  time:  { type: String },
  agent: { type: String },
  msg:   { type: String },
}, { _id: false });

const scanSchema = new mongoose.Schema({
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
  targetUrl: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ['running', 'completed', 'failed'],
    default: 'running',
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
  findings: {
    type: [findingSchema],
    default: [],
  },
  logs: {
    type: [logSchema],
    default: [],
  },
  // ─── Extension-scan extras ───────────────────────
  source: {
    type: String,
    enum: ['web', 'extension'],
    default: 'web',
  },
  targetPath: {
    type: String,
    default: null,
  },
  htmlReport: {
    type: String,
    default: null,
  },
}, { timestamps: false });

module.exports = mongoose.model('Scan', scanSchema);
