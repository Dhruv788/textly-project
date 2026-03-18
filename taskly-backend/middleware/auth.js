import { verifyToken } from '../utils/jwt.js';
import User from '../models/User.js';

export const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    console.log('🔐 Auth check:', authHeader ? 'Token present' : 'NO TOKEN');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.'
      });
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);

    console.log('🔐 Decoded:', decoded);

    if (!decoded || !decoded.userId) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired token.'
      });
    }

    const user = await User.findById(decoded.userId).select('-password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found.'
      });
    }

    console.log('✅ Authenticated user:', user._id.toString());
    req.user = user;
    next();

  } catch (error) {
    console.error('❌ Authentication error:', error);
    res.status(401).json({
      success: false,
      message: 'Authentication failed.'
    });
  }
};

export const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const decoded = verifyToken(token);
      if (decoded && decoded.userId) {
        const user = await User.findById(decoded.userId).select('-password');
        if (user) req.user = user;
      }
    }
    next();
  } catch (error) {
    next();
  }
};