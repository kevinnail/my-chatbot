import { io } from 'socket.io-client';

const BASE_URL = process.env.REACT_APP_BASE_URL;

// Create socket connection
let socket = null;
const getSocket = () => {
  if (!socket) {
    // Only connect to socket when running locally
    if (window.isLocal) {
      socket = io('http://localhost:4000');
    } else {
      // Return a mock socket for demo
      socket = {
        on: () => {},
        emit: () => {},
        disconnect: () => {},
      };
    }
  }
  return socket;
};

export async function sendPrompt({
  userId,
  input,
  setLog,
  setInput,
  setLoading,
  setContextPercent,
  setCallLLMStartTime,
  coachOrChat,
}) {
  if (!input.trim()) return;
  const userMsg = input;
  const startTime = Date.now();
  setLog((l) => [...l, { text: userMsg, role: 'user', timestamp: startTime }]);
  setInput('');
  setLoading(true);

  // Check if running locally or on netlify
  if (window.isLocal) {
    // Fake response for netlify deploy
    const botMessageId = Date.now();
    setLog((l) => [...l, { text: '', role: 'bot', timestamp: botMessageId, isStreaming: true }]);
    let fakeResponse = '';
    // Simulate streaming response
    if (coachOrChat === 'chat') {
      fakeResponse =
        "Hey Dude, I'm your senior software engineer assistant - demo version running right now. In the local version, I can tackle your React, Express, and Node.js challenges with production-ready solutions.\n\n**What I do:**\n\n• Debug complex issues and optimize performance\n\n• Write maintainable, secure code following best practices\n\n• Handle authentication, APIs, database integration\n\n• Provide testing strategies and deployment guidance\n\n\n**Current setup** - here's the Ollama API call from our Express route:\n\n```javascript\nconst response = await fetch(`${process.env.OLLAMA_URL}/api/chat`, {\n  method: 'POST',\n  headers: { 'Content-Type': 'application/json' },\n  body: JSON.stringify({\n    model: process.env.OLLAMA_MODEL,\n    messages,\n    keep_alive: '60m',\n    options: {\n      min_p: 0.05,\n      temperature: 0.2,\n      top_p: 0.9,\n      mirostat: 0,\n      repeat_penalty: 1.05,\n      top_k: 40,\n     },\n    stream: true,\n  }),\n  signal: controller.signal,\n  headersTimeout: 12000000, \n  bodyTimeout: 12000000,\n});\n```\n\n**Remember:** I'll be direct and technical- no hand-holding. If I don't know something, I'll tell you straight up. What coding problem can I help you solve?";
    } else {
      fakeResponse =
        'Hey Dude, I\'m JobCoachDude - your career coach for landing that next web dev role! This is the demo version, but in the local version, I can help you nail your job search strategy.\n\n**Top Move:** Optimize your LinkedIn profile - it\'s your digital storefront and the first thing recruiters see.\n\n**Why it matters:**\n• 87% of recruiters use LinkedIn to find candidates\n• A strong profile gets you 5x more connection requests\n• Your headline alone determines if they click or scroll past\n\n**Steps to dominate LinkedIn:**\n1. Write a headline that screams your value (not just "Software Developer")\n2. Craft an About section that tells your story in 3-4 short paragraphs\n3. Add 3-5 recent projects with impact metrics\n4. Post weekly about your coding journey or industry insights\n5. Connect with 10 people in your target companies each week\n\n**Next Step:** Update your LinkedIn headline right now with your main tech stack + the value you bring (e.g., "React Developer | Building scalable web apps that boost user engagement by 40%")\n\nRemember Dude - the job search is a numbers game mixed with strategy. I can help you with resume bullets, cover letter templates, interview prep, salary negotiation, and weekly action plans. What\'s your biggest job search challenge right now?';
    }
    const randomResponse = fakeResponse;
    const words = randomResponse.split(' ');
    let currentText = '';
    let wordIndex = 0;

    const streamWords = () => {
      if (wordIndex < words.length) {
        currentText += (wordIndex > 0 ? ' ' : '') + words[wordIndex];
        wordIndex++;

        setLog((l) =>
          l.map((msg) =>
            msg.timestamp === botMessageId && msg.role === 'bot'
              ? { ...msg, text: currentText, isStreaming: true }
              : msg,
          ),
        );

        // Random delay between words (50-150ms) for realistic typing
        setTimeout(streamWords, 50 + Math.random() * 100);
      } else {
        // Streaming complete
        const endTime = Date.now();
        const responseTime = endTime - startTime;

        setLog((l) =>
          l.map((msg) => {
            if (msg.timestamp === botMessageId && msg.role === 'bot') {
              return {
                text: randomResponse,
                role: 'bot',
                responseTime,
                timestamp: endTime,
                isStreaming: false,
              };
            }
            return msg;
          }),
        );

        setContextPercent(43.7); // Fake context percentage
        setLoading(false);
        if (setCallLLMStartTime) {
          setCallLLMStartTime(null);
        }
      }
    };

    // Start streaming after a brief delay
    setTimeout(streamWords, 3000 + Math.random() * 500);

    return;
  }

  // Original local functionality
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
      l.map((msg) => {
        if (msg.timestamp === botMessageId && msg.role === 'bot') {
          return {
            ...msg,
            text: data.fullResponse,
            isStreaming: false,
            responseTime,
            timestamp: endTime,
          };
        }
        return msg;
      }),
    );

    if (data.contextPercent !== undefined) {
      setContextPercent(Number(data.contextPercent));
    }

    setLoading(false);
    if (setCallLLMStartTime) {
      setCallLLMStartTime(null);
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
    if (setCallLLMStartTime) {
      setCallLLMStartTime(null);
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
      body: JSON.stringify({ msg: userMsg, userId, coachOrChat }),
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
      if (setCallLLMStartTime) {
        setCallLLMStartTime(null);
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
    if (setCallLLMStartTime) {
      setCallLLMStartTime(null);
    }

    // Clean up listeners
    socket.off('chat-chunk', handleChatChunk);
    socket.off('chat-complete', handleChatComplete);
    socket.off('chat-error', handleChatError);
  }
}

export async function deleteMessages(userId) {
  // Check if running locally or on netlify
  if (!window.isLocal) {
    // Fake successful deletion for netlify deploy
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({ success: true, message: 'Messages deleted successfully (demo mode)' });
      }, 500); // Small delay to simulate network request
    });
  }

  // Original local functionality
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
