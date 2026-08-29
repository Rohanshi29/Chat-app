import { useEffect, useRef } from "react";
import { API_URL } from "../api/axios";
import { useCall } from "../context/CallContext";

const CallModal = () => {
  const {
    callState,
    callType,
    remoteUser,
    localStream,
    remoteStream,
    muted,
    cameraOff,
    screenSharing,
    error,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleCamera,
    toggleScreenShare,
  } = useCall();

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const remoteAudioRef = useRef(null);

  useEffect(() => {
    if (localVideoRef.current) localVideoRef.current.srcObject = localStream;
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStream;
    if (remoteAudioRef.current) remoteAudioRef.current.srcObject = remoteStream;
  }, [remoteStream]);

  if (callState === "idle" && !error) return null;

  const isVideo = callType === "video";
  const initial = remoteUser?.username?.[0]?.toUpperCase() || "?";

  return (
    <div className="call-overlay">
      {error && callState === "idle" && (
        <div className="call-toast">{error}</div>
      )}

      {callState !== "idle" && (
        <div className="call-modal">
          {error && <div className="call-toast call-toast-inline">{error}</div>}

          {isVideo && callState === "connected" ? (
            <div className="call-video-stage">
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="remote-video"
              />
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="local-video"
              />
            </div>
          ) : (
            <div className="call-avatar-stage">
              {remoteUser?.profilePicture ? (
                <img
                  src={`${API_URL}${remoteUser.profilePicture}`}
                  alt={remoteUser.username}
                  className="call-avatar"
                />
              ) : (
                <div className="call-avatar call-avatar-placeholder">
                  {initial}
                </div>
              )}
              {isVideo && (
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="local-video local-video-solo"
                />
              )}
            </div>
          )}

          <audio ref={remoteAudioRef} autoPlay hidden={isVideo} />

          <div className="call-info">
            <h3>{remoteUser?.username}</h3>
            <p className="call-status-text">
              {callState === "outgoing" && "Calling..."}
              {callState === "incoming" &&
                `Incoming ${isVideo ? "video" : "voice"} call`}
              {callState === "connected" && (isVideo ? "Video call" : "Voice call")}
            </p>
          </div>

          <div className="call-controls">
            {callState === "incoming" ? (
              <>
                <button className="call-btn call-btn-reject" onClick={rejectCall}>
                  ✕
                </button>
                <button className="call-btn call-btn-accept" onClick={acceptCall}>
                  ✓
                </button>
              </>
            ) : (
              <>
                <button
                  className={`call-btn call-btn-secondary ${muted ? "active" : ""}`}
                  onClick={toggleMute}
                  title={muted ? "Unmute" : "Mute"}
                >
                  {muted ? "🔇" : "🎤"}
                </button>
                {isVideo && (
                  <button
                    className={`call-btn call-btn-secondary ${cameraOff ? "active" : ""}`}
                    onClick={toggleCamera}
                    title={cameraOff ? "Turn camera on" : "Turn camera off"}
                  >
                    {cameraOff ? "📷" : "🎥"}
                  </button>
                )}
                {isVideo && callState === "connected" && (
                  <button
                    className={`call-btn call-btn-secondary ${screenSharing ? "active" : ""}`}
                    onClick={toggleScreenShare}
                    title={screenSharing ? "Stop sharing screen" : "Share screen"}
                  >
                    🖥️
                  </button>
                )}
                <button className="call-btn call-btn-reject" onClick={endCall}>
                  ✕
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CallModal;
