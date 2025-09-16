import { io } from 'socket.io-client';
import * as chatApi from './chatApi';

export class ChatManager {
  constructor() {
    this.socket = null;
    this.stopPressed = false;
    this.eventHandlers = new Map();
  }

  getSocket() {
    if (!this.socket) {
      if (window.isLocal) {
        this.socket = io('http://localhost:4000');
        this.socket.on('connect', () => {});
        this.socket.on('disconnect', () => {});
        this.socket.on('connect_error', (error) => {
          console.error('WebSocket connection error:', error);
        });
      } else {
        // Mock socket for demo
        this.socket = {
          on: () => {},
          emit: () => {},
          disconnect: () => {},
          off: () => {},
        };
      }
    }
    return this.socket;
  }

  setStopPressed(value) {
    this.stopPressed = value;
  }

  // Clean up event listeners for a specific message
  cleanupListeners(messageId) {
    const handlers = this.eventHandlers.get(messageId);
    if (handlers) {
      const socket = this.getSocket();
      socket.off('chat-chunk', handlers.chunk);
      socket.off('chat-complete', handlers.complete);
      socket.off('chat-error', handlers.error);
      socket.off('chat-stopped', handlers.stopped);
      this.eventHandlers.delete(messageId);
    }
  }

  // Set up WebSocket listeners for streaming
  setupStreamingListeners({ messageId, userId, onChunk, onComplete, onError, onStopped }) {
    const socket = this.getSocket();

    const handlers = {
      chunk: (data) => {
        if (data.messageId === messageId) {
          onChunk(data);
        } else {
          console.info('messageId mismatch, ignoring chunk');
        }
      },
      complete: (data) => {
        if (data.messageId === messageId) {
          onComplete(data);
          this.cleanupListeners(messageId);
        } else {
          console.info('messageId mismatch, ignoring complete');
        }
      },
      error: (data) => {
        if (data.messageId === messageId) {
          onError(data);
          this.cleanupListeners(messageId);
        } else {
          console.info('messageId mismatch, ignoring error');
        }
      },
      stopped: (data) => {
        if (data.messageId === messageId) {
          onStopped(data);
          this.cleanupListeners(messageId);
        } else {
          console.info('messageId mismatch, ignoring stopped');
        }
      },
    };

    this.eventHandlers.set(messageId, handlers);

    socket.emit('join-sync-updates', userId);
    socket.emit('join-chat', userId);
    socket.on('chat-chunk', handlers.chunk);
    socket.on('chat-complete', handlers.complete);
    socket.on('chat-error', handlers.error);
    socket.on('chat-stopped', handlers.stopped);
    console.info('WebSocket event listeners set up successfully');
  }

  async sendMessage({
    userId,
    input,
    image,
    coachOrChat,
    chatId,
    onUserMessage,
    onBotMessageStart,
    onBotMessageChunk,
    onBotMessageComplete,
    onBotMessageError,
    onLoadingChange,
    onContextPercentChange,
    onCallLLMStartTimeChange,
    refreshChatList,
  }) {
    if (!input.trim()) return;

    const userMsg = input;
    const startTime = Date.now();
    const messageId = Date.now();

    // Add user message
    onUserMessage(userMsg, startTime);

    // Reset stop state
    this.stopPressed = false;

    // Handle demo mode
    if (!window.isLocal) {
      return this.handleDemoMode({
        userMsg,
        startTime,
        messageId,
        coachOrChat,
        onBotMessageStart,
        onBotMessageChunk,
        onBotMessageComplete,
        onLoadingChange,
        onContextPercentChange,
        onCallLLMStartTimeChange,
      });
    }

    // Add streaming placeholder
    onBotMessageStart(messageId);

    // Set up streaming listeners
    this.setupStreamingListeners({
      messageId,
      userId,
      onChunk: (data) => {
        onBotMessageChunk(messageId, data.fullResponse);
      },
      onComplete: async (data) => {
        const endTime = Date.now();
        const responseTime = endTime - startTime;

        onBotMessageComplete(messageId, {
          text: data.fullResponse,
          responseTime,
          timestamp: endTime,
        });

        if (data.contextPercent !== undefined) {
          onContextPercentChange(Number(data.contextPercent));
        }

        onLoadingChange(false);
        if (onCallLLMStartTimeChange) {
          onCallLLMStartTimeChange(null);
        }

        // Handle title generation
        try {
          const { hasTitle } = await chatApi.checkChatTitle({ chatId: data.chatId, userId });
          if (!hasTitle) {
            await chatApi.summarizeChat({ prompt: userMsg, chatId: data.chatId, userId });
            if (refreshChatList) {
              refreshChatList();
            }
          }
        } catch (error) {
          console.error('Error handling title generation:', error);
        }
      },
      onError: (data) => {
        if (this.stopPressed) {
          onBotMessageError(messageId, null, true); // isStopped = true
        } else {
          onBotMessageError(messageId, data.error || 'Streaming error occurred', false);
        }

        onLoadingChange(false);
        if (onCallLLMStartTimeChange) {
          onCallLLMStartTimeChange(null);
        }
      },
      onStopped: () => {
        this.stopPressed = true;
        onBotMessageError(messageId, null, true); // isStopped = true
        onLoadingChange(false);
        if (onCallLLMStartTimeChange) {
          onCallLLMStartTimeChange(null);
        }
      },
    });

    try {
      const data = await chatApi.sendChatMessage({
        msg: userMsg,
        userId,
        coachOrChat,
        chatId,
        messageId,
        image,
      });

      if (data.stopped) {
        onBotMessageError(messageId, null, true); // isStopped = true
        onLoadingChange(false);
        if (onCallLLMStartTimeChange) {
          onCallLLMStartTimeChange(null);
        }
        return;
      }

      if (!data.streaming) {
        // Handle non-streaming response
        const endTime = Date.now();
        const responseTime = endTime - startTime;

        onBotMessageComplete(messageId, {
          text: data.bot,
          responseTime,
          timestamp: endTime,
        });

        if (data.context_percent !== undefined && data.context_percent !== null) {
          onContextPercentChange(Number(data.context_percent));
        }

        onLoadingChange(false);
        if (onCallLLMStartTimeChange) {
          onCallLLMStartTimeChange(null);
        }

        this.cleanupListeners(messageId);
      }
    } catch (error) {
      console.error('Error sending message:', error);

      onBotMessageError(
        messageId,
        error.message || 'Unable to get response from server. Please try again.',
        false,
      );
      onLoadingChange(false);
      if (onCallLLMStartTimeChange) {
        onCallLLMStartTimeChange(null);
      }

      this.cleanupListeners(messageId);
    }
  }

