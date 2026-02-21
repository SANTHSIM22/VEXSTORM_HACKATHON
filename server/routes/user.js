const express = require('express');
const { protect } = require('../middleware/auth');
const User = require('../models/User');

const router = express.Router();

// GET /api/user/profile
router.get('/profile', protect, async (req, res) => {
  res.json({ user: req.user });
});

// PUT /api/user/profile
router.put('/profile', protect, async (req, res) => {
  const { name, avatar } = req.body;
  try {
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { name, avatar },
      { new: true, runValidators: true }
    );
    res.json({ user });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/user/stats
router.get('/stats', protect, async (req, res) => {
  const user = await User.findById(req.user._id);
  res.json({
    scansRun: user.scansRun,
    vulnerabilitiesFound: user.vulnerabilitiesFound,
    lastScan: user.lastScan,
    memberSince: user.createdAt
  });
});

module.exports = router;
