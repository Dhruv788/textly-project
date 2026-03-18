import express from 'express';
import { authenticate } from '../middleware/auth.js';
import User from '../models/User.js';

const router = express.Router();

// ── Search users
router.get('/search', authenticate, async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.trim() === '') {
      return res.json({ success: true, data: [] });
    }
    const users = await User.find({
      _id: { $ne: req.user._id },
      $or: [
        { name: { $regex: q, $options: 'i' } },
        { email: { $regex: q, $options: 'i' } }
      ]
    }).select('name email avatar isOnline lastSeen vibeStatus').limit(10);

    res.json({ success: true, data: users });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── Get my profile
router.get('/me', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    res.json({ success: true, data: user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── Update profile (name, vibeStatus, avatar)
router.put('/me', authenticate, async (req, res) => {
  try {
    const { name, vibeStatus, avatar } = req.body;

    const updateData = {};
    if (name) updateData.name = name;
    if (vibeStatus !== undefined) updateData.vibeStatus = vibeStatus;
    if (avatar) updateData.avatar = avatar;

    const user = await User.findByIdAndUpdate(
      req.user._id,
      updateData,
      { new: true }
    ).select('-password');

    // Notify friends via socket that profile updated
    const io = req.app.locals.io;
    if (io && name) {
      io.emit('user-profile-update', {
        userId: req.user._id,
        name,
        vibeStatus,
        avatar
      });
    }

    console.log(`✅ Profile updated: ${user.name}`);
    res.json({ success: true, data: user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── Update privacy settings
router.put('/privacy', authenticate, async (req, res) => {
  try {
    const {
      showLastSeen,
      showOnlineStatus,
      showProfilePhoto,
      showVibeStatus,
      showReadReceipts,
      showTyping
    } = req.body;

    const user = await User.findByIdAndUpdate(
      req.user._id,
      {
        privacy: {
          showLastSeen,
          showOnlineStatus,
          showProfilePhoto,
          showVibeStatus,
          showReadReceipts,
          showTyping
        }
      },
      { new: true }
    ).select('-password');

    console.log(`✅ Privacy updated for: ${user.name}`);
    res.json({ success: true, data: user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── Submit rating
router.post('/rating', authenticate, async (req, res) => {
  try {
    const { stars, review } = req.body;

    if (!stars || stars < 1 || stars > 5) {
      return res.status(400).json({
        success: false,
        message: 'Stars must be between 1 and 5'
      });
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      {
        rating: {
          stars,
          review: review || '',
          ratedAt: new Date()
        }
      },
      { new: true }
    ).select('-password');

    console.log(`⭐ Rating submitted: ${stars} stars by ${user.name}`);
    res.json({ success: true, data: user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── Get rating
router.get('/rating', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('rating');
    res.json({ success: true, data: user.rating });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;