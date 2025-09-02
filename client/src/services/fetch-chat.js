import { io } from 'socket.io-client';

const BASE_URL = process.env.REACT_APP_BASE_URL;

// Create socket connection
let socket = null;
const getSocket = () => {
  if (!socket) {
    socket = io('http://localhost:4000');
  }
  return socket;
};

export async function sendPrompt(
  userId,
  input,
  setLog,
  setInput,
  setLoading,
  setContextPercent,
  setcallLLMStartTime,
) {
  if (!input.trim()) return;
  const userMsg = input;
  const startTime = Date.now();
  setLog((l) => [...l, { text: userMsg, role: 'user', timestamp: startTime }]);
  setInput('');
  setLoading(true);

  // Add placeholder for streaming response
  const botMessageId = Date.now();
  setLog((l) => [...l, { text: '', role: 'bot', timestamp: botMessageId, isStreaming: true }]);

  const socket = getSocket();

  // Join chat room for this user
  socket.emit('join-sync-updates', userId);
  socket.emit('join-chat', userId); // New event for chat streaming

  // Set up WebSocket listeners for streaming
  const handleChatChunk = (data) => {
    setLog((l) =>
      l.map((msg) =>
        msg.timestamp === botMessageId && msg.role === 'bot'
          ? { ...msg, text: data.fullResponse, isStreaming: true }
          : msg,
      ),
    );
  };

  const handleChatComplete = (data) => {
    const endTime = Date.now();
    const responseTime = endTime - startTime;

    setLog((l) =>
      l.map((msg) =>
        msg.timestamp === botMessageId && msg.role === 'bot'
          ? {
              ...msg,
              text: data.fullResponse,
              isStreaming: false,
              responseTime,
              timestamp: endTime,
            }
          : msg,
      ),
    );

    if (data.contextPercent !== undefined) {
      setContextPercent(Number(data.contextPercent));
    }

    setLoading(false);
    if (setcallLLMStartTime) {
      setcallLLMStartTime(null);
    }

    // Clean up listeners
    socket.off('chat-chunk', handleChatChunk);
    socket.off('chat-complete', handleChatComplete);
    socket.off('chat-error', handleChatError);
  };

  const handleChatError = (data) => {
    const errorTime = Date.now();
    const responseTime = errorTime - startTime;

    // Remove streaming placeholder and add error
    setLog((l) => l.filter((msg) => !(msg.timestamp === botMessageId && msg.role === 'bot')));
    setLog((l) => [
      ...l,
      {
        text: `**Error**: ${data.error || 'Streaming error occurred'}`,
        role: 'error',
        responseTime,
        timestamp: errorTime,
      },
    ]);

    setLoading(false);
    if (setcallLLMStartTime) {
      setcallLLMStartTime(null);
    }

    // Clean up listeners
    socket.off('chat-chunk', handleChatChunk);
    socket.off('chat-complete', handleChatComplete);
    socket.off('chat-error', handleChatError);
  };

  // Add event listeners
  socket.on('chat-chunk', handleChatChunk);
  socket.on('chat-complete', handleChatComplete);
  socket.on('chat-error', handleChatError);

  try {
    const res = await fetch(`${BASE_URL}/api/chatbot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ msg: userMsg, userId }),
    });

    // Check if response indicates streaming
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || 'Failed to send prompt');
    }

    // If not streaming, handle as before
    if (!data.streaming) {
      const { bot, context_percent } = data;
      const endTime = Date.now();
      const responseTime = endTime - startTime;

      setLog((l) =>
        l.map((msg) =>
          msg.timestamp === botMessageId && msg.role === 'bot'
            ? { text: bot, role: 'bot', responseTime, timestamp: endTime, isStreaming: false }
            : msg,
        ),
      );

      if (context_percent !== undefined && context_percent !== null) {
        setContextPercent(Number(context_percent));
      }

      setLoading(false);
      if (setcallLLMStartTime) {
        setcallLLMStartTime(null);
      }

      // Clean up listeners if not streaming
      socket.off('chat-chunk', handleChatChunk);
      socket.off('chat-complete', handleChatComplete);
      socket.off('chat-error', handleChatError);
    }
    // If streaming, the WebSocket handlers will manage the response
  } catch (e) {
    console.error('error sending prompt', e);
    const errorTime = Date.now();
    const responseTime = errorTime - startTime;

    // Remove streaming placeholder and add error
    setLog((l) => l.filter((msg) => !(msg.timestamp === botMessageId && msg.role === 'bot')));
    setLog((l) => [
      ...l,
      {
        text: `**Error**: ${e.message || 'Unable to get response from server. Please try again.'}`,
        role: 'error',
        responseTime,
        timestamp: errorTime,
      },
    ]);

    setLoading(false);
    if (setcallLLMStartTime) {
      setcallLLMStartTime(null);
    }

    // Clean up listeners
    socket.off('chat-chunk', handleChatChunk);
    socket.off('chat-complete', handleChatComplete);
    socket.off('chat-error', handleChatError);
  }
}

export async function deleteMessages(userId) {
  try {
    const res = await fetch(`${BASE_URL}/api/chatbot/${userId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });

    // Check if response is JSON before parsing
    const contentType = res.headers.get('content-type');

    if (contentType && contentType.includes('application/json')) {
      return res.json();
    } else {
      // Response is not JSON (likely HTML error page or plain text)
      const textResponse = await res.text();
      console.log('Non-JSON response received:', textResponse);

      if (res.ok) {
        // If the response is ok but not JSON, assume success
        return { success: true };
      } else {
        // Extract meaningful error message
        let errorMessage;
        if (textResponse.includes('Proxy error')) {
          errorMessage = 'Backend server is not running. Please start the backend server.';
        } else if (textResponse.includes('404')) {
          errorMessage = 'API endpoint not found. Please check the backend configuration.';
        } else {
          errorMessage = 'Server returned an unexpected response. Please check the backend server.';
        }
        throw new Error(errorMessage);
      }
    }
  } catch (e) {
    console.error('error deleting messages', e);
    throw e; // Re-throw to allow caller to handle
  }
}
