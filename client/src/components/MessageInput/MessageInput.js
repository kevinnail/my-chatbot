import React, { useRef, useState } from 'react';
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
  const fileInputRef = useRef(null);
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);

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

  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSend = () => {
    setCallLLMStartTime(new Date());
    const prompt = {
      userId,
      input,
      image: selectedImage,
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

    // Clear image after sending
    handleRemoveImage();
  };

  return (
    <div className="message-input-container">
      {imagePreview && (
        <div className="image-preview-container">
          <div className="image-preview">
            <img src={imagePreview} alt="Selected" className="preview-image" />
            <button className="remove-image-button" onClick={handleRemoveImage}>
              ×
            </button>
          </div>
        </div>
      )}

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

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleImageSelect}
        style={{ display: 'none' }}
      />
      {loading && (
        <div className="token-mode-send">
          <div className="token-mode-wrapper"></div>
          {/* <div className="tokens-in-prompt-display">Generating response...</div> */}
        </div>
      )}
      {!loading && (
        <div className="token-mode-send">
          <div className="token-mode-wrapper">
            <div className="tokens-in-prompt-display">~{tokenCount} tokens in prompt</div>
          </div>
          <div className="input-buttons">
            <button
              className="image-upload-button"
              onClick={() => fileInputRef.current?.click()}
              title="Upload image"
            >
              <svg
                width="17"
                height="17"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"
                  fill="white"
                />
              </svg>
            </button>
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
        </div>
      )}
    </div>
  );
};

export default MessageInput;
