
import React, { useEffect, useRef, useState } from "react";
import { Socket } from "socket.io-client";

interface ChatMessage {
  id: string;
  username: string;
  message: string;
  timestamp: number;
  type?: "message" | "system" | "prayer" | "join" | "leave";
}

interface ChatProps {
  socket: Socket;
  username: string;
}

export default function Chat({ socket, username }: ChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [userCount, setUserCount] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = (data: ChatMessage) => {
      setMessages(prev => [...prev, data]);
    };
    const handleSystemMessage = (message: string) => {
      setMessages(prev => [...prev, { id: `system-${Date.now()}`, username: "System", message, timestamp: Date.now(), type: "system" }]);
    };
    const handleUserEvent = (message: string, type: "join" | "leave") => {
        setMessages(prev => [...prev, { id: `${type}-${Date.now()}`, username: "System", message, timestamp: Date.now(), type: type }]);
    };

    socket.on("chat:message", handleNewMessage);
    socket.on("chat:prayer", (data: ChatMessage) => handleNewMessage({ ...data, type: "prayer" }));
    socket.on("chat:system", handleSystemMessage);
    socket.on("chat:userJoin", (user: string) => handleUserEvent(`${user} joined`, 'join'));
    socket.on("chat:userLeave", (user: string) => handleUserEvent(`${user} left`, 'leave'));
    socket.on("chat:userCount", setUserCount);

    // Fix: Request initial state on join
    socket.emit("chat:requestInitial");

    return () => {
      socket.off("chat:message", handleNewMessage);
      socket.off("chat:prayer");
      socket.off("chat:system", handleSystemMessage);
      socket.off("chat:userJoin");
      socket.off("chat:userLeave");
      socket.off("chat:userCount", setUserCount);
    };
  }, [socket]);

  const sendMessage = () => {
    if (!inputMessage.trim() || !socket.connected) return;

    const isPrayer = inputMessage.toLowerCase().startsWith("/pray") || inputMessage.toLowerCase().startsWith("🙏");
    const messageData = {
      username,
      message: inputMessage.trim(),
      timestamp: Date.now(),
    };

    socket.emit(isPrayer ? "chat:prayer" : "chat:message", messageData);
    setInputMessage("");
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const getMessageClassName = (msg: ChatMessage) => {
    const classList = ['message'];
    const type = msg.type || 'message';
    classList.push(`message--${type}`);

    if (type === 'message' || type === 'prayer') {
        // Alignment logic
        classList.push(msg.username === username ? 'is-self' : 'is-other');

        // Special styling logic
        if (msg.username === 'Admin') {
            classList.push('is-admin');
        }
    }
    return classList.join(' ');
  }

  return (
    <div className="chat-container">
      <div className="chat-header">
        <h4>Live Chat</h4>
        <div className="status-indicator">
          <div className={`connection-dot ${socket.connected ? 'connected' : 'disconnected'}`} />
          <span>{userCount} Online</span>
        </div>
      </div>

      <div className="messages-area">
        {messages.length === 0 ? (
          <div className="welcome-message">
            <p>Welcome to the live chat!</p>
            <p>Messages from the stream will appear here.</p>
          </div>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className={getMessageClassName(msg)}>
              <div className="message-bubble">
                {/* Username is now inside the bubble for all message types */}
                {(msg.type === 'message' || msg.type === 'prayer') && (
                    <div className={`message-username ${msg.username === 'Admin' ? 'is-admin-username' : ''}`}>{msg.username}</div>
                )}
                <div className="message-content">{msg.message}</div>
                <div className="message-time">{formatTime(msg.timestamp)}</div>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="input-area-wrapper">
        <div className="quick-actions">
            <button className="quick-action-btn is-prayer" onClick={() => setInputMessage('🙏 Please pray for ')}>🙏 Pray For</button>
            <button className="quick-action-btn" onClick={() => setInputMessage('Amen! 🙌')}>Amen 🙌</button>
            <button className="quick-action-btn" onClick={() => setInputMessage('Hallelujah! ✨')}>Hallelujah ✨</button>
        </div>
        <form className="input-area" onSubmit={e => { e.preventDefault(); sendMessage(); }}>
          <input
            ref={inputRef}
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            placeholder={socket.connected ? "Type a message..." : "Connecting..."}
            disabled={!socket.connected}
          />
          <button type="submit" disabled={!inputMessage.trim() || !socket.connected}>
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
