import React, { useState } from 'react';
import { Link, useMatch, useNavigate } from 'react-router-dom';
import { useLoading } from '../../contexts/LoadingContext';
import { useUser } from '../../hooks/useUser.js';
import { signOut } from '../../services/auth.js';
import FolderSelector from '../FolderSelector/FolderSelector';
import DeleteMessagesButton from '../DeleteButton/DeleteButton.js';
import { processFolder } from '../../services/fetch-utils';
import './Menu.css';

const Menu = ({ userId, isOnChatPage }) => {
  const isHomePage = useMatch('/');
  const isChatPage = useMatch('/chat');
  const isExistingChat = useMatch('/chat/:chatId');
  const isGmailPage = useMatch('/gmail-mcp');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { isAnyLoading } = useLoading();
  const { user, setUser } = useUser();
  const navigate = useNavigate();

  const handleChat = (e) => {
    if (isAnyLoading) {
      e.preventDefault();
      return;
    }
    setIsMenuOpen(false);
  };

  const handleGmailMCP = (e) => {
    if (isAnyLoading) {
      e.preventDefault();
      return;
    }
    setIsMenuOpen(false);
  };

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const handleLogout = async () => {
    try {
      await signOut();
      setUser(null);
      navigate('/auth/sign-in');
    } catch (error) {
      console.error('Logout failed:', error);
    }
    setIsMenuOpen(false);
  };

  const handleFolderProcess = async (files) => {
    return await processFolder(files, userId);
  };

  const menuItems = [
    {
      to: '/',
      label: 'Chat',
      isActive: isHomePage || isChatPage || isExistingChat,
      onClick: handleChat,
    },
    {
      to: '/gmail-mcp',
      label: 'Gmail MCP',
      isActive: isGmailPage,
      onClick: handleGmailMCP,
    },
  ];

  return (
    <div className="menu-container">
      {/* Menu Button */}
      <button className="menu-button" onClick={toggleMenu} disabled={isAnyLoading}>
        <span className="menu-icon">☰</span>
        <span className="menu-text">Menu</span>
      </button>

      {/* Menu Dropdown */}
      {isMenuOpen && (
        <div className="menu-dropdown">
          <div className="menu-header">
            <span className="menu-title">Navigation</span>
            <button className="menu-close" onClick={() => setIsMenuOpen(false)}>
              ×
            </button>
          </div>

          {/* Navigation Links */}
          <div className="menu-section">
            {menuItems.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={`menu-item ${item.isActive ? 'active' : ''} ${isAnyLoading ? 'disabled' : ''}`}
                onClick={item.onClick}
              >
                {item.label}
              </Link>
            ))}
          </div>

          {/* File Upload Section */}
          <div className="menu-section">
            <div className="file-upload-container">
              <FolderSelector
                onFolderProcess={handleFolderProcess}
                disabled={isAnyLoading}
                compact={true}
              />
              <div className="menu-item">File Upload</div>
            </div>
          </div>

          {/* Actions Section */}
          <div className="menu-section">
            {isOnChatPage && (
              <div className="delete-messages-container">
                <DeleteMessagesButton
                  userId={userId}
                  loading={isAnyLoading}
                  setMobileMenuOpen={() => setIsMenuOpen(false)}
                />
              </div>
            )}
            {user && window.isLocal && (
              <button
                onClick={handleLogout}
                className="menu-item logout-item"
                disabled={isAnyLoading}
              >
                Logout
              </button>
            )}
          </div>
        </div>
      )}

      {/* Backdrop */}
      {isMenuOpen && <div className="menu-backdrop" onClick={() => setIsMenuOpen(false)} />}
    </div>
  );
};

export default Menu;
