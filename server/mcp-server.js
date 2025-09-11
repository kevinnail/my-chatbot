import 'dotenv/config';
import express from 'express';
import { randomUUID } from 'node:crypto';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { createCalendarEvent } from './lib/utils/emailAnalysis.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';

const app = express();
app.use(express.json());

// Map to store transports by session ID
const transports = {};

// Create and configure MCP server
function createServer() {
  const server = new McpServer({
    name: 'mcp-server',
    version: '1.0.0',
  });

  server.tool(
    'create_calendar_event',
    'Create a calendar event for appointments, meetings, interviews',
    {
      title: z.string().describe('Event title'),
      startDateTime: z.string().describe('Start time in ISO 8601 format'),
      endDateTime: z.string().describe('End time in ISO 8601 format'),
      description: z.string().optional().describe('Event description'),
      location: z.string().optional().describe('Event location'),
      attendees: z.array(z.string()).optional().describe('Attendee emails'),
      userId: z.string().optional().describe('User ID'),
    },
    async (args) => {
      try {
        const userId = args.userId;
        const result = await createCalendarEvent(userId, args, args.title, 'MCP Server');
        return {
          content: [
            {
              type: 'text',
              text: `Calendar event created: ${result?.htmlLink || 'Success'}`,
              calendarEvent: args.title,
              eventLink: result?.htmlLink,
            },
          ],
        };
      } catch (error) {
        console.error('Calendar creation failed:', error);
        return {
          content: [
            {
              type: 'text',
              text: `Failed to create calendar event: ${error.message}`,
            },
          ],
        };
      }
    },
  );

  return server;
}

app.post('/mcp', async (req, res) => {
  const sessionId = req.headers['mcp-session-id'];
  let transport;
  if (sessionId && transports[sessionId]) {
    // Reuse existing session
    transport = transports[sessionId];
  } else {
    // New initialization
    transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (id) => {
        transports[id] = transport;
      },
      enableDnsRebindingProtection: true,
      allowedHosts: ['127.0.0.1', 'localhost:3001'],
    });

    const server = createServer();
    await server.connect(transport);

    // Clean up when closed
    transport.onclose = () => {
      if (transport.sessionId) {
        delete transports[transport.sessionId];
      }
    };
  }

  await transport.handleRequest(req, res, req.body);
});

app.get('/mcp', async (req, res) => {
  const sessionId = req.headers['mcp-session-id'];
  if (!sessionId || !transports[sessionId]) {
    res.status(400).send('Invalid or missing session ID');
    return;
  }

  const transport = transports[sessionId];
  await transport.handleRequest(req, res);
});

// Start the server
const PORT = 4001;
app.listen(PORT, (error) => {
  if (error) {
    console.error('Failed to start MCP server:', error);
    process.exit(1);
  }
  console.log(`MCP HTTP Server listening on port ${PORT}`);
});
