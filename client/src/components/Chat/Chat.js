import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams, useMatch } from 'react-router-dom';
import ChatMessages from '../ChatMessages/ChatMessages';
import MessageInput from '../MessageInput/MessageInput';
import ContextProgressBar from '../ContextProgressBar/ContextProgressBar';
import { useChatContext } from '../../contexts/ChatContext';
import './Chat.css';
import ChatLoadingInline from '../ChatLoadingInline/ChatLoadingInline.js';
import { useLoading } from '../../contexts/LoadingContext.js';

const Chat = ({ userId }) => {
  const navigate = useNavigate();
  const { chatId: urlChatId } = useParams();
  const isExistingChat = useMatch('/chat/:chatId');
  const isNewChatPage = useMatch('/chat');
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
  const { isAnyLoading } = useLoading();

  const [currentChatId, setCurrentChatId] = useState(null);
  const [isNewChat, setIsNewChat] = useState(false);

  const [initialChatLoad, setInitialChatLoad] = useState(false);

  useEffect(() => {
    if (urlChatId) {
      // Existing chat - get chatId from URL params
      setCurrentChatId(urlChatId);
      setIsNewChat(false);
      setLog([]); // Clear log immediately when switching chats
    } else if (isNewChatPage) {
      // New chat - generate a new chatId and clear log
      const newChatId = `${userId}_${Date.now()}`;
      setCurrentChatId(newChatId);
      setIsNewChat(true);
      setLog([]); // Clear log for new chat
    }
  }, [urlChatId, isNewChatPage, userId, setLog]);

  // Load existing chat messages when viewing an existing chat
  useEffect(() => {
    const loadChatMessages = async () => {
      if (urlChatId && currentChatId && !loading && !isNewChat) {
        try {
          setInitialChatLoad(true);
          const response = await fetch(`/api/chatbot/messages/${userId}/${currentChatId}`);
          if (response.ok) {
            const messages = await response.json();
            if (messages && messages.length > 0) {
              // Convert backend messages to frontend format
              const formattedMessages = messages.map((msg, index) => ({
                text: msg.content,
                role: msg.role,
                timestamp: Date.now() + index, // Simple timestamp for display
              }));
              setLog(formattedMessages);
              setInitialChatLoad(false);
            } else {
              console.info('No messages found for this chat');
              setLog([]);
            }
          } else {
            console.error('Failed to load messages:', response.status, response.statusText);
            const errorText = await response.text();
            console.error('Error response:', errorText);
          }
        } catch (error) {
          console.error('Error loading chat messages:', error);
        }
      }
    };

    loadChatMessages();
  }, [urlChatId, currentChatId, userId, setLog, isNewChat]);

  // Update URL when first message is sent in a new chat
  useEffect(() => {
    if (isNewChatPage && currentChatId && log.length > 0) {
      // First message sent, update URL to include chatId
      setIsNewChat(false); // Mark as no longer a new chat
      navigate(`/chat/${currentChatId}`, { replace: true });
    }
  }, [log.length, currentChatId, isNewChatPage, navigate]);

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
    const newMode = coachOrChat === 'chat' ? 'coach' : 'chat';
    setCoachOrChat(newMode);
  };

  const scrollToBottom = () => {
    window.scrollTo({
      top: document.body.scrollHeight,
      behavior: 'smooth',
    });
  };

  const messageLabel = 'messages';

  return (
    <main className="chat-main-container">
      <div className="chat-header-container">
        <div
          style={{
            margin: '8px auto',
            display: 'flex',
            gap: '15px',
            justifyContent: 'space-around',
            alignItems: 'center',
          }}
        >
          {isExistingChat && (
            <button
              onClick={() => navigate('/')}
              className="back-to-chats-button"
              style={{
                background: 'transparent',
                border: '1px solid #639cff',
                color: '#639cff',
                padding: '8px 16px',
                borderRadius: '5px',
                cursor: 'pointer',
                fontSize: '14px',
                transition: 'all 0.2s',
                pointerEvents: isAnyLoading ? 'none' : 'auto',
                opacity: isAnyLoading ? 0.5 : 1,
              }}
              onMouseEnter={(e) => {
                e.target.style.background = '#639cff';
                e.target.style.color = 'white';
              }}
              onMouseLeave={(e) => {
                e.target.style.background = 'transparent';
                e.target.style.color = '#639cff';
              }}
            >
              ← Back to Chats
            </button>
          )}
          <span className="chat-header-title">
            {coachOrChat === 'chat' ? 'Code Assistant' : 'Career Coach'}
          </span>
          <button
            onClick={coachOrChat === 'coach' ? handleChatOption : null}
            className="coding-button"
            style={{
              color: coachOrChat === 'coach' ? 'white' : 'rgb(99, 156, 255)',
              border: coachOrChat === 'chat' ? '1px solid rgb(99, 156, 255' : 'none',
            }}
          >
            Coding
          </button>
          <button
            onClick={coachOrChat === 'chat' ? handleChatOption : null}
            className="job-search-button"
            style={{
              color: coachOrChat === 'coach' ? 'rgb(99, 156, 255)' : 'white',
              border: coachOrChat === 'coach' ? '1px solid rgb(99, 156, 255' : 'none',
            }}
          >
            Job Search
          </button>
        </div>
      </div>

      {initialChatLoad ? (
        <ChatLoadingInline props={messageLabel} />
      ) : (
        <ChatMessages
          log={log}
          loading={loading}
          callLLMStartTime={callLLMStartTime}
          setCallLLMStartTime={setCallLLMStartTime}
          calculateTimeSinceStart={calculateTimeSinceStart}
        />
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
        setCallLLMStartTime={setCallLLMStartTime}
        coachOrChat={coachOrChat}
        setCoachOrChat={setCoachOrChat}
        chatId={currentChatId}
      />

      <ContextProgressBar contextPercent={contextPercent} />

      {/* Bottom sentinel for intersection observer */}
      <div ref={bottomSentinelRef} style={{ height: '1px' }} />

      {/* Scroll to Bottom Button */}
      <button
        onClick={scrollToBottom}
        className={`scroll-to-bottom-button ${showScrollButton ? 'visible' : 'hidden'}`}
        onMouseEnter={(e) => {
          if (showScrollButton) {
            e.target.style.background = 'rgba(255, 255, 255, 0.15)';
            e.target.style.color = '#fff';
            e.target.style.borderColor = '#666';
            e.target.style.transform = 'translateX(-50%) translateY(-2px)';
          }
        }}
        onMouseLeave={(e) => {
          if (showScrollButton) {
            e.target.style.background = 'rgba(0, 0, 0, 0.8)';
            e.target.style.color = '#ccc';
            e.target.style.borderColor = '#444';
            e.target.style.transform = 'translateX(-50%) translateY(0px)';
          }
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
    </main>
  );
};

export default Chat;
