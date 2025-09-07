import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import DeleteMessagesButton from '../DeleteButton/DeleteButton.js';
import { useLoading } from '../../contexts/LoadingContext';
import './Header.css';

const Header = ({ userId }) => {
  const location = useLocation();
  const [isChat, setIsChat] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
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
    console.log('closing');
    setMobileMenuOpen(false);
  };

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  const handleChatMobile = (e) => {
    handleChat(e);
    setMobileMenuOpen(false);
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
          flex: '0 0 auto',
        }}
      >
        <span style={{ fontSize: '1.05rem', userSelect: 'none' }}>
          <img width="28px" style={{ borderRadius: '25%' }} alt="logo" src="./logo.png" />
        </span>
        <span className="header-title-text">
          {`${isChat ? 'My Code & Job Search Assistant' : 'Gmail and Google Calendar Assistant'}`}
        </span>
      </div>

      {/* Desktop Navigation */}
      <nav className="desktop-nav">
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

      {/* Desktop Delete Button */}
      <div className={`desktop-delete-button ${!isChat ? 'hidden' : ''}`}>
        <DeleteMessagesButton userId={userId} loading={isAnyLoading} />
      </div>

      {/* Mobile Menu Button */}
      <button className="mobile-menu-button" onClick={toggleMobileMenu}>
        ☰
      </button>

      {/* Mobile Dropdown Menu */}
      {mobileMenuOpen && (
        <div className="mobile-dropdown">
          <Link
            to="/"
            className={`mobile-nav-link ${location.pathname === '/' ? 'active' : ''} ${isAnyLoading ? 'disabled' : ''}`}
            onClick={handleChatMobile}
          >
            Chat
          </Link>
          <Link
            to="/gmail-mcp"
            className={`mobile-nav-link ${location.pathname === '/gmail-mcp' ? 'active' : ''} ${isAnyLoading ? 'disabled' : ''}`}
            onClick={handleGmailMCP}
          >
            Gmail MCP
          </Link>
          {isChat && (
            <div className="mobile-delete-section">
              <DeleteMessagesButton
                userId={userId}
                loading={isAnyLoading}
                setMobileMenuOpen={setMobileMenuOpen}
              />
            </div>
          )}
        </div>
      )}
    </header>
  );
};

export default Header;
