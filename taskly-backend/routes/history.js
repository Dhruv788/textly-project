import express from 'express';
import LoginHistory from '../models/LoginHistory.js';
import { authenticate } from '../middleware/auth.js';
import { formatLocation } from '../utils/deviceDetection.js';

const router = express.Router();

/**
 * @route   GET /api/history
 * @desc    Get login history for authenticated user
 * @access  Private
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const { limit = 50, page = 1, status } = req.query;
    
    // Build query
    const query = { user: req.user._id };
    if (status && ['success', 'failed'].includes(status)) {
      query.status = status;
    }

    // Get total count
    const total = await LoginHistory.countDocuments(query);

    // Get paginated history
    const history = await LoginHistory.find(query)
      .sort({ timestamp: -1 }) // Most recent first
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .lean(); // Return plain objects for better performance

    // Format response
    const formattedHistory = history.map(entry => ({
      id: entry._id,
      email: entry.email,
      status: entry.status,
      timestamp: entry.timestamp,
      device: entry.device,
      browser: entry.browser,
      os: entry.os,
      location: formatLocation(entry.location),
      ipAddress: entry.ipAddress,
      failureReason: entry.failureReason
    }));

    res.json({
      success: true,
      data: {
        history: formattedHistory,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });

  } catch (error) {
    console.error('Get history error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve login history'
    });
  }
});

/**
 * @route   GET /api/history/stats
 * @desc    Get login statistics for authenticated user
 * @access  Private
 */
router.get('/stats', authenticate, async (req, res) => {
  try {
    const userId = req.user._id;

    // Get all history for user
    const allHistory = await LoginHistory.find({ user: userId });

    // Calculate statistics
    const stats = {
      totalLogins: allHistory.length,
      successfulLogins: allHistory.filter(h => h.status === 'success').length,
      failedLogins: allHistory.filter(h => h.status === 'failed').length,
      uniqueDevices: new Set(allHistory.map(h => h.device)).size,
      uniqueLocations: new Set(allHistory.map(h => formatLocation(h.location))).size,
      browsers: {},
      devices: {},
      recentActivity: []
    };

    // Count by browser
    allHistory.forEach(entry => {
      stats.browsers[entry.browser] = (stats.browsers[entry.browser] || 0) + 1;
    });

    // Count by device
    allHistory.forEach(entry => {
      stats.devices[entry.device] = (stats.devices[entry.device] || 0) + 1;
    });

    // Get last 5 activities
    stats.recentActivity = allHistory
      .slice(0, 5)
      .map(entry => ({
        id: entry._id,
        status: entry.status,
        timestamp: entry.timestamp,
        device: entry.device,
        browser: entry.browser,
        location: formatLocation(entry.location)
      }));

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve statistics'
    });
  }
});

/**
 * @route   DELETE /api/history
 * @desc    Clear all login history for authenticated user
 * @access  Private
 */
router.delete('/', authenticate, async (req, res) => {
  try {
    await LoginHistory.deleteMany({ user: req.user._id });

    res.json({
      success: true,
      message: 'Login history cleared successfully'
    });

  } catch (error) {
    console.error('Clear history error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to clear login history'
    });
  }
});

/**
 * @route   DELETE /api/history/:id
 * @desc    Delete a specific login history entry
 * @access  Private
 */
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const entry = await LoginHistory.findOne({
      _id: req.params.id,
      user: req.user._id
    });

    if (!entry) {
      return res.status(404).json({
        success: false,
        message: 'Login history entry not found'
      });
    }

    await entry.deleteOne();

    res.json({
      success: true,
      message: 'Login history entry deleted'
    });

  } catch (error) {
    console.error('Delete history entry error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete login history entry'
    });
  }
});

export default router;
