import { Router } from 'express';
import { buildPromptWithMemory } from '../utils/buildPrompt.js';
import ChatMemory from '../models/ChatMemory.js';
import { careerCoach, codingAssistant } from '../utils/chatPrompts.js';

const router = Router();

// Store active AbortControllers for stop functionality
const activeControllers = new Map();

export function countTokens(messages) {
  // Very rough estimate: 1 token ≈ 4 characters in English
  return messages.reduce((acc, msg) => acc + Math.ceil(msg.content.length / 4), 0);
}

router.post('/', async (req, res) => {
  try {
    const { msg, userId, coachOrChat, chatId } = req.body;
    // Generate chatId if not provided (for new chats)
    const currentChatId = chatId || `${userId}_${Date.now()}`;

    // Get memories BEFORE storing current message (to avoid including current message in context)
    const memories = await buildPromptWithMemory({ chatId: currentChatId, userId, userInput: msg });

    // Store the user message AFTER getting memories
    await ChatMemory.storeMessage({ chatId: currentChatId, userId, role: 'user', content: msg });
    // Get Socket.IO instance
    const io = req.app.get('io');

    const systemPrompt = coachOrChat === 'coach' ? careerCoach : codingAssistant;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...memories,
      { role: 'user', content: msg },
    ];

    // Create AbortController for timeout handling - reduced to 5 minutes
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1200000); // 20 minute timeout

    // Store controller for stop functionality
    const controllerKey = `${userId}_${currentChatId}`;
    activeControllers.set(controllerKey, controller);
    console.log('Chat request - stored controller with key:', controllerKey);
    // eslint-disable-next-line no-console
    console.log('calling LLM...');
    const response = await fetch(`${process.env.OLLAMA_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: process.env.OLLAMA_MODEL,
        messages,
        keep_alive: '60m',
        // tools: availableTools,  //^ maybe add a helper for questions on coding?
        options: {
          min_p: 0.05,
          temperature: 0.2,
          top_p: 0.9,
          mirostat: 0,
          repeat_penalty: 1.05,
          top_k: 40,
          // optional settings for coding
          // min_p: 0.9,
          // temperature: 0.2,
          // top_p: 1,
          // mirostat: 0,
          // repeat_penalty: 1.05,
          // top_k: 40,
        },
        stream: true,
      }),
      signal: controller.signal,
      // Configure undici timeouts to prevent race condition
      // Set headers timeout to match our AbortController timeout

      // These are undici-specific options
      headersTimeout: 12000000, // 20 minutes - same as AbortController
      bodyTimeout: 12000000, // 20 minutes - same as AbortController
    });
    // Clear the timeout since we got a response
    clearTimeout(timeoutId);

    // Check if response is ok before processing
    if (!response.ok) {
      const errorText = await response.text();
      console.error('LLM API error:', response.status, errorText);
      io.to(`chat-${userId}`).emit('chat-error', {
        error: `LLM server error: ${response.status} - ${errorText}`,
      });
      return;
    }

    // Handle streaming response via WebSocket
    let fullResponse = '';
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let chunkCount = 0;
    const maxChunks = 10000; // Safety limit to prevent infinite loops
    let hasReceivedContent = false;

    // Send initial response to confirm request received
    res.json({ streaming: true, message: 'Streaming response via WebSocket' });

    try {
      while (chunkCount < maxChunks) {
        const { done, value } = await reader.read();
        if (done) break;

        chunkCount++;
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter((line) => line.trim());

        for (const line of lines) {
          try {
            const data = JSON.parse(line);

            // Check for error responses from LLM
            if (data.error) {
              console.error('LLM streaming error:', data.error);
              io.to(`chat-${userId}`).emit('chat-error', {
                error: `LLM error: ${data.error}`,
              });
              return;
            }

            if (data.message && data.message.content) {
              const content = data.message.content;
              fullResponse += content;
              hasReceivedContent = true;

              // Emit streaming chunk via WebSocket
              io.to(`chat-${userId}`).emit('chat-chunk', {
                content,
                fullResponse,
                done: false,
              });
            }

            if (data.done) {
              // Validate we received some content
              if (!hasReceivedContent) {
                console.error('Stream completed but no content received');
                io.to(`chat-${userId}`).emit('chat-error', {
                  error: 'No response content received from LLM',
                });
                return;
              }

              // Store the complete response
              await ChatMemory.storeMessage({
                chatId: currentChatId,
                userId,
                role: 'bot',
                content: fullResponse,
              });

              // Calculate context percentage
              const allMessages = await ChatMemory.getAllMessages({
                chatId: currentChatId,
                userId,
              });
              const allMessagesWithSystem = [
                { role: 'system', content: systemPrompt },
                ...allMessages,
              ];
              const totalTokens = countTokens(allMessagesWithSystem);
              const contextPercent = Math.min(100, (totalTokens / 128000) * 100).toFixed(4);

              // Emit completion via WebSocket
              io.to(`chat-${userId}`).emit('chat-complete', {
                fullResponse,
                contextPercent,
                chatId: currentChatId,
                done: true,
              });

              // Clean up controller
              activeControllers.delete(controllerKey);
              return;
            }
          } catch (parseError) {
            console.error('Error parsing streaming chunk:', parseError, 'Line:', line);
            // Continue processing other lines instead of failing completely
          }
        }
      }

      // If we exit the loop without done=true, something went wrong
      if (chunkCount >= maxChunks) {
        console.error('Stream processing hit safety limit');
        io.to(`chat-${userId}`).emit('chat-error', {
          error: 'Response too long - processing stopped for safety',
        });
      } else if (!hasReceivedContent) {
        console.error('Stream ended without content');
        io.to(`chat-${userId}`).emit('chat-error', {
          error: 'No response content received from LLM',
        });
      }
    } catch (streamError) {
      console.error('Error reading stream:', streamError);
      io.to(`chat-${userId}`).emit('chat-error', {
        error: 'Streaming error occurred',
      });
    } finally {
      // Ensure reader is always closed
      try {
        reader.releaseLock();
      } catch (e) {
        console.error('Reader already closed', e);
        // Reader might already be released
      }
    }
  } catch (error) {
    console.error('Error in chat controller:', error);

    // More comprehensive timeout error handling
    if (error.name === 'AbortError') {
      // Check if this was a user-initiated stop (controller was deleted)
      const { userId: errorUserId, chatId: errorChatId } = req.body;
      const controllerKey = `${errorUserId}_${errorChatId || `${errorUserId}_${Date.now()}`}`;
      if (!activeControllers.has(controllerKey)) {
        // This was a user stop, don't show timeout error
        return res.status(200).json({ stopped: true });
      }
      return res.status(408).json({
        error: 'Request timed out - LLM is taking too long to respond. Please try again.',
      });
    }

    // Handle various timeout-related errors
    if (
      error.cause &&
      (error.cause.code === 'UND_ERR_HEADERS_TIMEOUT' ||
        error.cause.code === 'UND_ERR_CONNECT_TIMEOUT' ||
        error.cause.code === 'UND_ERR_RESPONSE_TIMEOUT')
    ) {
      return res.status(408).json({
        error:
          'Connection timeout - LLM server is not responding quickly enough. Please try again.',
      });
    }

    // Handle general fetch failures that might be timeout-related
    if (error.message === 'fetch failed' && error.cause) {
      return res.status(408).json({
        error: 'Connection failed - LLM server is not responding. Please try again.',
      });
    }

    // Handle other timeout indicators
    if (
      error.message.toLowerCase().includes('timeout') ||
      error.name.toLowerCase().includes('timeout')
    ) {
      return res.status(408).json({
        error: 'Request timed out. Please try again.',
      });
    }

    // Default error handling
    return res.status(500).json({ error: error.message });
  }
});

router.get('/list/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const chatList = await ChatMemory.getChatList(userId);
    res.json(chatList);
  } catch (error) {
    console.error('Error in get chat list controller:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/messages/:userId/:chatId', async (req, res) => {
  try {
    const { userId, chatId } = req.params;
    const messages = await ChatMemory.getAllMessages({ chatId, userId });
    res.json(messages);
  } catch (error) {
    console.error('Error in get chat messages controller:', error);
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    await ChatMemory.deleteUserMessages({ userId });
    res.json({ message: 'All messages deleted successfully' });
  } catch (error) {
    console.error('Error in delete chat controller:', error);
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:userId/:chatId', async (req, res) => {
  try {
    const { userId, chatId } = req.params;
    await ChatMemory.deleteChatMessages({ chatId, userId });
    res.json({ message: 'Chat deleted successfully' });
  } catch (error) {
    console.error('Error in delete specific chat controller:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/has-title', async (req, res) => {
  try {
    const { chatId, userId } = req.body;
    const hasTitle = await ChatMemory.hasTitle({ chatId, userId });
    res.json({ hasTitle });
  } catch (error) {
    console.error('Error in has-title controller:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/summarize', async (req, res) => {
  try {
    const { prompt, chatId, userId } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    if (!process.env.OLLAMA_SMALL_MODEL) {
      return res.status(500).json({ error: 'OLLAMA_SMALL_MODEL not configured' });
    }
    performance.mark('summarize-start');
    // eslint-disable-next-line no-console
    console.log('summarizing title creation START ==============');
    const response = await fetch(`${process.env.OLLAMA_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: process.env.OLLAMA_MODEL,
        messages: [
          {
            role: 'system',
            content: `
            Your goal is to summarize the user's prompt into a short title for the ensuing chat.
            You are a title generator. 
            Return only ONE sentence, max 20 words, max 150 characters. 
            Do not add explanations or commentary. 
            
            
            `,
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        options: {
          min_p: 0,
          temperature: 0.2,
          top_p: 0.7,
          mirostat: 0,
          repeat_penalty: 1.05,
          top_k: 20,
          keep_alive: '10m',
        },
        stream: false,
      }),
    });
    performance.mark('summarize-end');
    // eslint-disable-next-line no-console
    console.log('summarizing title creation END ==============');
    performance.measure('summarize', 'summarize-start', 'summarize-end');
    // eslint-disable-next-line no-console
    console.log(
      'summarize time',
      performance.getEntriesByType('measure')[0].duration / 1000 + ' seconds',
    );
    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status}`);
    }

    const data = await response.json();
    const summary = data.message.content;
    // Store the summary as title in the database
    if (chatId && userId) {
      await ChatMemory.updateChatTitle({ chatId, userId, title: summary });
    }

    res.json({ summary });
  } catch (error) {
    console.error('Error in summarize controller:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/stop', async (req, res) => {
  try {
    const { userId, chatId } = req.body;

    if (!userId || !chatId) {
      return res.status(400).json({ error: 'userId and chatId are required' });
    }

    // Get Socket.IO instance
    const io = req.app.get('io');

    // Find and abort the active controller
    const controllerKey = `${userId}_${chatId}`;
    const controller = activeControllers.get(controllerKey);

    console.log('Stop request - controllerKey:', controllerKey);
    console.log('Stop request - active controllers:', Array.from(activeControllers.keys()));
    console.log('Stop request - found controller:', !!controller);

    if (controller) {
      controller.abort();
      activeControllers.delete(controllerKey);
    }

    // Call Ollama stop endpoint
    try {
      await fetch(`${process.env.OLLAMA_URL}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: process.env.OLLAMA_MODEL,
          prompt: '',
          stream: false,
          options: { stop: true },
        }),
      });
    } catch (ollamaError) {
      console.error('Error calling Ollama stop:', ollamaError);
    }

    // Emit stop signal via WebSocket
    io.to(`chat-${userId}`).emit('chat-stopped', {
      chatId,
      message: 'Generation stopped by user',
    });

    res.json({ message: 'Stop signal sent successfully' });
  } catch (error) {
    console.error('Error in stop controller:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
