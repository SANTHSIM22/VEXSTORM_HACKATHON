const mongoose = require('mongoose');

const githubScanSchema = new mongoose.Schema({
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
  repoUrl: {
    type: String,
    required: true,
  },
  branch: {
    type: String,
    default: null,
  },
  status: {
    type: String,
    enum: ['queued', 'running', 'completed', 'failed'],
    default: 'queued',
  },
  currentStage: {
    type: String,
    default: null,
  },
  htmlReport: {
    type: String,
    default: null,
  },
  reportJson: {
    type: mongoose.Schema.Types.Mixed,
    default: null,
  },
  executiveSummary: {
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
  repoMeta: {
    owner:       { type: String, default: '' },
    repo:        { type: String, default: '' },
    language:    { type: String, default: '' },
    description: { type: String, default: '' },
    stars:       { type: Number, default: 0 },
    isPrivate:   { type: Boolean, default: false },
  },
  agentLogs: {
    type: [String],
    default: [],
  },
  errors: {
    type: [String],
    default: [],
  },
  createdAt:   { type: String },
  completedAt: { type: String, default: null },
}, { timestamps: false });

module.exports = mongoose.model('GithubScan', githubScanSchema);
