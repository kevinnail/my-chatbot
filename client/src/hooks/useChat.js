import { useState, useEffect } from 'react';

export const useChat = () => {
  const [input, setInput] = useState('');
  const [log, setLog] = useState([]);
  const [loading, setLoading] = useState(false);
  const [contextPercent, setContextPercent] = useState(0);
  const [tokenCount, setTokenCount] = useState(0);

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
    loading,
    setLoading,
    contextPercent,
    setContextPercent,
    tokenCount,
    handleInputChange,
  };
}; 