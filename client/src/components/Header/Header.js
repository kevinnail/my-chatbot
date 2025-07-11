import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import DeleteMessagesButton from '../DeleteButton/DeleteButton.js';

const Header = ({ userId }) => {
  const location = useLocation();

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
        justifyContent: 'space-between',
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
        }}
      >
        <span style={{ fontSize: '1.05rem', userSelect: 'none' }}>
          <img width="28px" style={{ borderRadius: '25%' }} alt="logo" src="./logo.png" />
        </span>
        <span style={{ fontSize: '1.05rem', userSelect: 'none' }}>My Coding Assistant</span>
      </div>

      <nav
        style={{
          display: 'flex',
          gap: '2rem',
          alignItems: 'center',
        }}
      >
        <Link
          to="/"
          style={{
            color: location.pathname === '/' ? '#00d4ff' : 'white',
            textDecoration: 'none',
            fontSize: '1rem',
            fontWeight: 'normal',
            padding: '0.5rem 1rem',
            borderRadius: '20px',
            transition: 'all 0.3s ease',
            border: location.pathname === '/' ? '2px solid #00d4ff' : '2px solid transparent',
          }}
        >
          Chat
        </Link>
        <Link
          to="/gmail-mcp"
          style={{
            color: location.pathname === '/gmail-mcp' ? '#00d4ff' : 'white',
            textDecoration: 'none',
            fontSize: '1rem',
            fontWeight: 'normal',
            padding: '0.5rem 1rem',
            borderRadius: '20px',
            transition: 'all 0.3s ease',
            border:
              location.pathname === '/gmail-mcp' ? '2px solid #00d4ff' : '2px solid transparent',
          }}
        >
          Gmail MCP
        </Link>
      </nav>

      <DeleteMessagesButton userId={userId} />
    </header>
  );
};

export default Header;
