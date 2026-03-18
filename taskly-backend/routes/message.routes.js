import express from 'express';
import { authenticate } from '../middleware/auth.js';
import Message from '../models/Message.js';
import Conversation from '../models/Conversation.js';
import Notification from '../models/Notification.model.js'; // ← ADD

const router = express.Router();

// POST send a message
router.post('/send', authenticate, async (req, res) => {
  try {
    const { conversationId, text } = req.body;

    // Validate inputs
    if (!conversationId || !text) {
      return res.status(400).json({
        success: false,
        message: 'conversationId and text are required'
      });
    }

    // Save message to DB
    const message = await Message.create({
      conversationId,
      sender: req.user._id,
      text,
      status: 'sent'
    });

    await message.populate('sender', 'name avatar');

    // Update conversation preview
    const conversation = await Conversation.findByIdAndUpdate(
      conversationId,
      {
        lastMessage: text,
        lastMessageAt: new Date(),
        lastMessageSender: req.user._id
      },
      { new: true } // ← get updated doc so we have participants
    );

    console.log(`✅ Message saved: "${text}" in conv: ${conversationId}`);

    // ── NOTIFICATIONS: notify every participant except sender ← ADD
    if (conversation?.participants?.length) {
      const io = req.app.locals.io; // get socket.io instance

      const receivers = conversation.participants.filter(
        (p) => p.toString() !== req.user._id.toString()
      );

      for (const receiverId of receivers) {
        try {
          // Save notification to DB
          const notification = await Notification.create({
            recipient: receiverId,
            sender: req.user._id,
            type: 'message',
            message: `${message.sender.name}: "${text.substring(0, 60)}${text.length > 60 ? '...' : ''}"`,
            link: `/dashboard?conversation=${conversationId}`,
            isRead: false,
          });

          // Populate sender info for real-time emit
          const populated = await notification.populate('sender', 'name avatar');

          // Emit real-time notification via Socket.IO
          if (io) {
            io.to(receiverId.toString()).emit('newNotification', populated);
            console.log(`🔔 Notification emitted to: ${receiverId}`);
          }
        } catch (notifErr) {
          // Don't fail the whole request if notification fails
          console.error('⚠️ Notification error:', notifErr.message);
        }
      }
    }

    res.json({ success: true, data: message });

  } catch (err) {
    console.error('❌ Send message error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET messages
router.get('/:conversationId', authenticate, async (req, res) => {
  try {
    const messages = await Message.find({
      conversationId: req.params.conversationId
    })
      .populate('sender', 'name avatar')
      .sort({ createdAt: 1 });

    res.json({ success: true, data: messages });

  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;  