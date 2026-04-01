import { useEffect, useRef, useState } from 'react';

interface UseWebRTCProps {
  socket: any;
  currentUserId: string;
}

export const useWebRTC = ({ socket, currentUserId }: UseWebRTCProps) => {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [callActive, setCallActive] = useState(false);
  const [incomingCall, setIncomingCall] = useState<any>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [callDuration, setCallDuration] = useState(0);

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Get user media
  const getUserMedia = async (video = true) => {
    try {
      console.log('🎥 Requesting media:', { video, audio: true });
      
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: video ? { width: 1280, height: 720 } : false,
        audio: true
      });
      
      console.log('✅ Media stream obtained');
      setStream(mediaStream);
      return mediaStream;
    } catch (error) {
      console.error('❌ Failed to get user media:', error);
      alert('Please allow camera and microphone access');
      return null;
    }
  };

  // Create peer connection
  // Create peer connection
const createPeerConnection = () => {
  const pc = new RTCPeerConnection({
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ]
  });

  pc.onicecandidate = (event) => {
    if (event.candidate) {
      console.log('🧊 ICE Candidate:', event.candidate);
      socket.emit('ice-candidate', {
        to: incomingCall?.from || 'remote-user',
        candidate: event.candidate
      });
    }
  };

  pc.ontrack = (event) => {
    console.log('✅ Received remote track');
    if (event.streams && event.streams[0]) {
      setRemoteStream(event.streams[0]);
      setCallActive(true);
      startTimer();
    }
  };

  pc.onconnectionstatechange = () => {
    console.log('📡 Connection state:', pc.connectionState);
    if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
      console.error('❌ Connection failed');
      cleanup();
    }
  };

  pc.onicegatheringstatechange = () => {
    console.log('🧊 ICE gathering state:', pc.iceGatheringState);
  };

  return pc;
};

  // Start call (as caller)
  const startCall = async (receiverId: string, callType: 'video' | 'audio', receiverName: string) => {
    console.log('🎬 START CALL TO:', receiverId);

    const mediaStream = await getUserMedia(callType === 'video');
    if (!mediaStream) return;

    const pc = createPeerConnection();
    peerConnectionRef.current = pc;

    // Add local stream tracks
    mediaStream.getTracks().forEach(track => {
      pc.addTrack(track, mediaStream);
    });

    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      console.log('📡 Sending offer via socket');
      socket.emit('call-offer', {
        to: receiverId,
        offer: offer,
        callType,
        callerName: receiverName
      });
    } catch (error) {
      console.error('❌ Error creating offer:', error);
    }
  };

  // Accept call (as receiver)
  const acceptCall = async () => {
    if (!incomingCall) return;

    console.log('✅ Accepting call from:', incomingCall.from);

    const mediaStream = await getUserMedia(incomingCall.callType === 'video');
    if (!mediaStream) return;

    const pc = createPeerConnection();
    peerConnectionRef.current = pc;

    // Add local stream tracks
    mediaStream.getTracks().forEach(track => {
      pc.addTrack(track, mediaStream);
    });

    try {
      await pc.setRemoteDescription(new RTCSessionDescription(incomingCall.offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      console.log('📡 Sending answer via socket');
      socket.emit('call-answer', {
        to: incomingCall.from,
        answer: answer
      });

      setIncomingCall(null);
    } catch (error) {
      console.error('❌ Error accepting call:', error);
    }
  };

  // Reject call
  const rejectCall = () => {
    if (incomingCall) {
      socket.emit('call-rejected', { to: incomingCall.from });
      setIncomingCall(null);
    }
  };

  // End call
  const endCall = (otherUserId: string) => {
    socket.emit('call-ended', { to: otherUserId });
    cleanup();
  };

  // Cleanup
  const cleanup = () => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setRemoteStream(null);
    setCallActive(false);
    setCallDuration(0);
    setIsMuted(false);
    setIsVideoOff(false);
  };

  // Toggle mute
  const toggleMute = () => {
    if (stream) {
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  };

  // Toggle video
  const toggleVideo = () => {
    if (stream) {
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoOff(!videoTrack.enabled);
      }
    }
  };

  // Start timer
  const startTimer = () => {
    timerRef.current = setInterval(() => {
      setCallDuration(prev => prev + 1);
    }, 1000);
  };

  // Format duration
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Socket listeners
  useEffect(() => {
    if (!socket) return;

    socket.on('incoming-call', (data: any) => {
      console.log('📞 Incoming call from:', data.from);
      setIncomingCall(data);
    });

    socket.on('call-answered', async (data: any) => {
      console.log('✅ Call answered');
      if (peerConnectionRef.current) {
        await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(data.answer));
      }
    });

    socket.on('ice-candidate', async (data: any) => {
      if (peerConnectionRef.current && data.candidate) {
        try {
          await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(data.candidate));
        } catch (error) {
          console.error('❌ Error adding ICE candidate:', error);
        }
      }
    });

    socket.on('call-rejected', () => {
      alert('Call was rejected');
      cleanup();
    });

    socket.on('call-ended', () => {
      cleanup();
    });

    return () => {
      socket.off('incoming-call');
      socket.off('call-answered');
      socket.off('ice-candidate');
      socket.off('call-rejected');
      socket.off('call-ended');
    };
  }, [socket, incomingCall]);

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
    toggleVideo
  };
};