import React from 'react';
import ChatMessages from '../ChatMessages/ChatMessages';
import MessageInput from '../MessageInput/MessageInput';
import ContextProgressBar from '../ContextProgressBar/ContextProgressBar';
import { useChat } from '../../hooks/useChat';

const Chat = ({ userId }) => {
  const {
    input,
    setInput,
    log,
    setLog,
    loading,
    setLoading,
    contextPercent,
    setContextPercent,
    tokenCount,
    handleInputChange,
  } = useChat();

  return (
    <main style={{
      margin:'1.4rem auto',
      fontFamily:'sans-serif',
      fontSize:'1.2rem', 
      letterSpacing:'.07rem',
      background:'black',
      color:'white',
      padding:'0.7rem',
      borderRadius:'10.5px',
      flex:'1 0 auto',
      boxShadow:'0 2px 16px #000a',
      minHeight:'60vh',
      display:'flex',
      flexDirection:'column',
      width:'90%'
    }}>
      <ChatMessages log={log} loading={loading} />
      
      <MessageInput 
        userId={userId}
        input={input}
        setInput={setInput}
        loading={loading}
        setLog={setLog}
        setLoading={setLoading}
        setContextPercent={setContextPercent}
        tokenCount={tokenCount}
        onInputChange={handleInputChange}
      />

      <ContextProgressBar contextPercent={contextPercent} />
    </main>
  );
};

export default Chat; 