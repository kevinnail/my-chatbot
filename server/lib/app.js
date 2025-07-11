import express from 'express';
import cors from 'cors';
import chatRouter from './controllers/chat.js';
import {
  getGmailStatus,
  connectGmail,
  handleGmailCallback,
  syncEmails,
} from './controllers/gmailMcp.js';
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

// Use the imported router
app.use('/api/chat', chatRouter);

// Gmail MCP routes
app.get('/api/mcp/gmail/status/:userId', getGmailStatus);
app.post('/api/mcp/gmail/connect', connectGmail);
app.get('/api/mcp/gmail/callback', handleGmailCallback);
app.post('/api/mcp/gmail/sync', syncEmails);

app.use(notFound);
app.use(errorHandler);

export default app;
