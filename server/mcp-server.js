import express from 'express';
import { randomUUID } from 'node:crypto';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

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

// Working MCP server using the actual MCP server but with manual response handling
app.post('/mcp', async (req, res) => {
  console.log('📨 MCP Request received:', JSON.stringify(req.body, null, 2));

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
      // Manually return the tools since we know what we registered
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
        // Call the actual registered tool handler
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
      error: { code: -32603, message: error.message || 'Internal error' },
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
