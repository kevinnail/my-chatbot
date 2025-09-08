import React, { useEffect, useState } from 'react';
import ChatMessages from '../ChatMessages/ChatMessages';
import MessageInput from '../MessageInput/MessageInput';
import ContextProgressBar from '../ContextProgressBar/ContextProgressBar';
import { useChatContext } from '../../contexts/ChatContext';
import './Chat.css';

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
  const [coachOrChat, setCoachOrChat] = useState('chat');

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

  const handleChatOption = () => {
    setCoachOrChat(coachOrChat === 'chat' ? 'coach' : 'chat');
  };

  return (
    <main
      style={{
        margin: '0 auto ',
        fontFamily: 'sans-serif',
        fontSize: '1.2rem',
        letterSpacing: '.07rem',
        background: 'black',
        color: 'white',
        padding: '50px 0.7rem',
        borderRadius: '10.5px',
        flex: '1 0 auto',
        boxShadow: '0 2px 16px #000a',
        minHeight: '60vh',
        display: 'flex',
        flexDirection: 'column',
        width: '90%',
      }}
    >
      <div className="chat-header-container">
        <div
          style={{
            // width: '71.5%',
            padding: '0 1rem',
            margin: '8px auto',
            display: 'flex',
            gap: '50px',
          }}
        >
          <h3
            style={{
              margin: '0 auto',
              width: '71.5%',
              textAlign: 'start',
              padding: '8px 0',
            }}
          >
            {coachOrChat === 'chat' ? 'Code Assistant' : 'Career Coach'}
          </h3>
          <button
            onClick={coachOrChat === 'coach' ? handleChatOption : null}
            style={{
              fontSize: '.9rem',
              borderRadius: '8px',
              padding: '5px',
              background: 'none',
              color: coachOrChat === 'coach' ? 'white' : 'rgb(99, 156, 255)',
              border: coachOrChat === 'chat' ? '1px solid rgb(99, 156, 255' : 'none',
              fontWeight: 'bold',
              letterSpacing: '.08em',
              cursor: coachOrChat === 'coach' ? 'pointer' : '',
              transition: 'background 0.3s, transform 0.15s',
              display: 'inline',
              alignItems: 'center',
              gap: '0.7em',
            }}
          >
            {/* Set to {coachOrChat === 'chat' ? 'coach' : 'chat'} mode */}Coding
          </button>
          <button
            onClick={coachOrChat === 'chat' ? handleChatOption : null}
            style={{
              fontSize: '.9rem',
              borderRadius: '8px',
              padding: '5px',
              background: 'none',
              color: coachOrChat === 'coach' ? 'rgb(99, 156, 255)' : 'white',
              border: coachOrChat === 'coach' ? '1px solid rgb(99, 156, 255' : 'none',
              minWidth: '110px',
              fontWeight: 'bold',
              letterSpacing: '.08em',
              cursor: coachOrChat === 'chat' ? 'pointer' : '',
              transition: 'background 0.3s, transform 0.15s',
              display: 'inline',
              alignItems: 'center',
              gap: '0.7em',
            }}
          >
            Job Search
          </button>
        </div>
      </div>
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
        coachOrChat={coachOrChat}
        setCoachOrChat={setCoachOrChat}
      />

      <ContextProgressBar contextPercent={contextPercent} />
    </main>
  );
};

export default Chat;
