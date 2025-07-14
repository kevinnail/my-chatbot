import express from 'express';
import cors from 'cors';
import chatRouter from './controllers/chat.js';
import gmailMcpRouter from './controllers/gmailMcp.js';
import notFound from './middleware/not-found.js';
import errorHandler from './middleware/error.js';

const app = express();
app.use(
  cors({
    origin: ['http://localhost:3000', 'http://localhost:3001'],
    credentials: true,
  }),
);
app.use(express.json());

// Use the imported routers
app.use('/api/chat', chatRouter);
app.use('/api/mcp/gmail', gmailMcpRouter);

app.use(notFound);
app.use(errorHandler);

export default app;
