import { useState } from "react";
import api from "../api/axios";

const AIAssistant = () => {
  const [open, setOpen] = useState(false);
  const [history, setHistory] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);

  const send = async (e) => {
    e.preventDefault();
    if (!input.trim() || sending) return;

    const userMsg = { role: "user", content: input };
    const nextHistory = [...history, userMsg];
    setHistory(nextHistory);
    setInput("");
    setSending(true);

    try {
      const { data } = await api.post("/ai/chat", {
        message: userMsg.content,
        history,
      });
      setHistory([...nextHistory, { role: "assistant", content: data.reply }]);
    } catch (err) {
      setHistory([
        ...nextHistory,
        {
          role: "assistant",
          content:
            err.response?.data?.message ||
            "AI assistant isn't available right now.",
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="ai-assistant-widget">
      {open && (
        <div className="ai-assistant-panel">
          <div className="ai-assistant-header">
            <span>✨ AI Assistant</span>
            <button className="link-btn" onClick={() => setOpen(false)}>
              ✕
            </button>
          </div>
          <div className="ai-assistant-body">
            {history.length === 0 && (
              <p className="muted">Ask me anything, or ask me to help draft a reply.</p>
            )}
            {history.map((m, i) => (
              <div key={i} className={`ai-msg ${m.role}`}>
                {m.content}
              </div>
            ))}
            {sending && <div className="ai-msg assistant">Thinking...</div>}
          </div>
          <form className="ai-assistant-input" onSubmit={send}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask the AI assistant..."
            />
            <button type="submit" disabled={!input.trim() || sending}>
              Send
            </button>
          </form>
        </div>
      )}
      <button className="ai-assistant-fab" onClick={() => setOpen((o) => !o)}>
        ✨
      </button>
    </div>
  );
};

export default AIAssistant;
