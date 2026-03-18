import express from 'express';
import { body, validationResult } from 'express-validator';
import User from '../models/User.js';
import LoginHistory from '../models/LoginHistory.js';
import { generateAccessToken, verifyToken } from '../utils/jwt.js';
import { 
  detectDevice, 
  detectBrowser, 
  detectOS, 
  getLocationFromIP, 
  getRealIP 
} from '../utils/deviceDetection.js';
import passport from '../config/passport.js';

const router = express.Router();

/**
 * @route   POST /api/auth/signup
 */
router.post(
  '/signup',
  [
    body('name').trim().isLength({ min: 2, max: 50 }).withMessage('Name must be between 2 and 50 characters'),
    body('email').isEmail().normalizeEmail().withMessage('Please provide a valid email'),
    body('password')
      .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
      .matches(/\d/).withMessage('Password must contain at least one number')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: errors.array()[0].msg
        });
      }

      const { name, email, password } = req.body;

      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'Email already registered'
        });
      }

      const user = new User({ name, email, password });
      await user.save();

      const ipAddress = getRealIP(req);
      const userAgent = req.headers['user-agent'] || 'Unknown';

      const loginEntry = new LoginHistory({
        user: user._id,
        email: user.email,
        status: 'success',
        ipAddress,
        userAgent,
        device: detectDevice(userAgent),
        browser: detectBrowser(userAgent),
        os: detectOS(userAgent),
        location: getLocationFromIP(ipAddress)
      });

      await loginEntry.save();

      const token = generateAccessToken(user._id);

      res.status(201).json({
        success: true,
        message: 'Account created successfully',
        data: {
          user: {
            id: user._id,
            name: user.name,
            email: user.email,
            avatar: user.avatar,   // ✅ FIXED
            createdAt: user.createdAt
          },
          token
        }
      });

    } catch (error) {
      console.error('Signup error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error. Please try again later.'
      });
    }
  }
);

/**
 * @route   POST /api/auth/login
 */
router.post(
  '/login',
  [
    body('email').isEmail().normalizeEmail().withMessage('Please provide a valid email'),
    body('password').notEmpty().withMessage('Password is required')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: errors.array()[0].msg
        });
      }

      const { email, password } = req.body;

      const user = await User.findOne({ email }).select('+password');

      const ipAddress = getRealIP(req);
      const userAgent = req.headers['user-agent'] || 'Unknown';

      if (!user || !(await user.comparePassword(password))) {

        if (user) {
          const failedEntry = new LoginHistory({
            user: user._id,
            email,
            status: 'failed',
            ipAddress,
            userAgent,
            device: detectDevice(userAgent),
            browser: detectBrowser(userAgent),
            os: detectOS(userAgent),
            location: getLocationFromIP(ipAddress),
            failureReason: 'Invalid password'
          });
          await failedEntry.save();
        }

        return res.status(401).json({
          success: false,
          message: 'Invalid email or password'
        });
      }

      const loginEntry = new LoginHistory({
        user: user._id,
        email: user.email,
        status: 'success',
        ipAddress,
        userAgent,
        device: detectDevice(userAgent),
        browser: detectBrowser(userAgent),
        os: detectOS(userAgent),
        location: getLocationFromIP(ipAddress)
      });

      await loginEntry.save();
      await LoginHistory.cleanupOldEntries(user._id);

      const token = generateAccessToken(user._id);

      res.json({
        success: true,
        message: 'Login successful',
        data: {
          user: {
            id: user._id,
            name: user.name,
            email: user.email,
            avatar: user.avatar,   // ✅ FIXED
            createdAt: user.createdAt
          },
          token
        }
      });

    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error. Please try again later.'
      });
    }
  }
);

/**
 * @route   GET /api/auth/verify
 */
router.get('/verify', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'No token provided'
      });
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);

    if (!decoded) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired token'
      });
    }

    const user = await User.findById(decoded.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          avatar: user.avatar,   // ✅ FIXED
          createdAt: user.createdAt
        }
      }
    });

  } catch (error) {
    console.error('Token verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

router.get(
  '/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

router.get(
  '/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: '/login' }),
  async (req, res) => {
    try {
      const ipAddress = getRealIP(req);
      const userAgent = req.headers['user-agent'] || 'Unknown';

      const loginEntry = new LoginHistory({
        user: req.user._id,
        email: req.user.email,
        status: 'success',
        ipAddress,
        userAgent,
        device: detectDevice(userAgent),
        browser: detectBrowser(userAgent),
        os: detectOS(userAgent),
        location: getLocationFromIP(ipAddress)
      });

      await loginEntry.save();
      await LoginHistory.cleanupOldEntries(req.user._id);

      const token = generateAccessToken(req.user._id);

      res.redirect(`http://localhost:5173/oauth-success?token=${token}`);

    } catch (error) {
      console.error('Google login error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }
);

export default router;