import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './ChatList.css';
import ChatLoadingInline from '../ChatLoadingInline/ChatLoadingInline.js';
import { useChatContext } from '../../contexts/ChatContext';

const ChatList = ({ userId }) => {
  const { chats, setChats, setRefreshChatList } = useChatContext();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchChatList();
  }, [userId]);

  useEffect(() => {
    setRefreshChatList(() => fetchChatList);
  }, [setRefreshChatList]);

  const fetchChatList = async () => {
    setLoading(true);

    // Check if running locally or on netlify FIRST - no API calls in demo mode
    const hostname = window.location.hostname;
    const isLocal = hostname === 'localhost' || hostname === '127.0.0.1';

    // If not local, return demo data immediately - no API calls
    if (!isLocal) {
      console.log('DEMO MODE: Returning fake data, should NOT fetch');
      // Fake chat list for netlify deploy
      const fakeChats = [
        {
          id: 'demo_chat_1',
          chatId: 'demo_chat_1',
          preview: 'How do I implement authentication in React?',
          lastMessage: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
          messageCount: 4,
        },
        {
          id: 'demo_chat_2',
          chatId: 'demo_chat_2',
          preview: 'Best practices for API error handling',
          lastMessage: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
          messageCount: 6,
        },
        {
          id: 'demo_chat_3',
          chatId: 'demo_chat_3',
          preview: 'Database optimization strategies',
          lastMessage: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days ago
          messageCount: 8,
        },
      ];
      setChats(fakeChats);
      setLoading(false);
      return; // Exit early - no API calls in demo mode
    }

    // Only make API calls when running locally
    try {
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
    navigate('/chat');
  };

  const handleDeleteChat = async (chatId, e) => {
    e.stopPropagation();
    if (window.confirm('Are you sure you want to delete this chat?')) {
      try {
        // Check if running locally or on netlify
        const isLocal =
          window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        if (!isLocal) {
          // Fake deletion for netlify deploy
          setChats((prevChats) => prevChats.filter((chat) => chat.chatId !== chatId));
          return;
        }

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

  const chatLabel = 'chats';

  if (loading) {
    return (
      <div className="chat-list-container">
        <div className="chat-list-header">
          <h2>Chat History</h2>
          <button onClick={handleNewChat} className="new-chat-button">
            New Chat
          </button>
        </div>
        <ChatLoadingInline props={chatLabel} />
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
              <div className="chat-preview">
                {chat?.title ? (
                  <span>{chat.title} </span>
                ) : (
                  <span className="chat-title-generating"> title generating...</span>
                )}
              </div>
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
