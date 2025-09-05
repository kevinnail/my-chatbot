import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import DeleteMessagesButton from '../DeleteButton/DeleteButton.js';
import { useLoading } from '../../contexts/LoadingContext';

const Header = ({ userId }) => {
  const location = useLocation();
  const [isChat, setIsChat] = useState(true);
  const { isAnyLoading } = useLoading();

  const handleChat = (e) => {
    if (isAnyLoading) {
      e.preventDefault();
      return;
    }
    setIsChat(true);
  };

  const handleGmailMCP = (e) => {
    if (isAnyLoading) {
      e.preventDefault();
      return;
    }
    setIsChat(false);
  };
  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 1000,
        background: '#181818',
        color: 'white',
        padding: '.5rem 1rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-start',
        // position: 'relative',
        borderTopLeftRadius: '0',
        borderTopRightRadius: '0',
        boxShadow: '0 2px 8px #0008',
        fontSize: '1.4rem',
        fontWeight: 'bold',
        letterSpacing: '.15rem',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          flex: '0 0 auto', // Don't grow or shrink
        }}
      >
        <span style={{ fontSize: '1.05rem', userSelect: 'none' }}>
          <img width="28px" style={{ borderRadius: '25%' }} alt="logo" src="./logo.png" />
        </span>
        <span
          style={{ fontSize: '1.05rem', userSelect: 'none' }}
        >{`${isChat ? 'My Coding Assistant' : 'Gmail and Google Calendar Assistant'}`}</span>
      </div>

      <nav
        style={{
          display: 'flex',
          gap: '2rem',
          alignItems: 'center',
          position: 'absolute',
          left: '50%',
          transform: 'translateX(-50%)',
        }}
      >
        <Link
          to="/"
          style={{
            color: isAnyLoading ? '#666' : location.pathname === '/' ? '#639cff' : 'white',
            textDecoration: 'none',
            fontSize: '1rem',
            fontWeight: 'normal',
            padding: '0.5rem 1rem',
            borderRadius: '20px',
            transition: 'all 0.3s ease',
            border: location.pathname === '/' ? '2px solid #639cff' : '2px solid transparent',
            pointerEvents: isAnyLoading ? 'none' : 'auto',
            opacity: isAnyLoading ? 0.5 : 1,
          }}
          onClick={handleChat}
        >
          Chat
        </Link>
        <Link
          to="/gmail-mcp"
          style={{
            color: isAnyLoading ? '#666' : location.pathname === '/gmail-mcp' ? '#639cff' : 'white',
            textDecoration: 'none',
            fontSize: '1rem',
            fontWeight: 'normal',
            padding: '0.5rem 1rem',
            borderRadius: '20px',
            transition: 'all 0.3s ease',
            border:
              location.pathname === '/gmail-mcp' ? '2px solid #639cff' : '2px solid transparent',
            pointerEvents: isAnyLoading ? 'none' : 'auto',
            opacity: isAnyLoading ? 0.5 : 1,
          }}
          onClick={handleGmailMCP}
        >
          Gmail MCP
        </Link>
      </nav>
      <div style={{ visibility: isChat ? 'visible' : 'hidden', marginLeft: 'auto' }}>
        <DeleteMessagesButton userId={userId} loading={isAnyLoading} />
      </div>
    </header>
  );
};

export default Header;
