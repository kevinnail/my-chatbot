import express from 'express';
import { randomUUID } from 'node:crypto';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { createCalendarEvent } from './lib/utils/emailAnalysis.js';

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

  // Update the tool registration:
  server.registerTool(
    'create-calendar-event',
    {
      title: 'Create Calendar Event',
      description: 'Create a calendar event for appointments, meetings, interviews',
      inputSchema: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Event title' },
          startDateTime: { type: 'string', description: 'Start time in ISO format' },
          endDateTime: { type: 'string', description: 'End time in ISO format' },
          description: { type: 'string', description: 'Event description' },
          location: { type: 'string', description: 'Event location' },
          attendees: { type: 'array', items: { type: 'string' }, description: 'Attendee emails' },
        },
        required: ['title', 'startDateTime', 'endDateTime'],
      },
    },
    async (args) => {
      try {
        // Extract userId from somewhere (you'll need to pass this through)
        const userId = args.userId; // You'll need to add this to the args

        const result = await createCalendarEvent(
          userId,
          args,
          args.title, // subject
          'MCP Server', // from
        );

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

// Working MCP server using the actual MCP server but with manual response handling
app.post('/mcp', async (req, res) => {
  // console.log('📨 MCP Request received:', JSON.stringify(req.body, null, 2));

  try {
    const server = createServer();

    // Handle initialize request
    if (req.body.method === 'initialize') {
      const sessionId = randomUUID();

      // Store server instance for this session
      transports[sessionId] = server;

      res.setHeader('Mcp-Session-Id', sessionId);
      res.json({
        jsonrpc: '2.0',
        result: {
          protocolVersion: '2024-11-05',
          capabilities: { tools: {} },
          serverInfo: {
            name: 'hello-world-server',
            version: '1.0.0',
          },
        },
        id: req.body.id,
      });
      return;
    }

    // Handle other requests with session
    const sessionId = req.headers['mcp-session-id'];
    const sessionServer = transports[sessionId];

    if (!sessionServer) {
      return res.status(400).json({
        jsonrpc: '2.0',
        error: { code: -32000, message: 'No valid session' },
        id: req.body.id,
      });
    }

    // Handle notifications/initialized (no response needed)
    if (req.body.method === 'notifications/initialized') {
      res.status(200).end();
      return;
    }

    // Handle tools/list
    if (req.body.method === 'tools/list') {
      // Use the actual MCP server's registered tools
      const tools = Object.entries(sessionServer._registeredTools)
        .filter(([, tool]) => tool.enabled)
        .map(([name, tool]) => ({
          name,
          title: tool.title,
          description: tool.description,
          inputSchema: tool.inputSchema,
        }));

      res.json({
        jsonrpc: '2.0',
        result: { tools },
        id: req.body.id,
      });
      return;
    }

    // Handle tools/call
    if (req.body.method === 'tools/call') {
      const { name, arguments: args } = req.body.params;

      // Access the registered tool handler from the MCP server
      const tool = sessionServer._registeredTools[name];

      if (!tool || !tool.enabled) {
        res.json({
          jsonrpc: '2.0',
          error: { code: -32601, message: `Tool ${name} not found or disabled` },
          id: req.body.id,
        });
        return;
      }

      try {
        // Call the registered tool handler
        const result = await tool.callback(args);
        res.json({
          jsonrpc: '2.0',
          result,
          id: req.body.id,
        });
        return;
      } catch (error) {
        console.error('Tool execution error:', error);
        res.json({
          jsonrpc: '2.0',
          error: { code: -32603, message: 'Tool execution failed' },
          id: req.body.id,
        });
        return;
      }
    }

    // Method not found
    res.json({
      jsonrpc: '2.0',
      error: { code: -32601, message: 'Method not found' },
      id: req.body.id,
    });
  } catch (error) {
    console.error('❌ MCP request failed:', error);
    res.status(500).json({
      jsonrpc: '2.0',
      error: { code: -32603, message: 'Internal error' },
      id: req.body.id,
    });
  }
});

// SSE notifications not supported in stateless mode
app.get('/mcp', async (req, res) => {
  // console.log('Received GET MCP request');
  res.writeHead(405).end(
    JSON.stringify({
      jsonrpc: '2.0',
      error: {
        code: -32000,
        message: 'Method not allowed.',
      },
      id: null,
    }),
  );
});

// Start the server
const PORT = 3001;
app.listen(PORT, (error) => {
  if (error) {
    console.error('Failed to start MCP server:', error);
    process.exit(1);
  }
  console.log(`MCP HTTP Server listening on port ${PORT}`);
});
