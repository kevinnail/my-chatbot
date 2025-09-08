import React, { useEffect, useState, useRef } from 'react';
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
  const [showScrollButton, setShowScrollButton] = useState(false);
  const bottomSentinelRef = useRef(null);

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

  useEffect(() => {
    const hasMessages = log && log.length > 0;

    if (!hasMessages) {
      setShowScrollButton(false);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        // Show button when bottom sentinel is NOT visible
        setShowScrollButton(!entry.isIntersecting);
      },
      {
        threshold: 0,
        rootMargin: '0px 0px -100px 0px', // Trigger 100px before bottom
      },
    );

    if (bottomSentinelRef.current) {
      observer.observe(bottomSentinelRef.current);
    }

    return () => observer.disconnect();
  }, [log]);

  const handleChatOption = () => {
    setCoachOrChat(coachOrChat === 'chat' ? 'coach' : 'chat');
  };

  const scrollToBottom = () => {
    window.scrollTo({
      top: document.body.scrollHeight,
      behavior: 'smooth',
    });
  };

  return (
    <main className="chat-main-container">
      <div className="chat-header-container">
        <div
          style={{
            margin: '8px auto',
            display: 'flex',
            gap: '50px',
          }}
        >
          <span className="chat-header-title">
            {coachOrChat === 'chat' ? 'Code Assistant' : 'Career Coach'}
          </span>
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

      {/* Bottom sentinel for intersection observer */}
      <div ref={bottomSentinelRef} style={{ height: '1px' }} />

      {/* Scroll to Bottom Button */}
      {showScrollButton && (
        <button
          onClick={scrollToBottom}
          className="scroll-to-bottom-button"
          onMouseEnter={(e) => {
            e.target.style.background = 'rgba(255, 255, 255, 0.15)';
            e.target.style.color = '#fff';
            e.target.style.borderColor = '#666';
            e.target.style.transform = 'translateX(-50%) translateY(-2px)';
          }}
          onMouseLeave={(e) => {
            e.target.style.background = 'rgba(0, 0, 0, 0.8)';
            e.target.style.color = '#ccc';
            e.target.style.borderColor = '#444';
            e.target.style.transform = 'translateX(-50%) translateY(0px)';
          }}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M7 14L12 19L17 14M12 5V18"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Scroll to Bottom
        </button>
      )}
    </main>
  );
};

export default Chat;
