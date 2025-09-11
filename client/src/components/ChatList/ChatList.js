import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './ChatList.css';

const ChatList = ({ userId }) => {
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchChatList();
  }, [userId]);

  const fetchChatList = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/chatbot/list/${userId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch chat list');
      }
      const data = await response.json();
      setChats(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleChatClick = (chatId) => {
    navigate(`/chat/${chatId}`);
  };

  const handleNewChat = () => {
    navigate('/');
  };

  const handleDeleteChat = async (chatId, e) => {
    e.stopPropagation();
    if (window.confirm('Are you sure you want to delete this chat?')) {
      try {
        const response = await fetch(`/api/chatbot/${userId}/${chatId}`, {
          method: 'DELETE',
        });
        if (!response.ok) {
          throw new Error('Failed to delete chat');
        }
        fetchChatList(); // Refresh the list
      } catch (err) {
        setError(err.message);
      }
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString();
    }
  };

  if (loading) {
    return (
      <div className="chat-list-container">
        <div className="chat-list-header">
          <h2>Chat History</h2>
          <button onClick={handleNewChat} className="new-chat-button">
            New Chat
          </button>
        </div>
        <div className="loading">Loading chats...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="chat-list-container">
        <div className="chat-list-header">
          <h2>Chat History</h2>
          <button onClick={handleNewChat} className="new-chat-button">
            New Chat
          </button>
        </div>
        <div className="error">Error: {error}</div>
      </div>
    );
  }

  return (
    <div className="chat-list-container">
      <div className="chat-list-header">
        <h2>Chat History</h2>
        <button onClick={handleNewChat} className="new-chat-button">
          New Chat
        </button>
      </div>

      {chats.length === 0 ? (
        <div className="no-chats">
          <p>No chats yet. Start a new conversation!</p>
        </div>
      ) : (
        <div className="chat-list">
          {chats.map((chat) => (
            <div key={chat.id} className="chat-item" onClick={() => handleChatClick(chat.id)}>
              <div className="chat-item-header">
                <span className="chat-date">{formatDate(chat.lastMessage)}</span>
                <button
                  className="delete-chat-button"
                  onClick={(e) => handleDeleteChat(chat.chatId, e)}
                  title="Delete chat"
                >
                  ×
                </button>
              </div>
              <div className="chat-preview">{chat.preview}</div>
              <div className="chat-meta">
                {chat.messageCount} message{chat.messageCount !== 1 ? 's' : ''}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ChatList;
