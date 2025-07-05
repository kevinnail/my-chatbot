import express from 'express';
import cors from 'cors';

const app = express();
app.use(
    cors({
      origin: [
        'http://localhost:3000',
      ],
      credentials: true,
    })
  );
app.use(express.json());

// Temporary: /api/chat route will be moved to controllers
app.use('/api/chat', require('./controllers/chat.js'));

app.use(require('./middleware/not-found'));
app.use(require('./middleware/error'));

module.exports = app;

