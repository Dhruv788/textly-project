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

const ChatDashboard: React.FC = () => {
  const { user } = useAuth();
  const { socket } = useSocket();

  const [activeSection, setActiveSection] = useState<Section>('chats');
  const [activeContactId, setActiveContactId] = useState<string | null>(null);
  const [infoOpen, setInfoOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSearch, setShowSearch] = useState(false);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [typingUsers, setTypingUsers] = useState<{ [convId: string]: string }>({});

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
  const handleCreateGroup = useCallback(({ conv, members }: { conv: any; members: any[] }) => {
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
    console.log('✅ Group created:', conv.name);
  }, [user]);

  // ── Load conversations on mount
  useEffect(() => {
    const loadConversations = async () => {
      try {
        setLoading(true);
        const res = await (api as any).conversations.getAll();
        if (res.success && res.data) {
          const transformed = res.data.map((conv: any) => {
            const other = conv.participants.find(
              (p: any) => p._id.toString() !== user?.id.toString()
            );
            const isGroup = conv.type === 'group';

            return {
              id: conv._id,
              conversationId: conv._id,
              participantId: isGroup ? undefined : other?._id?.toString(),
              // For groups, store ALL participant IDs except self
              participantIds: isGroup
                ? conv.participants
                    .map((p: any) => p._id?.toString())
                    .filter((id: string) => id !== user?.id)
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

  // ── Real-time socket events
  useEffect(() => {
    if (!socket) return;

    // Incoming message
    socket.on('receive-message', ({ conversationId, message }: any) => {
      const time = new Date(message.createdAt).toLocaleTimeString([], {
        hour: '2-digit', minute: '2-digit'
      });
      setContacts(prev => prev.map(c => {
        if (c.id === conversationId) {
          const isMine = message.sender?._id?.toString() === user?.id?.toString()
                      || message.sender?.toString() === user?.id?.toString();
          return {
            ...c,
            messages: [
              ...(c.messages || []),
              { id: message._id, text: message.text, sent: isMine, time, senderName: message.sender?.name }
            ],
            lastMessage: message.text,
            time,
            unread: c.id !== activeContactId ? (c.unread || 0) + 1 : 0
          };
        }
        return c;
      }));
    });

    // Online status
    socket.on('user-status-change', ({ userId, isOnline, lastSeen }: any) => {
      setContacts(prev => prev.map(c =>
        c.participantId === userId?.toString()
          ? { ...c, status: isOnline ? 'online' : 'offline', lastSeen }
          : c
      ));
    });

    // Typing indicators
    socket.on('user-typing', ({ conversationId, userId, userName }: any) => {
      if (userId !== user?.id) {
        setTypingUsers(prev => ({ ...prev, [conversationId]: userName || 'Someone' }));
      }
    });

    socket.on('user-stop-typing', ({ conversationId }: any) => {
      setTypingUsers(prev => {
        const next = { ...prev };
        delete next[conversationId];
        return next;
      });
    });

    // Message status updates
    socket.on('message-status-update', ({ conversationId, messageId, status }: any) => {
      setContacts(prev => prev.map(c => {
        if (c.id !== conversationId) return c;
        return {
          ...c,
          messages: c.messages.map(m =>
            m.id === messageId ? { ...m, status } : m
          )
        };
      }));
    });

    // Messages seen
    socket.on('messages-seen', ({ conversationId }: any) => {
      setContacts(prev => prev.map(c => {
        if (c.id !== conversationId) return c;
        return {
          ...c,
          messages: c.messages.map(m =>
            m.sent ? { ...m, status: 'seen' } : m
          )
        };
      }));
    });

    return () => {
      socket.off('receive-message');
      socket.off('user-status-change');
      socket.off('user-typing');
      socket.off('user-stop-typing');
      socket.off('message-status-update');
      socket.off('messages-seen');
    };
  }, [socket, user, activeContactId]);

  // ── Open a contact and load messages
  const handleOpenContact = useCallback(async (id: string) => {
    setActiveContactId(id);
    setActiveSection('chats');
    setContacts(prev => prev.map(c => c.id === id ? { ...c, unread: 0 } : c));

    try {
      const res = await (api as any).messages.getMessages(id);
      if (res.success && res.data) {
        const msgs = res.data.map((m: any) => ({
          id: m._id,
          text: m.text,
          sent: m.sender?._id?.toString() === user?.id?.toString(),
          time: new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          senderName: m.sender?.name,
          senderAvatar: m.sender?.avatar,
        }));
        setContacts(prev => prev.map(c => c.id === id ? { ...c, messages: msgs } : c));
      }
    } catch (err) {
      console.error('❌ Failed to load messages:', err);
    }
  }, [user]);

  const handleSwitchSection = useCallback((section: Section) => {
    setActiveSection(section);
  }, []);

  const handleToggleDarkMode = useCallback(() => {
    setDarkMode(prev => !prev);
  }, []);

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
      <Navigation
        activeSection={activeSection}
        setActiveSection={handleSwitchSection}
        darkMode={darkMode}
      />

      {/* User search modal */}
      {showSearch && (
        <UserSearch
          onStartChat={handleStartChat}
          onClose={() => setShowSearch(false)}
        />
      )}

      {/* Create group modal */}
      {showCreateGroup && (
        <CreateGroup
          onCreateGroup={handleCreateGroup}
          onClose={() => setShowCreateGroup(false)}
        />
      )}

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