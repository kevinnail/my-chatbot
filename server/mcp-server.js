import express from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';

const app = express();
app.use(express.json());

// Stateless MCP server (from the docs)
app.post('/mcp', async (req, res) => {
  try {
    // Create a new instance for each request to ensure isolation
    const server = new McpServer({
      name: 'hello-world-server',
      version: '1.0.0',
    });

    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined, // Stateless mode
    });

    res.on('close', () => {
      console.log('Request closed');
      transport.close();
      server.close();
    });

    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error('Error handling MCP request:', error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: 'Internal server error',
        },
        id: null,
      });
    }
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
