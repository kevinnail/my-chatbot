import React, { useContext } from 'react';
import { useMatch } from 'react-router-dom';
import Menu from './Menu';
import './Header.css';
import { UserContext } from '../../contexts/UserContext.js';

const Header = ({ userId, setUserId }) => {
  const { user } = useContext(UserContext);
  const isHomePage = useMatch('/');
  const isChatPage = useMatch('/chat');
  const isExistingChat = useMatch('/chat/:chatId');
  const isOnChatPage = isHomePage || isChatPage || isExistingChat;
  return (
    <header className="header">
      <div className="header-left">
        <span className="header-logo">
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

      {user && <Menu userId={userId} isOnChatPage={isOnChatPage} setUserId={setUserId} />}
    </header>
  );
};

export default Header;
