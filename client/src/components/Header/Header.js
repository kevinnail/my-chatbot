import React, { useState } from 'react';
import { Link, useMatch, useNavigate } from 'react-router-dom';
import DeleteMessagesButton from '../DeleteButton/DeleteButton.js';
import { useLoading } from '../../contexts/LoadingContext';
import { useUser } from '../../hooks/useUser.js';
import { signOut } from '../../services/auth.js';
import './Header.css';

const Header = ({ userId }) => {
  const isHomePage = useMatch('/');
  const isChatPage = useMatch('/chat');
  const isExistingChat = useMatch('/chat/:chatId');
  const isGmailPage = useMatch('/gmail-mcp');
  const [, setIsChat] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { isAnyLoading } = useLoading();
  const { user, setUser } = useUser();
  const navigate = useNavigate();

  const handleChat = (e) => {
    if (isAnyLoading) {
      e.preventDefault();
      return;
    }
    setIsChat(true);
  };

  const isOnChatPage = isHomePage || isChatPage || isExistingChat;

  const handleGmailMCP = (e) => {
    if (isAnyLoading) {
      e.preventDefault();
      return;
    }
    setIsChat(false);
    setMobileMenuOpen(false);
  };

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  const handleChatMobile = (e) => {
    handleChat(e);
    setMobileMenuOpen(false);
  };

  const handleLogout = async () => {
    try {
      await signOut();
      setUser(null);
      navigate('/auth/sign-in');
    } catch (error) {
      console.error('Logout failed:', error);
    }
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
          <img
            width="28px"
            style={{ borderRadius: '25%' }}
            alt="logo"
            src="http://localhost:3000/logo.png"
          />
        </span>
        <span className="header-title-text">
          {`${isOnChatPage ? 'My Code & Job Search Assistant' : 'Gmail and Google Calendar Assistant'}`}
        </span>
      </div>

      {/* Desktop Navigation */}
      <nav className="desktop-nav">
        <Link
          to="/"
          style={{
            color: isAnyLoading ? '#666' : isOnChatPage ? '#639cff' : 'white',
            pointerEvents: isAnyLoading ? 'none' : 'auto',
            opacity: isAnyLoading ? 0.5 : 1,
            textDecoration: 'none',
            fontSize: '1rem',
            fontWeight: 'normal',
            padding: '0.5rem 1rem',
            borderRadius: '20px',
            transition: 'all 0.3s ease',
            border: isOnChatPage ? '2px solid #639cff' : '2px solid transparent',
          }}
          onClick={handleChat}
        >
          Chat
        </Link>
        <Link
          to="/gmail-mcp"
          style={{
            color: isAnyLoading ? '#666' : isGmailPage ? '#639cff' : 'white',
            textDecoration: 'none',
            fontSize: '1rem',
            fontWeight: 'normal',
            padding: '0.5rem 1rem',
            borderRadius: '20px',
            transition: 'all 0.3s ease',
            border: isGmailPage ? '2px solid #639cff' : '2px solid transparent',
            pointerEvents: isAnyLoading ? 'none' : 'auto',
            opacity: isAnyLoading ? 0.5 : 1,
          }}
          onClick={handleGmailMCP}
        >
          Gmail MCP
        </Link>
        {user && window.isLocal && (
          <button onClick={handleLogout} className="logout-button">
            Logout
          </button>
        )}
      </nav>

      {/* Desktop Delete Button */}
      <div className={`desktop-delete-button ${!isOnChatPage ? 'hidden' : ''}`}>
        <DeleteMessagesButton
          userId={userId}
          loading={isAnyLoading}
          setMobileMenuOpen={setMobileMenuOpen}
        />
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
            className={`mobile-nav-link ${isOnChatPage ? 'active' : ''} ${isAnyLoading ? 'disabled' : ''}`}
            onClick={handleChatMobile}
          >
            Chat
          </Link>
          <Link
            to="/gmail-mcp"
            className={`mobile-nav-link ${isGmailPage ? 'active' : ''} ${isAnyLoading ? 'disabled' : ''}`}
            onClick={handleGmailMCP}
          >
            Gmail MCP
          </Link>
          {isOnChatPage && (
            <div className="mobile-delete-section">
              <DeleteMessagesButton
                userId={userId}
                loading={isAnyLoading}
                setMobileMenuOpen={setMobileMenuOpen}
              />
            </div>
          )}
          {user && window.isLocal && (
            <button onClick={handleLogout} className="mobile-nav-link logout-button-mobile">
              Logout
            </button>
          )}
        </div>
      )}
    </header>
  );
};

export default Header;
