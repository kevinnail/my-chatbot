// server/server.js
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';

const app = express();
app.use(cors());
app.use(express.json());

app.post('/api/chat', async (req, res) => {
    
  const { user } = req.body;

const response = await fetch(`${process.env.OLLAMA_URL}/api/generate`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model: process.env.OLLAMA_MODEL,
    prompt: user,
system: 'You are a coding expert and understand web development on the level of a senior engineer and play the role of coding assistant.  You specialize in the React/ Express/ Node.',
    options: {
      temperature: 2,
      top_p: 0.9,
      repeat_penalty: 1.1,
      // stop: ['You:']
    },
        stream: false
    })
  });

  const data = await response.json();
  res.json({ bot: data.response.trim() });
});

app.listen(process.env.PORT, () =>
  console.log(`API on :${process.env.PORT}`)
);
