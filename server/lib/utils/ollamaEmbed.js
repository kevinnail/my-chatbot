export async function getEmbedding(input) {
  const startTime = performance.now();
  console.log('Starting embedding generation...');

  try {
    const res = await fetch('http://localhost:11434/api/embed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'mxbai-embed-large',
        input,
        keep_alive: '60m',
      }),
    });
    if (!res.ok) {
      throw new Error(`Ollama embedding API error: ${res.status} ${res.statusText}`);
    }

    const data = await res.json();

    // Check different possible response formats
    let embedding;
    if (data.embeddings && data.embeddings[0]) {
      embedding = data.embeddings[0];
    } else if (data.embedding) {
      embedding = data.embedding;
    } else if (Array.isArray(data)) {
      embedding = data;
    } else {
      console.error('Unexpected Ollama embedding response:', data);
      throw new Error('Invalid embedding response format');
    }

    // Ensure it's an array of numbers
    if (!Array.isArray(embedding)) {
      throw new Error('Embedding is not an array');
    }

    const endTime = performance.now();
    const duration = ((endTime - startTime) / 1000).toFixed(3);
    console.log(`✅ Embedding generation completed in ${duration} seconds`);

    // Convert array to PostgreSQL vector format: [0.1, 0.2, 0.3]
    return `[${embedding.join(',')}]`;
  } catch (error) {
    const endTime = performance.now();
    const duration = ((endTime - startTime) / 1000).toFixed(3);
    console.error(`❌ Embedding generation failed after ${duration} seconds:`, error);
    throw error;
  }
}
