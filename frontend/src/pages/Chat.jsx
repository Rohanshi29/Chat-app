import { useState } from "react";
import Sidebar from "../components/Sidebar";
import ChatWindow from "../components/ChatWindow";
import AIAssistant from "../components/AIAssistant";

const Chat = () => {
  const [activeChat, setActiveChat] = useState(null);

  return (
    <div className="chat-page">
      <Sidebar activeChat={activeChat} onSelectChat={setActiveChat} />
      <div className="chat-main">
        {activeChat ? (
          <ChatWindow chat={activeChat} onChatUpdated={setActiveChat} />
        ) : (
          <div className="empty-state">
            <p>Select a chat to start messaging</p>
          </div>
        )}
      </div>
      <AIAssistant />
    </div>
  );
};

export default Chat;
