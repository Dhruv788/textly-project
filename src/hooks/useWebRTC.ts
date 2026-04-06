import { useEffect, useRef, useState } from 'react';

interface UseWebRTCProps {
  socket: any;
  currentUserId: string;
}

export const useWebRTC = ({ socket, currentUserId: _currentUserId }: UseWebRTCProps) => {
  const [stream, setStream]             = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [callActive, setCallActive]     = useState(false);
  const [incomingCall, setIncomingCall] = useState<any>(null);
  const [isMuted, setIsMuted]           = useState(false);
  const [isVideoOff, setIsVideoOff]     = useState(false);
  const [callDuration, setCallDuration] = useState(0);

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const timerRef          = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef         = useRef<MediaStream | null>(null);      // ✅ FIX 3: ref for cleanup
  const remoteUserIdRef   = useRef<string | null>(null);           // ✅ FIX 2: track remote user

  // ── Get user media
  const getUserMedia = async (video = true): Promise<MediaStream | null> => {
    try {
      console.log('🎥 Requesting media:', { video, audio: true });
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: video ? { width: 1280, height: 720, facingMode: 'user' } : false,
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      console.log('✅ Media stream obtained, tracks:', mediaStream.getTracks().map(t => t.kind));
      streamRef.current = mediaStream;   // ✅ FIX 3: always keep ref in sync
      setStream(mediaStream);
      return mediaStream;
    } catch (error: any) {
      console.error('❌ Failed to get user media:', error);
      if (error.name === 'NotAllowedError') {
        alert('Camera/microphone access denied. Please allow access and try again.');
      } else if (error.name === 'NotFoundError') {
        alert('No camera or microphone found on this device.');
      } else {
        alert(`Media error: ${error.message}`);
      }
      return null;
    }
  };

  // ── Create peer connection
  const createPeerConnection = () => {
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
      ],
    });

    pc.onicecandidate = (event) => {
      if (event.candidate && remoteUserIdRef.current) {
        // ✅ FIX 1+2: use remoteUserIdRef instead of stale incomingCall closure
        console.log('🧊 Sending ICE candidate to:', remoteUserIdRef.current);
        socket.emit('ice-candidate', {
          to: remoteUserIdRef.current,
          candidate: event.candidate,
        });
      }
    };

    pc.ontrack = (event) => {
      console.log('✅ Received remote track:', event.track.kind);
      if (event.streams && event.streams[0]) {
        setRemoteStream(event.streams[0]);
        setCallActive(true);
        startTimer();
      }
    };

    pc.onconnectionstatechange = () => {
      console.log('📡 Connection state:', pc.connectionState);
      if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        console.error('❌ Peer connection failed/disconnected');
        cleanup();
      }
    };

    pc.onicegatheringstatechange = () => {
      console.log('🧊 ICE gathering state:', pc.iceGatheringState);
    };

    pc.onnegotiationneeded = () => {
      console.log('🔄 Negotiation needed');
    };

    return pc;
  };

  // ── Start call (caller side)
  const startCall = async (receiverId: string, callType: 'video' | 'audio', callerName: string) => {
    console.log('🎬 Starting', callType, 'call to:', receiverId);

    // ✅ FIX 2: set remote user BEFORE creating peer connection
    remoteUserIdRef.current = receiverId;

    const mediaStream = await getUserMedia(callType === 'video');
    if (!mediaStream) return;

    const pc = createPeerConnection();
    peerConnectionRef.current = pc;

    mediaStream.getTracks().forEach(track => {
      console.log('➕ Adding local track:', track.kind);
      pc.addTrack(track, mediaStream);
    });

    try {
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: callType === 'video',
      });
      await pc.setLocalDescription(offer);

      console.log('📡 Emitting call-offer to:', receiverId);
      socket.emit('call-offer', {
        to: receiverId,
        offer,
        callType,
        callerName,
      });
    } catch (error) {
      console.error('❌ Error creating offer:', error);
      cleanup();
    }
  };

  // ── Accept call (receiver side)
  const acceptCall = async () => {
    if (!incomingCall) return;

    console.log('✅ Accepting', incomingCall.callType, 'call from:', incomingCall.from);

    // ✅ FIX 2: set remote user BEFORE clearing incomingCall
    remoteUserIdRef.current = incomingCall.from;

    const mediaStream = await getUserMedia(incomingCall.callType === 'video');
    if (!mediaStream) return;

    const pc = createPeerConnection();
    peerConnectionRef.current = pc;

    mediaStream.getTracks().forEach(track => {
      console.log('➕ Adding local track:', track.kind);
      pc.addTrack(track, mediaStream);
    });

    try {
      await pc.setRemoteDescription(new RTCSessionDescription(incomingCall.offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      console.log('📡 Emitting call-answer to:', incomingCall.from);
      socket.emit('call-answer', {
        to: incomingCall.from,
        answer,
      });

      // ✅ FIX 2: clear incomingCall AFTER remoteUserIdRef is set and answer is sent
      setIncomingCall(null);
    } catch (error) {
      console.error('❌ Error accepting call:', error);
      cleanup();
    }
  };

  // ── Reject call
  const rejectCall = () => {
    if (incomingCall) {
      socket.emit('call-rejected', { to: incomingCall.from });
      setIncomingCall(null);
    }
  };

  // ── End call
  const endCall = (otherUserId?: string) => {
    const target = otherUserId || remoteUserIdRef.current;
    if (target) {
      socket.emit('call-ended', { to: target });
    }
    cleanup();
  };

  // ── Cleanup — uses refs so it always has fresh values
  const cleanup = () => {
    console.log('🧹 Cleaning up WebRTC');

    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    // ✅ FIX 3: use streamRef instead of stale stream state
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        track.stop();
        console.log('🛑 Stopped track:', track.kind);
      });
      streamRef.current = null;
    }

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    remoteUserIdRef.current = null;
    setStream(null);
    setRemoteStream(null);
    setCallActive(false);
    setCallDuration(0);
    setIsMuted(false);
    setIsVideoOff(false);
    setIncomingCall(null);
  };

  // ── Toggle mute
  const toggleMute = () => {
    if (streamRef.current) {
      const audioTrack = streamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  };

  // ── Toggle video
  const toggleVideo = () => {
    if (streamRef.current) {
      const videoTrack = streamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoOff(!videoTrack.enabled);
      }
    }
  };

  // ── Start timer
  const startTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCallDuration(prev => prev + 1);
    }, 1000);
  };

  // ── Format duration
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // ── Socket listeners
  useEffect(() => {
    if (!socket) return;

    const handleIncomingCall = (data: any) => {
      console.log('📞 Incoming call from:', data.from, 'type:', data.callType);
      setIncomingCall(data);
    };

    const handleCallAnswered = async (data: any) => {
      console.log('✅ Call answered by remote');
      if (peerConnectionRef.current) {
        try {
          await peerConnectionRef.current.setRemoteDescription(
            new RTCSessionDescription(data.answer)
          );
          console.log('✅ Remote description set from answer');
        } catch (error) {
          console.error('❌ Error setting remote description from answer:', error);
        }
      }
    };

    const handleIceCandidate = async (data: any) => {
      if (peerConnectionRef.current && data.candidate) {
        try {
          await peerConnectionRef.current.addIceCandidate(
            new RTCIceCandidate(data.candidate)
          );
          console.log('✅ ICE candidate added');
        } catch (error) {
          console.error('❌ Error adding ICE candidate:', error);
        }
      }
    };

    const handleCallRejected = () => {
      console.log('❌ Call was rejected');
      alert('Call was rejected.');
      cleanup();
    };

    const handleCallEnded = () => {
      console.log('📴 Call ended by remote');
      cleanup();
    };

    socket.on('incoming-call',  handleIncomingCall);
    socket.on('call-answered',  handleCallAnswered);
    socket.on('ice-candidate',  handleIceCandidate);
    socket.on('call-rejected',  handleCallRejected);
    socket.on('call-ended',     handleCallEnded);

    return () => {
      socket.off('incoming-call',  handleIncomingCall);
      socket.off('call-answered',  handleCallAnswered);
      socket.off('ice-candidate',  handleIceCandidate);
      socket.off('call-rejected',  handleCallRejected);
      socket.off('call-ended',     handleCallEnded);
    };
  // ✅ FIX 4: no incomingCall in deps — handlers use refs, not closures
  }, [socket]);

  return {
    stream,
    remoteStream,
    callActive,
    incomingCall,
    isMuted,
    isVideoOff,
    callDuration: formatDuration(callDuration),
    startCall,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleVideo,
  };
};