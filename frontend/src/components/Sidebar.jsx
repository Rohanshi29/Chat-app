import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api, { API_URL } from "../api/axios";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";
import { useTheme } from "../context/ThemeContext";
import { usePushNotifications } from "../hooks/usePushNotifications";
import GroupChatModal from "./GroupChatModal";
import EditProfileModal from "./EditProfileModal";

const getChatDisplayName = (chat, currentUserId) => {
  if (chat.isGroupChat) return chat.chatName;
  const other = chat.users.find((u) => String(u._id) !== String(currentUserId));
  return other?.username || "Unknown user";
};

const getChatAvatar = (chat, currentUserId) => {
  if (chat.isGroupChat) return chat.groupPicture;
  const other = chat.users.find((u) => String(u._id) !== String(currentUserId));
  return other?.profilePicture;
};

const Sidebar = ({ activeChat, onSelectChat, refreshTrigger }) => {
  const [chats, setChats] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const { user, logout } = useAuth();
  const { onlineUserIds, socket } = useSocket();
  const { theme, toggleTheme } = useTheme();
  const { supported, permission, subscribe, unsubscribe } = usePushNotifications(true);

  const fetchChats = async () => {
    try {
      const { data } = await api.get("/chats");
      setChats(data.chats);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChats();
  }, [refreshTrigger]);

  useEffect(() => {
    if (!socket) return;

    const handleChatUpdated = ({ chatId, latestMessage }) => {
      setChats((prev) => {
        const idx = prev.findIndex((c) => c._id === chatId);
        if (idx === -1) {
          // We don't have this chat yet locally (e.g. a brand-new chat) -
          // just refetch the full list to pick it up.
          fetchChats();
          return prev;
        }
        const updated = { ...prev[idx], latestMessage };
        const rest = prev.filter((c) => c._id !== chatId);
        return [updated, ...rest];
      });
    };

    socket.on("chat-updated", handleChatUpdated);
    return () => socket.off("chat-updated", handleChatUpdated);
  }, [socket]);

  useEffect(() => {
    api
      .get("/users")
      .then(({ data }) => setAllUsers(data.users))
      .catch((err) => console.error(err));
  }, []);

  useEffect(() => {
    const delayDebounce = setTimeout(async () => {
      if (!searchQuery.trim()) {
        setSearchResults([]);
        return;
      }
      const { data } = await api.get("/users");
      setSearchResults(
        data.users.filter((u) =>
          u.username.toLowerCase().includes(searchQuery.toLowerCase())
        )
      );
    }, 300);
    return () => clearTimeout(delayDebounce);
  }, [searchQuery]);

  const startChat = async (userId) => {
    const { data } = await api.post("/chats", { userId });
    setSearchQuery("");
    setSearchResults([]);
    await fetchChats();
    onSelectChat(data.chat);
  };

  const handleGroupCreated = async (chat) => {
    await fetchChats();
    onSelectChat(chat);
  };

  const handleNotificationToggle = () => {
    if (permission === "granted") {
      unsubscribe();
    } else {
      subscribe();
    }
  };

  // Everyone who has ever registered, minus yourself and anyone you already
  // have a one-to-one chat with - so a brand-new user (or anyone) can see
  // and start chatting with existing users without needing to search.
  const existingChatPartnerIds = new Set(
    chats
      .filter((c) => !c.isGroupChat)
      .map((c) => c.users.find((u) => String(u._id) !== String(user._id))?._id)
      .filter(Boolean)
      .map(String)
  );
  const discoverableUsers = allUsers.filter(
    (u) => String(u._id) !== String(user._id) && !existingChatPartnerIds.has(String(u._id))
  );

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <div
          className="current-user clickable"
          title="Edit profile"
          onClick={() => setShowEditProfile(true)}
        >
          {user?.profilePicture ? (
            <img
              src={`${API_URL}${user.profilePicture}`}
              alt={user.username}
              className="avatar avatar-sm"
            />
          ) : (
            <div className="avatar avatar-sm avatar-placeholder">
              {user?.username?.[0]?.toUpperCase()}
            </div>
          )}
          <span>{user?.username}</span>
        </div>
        <div className="sidebar-header-actions">
          {supported && (
            <button
              className="icon-btn"
              title={permission === "granted" ? "Disable notifications" : "Enable notifications"}
              onClick={handleNotificationToggle}
            >
              {permission === "granted" ? "🔔" : "🔕"}
            </button>
          )}
          <button className="icon-btn" title="Toggle theme" onClick={toggleTheme}>
            {theme === "light" ? "🌙" : "☀️"}
          </button>
          {user?.role === "admin" && (
            <Link to="/admin" className="icon-btn" title="Admin dashboard">
              🛠️
            </Link>
          )}
          <button className="logout-btn" onClick={logout}>
            Logout
          </button>
        </div>
      </div>

      <div className="sidebar-toolbar">
        <input
          className="search-input"
          placeholder="Search users to chat..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <button className="new-group-btn" onClick={() => setShowGroupModal(true)}>
          + Group
        </button>
      </div>

      {searchResults.length > 0 && (
        <div className="search-results">
          {searchResults.map((u) => (
            <div
              key={u._id}
              className="chat-list-item"
              onClick={() => startChat(u._id)}
            >
              {u.profilePicture ? (
                <img
                  src={`${API_URL}${u.profilePicture}`}
                  alt={u.username}
                  className="avatar"
                />
              ) : (
                <div className="avatar avatar-placeholder">
                  {u.username[0].toUpperCase()}
                </div>
              )}
              <div className="chat-list-info">
                <span className="chat-name">{u.username}</span>
                <span className="chat-preview">{u.bio || "Start a chat"}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="chat-list">
        {loading && <p className="muted">Loading chats...</p>}
        {!loading && chats.length === 0 && discoverableUsers.length === 0 && (
          <p className="muted">No chats yet. Search for a user above.</p>
        )}
        {chats.map((chat) => {
          const name = getChatDisplayName(chat, user._id);
          const avatar = getChatAvatar(chat, user._id);
          const other = !chat.isGroupChat
            ? chat.users.find((u) => String(u._id) !== String(user._id))
            : null;
          const isOnline = other && onlineUserIds.has(String(other._id));

          return (
            <div
              key={chat._id}
              className={`chat-list-item ${
                activeChat?._id === chat._id ? "active" : ""
              }`}
              onClick={() => onSelectChat(chat)}
            >
              <div className="avatar-wrap">
                {avatar ? (
                  <img
                    src={`${API_URL}${avatar}`}
                    alt={name}
                    className="avatar"
                  />
                ) : (
                  <div className="avatar avatar-placeholder">
                    {name?.[0]?.toUpperCase()}
                  </div>
                )}
                {isOnline && <span className="online-dot" />}
              </div>
              <div className="chat-list-info">
                <span className="chat-name">{name}</span>
                <span className="chat-preview">
                  {chat.latestMessage
                    ? chat.latestMessage.messageType === "text"
                      ? chat.latestMessage.content
                      : `📎 ${chat.latestMessage.fileName || "File"}`
                    : "No messages yet"}
                </span>
              </div>
            </div>
          );
        })}

        {!loading && discoverableUsers.length > 0 && (
          <>
            <p className="chat-list-section-label">All users</p>
            {discoverableUsers.map((u) => {
              const isOnline = onlineUserIds.has(String(u._id));
              return (
                <div key={u._id} className="chat-list-item" onClick={() => startChat(u._id)}>
                  <div className="avatar-wrap">
                    {u.profilePicture ? (
                      <img
                        src={`${API_URL}${u.profilePicture}`}
                        alt={u.username}
                        className="avatar"
                      />
                    ) : (
                      <div className="avatar avatar-placeholder">
                        {u.username[0].toUpperCase()}
                      </div>
                    )}
                    {isOnline && <span className="online-dot" />}
                  </div>
                  <div className="chat-list-info">
                    <span className="chat-name">{u.username}</span>
                    <span className="chat-preview">{u.bio || "Start a chat"}</span>
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>

      {showGroupModal && (
        <GroupChatModal
          allUsers={allUsers}
          onClose={() => setShowGroupModal(false)}
          onCreated={handleGroupCreated}
        />
      )}

      {showEditProfile && <EditProfileModal onClose={() => setShowEditProfile(false)} />}
    </div>
  );
};

export default Sidebar;
