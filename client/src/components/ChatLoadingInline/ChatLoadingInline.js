import React from 'react';
import './ChatLoadingInline.css';

const ChatLoadingInline = ({ isVisible }) => {
  if (!isVisible) return null;

  return (
    <div className="chat-loading-inline">
      <div className="chat-loading-content">
        <div className="chat-loading-spinner">
          <div className="spinner-ring"></div>
          <div className="spinner-ring"></div>
          <div className="spinner-ring"></div>
        </div>
        <div className="chat-loading-text">
          <span className="loading-dots">
            <span>Loading chats</span>
            <span className="dot">.</span>
            <span className="dot">.</span>
            <span className="dot">.</span>
          </span>
        </div>
        <div className="chat-loading-particles">
          <div className="particle"></div>
          <div className="particle"></div>
          <div className="particle"></div>
          <div className="particle"></div>
          <div className="particle"></div>
        </div>
      </div>
    </div>
  );
};

export default ChatLoadingInline;
