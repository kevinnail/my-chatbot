// Text chunking utility for breaking large content into manageable pieces
import { countTokens } from '../controllers/chat.js';

export function recursiveChunk(text, maxTokens = 512) {
  if (!text || text.trim().length === 0) {
    return [];
  }

  // 1. Split by double newline
  const paragraphs = text.split(/\n\n+/);
  const chunks = [];

  for (const para of paragraphs) {
    const paraTokens = countTokens([{ content: para }]);

    if (paraTokens <= maxTokens) {
      chunks.push(para.trim());
    } else {
      // 2. Split by single newline
      const lines = para.split(/\n+/);
      let current = '';

      for (const line of lines) {
        const testContent = current + (current ? '\n' : '') + line;
        if (countTokens([{ content: testContent }]) > maxTokens) {
          if (current.trim()) {
            chunks.push(current.trim());
          }
          current = line;
        } else {
          current = testContent;
        }
      }

      if (current.trim()) {
        chunks.push(current.trim());
      }

      // If we still have chunks that are too large (no newlines), split by words
      const finalChunks = [];
      for (const chunk of chunks) {
        if (countTokens([{ content: chunk }]) > maxTokens) {
          const wordChunks = splitByWords(chunk, maxTokens);
          finalChunks.push(...wordChunks);
        } else {
          finalChunks.push(chunk);
        }
      }
      chunks.length = 0;
      chunks.push(...finalChunks);
    }
  }

  return chunks.filter((chunk) => chunk.length > 0);
}

function splitByWords(text, maxTokens) {
  const words = text.split(/\s+/);
  const chunks = [];
  let current = '';

  for (const word of words) {
    const testContent = current + (current ? ' ' : '') + word;
    if (countTokens([{ content: testContent }]) > maxTokens) {
      if (current.trim()) {
        chunks.push(current.trim());
      }
      current = word;
    } else {
      current = testContent;
    }
  }

  if (current.trim()) {
    chunks.push(current.trim());
  }

  return chunks;
}

// Helper to chunk content and generate embeddings for each chunk
export async function chunkAndEmbed(content, maxTokens = 512) {
  const { getEmbedding } = await import('./ollamaEmbed.js');

  const chunks = recursiveChunk(content, maxTokens);
  const chunkedData = [];

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const embedding = await getEmbedding(chunk);

    chunkedData.push({
      chunkIndex: i,
      content: chunk,
      embedding,
      tokenCount: countTokens([{ content: chunk }]),
    });
  }

  return chunkedData;
}
