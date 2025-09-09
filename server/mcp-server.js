import express from 'express';
import { randomUUID } from 'node:crypto';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';

const app = express();
app.use(express.json());

// Map to store transports by session ID
const transports = {};

// Create and configure MCP server
function createServer() {
  const server = new McpServer({
    name: 'hello-world-server',
    version: '1.0.0',
  });

  // Add a simple hello world tool
  server.registerTool(
    'hello-world',
    {
      title: 'Hello World Tool',
      description: 'A simple greeting tool',
      inputSchema: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Name to greet',
          },
        },
        required: ['name'],
      },
    },
    async ({ name }) => ({
      content: [
        {
          type: 'text',
          text: `Hello, ${name}! This is your MCP server speaking.`,
        },
      ],
    }),
  );

  return server;
}

// Handle POST requests for client-to-server communication
app.post('/mcp', async (req, res) => {
  console.log('📨 MCP Request received:', JSON.stringify(req.body, null, 2));

  // Check for existing session ID
  const sessionId = req.headers['mcp-session-id'];
  let transport;

  if (sessionId && transports[sessionId]) {
    // Reuse existing transport
    transport = transports[sessionId];
  } else if (!sessionId && isInitializeRequest(req.body)) {
    // New initialization request
    transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (sessionId) => {
        // Store the transport by session ID
        transports[sessionId] = transport;
      },
    });

    // Clean up transport when closed
    transport.onclose = () => {
      if (transport.sessionId) {
        delete transports[transport.sessionId];
      }
    };

    const server = createServer();
    console.log('🔗 Connecting server to transport...');
    await server.connect(transport);
    console.log('✅ Server connected to transport');
  } else {
    // Invalid request
    res.status(400).json({
      jsonrpc: '2.0',
      error: {
        code: -32000,
        message: 'Bad Request: No valid session ID provided',
      },
      id: null,
    });
    return;
  }

  // Handle the request
  console.log('🚀 Calling transport.handleRequest...');
  console.log('📊 Response state before:', {
    headersSent: res.headersSent,
    finished: res.finished,
  });

  try {
    await transport.handleRequest(req, res, req.body);
    console.log('✅ transport.handleRequest completed');
    console.log('📊 Response state after:', {
      headersSent: res.headersSent,
      finished: res.finished,
    });
  } catch (error) {
    console.error('❌ transport.handleRequest failed:', error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: { code: -32603, message: 'Transport error' },
        id: req.body.id,
      });
    }
  }
});

// Simple MCP-compatible JSON-RPC handler
app.post('/mcp-simple', async (req, res) => {
  console.log('🧪 Simple MCP request:', JSON.stringify(req.body, null, 2));

  const { jsonrpc, method, params, id } = req.body;

  if (jsonrpc !== '2.0') {
    return res.json({
      jsonrpc: '2.0',
      error: { code: -32600, message: 'Invalid Request' },
      id,
    });
  }

  try {
    if (method === 'initialize') {
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
        id,
      });
    } else if (method === 'tools/list') {
      res.json({
        jsonrpc: '2.0',
        result: {
          tools: [
            {
              name: 'hello-world',
              description: 'A simple greeting tool',
              inputSchema: {
                type: 'object',
                properties: {
                  name: { type: 'string', description: 'Name to greet' },
                },
                required: ['name'],
              },
            },
          ],
        },
        id,
      });
    } else if (method === 'tools/call' && params.name === 'hello-world') {
      const { name } = params.arguments;
      res.json({
        jsonrpc: '2.0',
        result: {
          content: [
            {
              type: 'text',
              text: `Hello, ${name}! This is your MCP server speaking.`,
            },
          ],
        },
        id,
      });
    } else {
      res.json({
        jsonrpc: '2.0',
        error: { code: -32601, message: 'Method not found' },
        id,
      });
    }
  } catch (error) {
    res.json({
      jsonrpc: '2.0',
      error: { code: -32603, message: 'Internal error' },
      id,
    });
  }
});

// SSE notifications not supported in stateless mode
app.get('/mcp', async (req, res) => {
  console.log('Received GET MCP request');
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
