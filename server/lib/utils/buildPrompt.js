import ChatMemory from '../models/ChatMemory.js';

// Memory configuration following industry best practices
const MEMORY_CONFIG = {
  // Sliding window: guaranteed recent messages for conversational continuity
  GUARANTEED_RECENT: 20, // Increased from 12 to ensure better context continuity

  // Semantic retrieval: relevant messages from deeper history
  SEMANTIC_RELEVANT: 10, // Slightly increased from 8

  // Maximum total messages to prevent token overflow
  MAX_TOTAL_MESSAGES: 25,

  // Recency bias: how much to weight recent messages in relevance scoring
  RECENCY_BIAS_HOURS: 2, // Messages within 2 hours get relevance boost

  // Conversation boundary: time gap that indicates topic change
  CONVERSATION_BOUNDARY_MINUTES: 30,
};

export async function buildPromptWithMemory({ chatId, userId, userInput }) {
  // Industry best practice: Sliding window with guaranteed recent context
  // This ensures conversational continuity even with topic changes
  const recentMessages = await ChatMemory.getRecentMessages({
    chatId,
    userId,
    limit: MEMORY_CONFIG.GUARANTEED_RECENT,
  });

  // Get semantically relevant messages with recency bias
  const relevantMessages = await ChatMemory.getRelevantMessages({
    chatId,
    userId,
    inputText: userInput,
    limit: MEMORY_CONFIG.SEMANTIC_RELEVANT,
  });

  // Apply industry best practice: Hybrid retrieval with recency bias
  const combined = [...recentMessages];
  const now = new Date();

  for (const msg of relevantMessages) {
    // Avoid duplicates
    if (combined.some((existing) => existing.content === msg.content)) {
      continue;
    }

    // Apply recency bias: recent messages get priority even if less semantically relevant
    const messageAge = (now - new Date(msg.timestamp)) / (1000 * 60 * 60); // hours
    const isRecentlyRelevant = messageAge <= MEMORY_CONFIG.RECENCY_BIAS_HOURS;

    // Add relevant message if we have space or if it's recently relevant
    if (combined.length < MEMORY_CONFIG.MAX_TOTAL_MESSAGES || isRecentlyRelevant) {
      combined.push(msg);
    }
  }

  // Limit total messages to prevent token overflow
  const limitedMessages = combined.slice(-MEMORY_CONFIG.MAX_TOTAL_MESSAGES);

  // Sort chronologically to maintain conversation flow
  const memories = limitedMessages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  // Industry best practice: Conversation boundary detection
  const processedMemories = addConversationBoundaries(memories);

  // Remove timestamp for the LLM (clean interface)
  return processedMemories.map(({ role, content }) => ({ role, content }));
}

// Industry best practice: Detect conversation boundaries and add context refreshers
function addConversationBoundaries(memories) {
  if (memories.length <= 1) return memories;

  const processedMemories = [];
  let previousTimestamp = null;

  for (let i = 0; i < memories.length; i++) {
    const message = memories[i];
    const currentTimestamp = new Date(message.timestamp);

    // Check for conversation boundary (significant time gap)
    if (previousTimestamp) {
      const timeDiffMinutes = (currentTimestamp - previousTimestamp) / (1000 * 60);

      // If there's a significant gap, add a context refresher
      if (timeDiffMinutes > MEMORY_CONFIG.CONVERSATION_BOUNDARY_MINUTES) {
        processedMemories.push({
          role: 'system',
          content: `[Context: Conversation resumed after ${Math.round(timeDiffMinutes)} minutes]`,
          timestamp: currentTimestamp,
        });
      }
    }

    processedMemories.push(message);
    previousTimestamp = currentTimestamp;
  }

  return processedMemories;
}

// Enhanced: Include timestamp context with industry best practices
export async function buildPromptWithMemoryAndTime({ chatId, userId, userInput }) {
  // Re-fetch with timestamps for time-aware processing
  const recentMessages = await ChatMemory.getRecentMessages({
    chatId,
    userId,
    limit: MEMORY_CONFIG.GUARANTEED_RECENT,
  });

  const relevantMessages = await ChatMemory.getRelevantMessages({
    chatId,
    userId,
    inputText: userInput,
    limit: MEMORY_CONFIG.SEMANTIC_RELEVANT,
  });

  // Combine and apply same logic as main function but preserve timestamps
  const combined = [...recentMessages];
  const now = new Date();

  for (const msg of relevantMessages) {
    if (combined.some((existing) => existing.content === msg.content)) {
      continue;
    }

    const messageAge = (now - new Date(msg.timestamp)) / (1000 * 60 * 60);
    const isRecentlyRelevant = messageAge <= MEMORY_CONFIG.RECENCY_BIAS_HOURS;

    if (combined.length < MEMORY_CONFIG.MAX_TOTAL_MESSAGES || isRecentlyRelevant) {
      combined.push(msg);
    }
  }

  const limitedMessages = combined.slice(-MEMORY_CONFIG.MAX_TOTAL_MESSAGES);
  const sortedMemories = limitedMessages.sort(
    (a, b) => new Date(a.timestamp) - new Date(b.timestamp),
  );

  // Include relative time context with conversation boundaries
  return sortedMemories.map(({ role, content, timestamp }) => {
    const timeAgo = Math.floor((now - new Date(timestamp)) / (1000 * 60)); // minutes ago
    const timeContext = timeAgo < 60 ? `${timeAgo}m ago` : `${Math.floor(timeAgo / 60)}h ago`;

    return {
      role,
      content: `[${timeContext}] ${content}`,
    };
  });
}

// Export configuration for external use and testing
export { MEMORY_CONFIG };

// Utility function to update memory configuration at runtime
export function updateMemoryConfig(newConfig) {
  Object.assign(MEMORY_CONFIG, newConfig);
}

// Utility function to get memory statistics
export function getMemoryStats(memories) {
  const now = new Date();
  const recentCount = memories.filter((msg) => {
    const ageHours = (now - new Date(msg.timestamp)) / (1000 * 60 * 60);
    return ageHours <= MEMORY_CONFIG.RECENCY_BIAS_HOURS;
  }).length;

  return {
    totalMessages: memories.length,
    recentMessages: recentCount,
    oldMessages: memories.length - recentCount,
    timeSpan:
      memories.length > 0
        ? {
            oldest: memories[0].timestamp,
            newest: memories[memories.length - 1].timestamp,
          }
        : null,
  };
}