  handleDemoMode({
    _userMsg,
    startTime,
    messageId,
    coachOrChat,
    onBotMessageStart,
    onBotMessageChunk,
    onBotMessageComplete,
    onLoadingChange,
    onContextPercentChange,
    onCallLLMStartTimeChange,
  }) {
    onBotMessageStart(messageId);

    const fakeResponse =
      coachOrChat === 'chat'
        ? "Hey Dude, I'm your senior software engineer assistant - demo version running right now. In the local version, I can tackle your React, Express, and Node.js challenges with production-ready solutions.\n\n**What I do:**\n\n• Debug complex issues and optimize performance\n\n• Write maintainable, secure code following best practices\n\n• Handle authentication, APIs, database integration\n\n• Provide testing strategies and deployment guidance\n\n\n**Current setup** - here's the Ollama API call from our Express route:\n\n```javascript\nconst response = await fetch(`${process.env.OLLAMA_URL}/api/chat`, {\n  method: 'POST',\n  headers: { 'Content-Type': 'application/json' },\n  body: JSON.stringify({\n    model: process.env.OLLAMA_MODEL,\n    messages,\n    keep_alive: '60m',\n    options: {\n      min_p: 0.05,\n      temperature: 0.2,\n      top_p: 0.9,\n      mirostat: 0,\n      repeat_penalty: 1.05,\n      top_k: 40,\n     },\n    stream: true,\n  }),\n  signal: controller.signal,\n  headersTimeout: 12000000, \n  bodyTimeout: 12000000,\n});\n```\n\n**Remember:** I'll be direct and technical- no hand-holding. If I don't know something, I'll tell you straight up. What coding problem can I help you solve?"
        : 'Hey Dude, I\'m JobCoachDude - your career coach for landing that next web dev role! This is the demo version, but in the local version, I can help you nail your job search strategy.\n\n**Top Move:** Optimize your LinkedIn profile - it\'s your digital storefront and the first thing recruiters see.\n\n**Why it matters:**\n• 87% of recruiters use LinkedIn to find candidates\n• A strong profile gets you 5x more connection requests\n• Your headline alone determines if they click or scroll past\n\n**Steps to dominate LinkedIn:**\n1. Write a headline that screams your value (not just "Software Developer")\n2. Craft an About section that tells your story in 3-4 short paragraphs\n3. Add 3-5 recent projects with impact metrics\n4. Post weekly about your coding journey or industry insights\n5. Connect with 10 people in your target companies each week\n\n**Next Step:** Update your LinkedIn headline right now with your main tech stack + the value you bring (e.g., "React Developer | Building scalable web apps that boost user engagement by 40%")\n\nRemember Dude - the job search is a numbers game mixed with strategy. I can help you with resume bullets, cover letter templates, interview prep, salary negotiation, and weekly action plans. What\'s your biggest job search challenge right now?';

    const words = fakeResponse.split(' ');
    let currentText = '';
    let wordIndex = 0;

    const streamWords = () => {
      if (wordIndex < words.length) {
        currentText += (wordIndex > 0 ? ' ' : '') + words[wordIndex];
        wordIndex++;
        onBotMessageChunk(messageId, currentText);
        setTimeout(streamWords, 50 + Math.random() * 100);
      } else {
        const endTime = Date.now();
        const responseTime = endTime - startTime;

        onBotMessageComplete(messageId, {
          text: fakeResponse,
          responseTime,
          timestamp: endTime,
        });

        onContextPercentChange(43.7);
        onLoadingChange(false);
        if (onCallLLMStartTimeChange) {
          onCallLLMStartTimeChange(null);
        }
      }
    };

    setTimeout(streamWords, 3000 + Math.random() * 500);
  }

  async deleteMessages(userId) {
    if (!window.isLocal) {
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve({ success: true, message: 'Messages deleted successfully (demo mode)' });
        }, 500);
      });
    }

    return chatApi.deleteUserMessages(userId);
  }

  disconnect() {
    if (this.socket && this.socket.disconnect) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.eventHandlers.clear();
  }
}
