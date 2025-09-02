import ChatMemory from '../models/ChatMemory.js';

export async function buildPromptWithMemory({ userId, userInput }) {
  // Get both relevant and recent messages, sorted chronologically
  const memories = await ChatMemory.getHybridMessages({
    userId,
    inputText: userInput,
    relevantLimit: 10,
    recentLimit: 10,
  });

  // Remove timestamp for the LLM (unless you want to include it)
  return memories.map(({ role, content }) => ({ role, content }));
}

// Alternative: Include timestamp context for the LLM
export async function buildPromptWithMemoryAndTime({ userId, userInput }) {
  const memories = await ChatMemory.getHybridMessages({
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
