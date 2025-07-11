export async function getEmbedding(input) {
  const res = await fetch('http://localhost:11434/api/embed', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'mxbai-embed-large',
      input
    })
  });
  
  const data = await res.json();
  // Convert array to PostgreSQL vector format: [0.1, 0.2, 0.3]
  const embedding = data.embeddings[0]; // array of 1024 floats
  return `[${embedding.join(',')}]`; 
}
