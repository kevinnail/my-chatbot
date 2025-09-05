import React, { useEffect, useState } from 'react';
import ChatMessages from '../ChatMessages/ChatMessages';
import MessageInput from '../MessageInput/MessageInput';
import ContextProgressBar from '../ContextProgressBar/ContextProgressBar';
import { useChatContext } from '../../contexts/ChatContext';

const Chat = ({ userId }) => {
  const {
    input,
    setInput,
    loading,
    setLoading,
    contextPercent,
    setContextPercent,
    tokenCount,
    handleInputChange,
    log,
    setLog,
  } = useChatContext();

  const [currentTime, setCurrentTime] = useState(new Date());
  const [callLLMStartTime, setCallLLMStartTime] = useState(null);

  const calculateTimeSinceStart = () => {
    if (!callLLMStartTime) return null;
    const now = currentTime;
    const startTime = new Date(callLLMStartTime);
    const diffMs = now - startTime;
    const diffSeconds = Math.max(0, Math.floor(diffMs / 1000)); // Ensure non-negative
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
      <ChatMessages
        log={log}
        loading={loading}
        callLLMStartTime={callLLMStartTime}
        setCallLLMStartTime={setCallLLMStartTime}
        calculateTimeSinceStart={calculateTimeSinceStart}
      />

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
        setCallLLMStartTime={setCallLLMStartTime}
      />
      <ContextProgressBar contextPercent={contextPercent} />
    </main>
  );
};

export default Chat;
