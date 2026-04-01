import User from '../models/User.js';
import Notification from '../models/Notification.model.js';

// ✅ Store mapping: userId → peerId
const userPeerIds = {};

export const setupSocketHandlers = (io) => {

  io.on('connection', (socket) => {
    console.log(`🔌 Socket connected: ${socket.id}`);

    // ── User comes online
    socket.on('user-online', async (userId) => {
      if (!userId) {
        console.log('⚠️  user-online called without userId');
        return;
      }

      socket.userId = userId;
      socket.join(userId);

      console.log(`🟢 User online: ${userId} (Socket: ${socket.id})`);

      try {
        await User.findByIdAndUpdate(userId, {
          isOnline: true,
          lastSeen: new Date()
        });
      } catch (err) {
        console.error('❌ DB error in user-online:', err.message);
      }

      socket.broadcast.emit('user-status-change', {
        userId,
        isOnline: true
      });
    });

    // ✅ NEW: Peer ID Registration
    socket.on('peer-id-registered', ({ userId, peerId }) => {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('📡 PEER ID REGISTERED');
      console.log('   User ID:', userId);
      console.log('   Peer ID:', peerId);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      
      userPeerIds[userId] = peerId;
      console.log('✅ Current PeerJS mappings:', userPeerIds);
    });

    // ✅ WebRTC: Call Offer (Caller initiates call)
    socket.on('call-offer', ({ to, offer, callType, callerName }) => {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('📞 CALL OFFER RECEIVED');
      console.log('   From User ID:', socket.userId);
      console.log('   From Socket:', socket.id);
      console.log('   From Peer ID:', userPeerIds[socket.userId]);
      console.log('   To User ID:', to);
      console.log('   To Peer ID:', userPeerIds[to]);
      console.log('   Call Type:', callType);
      console.log('   Caller Name:', callerName);
      console.log('   Offer exists:', !!offer);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      
      // ✅ Send with Peer ID
      io.to(to).emit('incoming-call', {
        from: socket.userId,
        fromPeerId: userPeerIds[socket.userId],
        fromName: callerName,
        offer,
        callType
      });
      
      console.log(`✅ Call offer sent to room: ${to}`);
    });

    // ✅ WebRTC: Call Answer (Receiver accepts)
    socket.on('call-answer', ({ to, answer }) => {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('✅ CALL ANSWER RECEIVED');
      console.log('   From User ID:', socket.userId);
      console.log('   To User ID:', to);
      console.log('   Answer exists:', !!answer);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      
      io.to(to).emit('call-answered', {
        from: socket.userId,
        answer
      });
      
      console.log(`✅ Call answer sent to room: ${to}`);
    });

    // ✅ WebRTC: ICE Candidate (Network path exchange)
    socket.on('ice-candidate', ({ to, candidate }) => {
      console.log(`🧊 ICE candidate from ${socket.userId} to ${to}`);
      
      io.to(to).emit('ice-candidate', {
        from: socket.userId,
        candidate
      });
    });

    // ✅ WebRTC: Call Rejected
    socket.on('call-rejected', ({ to }) => {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('❌ CALL REJECTED');
      console.log('   By User ID:', socket.userId);
      console.log('   Notifying User ID:', to);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      
      io.to(to).emit('call-rejected', {
        from: socket.userId
      });
    });

    // ✅ WebRTC: Call Ended
    socket.on('call-ended', ({ to }) => {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('📴 CALL ENDED');
      console.log('   By User ID:', socket.userId);
      console.log('   Notifying User ID:', to);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      
      io.to(to).emit('call-ended', {
        from: socket.userId
      });
    });

    // ✅ Group created event
    socket.on('group-created-broadcast', ({ conversation, participantIds }) => {
      console.log(`📢 Broadcasting new group to ${participantIds?.length} members`);
      
      participantIds?.forEach(participantId => {
        io.to(participantId).emit('group-created', { conversation });
      });
    });

    // ✅ Members added event
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
            console.error('❌ Notification error:', err.message);
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
      console.log(`⌨️  Typing in conv: ${conversationId} → ${receiverIds?.length} receivers`);
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
      console.log(`👁️  Mark-seen: conv ${conversationId} by ${seenBy}`);

      receiverIds?.forEach(receiverId => {
        io.to(receiverId).emit('messages-seen', {
          conversationId,
          seenBy
        });
      });
    });

    // ── User disconnects
    socket.on('disconnect', async () => {
      if (!socket.userId) {
        console.log(`🔴 Socket disconnected: ${socket.id} (no userId)`);
        return;
      }

      console.log(`🔴 User offline: ${socket.userId} (Socket: ${socket.id})`);

      // ✅ Clean up PeerJS ID
      delete userPeerIds[socket.userId];
      console.log('✅ Cleaned up Peer ID for:', socket.userId);

      try {
        await User.findByIdAndUpdate(socket.userId, {
          isOnline: false,
          lastSeen: new Date()
        });
      } catch (err) {
        console.error('❌ DB error in disconnect:', err.message);
      }

      socket.broadcast.emit('user-status-change', {
        userId: socket.userId,
        isOnline: false,
        lastSeen: new Date()
      });
    });

  }); // ← io.on('connection') closes HERE
};