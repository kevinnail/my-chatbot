import React, { createContext, useContext, useState, useEffect } from 'react';
import { useLoading } from './LoadingContext';

const ChatContext = createContext();

export const useChatContext = () => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChatContext must be used within a ChatProvider');
  }
  return context;
};

export const ChatProvider = ({ children }) => {
  const [input, setInput] = useState('');
  const [contextPercent, setContextPercent] = useState(0);
  const [tokenCount, setTokenCount] = useState(0);
  const [log, setLog] = useState([]);
  const { chatLoading, setChatLoading } = useLoading();

  function countTokensFromString(text) {
    // Very rough estimate: 1 token ≈ 4 characters in English
    return Math.ceil(text.length / 4);
  }

  function handleInputChange(e) {
    const newInput = e.target.value;
    setInput(newInput);
    setTokenCount(countTokensFromString(newInput));
  }

  // Keep token count in sync with input (useful when input is cleared by other means)
  useEffect(() => {
    setTokenCount(countTokensFromString(input));
  }, [input]);

  const value = {
    input,
    setInput,
    loading: chatLoading,
    setLoading: setChatLoading,
    contextPercent,
    setContextPercent,
    tokenCount,
    handleInputChange,
    log,
    setLog,
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
};
