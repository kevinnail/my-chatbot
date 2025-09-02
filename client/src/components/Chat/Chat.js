import React, { useEffect, useState } from 'react';
import ChatMessages from '../ChatMessages/ChatMessages';
import MessageInput from '../MessageInput/MessageInput';
import ContextProgressBar from '../ContextProgressBar/ContextProgressBar';
import { useChat } from '../../hooks/useChat';

const Chat = ({ userId, log, setLog }) => {
  const {
    input,
    setInput,
    loading,
    setLoading,
    contextPercent,
    setContextPercent,
    tokenCount,
    handleInputChange,
  } = useChat();

  const [currentTime, setCurrentTime] = useState(new Date());
  const [callLLMStartTime, setcallLLMStartTime] = useState(null);

  const calculateTimeSinceStart = () => {
    if (!callLLMStartTime) return null;
    const now = currentTime;
    const startTime = new Date(callLLMStartTime);
    const diffMs = now - startTime;
    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const remainingSeconds = diffSeconds % 60;

    if (diffMinutes > 0) {
      return `${diffMinutes}m ${remainingSeconds}s`;
    }
    return `${diffSeconds}s`;
  };

  useEffect(() => {
    if (callLLMStartTime) {
      const interval = setInterval(() => {
        setCurrentTime(new Date());
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [callLLMStartTime]);

  // Debug logging
  useEffect(() => {
    console.log('Timer state changed:', { callLLMStartTime, loading });
  }, [callLLMStartTime, loading]);

  return (
    <main
      style={{
        margin: '1.4rem auto',
        fontFamily: 'sans-serif',
        fontSize: '1.2rem',
        letterSpacing: '.07rem',
        background: 'black',
        color: 'white',
        padding: '0.7rem',
        borderRadius: '10.5px',
        flex: '1 0 auto',
        boxShadow: '0 2px 16px #000a',
        minHeight: '60vh',
        display: 'flex',
        flexDirection: 'column',
        width: '90%',
      }}
    >
      <ChatMessages log={log} loading={loading} />
      {callLLMStartTime && (
        <div
          className="time-info"
          style={{
            padding: '10px',
            backgroundColor: '#333',
            color: '#00ff00',
            textAlign: 'center',
            borderRadius: '5px',
            margin: '10px 0',
          }}
        >
          <small>
            {calculateTimeSinceStart()
              ? `Running for: ${calculateTimeSinceStart()}`
              : 'Starting...'}
          </small>
        </div>
      )}
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
        setcallLLMStartTime={setcallLLMStartTime}
      />
      <ContextProgressBar contextPercent={contextPercent} />
    </main>
  );
};

export default Chat;
