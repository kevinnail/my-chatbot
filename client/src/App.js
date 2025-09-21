import React from 'react';
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
import { ToastContainer } from 'react-toastify';

window.isLocal =
  window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

export default function App() {
  return (
    <UserProvider>
      <LoadingProvider>
        <ChatProvider>
          <Router>
            <ToastContainer position="top-center" />

            <div
              style={{
                minHeight: '100vh',
                display: 'flex',
                flexDirection: 'column',
                background: 'black',
              }}
            >
              <Header />
              <Routes>
                <Route path="/auth/:type" element={<Auth />} />
                <Route
                  path="/"
                  element={
                    <ProtectedRoute>
                      <ChatList />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/chat"
                  element={
                    <ProtectedRoute>
                      <Chat />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/chat/:chatId"
                  element={
                    <ProtectedRoute>
                      <Chat />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/gmail-mcp"
                  element={
                    <ProtectedRoute>
                      <GmailMCP />
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
