import ChatMemory from '../models/ChatMemory.js';

export async function buildPromptWithMemory({ chatId, userId, userInput }) {
  // Get recent messages first (most important for context continuity)
  const recentMessages = await ChatMemory.getRecentMessages({ chatId, userId, limit: 12 });

  // Get more relevant messages to supplement context
  const relevantMessages = await ChatMemory.getRelevantMessages({
    chatId,
    userId,
    inputText: userInput,
    limit: 8,
  });

  // Prioritize recent messages, then add relevant ones that aren't duplicates
  const combined = [...recentMessages];
  for (const msg of relevantMessages) {
    if (!combined.some((existing) => existing.content === msg.content)) {
      combined.push(msg);
    }
  }

  // Sort chronologically to maintain conversation flow
  const memories = combined.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  // Remove timestamp for the LLM
  return memories.map(({ role, content }) => ({ role, content }));
}

// Alternative: Include timestamp context for the LLM
export async function buildPromptWithMemoryAndTime({ chatId, userId, userInput }) {
  const memories = await ChatMemory.getHybridMessages({
    chatId,
    userId,
    inputText: userInput,
    relevantLimit: 10,
    recentLimit: 10,
  });

  // Include relative time context
  const now = new Date();
  return memories.map(({ role, content, timestamp }) => {
    const timeAgo = Math.floor((now - new Date(timestamp)) / (1000 * 60)); // minutes ago
    const timeContext = timeAgo < 60 ? `${timeAgo}m ago` : `${Math.floor(timeAgo / 60)}h ago`;

    return {
      role,
      content: `[${timeContext}] ${content}`,
    };
  });
}
