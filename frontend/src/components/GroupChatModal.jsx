import { useState } from "react";
import api from "../api/axios";

const GroupChatModal = ({ allUsers, onClose, onCreated }) => {
  const [chatName, setChatName] = useState("");
  const [selected, setSelected] = useState([]);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);

  const toggleUser = (userId) => {
    setSelected((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const createGroup = async () => {
    setError("");
    if (!chatName.trim()) return setError("Give the group a name");
    if (selected.length < 2) return setError("Pick at least 2 other members");

    setCreating(true);
    try {
      const { data } = await api.post("/chats/group", {
        chatName,
        users: selected,
      });
      onCreated(data.chat);
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || "Could not create group");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>New group chat</h3>
        <input
          className="search-input"
          placeholder="Group name"
          value={chatName}
          onChange={(e) => setChatName(e.target.value)}
        />
        <div className="modal-user-list">
          {allUsers.map((u) => (
            <label key={u._id} className="modal-user-row">
              <input
                type="checkbox"
                checked={selected.includes(u._id)}
                onChange={() => toggleUser(u._id)}
              />
              {u.username}
            </label>
          ))}
          {allUsers.length === 0 && <p className="muted">No other users to add yet.</p>}
        </div>
        {error && <p className="form-error">{error}</p>}
        <div className="modal-actions">
          <button className="link-btn" onClick={onClose}>
            Cancel
          </button>
          <button onClick={createGroup} disabled={creating}>
            {creating ? "Creating..." : "Create group"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default GroupChatModal;
