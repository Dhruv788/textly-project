import React, { useRef, useEffect } from 'react';

interface CallWindowProps {
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  callDuration: string;
  isMuted: boolean;
  isVideoOff: boolean;
  onToggleMute: () => void;
  onToggleVideo: () => void;
  onEndCall: () => void;
  darkMode: boolean;
}

const CallWindow: React.FC<CallWindowProps> = ({
  localStream,
  remoteStream,
  callDuration,
  isMuted,
  isVideoOff,
  onToggleMute,
  onToggleVideo,
  onEndCall
}) => {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: '#000',
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      {/* Remote video */}
      <video
        ref={remoteVideoRef}
        autoPlay
        playsInline
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover'
        }}
      />

      {/* Local video (PiP) */}
      <div style={{
        position: 'absolute',
        top: 20,
        right: 20,
        width: 200,
        height: 150,
        borderRadius: 12,
        overflow: 'hidden',
        border: '2px solid white'
      }}>
        {!isVideoOff ? (
          <video
            ref={localVideoRef}
            autoPlay
            muted
            playsInline
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              transform: 'scaleX(-1)'
            }}
          />
        ) : (
          <div style={{
            width: '100%',
            height: '100%',
            background: '#1e293b',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <span className="material-icons" style={{ fontSize: 48, color: '#64748b' }}>
              videocam_off
            </span>
          </div>
        )}
      </div>

      {/* Timer */}
      <div style={{
        position: 'absolute',
        top: 20,
        left: 20,
        background: 'rgba(0,0,0,0.5)',
        padding: '8px 16px',
        borderRadius: 20,
        color: 'white'
      }}>
        {callDuration}
      </div>

      {/* Controls */}
      <div style={{
        position: 'absolute',
        bottom: 30,
        display: 'flex',
        gap: 16
      }}>
        <button
          onClick={onToggleMute}
          style={{
            width: 56,
            height: 56,
            borderRadius: '50%',
            background: isMuted ? '#ef4444' : '#334155',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <span className="material-icons" style={{ fontSize: 24, color: 'white' }}>
            {isMuted ? 'mic_off' : 'mic'}
          </span>
        </button>

        <button
          onClick={onToggleVideo}
          style={{
            width: 56,
            height: 56,
            borderRadius: '50%',
            background: isVideoOff ? '#ef4444' : '#334155',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <span className="material-icons" style={{ fontSize: 24, color: 'white' }}>
            {isVideoOff ? 'videocam_off' : 'videocam'}
          </span>
        </button>

        <button
          onClick={onEndCall}
          style={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            background: '#ef4444',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <span className="material-icons" style={{ fontSize: 28, color: 'white' }}>
            call_end
          </span>
        </button>
      </div>
    </div>
  );
};

export default CallWindow;