import User from '../models/User.js';
import Notification from '../models/Notification.model.js';
import { sendMessageNotification, sendCallNotification } from '../services/onesignal.js';

const userPeerIds = {};
const connectedUsers = {}; // Mapping userId -> socketId

export const setupSocketHandlers = (io) => {
  io.on('connection', (socket) => {
    console.log(`🔌 Socket connected: ${socket.id}`);

    // ── User comes online
    socket.on('user-online', async (userId) => {
      if (!userId) {
        console.log('⚠️  user-online called without userId');
        return;
      }

      if (connectedUsers[userId] && connectedUsers[userId] !== socket.id) {
        console.log(`⚠️ User ${userId} already connected! Disconnecting old socket.`);
        io.to(connectedUsers[userId]).emit('duplicate-login', 'You have been logged out due to a new login.');
        io.to(connectedUsers[userId]).disconnectSockets(true);
      }

      connectedUsers[userId] = socket.id;
      socket.userId = userId;
      socket.join(userId);

      console.log(`🟢 User online: ${userId} (Socket: ${socket.id})`);

      try {
        await User.findByIdAndUpdate(userId, {
          isOnline: true,
          lastSeen: new Date(),
        });
      } catch (err) {
        console.error('❌ DB error in user-online:', err.message);
      }

      socket.broadcast.emit('user-status-change', { userId, isOnline: true });
    });

    // ── Forward messages to receiver(s) + OneSignal push notification
    socket.on('send-message', async ({ conversationId, message, receiverIds }) => {
      console.log('📨 send-message received:', {
        conversationId,
        messageId: message?._id,
        receiverIds,
      });

      if (!conversationId || !message || !receiverIds || receiverIds.length === 0) {
        console.error('❌ send-message missing required fields:', {
          conversationId,
          hasMessage: !!message,
          receiverIds,
        });
        return;
      }

      // ── Step 1: Emit via socket to all receivers
      receiverIds.forEach((receiverId) => {
        console.log(`📤 Forwarding message to room: ${receiverId}`);
        io.to(receiverId).emit('receive-message', {
          conversationId,
          message,
        });
      });

      // ── Step 2: Send OneSignal push notification
      for (const receiverId of receiverIds) {
        const isOnline = !!connectedUsers[receiverId];

        if (!isOnline) {
          console.log(`🔔 User ${receiverId} is offline, sending push notification`);
          await sendMessageNotification({
            recipientUserId: receiverId,
            senderName: message?.sender?.name || message?.senderName || 'Someone',
            messageText: message?.content || message?.text || 'New message',
            conversationId,
          });
        } else {
          console.log(`✅ User ${receiverId} is online via socket, skipping push`);
        }
      }
    });

    // ── Mark messages as seen
    socket.on('mark-seen', ({ conversationId, seenBy, receiverIds }) => {
      console.log('👁️  mark-seen:', { conversationId, seenBy, receiverIds });

      if (!conversationId || !seenBy || !receiverIds?.length) return;

      receiverIds.forEach((receiverId) => {
        io.to(receiverId).emit('messages-seen', { conversationId, seenBy });
      });
    });

    // ── Typing event
    socket.on('typing', ({ conversationId, userId, receiverIds, userName }) => {
      console.log('⌨️ Typing event received:', { conversationId, userId, receiverIds });

      if (!receiverIds || receiverIds.length === 0 || !conversationId || !userId) {
        console.error('❌ Typing event missing required data.');
        return;
      }

      receiverIds.forEach((receiverId) => {
        io.to(receiverId).emit('user-typing', {
          conversationId,
          userId,
          userName: userName || 'Someone',
        });
      });
    });

    // ── Stop-typing event
    socket.on('stop-typing', ({ conversationId, userId, receiverIds }) => {
      console.log('🚫 Stop-typing event received:', { conversationId, userId, receiverIds });

      if (!receiverIds || !conversationId || !userId) {
        console.error('❌ Stop-typing event missing required data.');
        return;
      }

      receiverIds.forEach((receiverId) => {
        io.to(receiverId).emit('user-stop-typing', { conversationId, userId });
      });
    });

    // ── WebRTC: call offer + OneSignal push notification
    socket.on('call-offer', async ({ to, offer, callType, fromName, conversationId }) => {
      console.log(`📞 call-offer from ${socket.userId} to ${to}`);

      // ── Step 1: Emit via socket
      io.to(to).emit('incoming-call', {
        from: socket.userId,
        fromName,
        offer,
        callType,
      });

      // ── Step 2: Send OneSignal push for incoming call
      try {
        await sendCallNotification({
          recipientUserId: to,
          callerName: fromName || 'Someone',
          callType: callType || 'audio',
          conversationId: conversationId || to,
        });
        console.log(`🔔 Call notification sent to: ${to}`);
      } catch (err) {
        console.error('❌ Failed to send call notification:', err.message);
      }
    });

    // ── WebRTC: call answer
    socket.on('call-answer', ({ to, answer }) => {
      console.log(`📞 call-answer from ${socket.userId} to ${to}`);
      io.to(to).emit('call-answered', { answer });
    });

    // ── WebRTC: ICE candidate
    socket.on('ice-candidate', ({ to, candidate }) => {
      io.to(to).emit('ice-candidate', { candidate });
    });

    // ── WebRTC: end call
    socket.on('end-call', ({ to }) => {
      console.log(`📞 end-call from ${socket.userId} to ${to}`);
      io.to(to).emit('call-ended');
    });

    // ── User disconnects
    socket.on('disconnect', async () => {
      if (!socket.userId) {
        console.log(`🔴 Socket disconnected: ${socket.id} (No userId assigned)`);
        return;
      }

      console.log(`🔴 User offline: ${socket.userId} (Socket: ${socket.id})`);

      delete connectedUsers[socket.userId];
      delete userPeerIds[socket.userId];

      try {
        await User.findByIdAndUpdate(socket.userId, {
          isOnline: false,
          lastSeen: new Date(),
        });
      } catch (err) {
        console.error('❌ Error updating user status:', err.message);
      }

      socket.broadcast.emit('user-status-change', {
        userId: socket.userId,
        isOnline: false,
        lastSeen: new Date(),
      });
    });
  });
};