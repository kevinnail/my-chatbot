import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import './App.css';
import Auth from './components/Auth/Auth.js';
import Chat from './components/Chat/Chat';
import ChatList from './components/ChatList/ChatList';
import Footer from './components/Footer/Footer';
import Header from './components/Header/Header';
import GmailMCP from './components/GmailMCP/GmailMCP.js';
import ProtectedRoute from './components/ProtectedRoute.js';
import { LoadingProvider } from './contexts/LoadingContext';
import { ChatProvider } from './contexts/ChatContext';
import { UserProvider } from './contexts/UserContext';

window.isLocal =
  window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

export default function App() {
  const googleId = process.env.REACT_APP_GOOGLE_USER_ID;
  // Use a fallback userId for demo mode when the environment variable is not set
  const [userId] = useState(googleId || 'demo-user');

  return (
    <UserProvider>
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
                <Route path="/auth/:type" element={<Auth userId={userId} />} />
                <Route
                  path="/"
                  element={
                    <ProtectedRoute>
                      <ChatList userId={userId} />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/chat"
                  element={
                    <ProtectedRoute>
                      <Chat userId={userId} />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/chat/:chatId"
                  element={
                    <ProtectedRoute>
                      <Chat userId={userId} />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/gmail-mcp"
                  element={
                    <ProtectedRoute>
                      <GmailMCP userId={userId} />
                    </ProtectedRoute>
                  }
                />
              </Routes>
              <Footer />
            </div>
          </Router>
        </ChatProvider>
      </LoadingProvider>
    </UserProvider>
  );
}
