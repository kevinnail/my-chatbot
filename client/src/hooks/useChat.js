import { useState, useEffect } from 'react';
import { useLoading } from '../contexts/LoadingContext';

export const useChat = () => {
  const [input, setInput] = useState('');
  const [log, setLog] = useState([]);
  const [contextPercent, setContextPercent] = useState(0);
  const [tokenCount, setTokenCount] = useState(0);
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

  return {
    input,
    setInput,
    log,
    setLog,
    loading: chatLoading,
    setLoading: setChatLoading,
    contextPercent,
    setContextPercent,
    tokenCount,
    handleInputChange,
  };
};
