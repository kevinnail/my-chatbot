import React from 'react';
import { sendPrompt } from '../../services/fetch-chat';

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
  setcallLLMStartTime,
}) => {
  const handleSend = () => {
    setcallLLMStartTime(new Date());

    sendPrompt(userId, input, setLog, setInput, setLoading, setContextPercent);
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '0.35rem',
        width: '100%',
      }}
    >
      <textarea
        style={{
          width: '70%',
          fontSize: '1.05rem',
          height: '70px',
          display: loading ? 'none' : 'block',
          color: 'white',
          backgroundColor: 'black',
          padding: '10px',
          borderRadius: '10px',
          border: '1px solid #4f62cb',
        }}
        value={input}
        placeholder={`Let's code!  What can I help build for you?`}
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
        <div
          style={{
            width: '70%',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: '0.5rem',
          }}
        >
          <div
            style={{
              fontSize: '1rem',
              color: '#888',
              fontFamily: 'monospace',
              letterSpacing: '0.05em',
            }}
          >
            ~{tokenCount} tokens in prompt
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
