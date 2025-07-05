import express from 'express';
import cors from 'cors';
import chatController from './controllers/chat.js';
import notFound from './middleware/not-found.js';
import errorHandler from './middleware/error.js';

const app = express();
app.use(cors());
app.use(express.json());

// Temporary: /api/chat route will be moved to controllers
app.use('/api/chat', chatController);

app.use(notFound);
app.use(errorHandler);

export default app; 