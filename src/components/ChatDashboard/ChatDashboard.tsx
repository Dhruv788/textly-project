// src/components/ChatDashboard/ChatDashboard.tsx

import React, { useState, useCallback, useEffect } from 'react';
import Navigation from './Navigation';
import Sidebar from './Sidebar';
import ChatArea from './ChatArea';
import InfoPanel from './InfoPanel';
import { Contact, Section } from './types';
import { useAuth } from '../../contexts/AuthContext';
import { useSocket } from '../../contexts/SocketContext';
import api from '../../services/api';
import UserSearch from './UserSearch';
import CreateGroup from './CreateGroup';
import { initOneSignal, logoutOneSignal } from '../../services/onesignal'; // ← ADD
import OneSignal from 'react-onesignal';                                    // ← ADD

const ChatDashboard: React.FC = () => {
  const { user } = useAuth();
  const { socket } = useSocket();

  const [activeSection, setActiveSection]     = useState<Section>('chats');
  const [activeContactId, setActiveContactId] = useState<string | null>(null);
  const [infoOpen, setInfoOpen]               = useState(false);
  const [darkMode, setDarkMode]               = useState(false);
  const [contacts, setContacts]               = useState<Contact[]>([]);
  const [loading, setLoading]                 = useState(true);
  const [showSearch, setShowSearch]           = useState(false);
  const [showCreateGroup, setShowCreateGroup] = useState(false);

  // ── OneSignal init after user loads ← ADD
  useEffect(() => {
    if (!user?.id) return;
    initOneSignal(user.id);
  }, [user?.id]);

  // ── Handle notification click → open the right conversation ← ADD
  useEffect(() => {
    const handler = (event: any) => {
      const data = event?.notification?.additionalData;
      if (!data) return;
      console.log('🔔 Notification clicked:', data);
      if (data.conversationId) {
        handleOpenContact(data.conversationId);
        setActiveSection('chats');
      }
    };
    OneSignal.Notifications.addEventListener('click', handler);
    return () => {
      OneSignal.Notifications.removeEventListener('click', handler);
    };
  }, []);

  // ── Start new direct chat
  const handleStartChat = useCallback(async (searchUser: any) => {
    try {
      const res = await (api as any).conversations.createDirect(searchUser._id);
      if (res.success && res.data) {
        const conv = res.data;
        const newContact: Contact = {
          id: conv._id,
          conversationId: conv._id,
          participantId: searchUser._id,
          name: searchUser.name,
          avatar: searchUser.name.split(' ').map((n: string) => n[0]).join('').toUpperCase(),
          avatarUrl: searchUser.avatar,
          color: '#3b82f6',
          status: searchUser.isOnline ? 'online' : 'offline',
          lastMessage: '',
          time: '',
          unread: 0,
          messages: [],
          type: 'direct'
        };
        setContacts(prev => {
          const exists = prev.find(c => c.id === conv._id);
          if (exists) return prev;
          return [newContact, ...prev];
        });
        setActiveContactId(conv._id);
        setActiveSection('chats');
        setShowSearch(false);
      }
    } catch (err) {
      console.error('❌ Failed to start chat:', err);
    }
  }, []);

  // ── Create group chat
  const handleCreateGroup = useCallback(({ conv }: { conv: any; members?: any[] }) => {
    const newContact: Contact = {
      id: conv._id,
      conversationId: conv._id,
      participantId: undefined,
      participantIds: conv.participants
        .map((p: any) => p._id?.toString() || p.toString())
        .filter((id: string) => id !== user?.id),
      name: conv.name,
      avatar: conv.name.slice(0, 2).toUpperCase(),
      avatarUrl: conv.avatar,
      color: '#7c3aed',
      status: 'online',
      lastMessage: '',
      time: '',
      unread: 0,
      messages: [],
      type: 'group',
      memberCount: conv.participants.length,
      members: conv.participants,
    };
    setContacts(prev => [newContact, ...prev]);
    setActiveContactId(conv._id);
    setActiveSection('chats');
    setShowCreateGroup(false);
  }, [user]);

  // ── Load conversations on mount
  useEffect(() => {
    const loadConversations = async () => {
      try {
        setLoading(true);
        const res = await (api as any).conversations.getAll();
        if (res.success && res.data) {
          const transformed = res.data.map((conv: any) => {
            const isGroup = conv.type === 'group';
            const other = conv.participants.find(
              (p: any) => p._id?.toString() !== user?.id?.toString()
            );
            return {
              id: conv._id,
              conversationId: conv._id,
              participantId: isGroup ? undefined : other?._id?.toString(),
              participantIds: isGroup
                ? conv.participants
                    .map((p: any) => p._id?.toString())
                    .filter((id: string) => id !== user?.id?.toString())
                : undefined,
              name: isGroup ? conv.name : other?.name || 'Unknown',
              avatar: isGroup
                ? conv.name.slice(0, 2).toUpperCase()
                : other?.name?.split(' ').map((n: string) => n[0]).join('').toUpperCase() || '?',
              avatarUrl: isGroup ? conv.avatar : other?.avatar,
              color: isGroup ? '#7c3aed' : '#3b82f6',
              status: isGroup ? 'online' : (other?.isOnline ? 'online' : 'offline'),
              lastSeen: other?.lastSeen,
              lastMessage: conv.lastMessage || '',
              time: conv.lastMessageAt
                ? new Date(conv.lastMessageAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : '',
              unread: 0,
              messages: [],
              type: conv.type,
              memberCount: isGroup ? conv.participants.length : undefined,
              members: isGroup ? conv.participants : undefined,
            };
          });
          setContacts(transformed);
          if (transformed.length > 0) setActiveContactId(transformed[0].id);
        }
      } catch (err) {
        console.error('❌ Failed to load conversations:', err);
      } finally {
        setLoading(false);
      }
    };
    if (user) loadConversations();
  }, [user]);

  // ── ALL real-time socket events live HERE only
  useEffect(() => {
    if (!socket || !user) return;

    const handleReceiveMessage = ({ conversationId, message }: any) => {
      console.log('📨 receive-message:', { conversationId, message });

      const time = new Date(message.createdAt || Date.now())
        .toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      const msgText = message.text || message.content || '';

      const isMine =
        message.sender?._id?.toString() === user?.id?.toString() ||
        message.sender?.toString() === user?.id?.toString();

      setContacts(prev => prev.map(c => {
        if (c.id !== conversationId) return c;

        const alreadyExists = c.messages.some(
          (m: any) => m.id === message._id || m.id === message.id
        );
        if (alreadyExists) return c;

        return {
          ...c,
          messages: [
            ...(c.messages || []),
            {
              id: message._id || message.id,
              text: msgText,
              sent: isMine,
              time,
              senderName: message.sender?.name || message.senderName,
              status: 'delivered',
            }
          ],
          lastMessage: msgText,
          time,
          unread: c.id !== activeContactId ? (c.unread || 0) + 1 : 0,
        };
      }));
    };

    const handleUserStatusChange = ({ userId, isOnline, lastSeen }: any) => {
      setContacts(prev => prev.map(c =>
        c.participantId === userId?.toString()
          ? { ...c, status: isOnline ? 'online' : 'offline', lastSeen }
          : c
      ));
    };

    const handleMessagesSeen = ({ conversationId }: any) => {
      setContacts(prev => prev.map(c => {
        if (c.id !== conversationId) return c;
        return {
          ...c,
          messages: c.messages.map(m => m.sent ? { ...m, status: 'seen' } : m)
        };
      }));
    };

    const handleMessageStatusUpdate = ({ conversationId, messageId, status }: any) => {
      setContacts(prev => prev.map(c => {
        if (c.id !== conversationId) return c;
        return {
          ...c,
          messages: c.messages.map(m => m.id === messageId ? { ...m, status } : m)
        };
      }));
    };

    socket.on('receive-message',       handleReceiveMessage);
    socket.on('user-status-change',    handleUserStatusChange);
    socket.on('messages-seen',         handleMessagesSeen);
    socket.on('message-status-update', handleMessageStatusUpdate);

    return () => {
      socket.off('receive-message',       handleReceiveMessage);
      socket.off('user-status-change',    handleUserStatusChange);
      socket.off('messages-seen',         handleMessagesSeen);
      socket.off('message-status-update', handleMessageStatusUpdate);
    };
  }, [socket, user, activeContactId]);

  // ── Open contact and load messages
  const handleOpenContact = useCallback(async (id: string) => {
    setActiveContactId(id);
    setActiveSection('chats');
    setContacts(prev => prev.map(c => c.id === id ? { ...c, unread: 0 } : c));
    try {
      const res = await (api as any).messages.getMessages(id);
      if (res.success && res.data) {
        const msgs = res.data.map((m: any) => ({
          id: m._id,
          text: m.text || m.content || '',
          sent: m.sender?._id?.toString() === user?.id?.toString(),
          time: new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          senderName: m.sender?.name,
          senderAvatar: m.sender?.avatar,
          status: 'seen',
        }));
        setContacts(prev => prev.map(c => c.id === id ? { ...c, messages: msgs } : c));
      }
    } catch (err) {
      console.error('❌ Failed to load messages:', err);
    }
  }, [user]);

  // ── Logout — clears OneSignal too ← ADD
  const handleLogout = useCallback(async () => {
    await logoutOneSignal();
  }, []);
  void handleLogout; // ← remove this line once you wire to your logout button

  const handleSwitchSection  = useCallback((section: Section) => setActiveSection(section), []);
  const handleToggleDarkMode = useCallback(() => setDarkMode(prev => !prev), []);

  const activeContact = contacts.find(c => c.id === activeContactId);

  if (loading) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, sans-serif', color: '#64748b' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>💬</div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>Loading your chats...</div>
        </div>
      </div>
    );
  }

  return (
    <div id="app" style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Navigation activeSection={activeSection} setActiveSection={handleSwitchSection} darkMode={darkMode} />

      {showSearch && <UserSearch onStartChat={handleStartChat} onClose={() => setShowSearch(false)} />}
      {showCreateGroup && <CreateGroup onCreateGroup={handleCreateGroup} onClose={() => setShowCreateGroup(false)} />}

      <Sidebar
        activeSection={activeSection}
        setActiveContactId={handleOpenContact as (id: string | null) => void}
        activeContactId={activeContactId}
        contacts={contacts}
        darkMode={darkMode}
        onToggleDarkMode={handleToggleDarkMode}
        currentUser={user}
        onNewChat={() => setShowSearch(true)}
        onNewGroup={() => setShowCreateGroup(true)}
        setActiveSection={handleSwitchSection}
      />

      <ChatArea
        activeContactId={activeContactId}
        contacts={contacts}
        setContacts={setContacts}
        setInfoOpen={setInfoOpen}
        darkMode={darkMode}
        currentUser={user}
        socket={socket}
      />

      {infoOpen && activeContact && (
        <InfoPanel
          activeContactId={activeContactId!}
          contacts={contacts}
          onClose={() => setInfoOpen(false)}
          darkMode={darkMode}
        />
      )}
    </div>
  );
};

export default ChatDashboard;