import React, { createContext, useContext, useState } from 'react';

const LoadingContext = createContext();

export const useLoading = () => {
  const context = useContext(LoadingContext);
  if (!context) {
    throw new Error('useLoading must be used within a LoadingProvider');
  }
  return context;
};

export const LoadingProvider = ({ children }) => {
  const [chatLoading, setChatLoading] = useState(false);
  const [gmailLoading, setGmailLoading] = useState(false);

  const isAnyLoading = chatLoading || gmailLoading;

  return (
    <LoadingContext.Provider
      value={{
        chatLoading,
        setChatLoading,
        gmailLoading,
        setGmailLoading,
        isAnyLoading,
      }}
    >
      {children}
    </LoadingContext.Provider>
  );
};
