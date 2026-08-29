import { useState } from "react";

const PinnedBar = ({ messages }) => {
  const [open, setOpen] = useState(false);

  if (!messages || messages.length === 0) return null;

  return (
    <div className="pinned-bar">
      <div className="pinned-bar-header" onClick={() => setOpen((o) => !o)}>
        📌 {messages.length} pinned message{messages.length > 1 ? "s" : ""}
        <span className="link-btn">{open ? "Hide" : "Show"}</span>
      </div>
      {open && (
        <div className="pinned-bar-list">
          {messages.map((m) => (
            <div key={m._id} className="pinned-bar-item">
              <strong>{m.sender?.username}: </strong>
              {m.content || `[${m.messageType}]`}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PinnedBar;
