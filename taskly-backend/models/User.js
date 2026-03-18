import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    minlength: [2, 'Name must be at least 2 characters'],
    maxlength: [50, 'Name cannot exceed 50 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email']
  },
  password: {
    type: String,
    required: function() {
      return !this.googleId;
    }
  },
  avatar: {
    type: String,
    default: ''
  },
  isEmailVerified: {
    type: Boolean,
    default: false
  },
  googleId: {
    type: String
  },
  isOnline: {
    type: Boolean,
    default: false
  },
  lastSeen: {
    type: Date,
    default: Date.now
  },
  vibeStatus: {
    type: String,
    default: '👋 Hey, I am using Textly!',
    maxlength: 60
  },
  friends: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  // ADD after friends field:
privacy: {
  showLastSeen: { type: Boolean, default: true },
  showOnlineStatus: { type: Boolean, default: true },
  showProfilePhoto: { type: Boolean, default: true },
  showVibeStatus: { type: Boolean, default: true },
  showReadReceipts: { type: Boolean, default: true },
  showTyping: { type: Boolean, default: true },
},

rating: {
  stars: { type: Number, min: 1, max: 5, default: null },
  review: { type: String, default: '', maxlength: 500 },
  ratedAt: { type: Date, default: null }
},
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Update updatedAt timestamp
userSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Auto-generate avatar on user creation
userSchema.pre('save', function(next) {
  if (this.isNew && !this.avatar) {
    this.avatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(this.name)}&background=2563eb&color=fff&size=200&bold=true`;
  }
  next();
});

// Method to compare password
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Method to generate avatar URL
userSchema.methods.generateAvatar = function() {
  if (this.avatar && this.avatar.startsWith('http')) {
    return this.avatar;
  }
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(this.name)}&background=2563eb&color=fff&size=200&bold=true`;
};

const User = mongoose.model('User', userSchema);

export default User;