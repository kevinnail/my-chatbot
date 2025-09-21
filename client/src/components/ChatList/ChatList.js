import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './ChatList.css';
import ChatLoadingInline from '../ChatLoadingInline/ChatLoadingInline.js';
import { useChatContext } from '../../contexts/ChatContext';
import ConfirmationDialog from '../ConfirmationDialog/ConfirmationDialog';
import { getChatList, deleteChat } from '../../services/fetch-utils';
import { useUser } from '../../hooks/useUser.js';

const ChatList = () => {
  const { chats, setChats, setRefreshChatList } = useChatContext();
  const { userId } = useUser();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [chatToDelete, setChatToDelete] = useState(null);
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
      // Fake chat list for netlify deploy
      const fakeChats = [
        {
          id: 'demo_chat_1',
          chatId: 'demo_chat_1',
          title: null,
          lastMessage: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
          messageCount: 4,
        },
        {
          id: 'demo_chat_2',
          chatId: 'demo_chat_2',
          title: 'Best practices for API error handling',
          lastMessage: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
          messageCount: 6,
        },
        {
          id: 'demo_chat_3',
          chatId: 'demo_chat_3',
          title: 'Database optimization strategies',
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
      const data = await getChatList(userId);
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
    setChatToDelete(chatId);
    setShowDeleteDialog(true);
  };

  const confirmDeleteChat = async () => {
    if (!chatToDelete) return;

    setShowDeleteDialog(false);
    try {
      // Check if running locally or on netlify
      const isLocal =
        window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      if (!isLocal) {
        // Fake deletion for netlify deploy
        setChats((prevChats) => prevChats.filter((chat) => chat.chatId !== chatToDelete));
        setChatToDelete(null);
        return;
      }

      await deleteChat(userId, chatToDelete);
      fetchChatList(); // Refresh the list
      setChatToDelete(null);
    } catch (err) {
      setError(err.message);
      setChatToDelete(null);
    }
  };

  const cancelDeleteChat = () => {
    setShowDeleteDialog(false);
    setChatToDelete(null);
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
                <div className="chat-preview">
                  {chat?.title ? (
                    <span>{chat.title} </span>
                  ) : (
                    <span className="chat-title-generating"> title generating...</span>
                  )}
                </div>
                <button
                  className="delete-chat-button"
                  onClick={(e) => handleDeleteChat(chat.chatId, e)}
                  title="Delete chat"
                >
                  ×
                </button>
              </div>
              <div className="chat-item-info">
                <span className="chat-date">{formatDate(chat.lastMessage)}</span>
                <div className="chat-meta">
                  {chat.messageCount} message{chat.messageCount !== 1 ? 's' : ''}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmationDialog
        isOpen={showDeleteDialog}
        title="Delete Chat"
        message="Are you sure you want to delete this chat? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={confirmDeleteChat}
        onCancel={cancelDeleteChat}
        variant="subtle"
        confirmButtonStyle={{
          background: '#666',
          color: 'white',
        }}
      />
    </div>
  );
};

export default ChatList;
