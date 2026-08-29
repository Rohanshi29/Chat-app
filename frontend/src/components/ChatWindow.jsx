import { useEffect, useRef, useState } from "react";
import EmojiPicker from "emoji-picker-react";
import api, { API_URL } from "../api/axios";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";
import { useCall } from "../context/CallContext";
import PinnedBar from "./PinnedBar";
import WallpaperPicker from "./WallpaperPicker";

const REACTION_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

const getChatDisplayName = (chat, currentUserId) => {
  if (chat.isGroupChat) return chat.chatName;
  const other = chat.users.find((u) => String(u._id) !== String(currentUserId));
  return other?.username || "Unknown user";
};

const formatTime = (dateStr) =>
  new Date(dateStr).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

const formatDuration = (secs) => {
  const s = Math.round(secs || 0);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

const ChatWindow = ({ chat, onChatUpdated }) => {
  const [messages, setMessages] = useState([]);
  const [content, setContent] = useState("");
  const [showEmoji, setShowEmoji] = useState(false);
  const [typingUser, setTypingUser] = useState(null);
  const [sending, setSending] = useState(false);

  // search
  const [searching, setSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState(null);

  // reactions / menu
  const [openMenuId, setOpenMenuId] = useState(null);
  const [reactionPickerId, setReactionPickerId] = useState(null);

  // edit
  const [editingId, setEditingId] = useState(null);
  const [editContent, setEditContent] = useState("");

  // voice recording
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);

  // pinned + wallpaper
  const [pinnedMessages, setPinnedMessages] = useState([]);
  const [showWallpaperPicker, setShowWallpaperPicker] = useState(false);

  // AI
  const [summarizing, setSummarizing] = useState(false);
  const [summary, setSummary] = useState(null);
  const [smartSuggestions, setSmartSuggestions] = useState([]);
  const [translations, setTranslations] = useState({});
  const [translatingId, setTranslatingId] = useState(null);

  const { user } = useAuth();
  const { socket, onlineUserIds } = useSocket();
  const { startCall, callState } = useCall();
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const fileInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordTimerRef = useRef(null);

  const otherUser = !chat.isGroupChat
    ? chat.users.find((u) => String(u._id) !== String(user._id))
    : null;
  const isOnline = otherUser && onlineUserIds.has(String(otherUser._id));
  const otherMemberCount = chat.users.filter((u) => String(u._id) !== String(user._id)).length;

  const refreshPinned = async () => {
    try {
      const { data } = await api.get(`/messages/pinned/${chat._id}`);
      setPinnedMessages(data.messages);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    const fetchMessages = async () => {
      const { data } = await api.get(`/messages/${chat._id}`);
      setMessages(data.messages);
      // Mark everything in this chat as read, and let the other side know.
      try {
        await api.put(`/messages/read/${chat._id}`);
        socket?.emit("chat-read", { chatId: chat._id });
      } catch (err) {
        console.error(err);
      }
    };
    fetchMessages();
    refreshPinned();
    setSearching(false);
    setSearchQuery("");
    setSearchResults(null);
    setSummary(null);
    setSmartSuggestions([]);
    setTranslations({});

    if (socket) {
      socket.emit("join-chat", chat._id);
    }

    return () => {
      if (socket) socket.emit("leave-chat", chat._id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chat._id, socket]);

  useEffect(() => {
    if (!socket) return;

    const handleReceive = (message) => {
      if (message.chat._id === chat._id) {
        setMessages((prev) => [...prev, message]);
        if (String(message.sender._id) !== String(user._id)) {
          api.put(`/messages/read/${chat._id}`).catch(() => {});
          socket.emit("chat-read", { chatId: chat._id });
        }
      }
    };

    const handleTyping = ({ chatId }) => {
      if (chatId === chat._id) setTypingUser(true);
    };

    const handleStopTyping = ({ chatId }) => {
      if (chatId === chat._id) setTypingUser(false);
    };

    const handleChatRead = ({ chatId }) => {
      if (chatId !== chat._id) return;
      setMessages((prev) =>
        prev.map((m) =>
          m.readBy.some((id) => String(id) === String(user._id))
            ? m
            : { ...m, readBy: [...m.readBy, otherUser?._id].filter(Boolean) }
        )
      );
    };

    const handleEdited = ({ chatId, messageId, content: newContent }) => {
      if (chatId !== chat._id) return;
      setMessages((prev) =>
        prev.map((m) => (m._id === messageId ? { ...m, content: newContent, edited: true } : m))
      );
    };

    const handleDeleted = ({ chatId, messageId, forEveryone }) => {
      if (chatId !== chat._id) return;
      if (forEveryone) {
        setMessages((prev) =>
          prev.map((m) =>
            m._id === messageId ? { ...m, isDeleted: true, content: "", fileUrl: "", fileName: "" } : m
          )
        );
      }
    };

    const handleReaction = ({ chatId, messageId, reactions }) => {
      if (chatId !== chat._id) return;
      setMessages((prev) => prev.map((m) => (m._id === messageId ? { ...m, reactions } : m)));
    };

    const handlePinned = ({ chatId }) => {
      if (chatId === chat._id) refreshPinned();
    };

    socket.on("receive-message", handleReceive);
    socket.on("typing", handleTyping);
    socket.on("stop-typing", handleStopTyping);
    socket.on("chat-read", handleChatRead);
    socket.on("message-edited", handleEdited);
    socket.on("message-deleted", handleDeleted);
    socket.on("message-reaction", handleReaction);
    socket.on("message-pinned", handlePinned);

    return () => {
      socket.off("receive-message", handleReceive);
      socket.off("typing", handleTyping);
      socket.off("stop-typing", handleStopTyping);
      socket.off("chat-read", handleChatRead);
      socket.off("message-edited", handleEdited);
      socket.off("message-deleted", handleDeleted);
      socket.off("message-reaction", handleReaction);
      socket.off("message-pinned", handlePinned);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, chat._id, otherUser?._id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Fetch smart-reply suggestions whenever the latest message is from the
  // other person (nothing to suggest replying to your own message).
  useEffect(() => {
    const last = messages[messages.length - 1];
    setSmartSuggestions([]);
    if (!last || String(last.sender._id) === String(user._id) || last.messageType !== "text") return;

    const t = setTimeout(async () => {
      try {
        const { data } = await api.post("/ai/smart-reply", { chatId: chat._id });
        setSmartSuggestions(data.suggestions || []);
      } catch {
        // AI not configured or failed - fail silently, it's a nice-to-have
      }
    }, 400);
    return () => clearTimeout(t);
  }, [messages, chat._id, user._id]);

  const handleTypingInput = (value) => {
    setContent(value);
    if (!socket) return;

    socket.emit("typing", { chatId: chat._id });
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit("stop-typing", { chatId: chat._id });
    }, 1500);
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!content.trim() || sending) return;

    setSending(true);
    try {
      const { data } = await api.post("/messages", {
        chatId: chat._id,
        content,
      });
      setMessages((prev) => [...prev, data.message]);
      socket?.emit("send-message", data.message);
      setContent("");
      socket?.emit("stop-typing", { chatId: chat._id });
    } catch (err) {
      console.error(err);
    } finally {
      setSending(false);
    }
  };

  const handleEmojiClick = (emojiData) => {
    setContent((prev) => prev + emojiData.emoji);
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);
    formData.append("chatId", chat._id);

    try {
      const { data } = await api.post("/messages/file", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setMessages((prev) => [...prev, data.message]);
      socket?.emit("send-message", data.message);
    } catch (err) {
      console.error(err);
    } finally {
      e.target.value = "";
    }
  };

  // ---- Voice notes ----
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const duration = recordSeconds;

        const formData = new FormData();
        formData.append("voice", blob, "voice-note.webm");
        formData.append("chatId", chat._id);
        formData.append("duration", duration);

        try {
          const { data } = await api.post("/messages/voice", formData, {
            headers: { "Content-Type": "multipart/form-data" },
          });
          setMessages((prev) => [...prev, data.message]);
          socket?.emit("send-message", data.message);
        } catch (err) {
          console.error(err);
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecording(true);
      setRecordSeconds(0);
      recordTimerRef.current = setInterval(() => setRecordSeconds((s) => s + 1), 1000);
    } catch (err) {
      console.error(err);
      alert("Microphone permission is needed to record a voice note.");
    }
  };

  const stopRecording = (cancel = false) => {
    clearInterval(recordTimerRef.current);
    setRecording(false);
    if (cancel && mediaRecorderRef.current) {
      audioChunksRef.current = [];
      mediaRecorderRef.current.onstop = () => {
        mediaRecorderRef.current.stream?.getTracks().forEach((t) => t.stop());
      };
    }
    mediaRecorderRef.current?.stop();
  };

  // ---- Edit / delete ----
  const beginEdit = (msg) => {
    setEditingId(msg._id);
    setEditContent(msg.content);
    setOpenMenuId(null);
  };

  const saveEdit = async (msg) => {
    if (!editContent.trim()) return;
    try {
      const { data } = await api.put(`/messages/${msg._id}`, { content: editContent });
      setMessages((prev) => prev.map((m) => (m._id === msg._id ? data.message : m)));
      socket?.emit("message-edited", {
        chatId: chat._id,
        messageId: msg._id,
        content: data.message.content,
      });
      setEditingId(null);
    } catch (err) {
      console.error(err);
    }
  };

  const deleteMessage = async (msg, forEveryone) => {
    setOpenMenuId(null);
    try {
      await api.delete(`/messages/${msg._id}?forEveryone=${forEveryone}`);
      if (forEveryone) {
        setMessages((prev) =>
          prev.map((m) =>
            m._id === msg._id ? { ...m, isDeleted: true, content: "", fileUrl: "", fileName: "" } : m
          )
        );
        socket?.emit("message-deleted", { chatId: chat._id, messageId: msg._id, forEveryone: true });
      } else {
        setMessages((prev) => prev.filter((m) => m._id !== msg._id));
      }
    } catch (err) {
      console.error(err);
    }
  };

  // ---- Reactions ----
  const react = async (msg, emoji) => {
    setReactionPickerId(null);
    try {
      const { data } = await api.post(`/messages/${msg._id}/react`, { emoji });
      setMessages((prev) =>
        prev.map((m) => (m._id === msg._id ? { ...m, reactions: data.reactions } : m))
      );
      socket?.emit("message-reaction", {
        chatId: chat._id,
        messageId: msg._id,
        reactions: data.reactions,
      });
    } catch (err) {
      console.error(err);
    }
  };

  // ---- Pin ----
  const togglePin = async (msg) => {
    setOpenMenuId(null);
    try {
      await api.post(`/messages/${msg._id}/pin`);
      socket?.emit("message-pinned", { chatId: chat._id, messageId: msg._id });
      refreshPinned();
    } catch (err) {
      console.error(err);
    }
  };

  // ---- Search ----
  useEffect(() => {
    if (!searching) return;
    const t = setTimeout(async () => {
      if (!searchQuery.trim()) {
        setSearchResults(null);
        return;
      }
      try {
        const { data } = await api.get(`/messages/search/${chat._id}`, {
          params: { q: searchQuery },
        });
        setSearchResults(data.messages);
      } catch (err) {
        console.error(err);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [searchQuery, searching, chat._id]);

  // ---- AI helpers ----
  const runSummarize = async () => {
    setSummarizing(true);
    setSummary(null);
    try {
      const { data } = await api.post("/ai/summarize", { chatId: chat._id });
      setSummary(data.summary);
    } catch (err) {
      setSummary(err.response?.data?.message || "Couldn't generate a summary.");
    } finally {
      setSummarizing(false);
    }
  };

  const translateMessage = async (msg) => {
    if (translations[msg._id]) {
      setTranslations((prev) => {
        const next = { ...prev };
        delete next[msg._id];
        return next;
      });
      return;
    }
    setTranslatingId(msg._id);
    try {
      const targetLanguage = navigator.language?.split("-")[0] || "English";
      const { data } = await api.post("/ai/translate", {
        text: msg.content,
        targetLanguage,
      });
      setTranslations((prev) => ({ ...prev, [msg._id]: data.translation }));
    } catch (err) {
      console.error(err);
    } finally {
      setTranslatingId(null);
    }
  };

  const onWallpaperChange = async (wallpaper) => {
    try {
      await api.put("/chats/wallpaper", { chatId: chat._id, wallpaper });
      onChatUpdated?.({ ...chat, wallpaper });
      setShowWallpaperPicker(false);
    } catch (err) {
      console.error(err);
    }
  };

  const readTicks = (msg) => {
    if (String(msg.sender._id) !== String(user._id)) return null;
    const readByOthers = msg.readBy.filter((id) => String(id) !== String(user._id)).length;
    const seen = readByOthers >= otherMemberCount && otherMemberCount > 0;
    return (
      <span className={`read-ticks ${seen ? "seen" : ""}`}>
        {readByOthers > 0 ? "✓✓" : "✓"}
      </span>
    );
  };

  const displayList = searching && searchResults !== null ? searchResults : messages;
  const messagesContainerStyle = chat.wallpaper
    ? chat.wallpaper.startsWith("/uploads")
      ? { backgroundImage: `url(${API_URL}${chat.wallpaper})`, backgroundSize: "cover" }
      : { background: chat.wallpaper }
    : undefined;

  return (
    <div className="chat-window">
      <div className="chat-window-header">
        <div>
          <h2>{getChatDisplayName(chat, user._id)}</h2>
          {!chat.isGroupChat && (
            <span className="status-text">
              {isOnline
                ? "Online"
                : otherUser?.lastSeen
                ? `Last seen ${formatTime(otherUser.lastSeen)}`
                : "Offline"}
            </span>
          )}
          {chat.isGroupChat && <span className="status-text">{chat.users.length} members</span>}
        </div>
        <div className="call-header-actions">
          <button
            type="button"
            className="icon-btn"
            title="Search messages"
            onClick={() => setSearching((s) => !s)}
          >
            🔍
          </button>
          <button
            type="button"
            className="icon-btn"
            title="Summarize with AI"
            onClick={runSummarize}
            disabled={summarizing}
          >
            ✨
          </button>
          <button
            type="button"
            className="icon-btn"
            title="Chat wallpaper"
            onClick={() => setShowWallpaperPicker((s) => !s)}
          >
            🖼️
          </button>
          {!chat.isGroupChat && (
            <>
              <button
                type="button"
                className="icon-btn"
                title="Voice call"
                disabled={callState !== "idle"}
                onClick={() => startCall(otherUser, chat, "audio")}
              >
                📞
              </button>
              <button
                type="button"
                className="icon-btn"
                title="Video call"
                disabled={callState !== "idle"}
                onClick={() => startCall(otherUser, chat, "video")}
              >
                🎥
              </button>
            </>
          )}
        </div>
      </div>

      {showWallpaperPicker && (
        <WallpaperPicker current={chat.wallpaper} onSelect={onWallpaperChange} />
      )}

      {summary && (
        <div className="ai-summary-banner">
          <strong>AI summary</strong>
          <p>{summary}</p>
          <button className="link-btn" onClick={() => setSummary(null)}>
            Dismiss
          </button>
        </div>
      )}

      <PinnedBar messages={pinnedMessages} />

      {searching && (
        <div className="search-bar">
          <input
            autoFocus
            placeholder="Search this chat..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <span className="search-count">
            {searchResults ? `${searchResults.length} result(s)` : ""}
          </span>
        </div>
      )}

      <div className="messages-container" style={messagesContainerStyle}>
        {searching && searchResults !== null && searchResults.length === 0 && (
          <p className="muted search-empty-state">
            No text or file/voice-name matches for "{searchQuery}". Note: search only
            looks at message text and file names, not voice/image content.
          </p>
        )}
        {displayList.map((msg) => {
          const isOwn = String(msg.sender._id) === String(user._id);
          return (
            <div key={msg._id} className={`message-row ${isOwn ? "own" : ""}`}>
              <div
                className="message-bubble"
                onMouseLeave={() => {
                  if (openMenuId === msg._id) setOpenMenuId(null);
                  if (reactionPickerId === msg._id) setReactionPickerId(null);
                }}
              >
                {chat.isGroupChat && !isOwn && (
                  <span className="message-sender">{msg.sender.username}</span>
                )}

                {!msg.isDeleted && (
                  <div className="message-actions">
                    <button
                      className="mini-btn"
                      title="React"
                      onClick={() => setReactionPickerId(reactionPickerId === msg._id ? null : msg._id)}
                    >
                      🙂
                    </button>
                    <button
                      className="mini-btn"
                      title="More"
                      onClick={() => setOpenMenuId(openMenuId === msg._id ? null : msg._id)}
                    >
                      ⋮
                    </button>
                  </div>
                )}

                {reactionPickerId === msg._id && (
                  <div className="reaction-picker">
                    {REACTION_EMOJIS.map((e) => (
                      <button key={e} onClick={() => react(msg, e)}>
                        {e}
                      </button>
                    ))}
                  </div>
                )}

                {openMenuId === msg._id && (
                  <div className="message-menu">
                    <button onClick={() => togglePin(msg)}>📌 Pin/Unpin</button>
                    {isOwn && msg.messageType === "text" && (
                      <button onClick={() => beginEdit(msg)}>✏️ Edit</button>
                    )}
                    <button onClick={() => deleteMessage(msg, false)}>🗑️ Delete for me</button>
                    {isOwn && (
                      <button onClick={() => deleteMessage(msg, true)}>
                        🗑️ Delete for everyone
                      </button>
                    )}
                  </div>
                )}

                {msg.isDeleted ? (
                  <p className="deleted-text">This message was deleted</p>
                ) : editingId === msg._id ? (
                  <div className="edit-row">
                    <input
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && saveEdit(msg)}
                    />
                    <button onClick={() => saveEdit(msg)}>Save</button>
                    <button onClick={() => setEditingId(null)}>Cancel</button>
                  </div>
                ) : (
                  <>
                    {msg.messageType === "text" && (
                      <>
                        <p>{msg.content}</p>
                        {translations[msg._id] && (
                          <p className="translated-text">🌐 {translations[msg._id]}</p>
                        )}
                        {!isOwn && (
                          <button
                            className="link-btn translate-btn"
                            onClick={() => translateMessage(msg)}
                            disabled={translatingId === msg._id}
                          >
                            {translatingId === msg._id
                              ? "Translating..."
                              : translations[msg._id]
                              ? "Hide translation"
                              : "Translate"}
                          </button>
                        )}
                      </>
                    )}
                    {msg.messageType === "image" && (
                      <img
                        src={`${API_URL}${msg.fileUrl}`}
                        alt={msg.fileName}
                        className="message-image"
                      />
                    )}
                    {msg.messageType === "file" && (
                      <a
                        href={`${API_URL}${msg.fileUrl}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="message-file"
                      >
                        📎 {msg.fileName}
                      </a>
                    )}
                    {msg.messageType === "voice" && (
                      <div className="voice-message">
                        <audio controls src={`${API_URL}${msg.fileUrl}`} />
                        <span className="voice-duration">{formatDuration(msg.fileDuration)}</span>
                      </div>
                    )}
                  </>
                )}

                {msg.reactions?.length > 0 && (
                  <div className="reaction-pills">
                    {Object.entries(
                      msg.reactions.reduce((acc, r) => {
                        acc[r.emoji] = (acc[r.emoji] || 0) + 1;
                        return acc;
                      }, {})
                    ).map(([emoji, count]) => (
                      <span key={emoji} className="reaction-pill" onClick={() => react(msg, emoji)}>
                        {emoji} {count > 1 ? count : ""}
                      </span>
                    ))}
                  </div>
                )}

                <span className="message-time">
                  {msg.edited && !msg.isDeleted && <em className="edited-label">edited </em>}
                  {formatTime(msg.createdAt)} {readTicks(msg)}
                </span>
              </div>
            </div>
          );
        })}
        {typingUser && (
          <div className="message-row">
            <div className="message-bubble typing-indicator">typing...</div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {smartSuggestions.length > 0 && (
        <div className="smart-reply-bar">
          {smartSuggestions.map((s, i) => (
            <button key={i} className="smart-reply-chip" onClick={() => setContent(s)}>
              {s}
            </button>
          ))}
        </div>
      )}

      {recording ? (
        <div className="message-input-bar recording-bar">
          <span className="recording-dot" /> Recording {formatDuration(recordSeconds)}
          <button type="button" onClick={() => stopRecording(true)} className="link-btn">
            Cancel
          </button>
          <button type="button" onClick={() => stopRecording(false)} className="call-btn call-btn-accept small">
            Send
          </button>
        </div>
      ) : (
        <form className="message-input-bar" onSubmit={sendMessage}>
          <button type="button" className="icon-btn" onClick={() => setShowEmoji((v) => !v)}>
            😊
          </button>
          {showEmoji && (
            <div className="emoji-picker-wrap">
              <EmojiPicker onEmojiClick={handleEmojiClick} />
            </div>
          )}
          <button type="button" className="icon-btn" onClick={() => fileInputRef.current?.click()}>
            📎
          </button>
          <input type="file" ref={fileInputRef} style={{ display: "none" }} onChange={handleFileSelect} />
          <button type="button" className="icon-btn" title="Record voice note" onClick={startRecording}>
            🎙️
          </button>
          <input
            type="text"
            placeholder="Type a message..."
            value={content}
            onChange={(e) => handleTypingInput(e.target.value)}
          />
          <button type="submit" disabled={!content.trim() || sending}>
            Send
          </button>
        </form>
      )}
    </div>
  );
};

export default ChatWindow;
