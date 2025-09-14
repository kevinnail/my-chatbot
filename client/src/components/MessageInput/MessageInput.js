import React, { useEffect, useRef } from 'react';
import { sendPrompt } from '../../services/fetch-chat';
import './MessageInput.css';

const MessageInput = ({
  userId,
  input,
  setInput,
  loading,
  setLog,
  setLoading,
  setContextPercent,
  tokenCount,
  onInputChange,
  setCallLLMStartTime,
  coachOrChat,
  chatId,
  refreshChatList,
}) => {
  const textareaRef = useRef(null);

  // Auto-resize textarea based on content
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  }, [input]);
  const handleSend = () => {
    setCallLLMStartTime(new Date());
    const prompt = {
      userId,
      input,
      setLog,
      setInput,
      setLoading,
      setContextPercent,
      setCallLLMStartTime,
      coachOrChat,
      chatId,
      refreshChatList,
    };

    sendPrompt(prompt);
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '0.35rem',
        width: '100%',
        paddingTop: '40px',
      }}
    >
      <textarea
        ref={textareaRef}
        className="message-input"
        style={{
          display: loading ? 'none' : 'block',
        }}
        value={input}
        placeholder={
          coachOrChat === 'chat'
            ? "Let's code!  What can I help build for you?"
            : 'What can I do to help with your job search?'
        }
        disabled={loading}
        onChange={onInputChange}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
          }
          // If Shift+Enter is pressed, allow default behavior (new line)
        }}
      />
      {!loading && (
        <div className="token-mode-send">
          <div className="token-mode-wrapper">
            <div className="tokens-in-prompt-display">~{tokenCount} tokens in prompt</div>
          </div>
          <button
            style={{
              fontSize: '0.77rem',
              borderRadius: '15px',
              padding: '.28rem 1.05rem',
              background: 'linear-gradient(90deg, #4af 0%, #0fa 100%)',
              color: '#fff',
              border: 'none',
              boxShadow: '0 2px 12px #0af4',
              fontWeight: 'bold',
              letterSpacing: '.08em',
              cursor: 'pointer',
              transition: 'background 0.3s, transform 0.15s',
              display: 'flex',
              alignItems: 'center',
              gap: '0.7em',
            }}
            disabled={loading}
            onClick={handleSend}
          >
            <svg
              width="17"
              height="17"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              style={{ marginRight: '0.2em' }}
            >
              <path d="M3 20L21 12L3 4V10L17 12L3 14V20Z" fill="white" />
            </svg>
            Send
          </button>
        </div>
      )}
    </div>
  );
};

export default MessageInput;
