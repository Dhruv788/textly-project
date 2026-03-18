import mongoose from 'mongoose';

const loginHistorySchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true // Index for faster queries
  },
  email: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['success', 'failed'],
    required: true,
    index: true
  },
  ipAddress: {
    type: String,
    required: true
  },
  userAgent: {
    type: String,
    required: true
  },
  device: {
    type: String,
    enum: ['Desktop', 'Mobile', 'Tablet', 'Unknown'],
    default: 'Unknown'
  },
  browser: {
    type: String,
    default: 'Unknown'
  },
  os: {
    type: String,
    default: 'Unknown'
  },
  location: {
    city: String,
    region: String,
    country: String,
    timezone: String,
    coordinates: {
      lat: Number,
      lng: Number
    }
  },
  failureReason: {
    type: String,
    default: null
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true // Index for sorting by date
  }
});

// Compound index for efficient queries
loginHistorySchema.index({ user: 1, timestamp: -1 });

// Auto-delete old entries (keep last 100 per user)
loginHistorySchema.statics.cleanupOldEntries = async function(userId) {
  const entries = await this.find({ user: userId })
    .sort({ timestamp: -1 })
    .skip(100)
    .select('_id');
  
  const idsToDelete = entries.map(entry => entry._id);
  
  if (idsToDelete.length > 0) {
    await this.deleteMany({ _id: { $in: idsToDelete } });
  }
};

const LoginHistory = mongoose.model('LoginHistory', loginHistorySchema);

export default LoginHistory;
