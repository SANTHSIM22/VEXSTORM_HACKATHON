require('dotenv/config');
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const authRoutes      = require('./routes/auth');
const userRoutes      = require('./routes/user');
const scanRoutes      = require('./routes/scans');
const extensionRoutes = require('./routes/extension');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  // Allow the web client AND the VS Code extension (extension sends requests from
  // a vscode-webview or node context, so we accept all origins for the extension
  // endpoints while keeping credentials support for the web client).
  origin: (origin, cb) => cb(null, true),
  credentials: true,
}));
// Large HTML reports from the VS Code extension can exceed 5 MB
app.use(express.json({ limit: '50mb' }));
app.use(express.text({ limit: '50mb' }));

// Routes
app.use('/api/auth',      authRoutes);
app.use('/api/user',      userRoutes);
app.use('/api/scans',     scanRoutes);
app.use('/api/extension', extensionRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'VexStorm API is running', timestamp: new Date().toISOString() });
});

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('✅ MongoDB connected');
    app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('❌ MongoDB connection failed:', err.message);
    process.exit(1);
  });

module.exports = app;
