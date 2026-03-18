// socket/handlers.js

import User from '../models/User.js';
import Notification from '../models/Notification.model.js';

export const setupSocketHandlers = (io) => {

  io.on('connection', (socket) => {
    console.log(`🔌 Socket connected: ${socket.id}`);

    // ── User comes online
    socket.on('user-online', async (userId) => {
      if (!userId) return;

      socket.userId = userId;
      socket.join(userId);

      console.log(`🟢 User online: ${userId}`);

      try {
        await User.findByIdAndUpdate(userId, {
          isOnline: true,
          lastSeen: new Date()
        });
      } catch (err) {
        console.error('DB error:', err.message);
      }

      socket.broadcast.emit('user-status-change', {
        userId,
        isOnline: true
      });
    }); // ← CLOSED user-online handler HERE

    // ✅ NEW: Group created event (SEPARATE handler, not nested!)
    socket.on('group-created-broadcast', ({ conversation, participantIds }) => {
      console.log(`📢 Broadcasting new group to ${participantIds?.length} members`);
      
      participantIds?.forEach(participantId => {
        io.to(participantId).emit('group-created', { conversation });
      });
    });

    // ✅ NEW: Members added event (SEPARATE handler, not nested!)
    socket.on('members-added-broadcast', ({ conversationId, newMembers, allParticipantIds }) => {
      console.log(`📢 Broadcasting member addition to group ${conversationId}`);
      
      allParticipantIds?.forEach(participantId => {
        io.to(participantId).emit('members-added', {
          conversationId,
          newMembers
        });
      });
    });

    // ── User sends a message (works for both direct AND group)
    socket.on('send-message', async (data) => {
      const { conversationId, message, receiverIds } = data;

      console.log(`📨 Message from ${socket.userId} in conv: ${conversationId}`);
      console.log(`📤 Sending to ${receiverIds?.length} receiver(s):`, receiverIds);

      if (!receiverIds || receiverIds.length === 0) {
        console.log('❌ No receiverIds!');
        return;
      }

      // ── Broadcast message to ALL receivers (works for group: multiple ids)
      receiverIds.forEach(receiverId => {
        io.to(receiverId).emit('receive-message', {
          conversationId,
          message
        });
        console.log(`✅ Message sent to room: ${receiverId}`);
      });

      // ── Create notification for each receiver
      if (socket.userId) {
        for (const receiverId of receiverIds) {
          try {
            const notification = await Notification.create({
              recipient: receiverId,
              sender: socket.userId,
              type: 'message',
              message: message?.text
                ? `New message: "${message.text.substring(0, 50)}${message.text.length > 50 ? '...' : ''}"`
                : 'You have a new message',
              link: `/dashboard?conversation=${conversationId}`,
              isRead: false,
            });

            const populated = await notification.populate('sender', 'name profilePic');
            io.to(receiverId).emit('newNotification', populated);
            console.log(`🔔 Notification sent to: ${receiverId}`);
          } catch (err) {
            console.error('Notification error:', err.message);
          }
        }
      }
    });

    // ── Typing indicator (works for group: receiverIds = all members except sender)
    socket.on('typing', ({ conversationId, userId, receiverIds, userName }) => {
      receiverIds?.forEach(receiverId => {
        io.to(receiverId).emit('user-typing', {
          conversationId,
          userId,
          userName: userName || 'Someone'
        });
      });
      console.log(`⌨️  typing in conv: ${conversationId} → ${receiverIds?.length} receivers`);
    });

    // ── Stop typing
    socket.on('stop-typing', ({ conversationId, userId, receiverIds }) => {
      receiverIds?.forEach(receiverId => {
        io.to(receiverId).emit('user-stop-typing', {
          conversationId,
          userId
        });
      });
    });

    // ── Mark messages as seen (read receipts)
    socket.on('mark-seen', ({ conversationId, seenBy, receiverIds }) => {
      console.log(`👁️  mark-seen: conv ${conversationId} by ${seenBy}`);

      receiverIds?.forEach(receiverId => {
        io.to(receiverId).emit('messages-seen', {
          conversationId,
          seenBy
        });
      });
    });

    // ── User disconnects
    socket.on('disconnect', async () => {
      if (!socket.userId) return;

      console.log(`🔴 User offline: ${socket.userId}`);

      try {
        await User.findByIdAndUpdate(socket.userId, {
          isOnline: false,
          lastSeen: new Date()
        });
      } catch (err) {
        console.error('DB error:', err.message);
      }

      socket.broadcast.emit('user-status-change', {
        userId: socket.userId,
        isOnline: false,
        lastSeen: new Date()
      });
    });

  }); // ← io.on('connection') closes HERE
};