import { getRelevantMessages } from '../Models/ChatMemory.js';

export async function buildPromptWithMemory({ userId, userInput }) {
  // Get relevant previous messages as an array of { role, content }
  const memories = await getRelevantMessages({ userId, inputText: userInput });
  return memories;
}
