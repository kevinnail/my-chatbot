import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import './App.css';
import Header from './components/Header/Header';
import Chat from './components/Chat/Chat';
import Footer from './components/Footer/Footer';
import GmailMCP from './components/GmailMCP/GmailMCP.js';
import { LoadingProvider } from './contexts/LoadingContext';

export default function App() {
  const googleId = process.env.REACT_APP_GOOGLE_USER_ID;
  const [userId, setUserId] = useState(googleId);
  const [log, setLog] = useState([]);

  return (
    <LoadingProvider>
      <Router>
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            background: 'black',
          }}
        >
          <Header userId={userId} setLog={setLog} />
          <Routes>
            <Route path="/" element={<Chat userId={userId} log={log} setLog={setLog} />} />
            <Route path="/gmail-mcp" element={<GmailMCP userId={userId} />} />
          </Routes>
          <Footer />
        </div>
      </Router>
    </LoadingProvider>
  );
}
