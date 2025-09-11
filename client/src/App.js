import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import './App.css';
import Header from './components/Header/Header';
import Chat from './components/Chat/Chat';
import ChatList from './components/ChatList/ChatList';
import Footer from './components/Footer/Footer';
import GmailMCP from './components/GmailMCP/GmailMCP.js';
import { LoadingProvider } from './contexts/LoadingContext';
import { ChatProvider } from './contexts/ChatContext';

window.isLocal =
  window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

export default function App() {
  const googleId = process.env.REACT_APP_GOOGLE_USER_ID;
  const [userId] = useState(googleId);

  return (
    <LoadingProvider>
      <ChatProvider>
        <Router>
          <div
            style={{
              minHeight: '100vh',
              display: 'flex',
              flexDirection: 'column',
              background: 'black',
            }}
          >
            <Header userId={userId} />
            <Routes>
              <Route path="/" element={<ChatList userId={userId} />} />
              <Route path="/chat" element={<Chat userId={userId} />} />
              <Route path="/chat/:chatId" element={<Chat userId={userId} />} />
              <Route path="/gmail-mcp" element={<GmailMCP userId={userId} />} />
            </Routes>
            <Footer />
          </div>
        </Router>
      </ChatProvider>
    </LoadingProvider>
  );
}
