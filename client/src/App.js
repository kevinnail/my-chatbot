import React, { useState } from 'react';
import './App.css';
import Header from './components/Header/Header';
import Chat from './components/Chat/Chat';
import Footer from './components/Footer/Footer';

export default function App() {
  const [userId, setUserId] = useState('1');  // Default to 1 since this is local

  return (
    <div style={{minHeight:'100vh',display:'flex',flexDirection:'column',background:'black'}}>
      <Header userId={userId} />
      <Chat userId={userId} />
      <Footer />
    </div>
  );
}
