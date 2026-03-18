import mongoose from 'mongoose';

const conversationSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['direct', 'group'],
    default: 'direct'
  },
  // For group chats
  name: { type: String, default: '' },
  avatar: { type: String, default: '' },
  
  // ✅ Single admin (backward compatible)
  admin: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  // ✅ Multiple admins (new feature)
  admins: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  
  // All users in this chat
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  
  // Last message preview for sidebar
  lastMessage: { type: String, default: '' },
  lastMessageAt: { type: Date, default: Date.now },
  lastMessageSender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  // Unread count per user
  unreadCount: {
    type: Map,
    of: Number,
    default: {}
  }
}, { timestamps: true });

// ✅ Method to get proper group avatar
conversationSchema.methods.getGroupAvatar = function() {
  if (this.avatar) return this.avatar;
  
  // For groups without avatar, generate one
  if (this.type === 'group' && this.name) {
    const colors = ['#2563eb','#7c3aed','#db2777','#ea580c','#16a34a','#0891b2'];
    const color = colors[this.name.length % colors.length];
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(this.name)}&background=${color.slice(1)}&color=fff&size=200&bold=true`;
  }
  
  return this.avatar;
};

const Conversation = mongoose.model('Conversation', conversationSchema);
export default Conversation;