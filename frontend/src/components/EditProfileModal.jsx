import { useRef, useState } from "react";
import api, { API_URL } from "../api/axios";
import { useAuth } from "../context/AuthContext";

const EditProfileModal = ({ onClose }) => {
  const { user, setUser } = useAuth();
  const [username, setUsername] = useState(user?.username || "");
  const [bio, setBio] = useState(user?.bio || "");
  const [preview, setPreview] = useState(
    user?.profilePicture ? `${API_URL}${user.profilePicture}` : null
  );
  const [file, setFile] = useState(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    if (!selected) return;
    setFile(selected);
    setPreview(URL.createObjectURL(selected));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setError("");

    if (!username.trim()) {
      return setError("Username can't be empty");
    }

    setSaving(true);
    try {
      const formData = new FormData();
      formData.append("username", username.trim());
      formData.append("bio", bio);
      if (file) formData.append("profilePicture", file);

      const { data } = await api.put("/users/profile", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setUser(data.user);
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || "Could not update profile");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={handleSave}>
        <h3>Edit profile</h3>

        <div className="profile-picture-picker" onClick={() => fileInputRef.current?.click()}>
          {preview ? (
            <img src={preview} alt="Profile" className="avatar avatar-lg" />
          ) : (
            <div className="avatar avatar-lg avatar-placeholder">
              {username?.[0]?.toUpperCase() || "?"}
            </div>
          )}
          <span className="link-btn">Change photo</span>
        </div>
        <input
          type="file"
          accept="image/*"
          ref={fileInputRef}
          style={{ display: "none" }}
          onChange={handleFileChange}
        />

        <label className="modal-field-label">Username</label>
        <input
          className="search-input"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Username"
        />

        <label className="modal-field-label">Bio / status message</label>
        <textarea
          className="bio-textarea"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          placeholder="Hey there! I'm using the chat app."
          maxLength={150}
          rows={3}
        />

        {error && <p className="form-error">{error}</p>}

        <div className="modal-actions">
          <button type="button" className="link-btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" disabled={saving}>
            {saving ? "Saving..." : "Save changes"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default EditProfileModal;
