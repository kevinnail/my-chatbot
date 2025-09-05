import 'dotenv/config';
import { createServer } from 'http';
import { Server } from 'socket.io';
import app from './lib/app.js';

const API_URL = process.env.API_URL || 'http://localhost';
const PORT = process.env.PORT || 4000;

// Create HTTP server
const server = createServer(app);

// Setup Socket.IO
const io = new Server(server, {
  cors: {
    origin: ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:4000'],
    credentials: true,
  },
});

// Make Socket.IO available to the app
app.set('io', io);

// Socket.IO connection handler
io.on('connection', (socket) => {
  console.log('Client connected for real-time updates');

  socket.on('join-sync-updates', (userId) => {
    socket.join(`sync-updates-${userId}`);
    console.log(` Client joined sync updates for user ${userId}`);
  });

  socket.on('join-chat', (userId) => {
    socket.join(`chat-${userId}`);
    console.log(`💬 Client joined chat for user ${userId}`);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
});

server.listen(PORT, () => {
  console.info(`🚀  Server started on ${API_URL}:${PORT}`);
  console.info(`📡  Socket.IO enabled for real-time updates`);
});

// Placeholder for pool import and graceful shutdown
// import pool from './lib/utils/pool.js';
// process.on('exit', () => {
//   console.info('👋  Goodbye!');
//   pool.end();
// });
