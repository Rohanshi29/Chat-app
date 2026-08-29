import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useAuth } from "./AuthContext";
import { useSocket } from "./SocketContext";

const CallContext = createContext(null);

// Public STUN server so peers can discover their public IP/port.
// Note: on strict NATs/corporate firewalls a TURN server would also be
// needed for relaying media - none is configured here.
const ICE_SERVERS = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

export const CallProvider = ({ children }) => {
  const { socket } = useSocket();
  const { user } = useAuth();

  // "idle" | "outgoing" | "incoming" | "connected"
  const [callState, setCallState] = useState("idle");
  const [callType, setCallType] = useState("audio"); // "audio" | "video"
  const [remoteUser, setRemoteUser] = useState(null);
  const [chatId, setChatId] = useState(null);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [screenSharing, setScreenSharing] = useState(false);
  const [error, setError] = useState(null);

  const pcRef = useRef(null);
  const pendingOfferRef = useRef(null);
  const pendingCandidatesRef = useRef([]);
  const cameraTrackRef = useRef(null); // original webcam track, kept aside while screen-sharing

  const cleanup = useCallback(() => {
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    setLocalStream((stream) => {
      stream?.getTracks().forEach((t) => t.stop());
      return null;
    });
    setRemoteStream(null);
    setRemoteUser(null);
    setChatId(null);
    setCallState("idle");
    setMuted(false);
    setCameraOff(false);
    setScreenSharing(false);
    cameraTrackRef.current = null;
    pendingOfferRef.current = null;
    pendingCandidatesRef.current = [];
  }, []);

  const createPeerConnection = useCallback(
    (toUserId) => {
      const pc = new RTCPeerConnection(ICE_SERVERS);

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socket?.emit("call:ice-candidate", {
            toUserId,
            candidate: event.candidate,
          });
        }
      };

      pc.ontrack = (event) => {
        setRemoteStream(event.streams[0]);
      };

      pc.onconnectionstatechange = () => {
        if (["failed", "disconnected", "closed"].includes(pc.connectionState)) {
          if (pc.connectionState === "failed") {
            setError("Call connection lost");
          }
        }
      };

      pcRef.current = pc;
      return pc;
    },
    [socket]
  );

  const getLocalMedia = useCallback(async (type) => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: type === "video",
    });
    setLocalStream(stream);
    return stream;
  }, []);

  // ----- Outgoing call -----
  const startCall = useCallback(
    async (targetUser, chat, type) => {
      if (!socket || callState !== "idle") return;
      setError(null);
      setCallType(type);
      setRemoteUser(targetUser);
      setChatId(chat._id);
      setCallState("outgoing");

      try {
        const stream = await getLocalMedia(type);
        const pc = createPeerConnection(targetUser._id);
        stream.getTracks().forEach((track) => pc.addTrack(track, stream));

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        socket.emit("call:initiate", {
          toUserId: targetUser._id,
          chatId: chat._id,
          offer,
          callType: type,
        });
      } catch (err) {
        console.error(err);
        setError(
          err.name === "NotAllowedError"
            ? "Camera/microphone permission denied"
            : "Could not start call"
        );
        cleanup();
      }
    },
    [socket, callState, getLocalMedia, createPeerConnection, cleanup]
  );

  // ----- Incoming call -----
  const acceptCall = useCallback(async () => {
    if (!socket || !remoteUser || !pendingOfferRef.current) return;
    setError(null);

    try {
      const stream = await getLocalMedia(callType);
      const pc = createPeerConnection(remoteUser._id);
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      await pc.setRemoteDescription(
        new RTCSessionDescription(pendingOfferRef.current)
      );

      for (const candidate of pendingCandidatesRef.current) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      }
      pendingCandidatesRef.current = [];

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socket.emit("call:answer", {
        toUserId: remoteUser._id,
        chatId,
        answer,
      });

      setCallState("connected");
    } catch (err) {
      console.error(err);
      setError(
        err.name === "NotAllowedError"
          ? "Camera/microphone permission denied"
          : "Could not answer call"
      );
      socket.emit("call:reject", { toUserId: remoteUser._id, chatId });
      cleanup();
    }
  }, [socket, remoteUser, chatId, callType, getLocalMedia, createPeerConnection, cleanup]);

  const rejectCall = useCallback(() => {
    if (socket && remoteUser) {
      socket.emit("call:reject", { toUserId: remoteUser._id, chatId });
    }
    cleanup();
  }, [socket, remoteUser, chatId, cleanup]);

  const endCall = useCallback(() => {
    if (socket && remoteUser) {
      socket.emit("call:end", { toUserId: remoteUser._id, chatId });
    }
    cleanup();
  }, [socket, remoteUser, chatId, cleanup]);

  const toggleMute = useCallback(() => {
    setLocalStream((stream) => {
      stream?.getAudioTracks().forEach((t) => (t.enabled = muted));
      return stream;
    });
    setMuted((m) => !m);
  }, [muted]);

  const toggleCamera = useCallback(() => {
    setLocalStream((stream) => {
      stream?.getVideoTracks().forEach((t) => (t.enabled = cameraOff));
      return stream;
    });
    setCameraOff((c) => !c);
  }, [cameraOff]);

  // Screen sharing: swaps the outgoing video track between the webcam and
  // a captured screen/window/tab. Only meaningful for video calls that are
  // already connected.
  const toggleScreenShare = useCallback(async () => {
    const pc = pcRef.current;
    if (!pc || callType !== "video" || callState !== "connected") return;

    const sender = pc.getSenders().find((s) => s.track?.kind === "video");
    if (!sender) return;

    if (screenSharing) {
      // Switch back to the webcam.
      const camTrack = cameraTrackRef.current;
      if (camTrack) {
        await sender.replaceTrack(camTrack);
        setLocalStream((stream) => {
          const s = stream || new MediaStream();
          s.getVideoTracks().forEach((t) => s.removeTrack(t));
          s.addTrack(camTrack);
          return s;
        });
      }
      setScreenSharing(false);
      return;
    }

    try {
      const displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const screenTrack = displayStream.getVideoTracks()[0];

      // Stash the current webcam track so we can restore it later.
      cameraTrackRef.current = sender.track;

      await sender.replaceTrack(screenTrack);
      setLocalStream((stream) => {
        const s = stream || new MediaStream();
        s.getVideoTracks().forEach((t) => s.removeTrack(t));
        s.addTrack(screenTrack);
        return s;
      });
      setScreenSharing(true);

      // If the user stops sharing from the browser's own UI, switch back.
      screenTrack.onended = async () => {
        const camTrack = cameraTrackRef.current;
        if (camTrack && pcRef.current) {
          const currentSender = pcRef.current.getSenders().find((s) => s.track?.kind === "video");
          await currentSender?.replaceTrack(camTrack);
          setLocalStream((stream) => {
            const s = stream || new MediaStream();
            s.getVideoTracks().forEach((t) => s.removeTrack(t));
            s.addTrack(camTrack);
            return s;
          });
        }
        setScreenSharing(false);
      };
    } catch (err) {
      console.error(err);
      // User cancelled the share picker, or permission denied - no-op.
    }
  }, [callType, callState, screenSharing]);

  // ----- Socket event wiring -----
  useEffect(() => {
    if (!socket) return;

    const handleIncoming = ({ fromUser, chatId: cid, offer, callType: type }) => {
      // Already on a call - silently ignore (a fuller app might send a
      // "busy" signal back).
      if (callState !== "idle") return;
      pendingOfferRef.current = offer;
      setRemoteUser(fromUser);
      setChatId(cid);
      setCallType(type);
      setCallState("incoming");
    };

    const handleAnswered = async ({ answer }) => {
      const pc = pcRef.current;
      if (!pc) return;
      await pc.setRemoteDescription(new RTCSessionDescription(answer));
      for (const candidate of pendingCandidatesRef.current) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      }
      pendingCandidatesRef.current = [];
      setCallState("connected");
    };

    const handleIceCandidate = async ({ candidate }) => {
      const pc = pcRef.current;
      if (pc && pc.remoteDescription) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.error("Failed to add ICE candidate", err);
        }
      } else {
        pendingCandidatesRef.current.push(candidate);
      }
    };

    const handleRejected = () => {
      setError("Call declined");
      cleanup();
    };

    const handleEnded = () => {
      cleanup();
    };

    const handleUnavailable = () => {
      setError("User is offline");
      cleanup();
    };

    socket.on("call:incoming", handleIncoming);
    socket.on("call:answered", handleAnswered);
    socket.on("call:ice-candidate", handleIceCandidate);
    socket.on("call:rejected", handleRejected);
    socket.on("call:ended", handleEnded);
    socket.on("call:unavailable", handleUnavailable);

    return () => {
      socket.off("call:incoming", handleIncoming);
      socket.off("call:answered", handleAnswered);
      socket.off("call:ice-candidate", handleIceCandidate);
      socket.off("call:rejected", handleRejected);
      socket.off("call:ended", handleEnded);
      socket.off("call:unavailable", handleUnavailable);
    };
  }, [socket, callState, cleanup]);

  // Clear a transient error a few seconds after it's shown.
  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(null), 4000);
    return () => clearTimeout(t);
  }, [error]);

  return (
    <CallContext.Provider
      value={{
        callState,
        callType,
        remoteUser,
        localStream,
        remoteStream,
        muted,
        cameraOff,
        screenSharing,
        error,
        currentUser: user,
        startCall,
        acceptCall,
        rejectCall,
        endCall,
        toggleMute,
        toggleCamera,
        toggleScreenShare,
      }}
    >
      {children}
    </CallContext.Provider>
  );
};

export const useCall = () => useContext(CallContext);
