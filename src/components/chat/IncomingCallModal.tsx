import React, { useEffect, useRef } from 'react';

interface IncomingCallModalProps {
  callerName: string;
  callType: 'audio' | 'video';
  onAccept: () => void;
  onReject: () => void;
}

const IncomingCallModal: React.FC<IncomingCallModalProps> = ({
  callerName,
  callType,
  onAccept,
  onReject,
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // ── Play ringtone while modal is open
  useEffect(() => {
    const audio = new Audio('https://cdn.pixabay.com/download/audio/2021/08/04/audio_0625c1539c.mp3');
    audio.loop = true;
    audio.volume = 0.5;
    audio.play().catch(() => {
      // Browser may block autoplay — that's fine
    });
    audioRef.current = audio;

    return () => {
      audio.pause();
      audio.currentTime = 0;
    };
  }, []);

  const handleAccept = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    onAccept();
  };

  const handleReject = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    onReject();
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>

        {/* ── Pulse ring animation */}
        <div style={styles.pulseWrapper}>
          <div style={styles.pulseRing} />
          <div style={styles.pulseRing2} />
          <div style={styles.avatar}>
            <span style={{ fontSize: 36, fontWeight: 700, color: 'white' }}>
              {callerName?.[0]?.toUpperCase() || '?'}
            </span>
          </div>
        </div>

        {/* ── Caller info */}
        <div style={styles.callerName}>{callerName}</div>
        <div style={styles.callType}>
          {callType === 'video' ? '📹 Incoming video call' : '📞 Incoming voice call'}
        </div>

        {/* ── Action buttons */}
        <div style={styles.buttons}>

          {/* Reject */}
          <button
            onClick={handleReject}
            style={styles.rejectBtn}
            onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.1)')}
            onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
            title="Decline"
          >
            <span className="material-icons" style={{ fontSize: 28, color: 'white' }}>
              call_end
            </span>
          </button>

          {/* Accept */}
          <button
            onClick={handleAccept}
            style={styles.acceptBtn}
            onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.1)')}
            onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
            title="Accept"
          >
            <span className="material-icons" style={{ fontSize: 28, color: 'white' }}>
              {callType === 'video' ? 'videocam' : 'call'}
            </span>
          </button>

        </div>

        {/* ── Button labels */}
        <div style={styles.btnLabels}>
          <span style={styles.btnLabel}>Decline</span>
          <span style={styles.btnLabel}>Accept</span>
        </div>

      </div>

      {/* ── Pulse animation keyframes */}
      <style>{`
        @keyframes pulse1 {
          0%   { transform: scale(1);   opacity: 0.6; }
          100% { transform: scale(1.6); opacity: 0; }
        }
        @keyframes pulse2 {
          0%   { transform: scale(1);   opacity: 0.4; }
          100% { transform: scale(1.9); opacity: 0; }
        }
        @keyframes slideUp {
          from { transform: translateY(40px); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
      `}</style>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0, 0, 0, 0.7)',
    backdropFilter: 'blur(6px)',
    zIndex: 99999,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modal: {
    background: 'linear-gradient(145deg, #1e293b, #0f172a)',
    borderRadius: 24,
    padding: '40px 48px 36px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 12,
    boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
    border: '1px solid rgba(255,255,255,0.08)',
    animation: 'slideUp 0.3s ease',
    minWidth: 280,
  },
  pulseWrapper: {
    position: 'relative',
    width: 96,
    height: 96,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  pulseRing: {
    position: 'absolute',
    inset: 0,
    borderRadius: '50%',
    background: 'rgba(34, 197, 94, 0.4)',
    animation: 'pulse1 1.6s ease-out infinite',
  },
  pulseRing2: {
    position: 'absolute',
    inset: 0,
    borderRadius: '50%',
    background: 'rgba(34, 197, 94, 0.25)',
    animation: 'pulse2 1.6s ease-out infinite 0.4s',
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #2563eb, #7c3aed)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
    border: '3px solid rgba(255,255,255,0.15)',
  },
  callerName: {
    fontSize: 22,
    fontWeight: 700,
    color: 'white',
    fontFamily: 'Inter, sans-serif',
    marginTop: 4,
  },
  callType: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.55)',
    fontFamily: 'Inter, sans-serif',
    marginBottom: 8,
  },
  buttons: {
    display: 'flex',
    gap: 40,
    marginTop: 16,
  },
  rejectBtn: {
    width: 64,
    height: 64,
    borderRadius: '50%',
    background: '#ef4444',
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 8px 24px rgba(239,68,68,0.4)',
    transition: 'transform 0.15s',
  },
  acceptBtn: {
    width: 64,
    height: 64,
    borderRadius: '50%',
    background: '#22c55e',
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 8px 24px rgba(34,197,94,0.4)',
    transition: 'transform 0.15s',
  },
  btnLabels: {
    display: 'flex',
    gap: 64,
    marginTop: 4,
  },
  btnLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
    fontFamily: 'Inter, sans-serif',
  },
};

export default IncomingCallModal;