import React, { useState, useRef, useEffect } from 'react';
import { useSocket } from '../../contexts/SocketContext';

interface Props {
  darkMode: boolean;
  onNotificationClick: (link: string) => void;
}

const NotificationBell: React.FC<Props> = ({ darkMode, onNotificationClick }) => {
  const { notifications, unreadCount, markAsRead, markAllAsRead, deleteNotification } = useSocket();
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  // ── Theme colors
  const bg        = darkMode ? '#1e293b' : '#ffffff';
  const text      = darkMode ? '#f1f5f9' : '#1e293b';
  const border    = darkMode ? '#334155' : '#e2e8f0';
  const hoverBg   = darkMode ? '#334155' : '#f1f5f9';
  const subText   = darkMode ? '#94a3b8' : '#64748b';
  const headerBg  = darkMode ? '#0f172a'  : '#f8fafc';
  const unreadBg  = darkMode ? '#1e3a5f'  : '#eff6ff';

  // ── Get sender initials for avatar fallback
  const getInitial = (name: string | undefined): string => {
    if (!name) return '?';
    return name.charAt(0).toUpperCase();
  };

  // ── Get sender image src (works with avatar OR profilePic field)
  const getAvatarSrc = (sender: any): string | null => {
    if (!sender) return null;
    if (sender.avatar && sender.avatar.trim() !== '') return sender.avatar;
    if (sender.profilePic && sender.profilePic.trim() !== '') return sender.profilePic;
    return null;
  };

  const handleItemClick = async (id: string, link: string, isRead: boolean) => {
    if (!isRead) await markAsRead(id);
    if (link) {
      onNotificationClick(link);
      setOpen(false);
    }
  };

  // ── Strip redundant "Name: " prefix from message
  const getMessagePreview = (message: string): string => {
    if (!message) return '';
    if (message.includes(': ')) {
      return message.split(': ').slice(1).join(': ');
    }
    return message;
  };

  // Get button position for proper dropdown placement
  const [buttonRect, setButtonRect] = useState<DOMRect | null>(null);
    
  const handleBellClick = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setButtonRect(rect);
    setOpen(prev => !prev);
  };
  
  // Close dropdown on window resize
  useEffect(() => {
    const handleResize = () => {
      if (open) {
        setOpen(false);
      }
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [open]);
    
  return (
    <div ref={dropdownRef} style={{ position: 'relative' }}>
  
      {/*── Bell Button */}
      <button
        onClick={handleBellClick}
        style={{
          position: 'relative',
          background: bg,
          border: `1px solid ${border}`,
          borderRadius: '50%',
          width: 40,
          height: 40,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
        }}
        title="Notifications"
      >
        <span style={{ fontSize: 18 }}>🔔</span>
  
        {/* Unread count badge */}
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute',
            top: -4,
            right: -4,
            background: '#ef4444',
            color: '#fff',
            fontSize: 10,
            fontWeight: 700,
            borderRadius: '999px',
            minWidth: 18,
            height: 18,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 4px',
            border: `2px solid ${bg}`,
          }}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>
  
      {/*── Dropdown */}
      {open && buttonRect && (
        <div style={{
          position: 'fixed',
          top: `${buttonRect.bottom + 8}px`,
          right: `${window.innerWidth - buttonRect.right}px`,
          width: '340px',
          background: bg,
          border: `1px solid ${border}`,
          borderRadius: '14px',
          boxShadow: '0 8px 40px rgba(0,0,0,0.18)',
          zIndex: 9999,
          overflow: 'hidden',
          fontFamily: 'Inter, sans-serif',
        }}>

          {/* ── Header */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '12px 16px',
            background: headerBg,
            borderBottom: `1px solid ${border}`,
          }}>
            <span style={{ fontWeight: 700, fontSize: 14, color: text }}>
              🔔 Notifications
              {unreadCount > 0 && (
                <span style={{
                  marginLeft: 8,
                  background: '#3b82f6',
                  color: '#fff',
                  fontSize: 11,
                  borderRadius: 999,
                  padding: '2px 8px',
                  fontWeight: 600,
                }}>
                  {unreadCount} new
                </span>
              )}
            </span>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#3b82f6',
                  fontSize: 12,
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                Mark all read
              </button>
            )}
          </div>

          {/* ── Notification List */}
          <ul style={{
            maxHeight: 360,
            overflowY: 'auto',
            margin: 0,
            padding: 0,
            listStyle: 'none',
          }}>
            {notifications.length === 0 ? (
              <li style={{
                padding: '36px 16px',
                textAlign: 'center',
                color: subText,
                fontSize: 13,
              }}>
                <div style={{ fontSize: 30, marginBottom: 8 }}>🔕</div>
                No notifications yet
              </li>
            ) : (
              notifications.map(n => {
                const avatarSrc = getAvatarSrc(n.sender);
                const initial   = getInitial(n.sender?.name);
                const preview   = getMessagePreview(n.message);

                return (
                  <li
                    key={n._id}
                    onClick={() => handleItemClick(n._id, n.link, n.isRead)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '10px 14px',
                      borderBottom: `1px solid ${border}`,
                      background: n.isRead ? bg : unreadBg,
                      cursor: 'pointer',
                      borderLeft: n.isRead ? '3px solid transparent' : '3px solid #3b82f6',
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLLIElement).style.background = hoverBg;
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLLIElement).style.background = n.isRead ? bg : unreadBg;
                    }}
                  >
                    {/* ── Avatar */}
                    <div style={{
                      width: 42,
                      height: 42,
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 16,
                      fontWeight: 700,
                      color: '#fff',
                      flexShrink: 0,
                      overflow: 'hidden',
                      boxShadow: '0 2px 6px rgba(59,130,246,0.3)',
                    }}>
                      {avatarSrc ? (
                        <img
                          src={avatarSrc}
                          alt={n.sender?.name ?? ''}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                          }}
                        />
                      ) : (
                        <span>{initial}</span>
                      )}
                    </div>

                    {/* ── Text Content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {/* Sender name — bold so you know WHO messaged */}
                      <p style={{
                        margin: 0,
                        fontSize: 13,
                        fontWeight: 700,
                        color: text,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}>
                        {n.sender?.name ?? 'Someone'}
                      </p>

                      {/* Message preview */}
                      <p style={{
                        margin: '2px 0 0',
                        fontSize: 12,
                        color: subText,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        fontWeight: n.isRead ? 400 : 500,
                      }}>
                        {preview}
                      </p>

                      {/* Timestamp */}
                      <p style={{
                        margin: '3px 0 0',
                        fontSize: 11,
                        color: subText,
                        opacity: 0.8,
                      }}>
                        {new Date(n.createdAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                        {' · '}
                        {new Date(n.createdAt).toLocaleDateString([], {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </p>
                    </div>

                    {/* ── Unread blue dot */}
                    {!n.isRead && (
                      <div style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: '#3b82f6',
                        flexShrink: 0,
                      }} />
                    )}

                    {/* ── Delete button */}
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        deleteNotification(n._id);
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#ef4444',
                        cursor: 'pointer',
                        fontSize: 13,
                        padding: '2px 5px',
                        borderRadius: 4,
                        flexShrink: 0,
                        opacity: 0.7,
                      }}
                      title="Delete"
                    >
                      ✕
                    </button>
                  </li>
                );
              })
            )}
          </ul>

          {/*── Footer */}
          {notifications.length > 0 && (
            <div style={{
              padding: '10px 16px',
              borderTop: `1px solid ${border}`,
              background: headerBg,
              textAlign: 'center',
            }}>
              <span style={{ fontSize: 12, color: subText }}>
                {notifications.length} total · {unreadCount} unread
              </span>
            </div>
          )}
    
        </div>
      )}
    </div>
  );
};

export default NotificationBell;