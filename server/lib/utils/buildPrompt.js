import { getRelevantMessages } from '../Models/ChatMemory.js';

export async function buildPromptWithMemory({ userId, userInput }) {
  const memories = await getRelevantMessages({ userId, inputText: userInput });

  const memorySection = memories.map((m, i) =>
    `Memory ${i + 1} (${m.role}): ${m.content.trim()}`
  ).join('\n\n');

  const prompt = `
Here are some previous context clues:

${memorySection}

Now respond to this prompt:
"${userInput}"
`;

  return prompt;
}
