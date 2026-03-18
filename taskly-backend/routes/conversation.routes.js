import express from 'express';
import { authenticate } from '../middleware/auth.js';
import Conversation from '../models/Conversation.js';

const router = express.Router();

// POST /direct — create or get direct conversation
router.post('/direct', authenticate, async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ success: false, message: 'userId is required' });
    }

    console.log(`💬 Direct chat: ${req.user._id} ↔ ${userId}`);

    let conversation = await Conversation.findOne({
      type: 'direct',
      participants: { $all: [req.user._id, userId] }
    });

    if (!conversation) {
      conversation = await Conversation.create({
        type: 'direct',
        participants: [req.user._id, userId],
        lastMessage: '',
        lastMessageAt: new Date()
      });
    }

    await conversation.populate('participants', 'name avatar isOnline lastSeen vibeStatus');
    res.json({ success: true, data: conversation });

  } catch (err) {
    console.error('❌ Create direct error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /group — create group conversation
router.post('/group', authenticate, async (req, res) => {
  try {
    const { name, participantIds } = req.body;

    if (!name || !participantIds || participantIds.length === 0) {
      return res.status(400).json({ success: false, message: 'name and participantIds are required' });
    }

    console.log(`👥 Creating group: ${name}`);

    const uniqueParticipants = [...new Set([req.user._id.toString(), ...participantIds])];

    const conversation = await Conversation.create({
      type: 'group',
      name,
      admin: req.user._id,
      admins: [req.user._id],
      participants: uniqueParticipants,
      avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=2563eb&color=fff&size=200&bold=true`,
      lastMessage: '',
      lastMessageAt: new Date()
    });

    await conversation.populate('participants', 'name avatar isOnline lastSeen vibeStatus');
    console.log('✅ Group created:', conversation._id);

    const io = req.app.locals.io;
    if (io) {
      uniqueParticipants.forEach(participantId => {
        io.to(participantId.toString()).emit('group-created', { conversation });
      });
      console.log(`📢 group-created sent to ${uniqueParticipants.length} members`);
    }

    res.json({ success: true, data: conversation });

  } catch (err) {
    console.error('❌ Create group error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /fix-admins — MUST be before /:id routes
router.post('/fix-admins', authenticate, async (req, res) => {
  try {
    const groups = await Conversation.find({ type: 'group' });
    let fixed = 0;

    for (const group of groups) {
      let changed = false;

      // Fix admins array
      if (!group.admins || group.admins.length === 0) {
        group.admins = group.admin ? [group.admin] : [];
        changed = true;
      }

      // Fix admin field if missing but admins exists
      if (!group.admin && group.admins && group.admins.length > 0) {
        group.admin = group.admins[0];
        changed = true;
      }

      if (changed) {
        await group.save();
        fixed++;
        console.log(`✅ Fixed group: ${group.name} — admin: ${group.admin}, admins: ${group.admins}`);
      }
    }

    console.log(`✅ Fixed ${fixed} / ${groups.length} groups`);
    res.json({ success: true, message: `Fixed ${fixed} out of ${groups.length} groups` });

  } catch (err) {
    console.error('❌ Fix admins error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /:id/debug — check group admin data
router.get('/:id/debug', authenticate, async (req, res) => {
  try {
    const conversation = await Conversation.findById(req.params.id);
    if (!conversation) return res.status(404).json({ error: 'Group not found' });

    const currentUserId = req.user._id.toString();
    const adminStr = conversation.admin?.toString();
    const adminsArr = conversation.admins?.map(a => a.toString()) || [];

    res.json({
      groupId: conversation._id,
      groupName: conversation.name,
      type: conversation.type,
      admin: adminStr,
      admins: adminsArr,
      currentUserId,
      adminFieldMatch: adminStr === currentUserId,
      adminsArrayMatch: adminsArr.includes(currentUserId),
      finalIsAdmin: adminStr === currentUserId || adminsArr.includes(currentUserId)
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /:id/add-members — add members to group
router.post('/:id/add-members', authenticate, async (req, res) => {
  try {
    const { participantIds } = req.body;
    const conversationId = req.params.id;
    const currentUserId = req.user._id.toString();

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('➕ ADD MEMBERS REQUEST');
    console.log('Group ID     :', conversationId);
    console.log('Adding IDs   :', participantIds);
    console.log('Current user :', currentUserId);

    if (!participantIds || participantIds.length === 0) {
      return res.status(400).json({ success: false, message: 'participantIds are required' });
    }

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({ success: false, message: 'Group not found' });
    }

    console.log('Group name   :', conversation.name);
    console.log('admin field  :', conversation.admin?.toString());
    console.log('admins array :', conversation.admins?.map(a => a.toString()));

    // Check admin — handles both old (admin only) and new (admins array) groups
    const adminMatch = conversation.admin?.toString() === currentUserId;
    const adminsMatch = conversation.admins?.some(a => a.toString() === currentUserId) || false;
    const isAdmin = adminMatch || adminsMatch;

    console.log('adminMatch   :', adminMatch);
    console.log('adminsMatch  :', adminsMatch);
    console.log('isAdmin      :', isAdmin);

    if (!isAdmin) {
      console.log('❌ FORBIDDEN — user is not admin');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      return res.status(403).json({ success: false, message: 'Only admins can add members' });
    }

    const existingIds = conversation.participants.map(p => p.toString());
    const newMembers = participantIds.filter(id => !existingIds.includes(id.toString()));

    console.log('Existing     :', existingIds);
    console.log('New members  :', newMembers);

    if (newMembers.length === 0) {
      return res.status(400).json({ success: false, message: 'All selected users are already members' });
    }

    newMembers.forEach(id => conversation.participants.push(id));
    conversation.lastMessageAt = new Date();
    await conversation.save();

    await conversation.populate('participants', 'name avatar isOnline lastSeen vibeStatus');

    console.log(`✅ Added ${newMembers.length} member(s). Total: ${conversation.participants.length}`);

    const io = req.app.locals.io;
    if (io) {
      conversation.participants.forEach(p => {
        const pid = typeof p === 'object' ? p._id.toString() : p.toString();
        io.to(pid).emit('members-added', {
          conversationId: conversation._id,
          newMemberIds: newMembers,
          conversation
        });
      });
      console.log(`📢 members-added sent to ${conversation.participants.length} users`);
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    res.json({ success: true, message: `${newMembers.length} member(s) added`, data: conversation });

  } catch (err) {
    console.error('❌ Add members error:', err.message);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET / — get all conversations for current user
router.get('/', authenticate, async (req, res) => {
  try {
    console.log(`📋 Loading conversations for: ${req.user._id}`);

    const conversations = await Conversation.find({ participants: req.user._id })
      .populate('participants', 'name avatar isOnline lastSeen vibeStatus')
      .populate('lastMessageSender', 'name')
      .sort({ lastMessageAt: -1 });

    console.log(`✅ Found ${conversations.length} conversations`);
    res.json({ success: true, data: conversations });

  } catch (err) {
    console.error('❌ Get conversations error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;