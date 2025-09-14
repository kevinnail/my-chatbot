import React, { useRef } from 'react';
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
  const handleTextareaChange = (e) => {
    onInputChange(e);

    // Auto-resize after input change
    const textarea = e.target;
    const oldHeight = textarea.offsetHeight;
    textarea.style.height = 'auto';
    const newHeight = textarea.scrollHeight;
    textarea.style.height = `${newHeight}px`;

    // If textarea grew, scroll down by the exact amount it expanded
    // This keeps the textarea in the same position relative to viewport
    // and prevents the "scroll to bottom" button from appearing
    if (newHeight > oldHeight) {
      window.scrollBy(0, newHeight - oldHeight);
    }
  };

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

  const handleStop = async () => {
    try {
      const response = await fetch('/api/chatbot/stop', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId }),
      });

      if (response.ok) {
        setLoading(false);
      }
    } catch (error) {
      console.error('Error stopping request:', error);
    }
  };

  return (
    <div className="message-input-container">
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
        onChange={handleTextareaChange}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
          }
          // If Shift+Enter is pressed, allow default behavior (new line)
        }}
      />
      {loading && (
        <div className="token-mode-send">
          <div className="token-mode-wrapper">
            <div className="tokens-in-prompt-display">Generating response...</div>
          </div>
          <button className="stop-button" onClick={handleStop}>
            <svg
              width="17"
              height="17"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              style={{ marginRight: '0.2em' }}
            >
              <rect x="6" y="6" width="12" height="12" fill="white" />
            </svg>
            Stop
          </button>
        </div>
      )}
      {!loading && (
        <div className="token-mode-send">
          <div className="token-mode-wrapper">
            <div className="tokens-in-prompt-display">~{tokenCount} tokens in prompt</div>
          </div>
          <button className="send-button" disabled={loading} onClick={handleSend}>
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
