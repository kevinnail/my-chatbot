import React, { createContext, useContext, useState } from 'react';
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
  const [chats, setChats] = useState([]);

  function countTokensFromString(text) {
    // Very rough estimate: 1 token ≈ 4 characters in English
    return Math.ceil(text.length / 4);
  }

  function handleInputChange(e) {
    const newInput = e.target.value;
    setInput(newInput);
    setTokenCount(countTokensFromString(newInput));
  }

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
    chats,
    setChats,
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
};
