import express from 'express';
import cors from 'cors';
import chatRouter from './controllers/chat.js';
import gmailMcpRouter from './controllers/gmail.js';
import googleCalendarRouter from './controllers/googleCalendar.js';
import notFound from './middleware/not-found.js';
import errorHandler from './middleware/error.js';
import users from './controllers/users.js';

const app = express();
app.use(
  cors({
    origin: ['http://localhost:3000', 'http://localhost:3001'],
    credentials: true,
    exposedHeaders: ['Mcp-Session-Id'],
    allowedHeaders: ['Content-Type', 'Mcp-Session-Id'],
  }),
);
app.use(express.json());

// Use the imported routers
app.use('/api/users', users);
app.use('/api/chatbot', chatRouter);
app.use('/api/gmail', gmailMcpRouter);
app.use('/api/calendar', googleCalendarRouter);

app.use(notFound);
app.use(errorHandler);

export default app;
