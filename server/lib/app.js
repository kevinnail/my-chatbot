import express from 'express';
import cors from 'cors';
import chatRouter from './controllers/chat.js';
import notFound from './middleware/not-found.js';
import errorHandler from './middleware/error.js';

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

// Use the imported router
app.use('/api/chat', chatRouter);

app.use(notFound);
app.use(errorHandler);

export default app;

