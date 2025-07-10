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
  return data.embedding; // array of 1024 floats
}
