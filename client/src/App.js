import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import './App.css';
import Header from './components/Header/Header';
import Chat from './components/Chat/Chat';
import Footer from './components/Footer/Footer';
import GmailMCP from './components/GmailMCP/GmailMCP';

export default function App() {
  const googleId = process.env.REACT_APP_GOOGLE_USER_ID;
  const [userId, setUserId] = useState(googleId);

  console.log(userId.userId);
  return (
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
          <Route path="/" element={<Chat userId={userId} />} />
          <Route path="/gmail-mcp" element={<GmailMCP userId={userId} />} />
        </Routes>
        <Footer />
      </div>
    </Router>
  );
}
