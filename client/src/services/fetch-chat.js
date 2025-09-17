import { ChatManager } from './ChatManager';

// Create a singleton instance of ChatManager
const chatManager = new ChatManager();

// Export the setStopPressed function for backward compatibility
export function setStopPressed(value) {
  chatManager.setStopPressed(value);
}

export async function sendPrompt({
  userId,
  input,
  image,
  setLog,
  setInput,
  setLoading,
  setContextPercent,
  setCallLLMStartTime,
  coachOrChat,
  chatId,
  refreshChatList,
}) {
  try {
    await chatManager.sendMessage({
      userId,
      input,
      image,
      coachOrChat,
      chatId,
      onUserMessage: (userMsg, startTime) => {
        setLog((l) => [...l, { text: userMsg, role: 'user', timestamp: startTime }]);
        setInput('');
        setLoading(true);
      },
      onBotMessageStart: (messageId) => {
        setLog((l) => [
          ...l,
          { text: '', role: 'bot', timestamp: messageId, isStreaming: true, isProcessing: true },
        ]);
      },
      onBotMessageChunk: (messageId, text) => {
        setLog((l) =>
          l.map((msg) =>
            msg.timestamp === messageId && msg.role === 'bot'
              ? { ...msg, text, isStreaming: true, isProcessing: false }
              : msg,
          ),
        );
      },
      onBotMessageComplete: (messageId, { text, responseTime, timestamp }) => {
        setLog((l) =>
          l.map((msg) => {
            if (msg.timestamp === messageId && msg.role === 'bot') {
              return {
                text,
                role: 'bot',
                responseTime,
                timestamp,
                isStreaming: false,
                isProcessing: false,
              };
            }
            return msg;
          }),
        );
      },
      onBotMessageError: (messageId, error, isStopped) => {
        if (isStopped) {
          // When stopped, preserve the message content but mark it as stopped
          setLog((l) =>
            l.map((msg) => {
              if (msg.timestamp === messageId && msg.role === 'bot') {
                return {
                  ...msg,
                  isStreaming: false,
                  isProcessing: false,
                  isStopped: true,
                  responseTime: Date.now() - messageId,
                };
              }
              return msg;
            }),
          );
        } else {
          const errorTime = Date.now();
          setLog((l) => l.filter((msg) => !(msg.timestamp === messageId && msg.role === 'bot')));
          setLog((l) => [
            ...l,
            {
              text: `**Error**: ${error || 'Streaming error occurred'}`,
              role: 'error',
              responseTime: errorTime - Date.now(),
              timestamp: errorTime,
            },
          ]);
        }
      },
      onLoadingChange: setLoading,
      onContextPercentChange: setContextPercent,
      onCallLLMStartTimeChange: setCallLLMStartTime,
      refreshChatList,
    });
  } catch (error) {
    console.error('Error sending prompt:', error);
    setLoading(false);
    // Show error to user
    const errorTime = Date.now();
    setLog((l) => [
      ...l,
      {
        text: '**Error**: Failed to send message. Please try again.',
        role: 'error',
        responseTime: 0,
        timestamp: errorTime,
      },
    ]);
  }
}

export async function deleteMessages(userId) {
  try {
    return await chatManager.deleteMessages(userId);
  } catch (error) {
    console.error('Error deleting messages:', error);
    throw error;
  }
}
