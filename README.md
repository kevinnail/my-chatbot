# Coding & Office Assistant with MCP Server

A full-stack AI-powered chatbot & office assistant RAG application with an MCP server built with React, Express.js, PostgreSQL, WSL/ Linux, and Ollama. Features dual-mode operation (coding assistant and career coach), semantic search capabilities using vector embeddings for intelligent conversation memory, and AI agentic capabilities that automatically create Google Calendar events from analyzed emails via MCP server tool calls.

## Quick Start

**Prerequisites**: Node.js 18+, PostgreSQL with pgvector (via Ubuntu - WSL on Windows), Ollama with required models

**Required Commands to Run the Application:**

```bash
# 1. Start Ubuntu/WSL (Windows users)
# Launch Ubuntu terminal

# 2. Start Frontend (Terminal 1) - Port 3000
cd client
npm run start

# 3. Start Backend (Terminal 2) - Port 4000
cd server
npm run start:watch

# 4. Start MCP Server (Terminal 3) - Port 4001
cd server
npm run start:mcp
```

**Access the application at:** `http://localhost:3000`

_Note: You need all 4 services running (Ubuntu, Frontend, Backend, MCP Server) for full functionality including email analysis and calendar integration._

## Features

- **AI-Powered Chat**: Integrated with Ollama for local LLM inference
- **MCP Server**: HTTP SSE transport, provides Google Calendar event creation tool for LLM
- **Dual Mode Operation**: Switch between coding assistant and career coach modes
- **Gmail Integration**: IMAP-based email sync with intelligent job-search email analysis
- **Google Calendar Integration**: OAuth-connected calendar with AI agent appointment creation
- **Smart Memory**: Vector-based semantic search for conversation history
- **Persistent Storage**: PostgreSQL with pgvector extension for embeddings
- **Hybrid Memory System**: Combines recent and semantically relevant messages
- **Context Tracking**: Real-time token counting and context percentage
- **Modern UI**: React-based interface with markdown support and syntax highlighting

## Screenshots

Here are some examples of the chatbot application in action:

![Chatbot Interface Example 1](<./client/public/screenshot-ex%20(1).png>)
_Main chat interface showing conversation flow and AI responses_

![Chatbot Interface Example 2](<./client/public/screenshot-ex%20(2).png>)
_Chatbot interface with code syntax highlighting and technical assistance_

![Gmail Calendar Integration](<./client/public/screenshot-ex%20(4).png>)
_Gmail sync and Google Calendar integration showing email analysis and automatic appointment creation_

## Gmail & Calendar Integration

The application includes powerful Gmail sync and Google Calendar integration features that work seamlessly with your local LLM to provide intelligent email analysis and automatic appointment scheduling.

### Gmail Integration Features

- **IMAP-Based Sync**: Secure, local email access using Gmail IMAP (no Google Cloud APIs required)
- **Intelligent Email Filtering**: AI-powered detection of job-related emails using vector similarity
- **Real-time Analysis**: LLM-powered categorization of emails (job applications, interviews, offers, rejections)
- **Priority Classification**: Automatic priority assignment (high/medium/low) based on email content
- **Action Item Generation**: AI suggests specific next steps for each email
- **Draft Response Creation**: Contextual response suggestions for appropriate emails
- **Category Filtering**: Filter emails by type (job_application, job_interview, job_offer, etc.)

### Google Calendar Integration Features

- **OAuth Authentication**: Secure connection to your Google Calendar account
- **Automatic Event Creation**: LLM analyzes emails and creates calendar appointments when it detects scheduling information
- **Conflict Detection**: Checks for existing calendar conflicts before creating events
- **Smart Parsing**: Extracts date, time, and location information from email content
- **Tool Call Integration**: Uses Ollama's tool calling capabilities to trigger calendar actions

### How It Works

1. **Email Sync**: The system connects to Gmail via IMAP and fetches recent unread emails
2. **Vector Filtering**: Uses embeddings to identify potentially job-related emails before LLM analysis
3. **LLM Analysis**: Each relevant email is analyzed by your local Ollama model for:
   - Job relevance and category
   - Priority level and sentiment
   - Action items and suggested responses
   - Potential calendar events (meetings, interviews, appointments)
4. **Calendar Integration**: When the LLM detects scheduling information, it automatically creates Google Calendar events
5. **Real-time Updates**: WebSocket connections provide live updates during the analysis process

### Privacy & Security

- **100% Local Analysis**: All email content analysis happens on your machine using Ollama
- **Secure Authentication**: OAuth 2.0 for Google services, IMAP app passwords for Gmail
- **No External APIs**: Email analysis doesn't send data to external services
- **Encrypted Connections**: All communications use SSL/TLS encryption

### Setup Requirements

- **Gmail IMAP Access**: Enable IMAP in Gmail settings and create an app password
- **Google Calendar OAuth**: Set up Google Cloud project with Calendar API access
- **Local LLM**: Requires Ollama with a capable model for email analysis
- **Database**: PostgreSQL tables for storing email metadata and OAuth tokens

For detailed setup instructions, see `server/GMAIL_IMAP_SETUP.md` and `server/GMAIL_MCP_SETUP.md`.

## System Requirements

### Windows Users (Recommended Setup)

- **Windows 10/11** with WSL2 enabled
- **Ubuntu 20.04 LTS or later** (via WSL2)
- **8GB+ RAM** (16GB recommended for optimal performance)
- **10GB+ free disk space**

### Alternative: Linux/macOS

- **Ubuntu 18.04+**, **macOS 10.15+**, or other Unix-like systems
- **Docker** (optional, for containerized PostgreSQL)

## Prerequisites Installation

### 1. Windows WSL2 Setup (Windows Users Only)

If you're on Windows, you'll need WSL2 with Ubuntu for the best development experience:

```bash
# Run in PowerShell as Administrator
wsl --install -d Ubuntu-20.04

# After installation, restart your computer
# Open Ubuntu terminal and update system
sudo apt update && sudo apt upgrade -y
```

### 2. Install Node.js (Required)

```bash
# Install Node.js 18+ (Ubuntu/WSL)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify installation
node --version  # Should be 18.x or higher
npm --version
```

### 3. Install PostgreSQL with pgvector Extension

#### Option A: Native Installation (Recommended)

```bash
# Install PostgreSQL
sudo apt update
sudo apt install postgresql postgresql-contrib postgresql-server-dev-all

# Start PostgreSQL service
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Create a database user
sudo -u postgres createuser --interactive
# Enter your username, make it a superuser for setup

# Create your database
sudo -u postgres createdb my_chatbot_db

# Install pgvector extension
sudo apt install git build-essential
git clone --branch v0.5.1 https://github.com/pgvector/pgvector.git
cd pgvector
make
sudo make install

# Run the setup script to create tables
cd server
npm run setup-db
```

### 4. Install Ollama

```bash
# Install Ollama
curl -fsSL https://ollama.com/install.sh | sh

# Pull required models
ollama pull llama3.1:8b              # Main chat model (adjust size as needed)
ollama pull mxbai-embed-large        # Embedding model (required)

# Verify installation
ollama list
```

**Note**: The embedding model `mxbai-embed-large` is required for the vector search functionality. The chat model can be adjusted based on your hardware capabilities. Ollama must be running locally on port 11434 (this happens automatically when you pull models).

## Application Setup

### 1. Clone and Install Dependencies

```bash
# Clone the repository
git clone <your-repo-url>
cd my-chatbot

# Install root dependencies
npm install

# Install server dependencies
cd server
npm install

# Install client dependencies
cd ../client
npm install

# Return to root directory
cd ..
```

### 2. Environment Configuration

Create environment files for the server:

```bash
# Create server .env file
touch server/.env
```

**IMPORTANT FOR WSL USERS**: If you're running the application from Windows you must use the WSL IP address instead of 'localhost' for the database connection.

**To find your WSL IP address:**

```bash
# In WSL terminal, run:
ip addr show eth0 | grep inet
# OR
hostname -I
```

Add the following to `server/.env`:

```env
# Auth Configuration
SALT_ROUNDS=10
COOKIE_NAME=cookie_name
JWT_SECRET=secret
SECURE_COOKIES=false

# PostgreSQL Configuration
PG_USER=your_username
PG_HOST=localhost  # For WSL users: Use WSL IP address (e.g., 172.20.240.2)
PG_DATABASE=my_chatbot_db
PG_PASSWORD=your_password
PG_PORT=5432

#^ Encryption Key
ENCRYPTION_KEY=your_encryption_key

# Server Configuration
PORT=4000
API_URL=http://localhost

# Ollama Configuration (try your own mix of models)
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=Llama3.2:3b
OLLAMA_SMALL_MODEL=Llama3.2:3b-instruct-q4_K_M

#^ Gmail IMAP Configuration (instead of OAuth)
GMAIL_USER=your_name@email.com
GMAIL_APP_PASSWORD=abcdefghijklmnopqrstuvwxyz
GMAIL_IMAP_HOST=imap.gmail.com
GMAIL_IMAP_PORT=993

# Client URL (for OAuth redirects)
CLIENT_URL=http://localhost:3000

# Google Calendar API Configuration
GOOGLE_CLIENT_ID=1234567891011-pasdfpoiuasdfpoiuasdfpoiuasdf.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=http://localhost:4000/api/calendar/callback

```

Create environment file for the client:

```bash
# Create client .env file
touch client/.env
```

Add the following to `client/.env.development`:

```env
# Backend API URL
REACT_APP_BASE_URL='http://localhost:3000'
```

### 3. Database Schema Setup

Run the database setup script:

```bash
# From the server directory
cd server
npm run setup-db
```

## Running the Application

### 1. Start Required Services

```bash
# Start PostgreSQL (if not already running)
sudo systemctl start postgresql
```

### 2. Start the Application

```bash
# From the /client directory, start client
npm run start
# From the /server directory, start server
npm run start:watch
```

This will start:

- **Backend server** on `http://localhost:4000`
- **Frontend client** on `http://localhost:3000`

The app will automatically open in your browser at `http://localhost:3000`.

### 3. MCP Server (Required for Email/Calendar Features)

The application includes a Model Context Protocol (MCP) server that is **required** for email analysis and Google Calendar integration. The MCP server handles tool execution for the LLM, including automatic calendar event creation from analyzed emails. To run the MCP server:

```bash
# From the /server directory
cd server
npm run start:mcp
```

This will start:

- **MCP server** on `http://localhost:4001`

#### MCP Server Features

- **Email Analysis Integration**: Powers the AI-driven email analysis that categorizes job-related emails and extracts appointment information
- **Automatic Calendar Creation**: Executes calendar event creation when the LLM detects scheduling information in emails
- **HTTP Streaming Transport**: Uses streamable HTTP instead of stdio/stdout for better performance and reliability
- **Session Management**: Maintains persistent sessions with unique session IDs for reliable tool execution
- **LLM Tool Execution**: Handles function calling from Ollama models for real-world actions
- **DNS Rebinding Protection**: Enhanced security for local development

## Testing

The application includes a comprehensive test suite using Jest and Supertest for integration testing.

### Test Setup

1. **Create Test Database**:

```bash
# Create a separate database for testing
sudo -u postgres createdb chatbot_test
```

2. **Set up Test Database Schema**:

```bash
# From the server directory
cd server
npm run setup-test-db
```

### Running Tests

```bash
# Navigate to server directory
cd server

# Run all tests
npm test

# Run tests in watch mode (for development)
npm run test:watch

# Run tests with coverage report
npm test -- --coverage

# Run specific test file
npm test -- __tests__/controllers/chat.test.js

# Run tests matching a pattern
npm test -- --testNamePattern="should send a message"
```

### Test Structure

The test suite covers:

- **API Endpoints** (`__tests__/controllers/chat.test.js`)
  - POST `/api/chatbot` - Message sending and bot responses
  - DELETE `/api/chatbot/:userId` - Message deletion and user isolation
  - Error handling and edge cases

- **Database Models** (`__tests__/models/ChatMemory.test.js`)
  - Message storage with vector embeddings
  - Recent, relevant, and hybrid message retrieval
  - User-specific operations and data isolation

- **Utilities** (`__tests__/utils/buildPrompt.test.js`)
  - Prompt building with conversation memory
  - Time-based context formatting
  - Message limits and chronological ordering

### Test Features

- **Integration Testing**: Real database operations with test data isolation
- **API Mocking**: External Ollama API calls are mocked for consistent testing
- **Vector Embeddings**: Proper PostgreSQL vector format testing
- **Error Scenarios**: Comprehensive error handling and edge case coverage
- **Clean Environment**: Automatic test data cleanup between tests

### Test Configuration

Tests use the following environment:

- Test database: `chatbot_test`
- Vector dimensions: 1024 (matching your production setup)
- Mocked external APIs for consistent results
- Isolated test data with `test_` prefixes

For detailed test setup instructions, see `server/TEST_README.md`.

## Usage

### Core Chat Features

1. **Choose Your Mode**: Toggle between "chat" (coding assistant) and "coach" (career coaching) modes using the mode button
2. **Start Chatting**: Type your message in the input field and press Enter
3. **Context Awareness**: The bot remembers your conversation using semantic search
4. **Delete History**: Click the "Delete Messages" button to clear conversation history
5. **Coding Mode**: Get help with React, Express, Node.js, and PostgreSQL questions
6. **Career Coach Mode**: Receive job search guidance, LinkedIn strategy, resume advice, and interview preparation

### Gmail & Calendar Integration

1. **Access Gmail Integration**: Navigate to the Gmail MCP section of the application
2. **Connect Gmail**: Set up IMAP connection using your Gmail credentials and app password
3. **Connect Google Calendar**: Authenticate with OAuth to enable calendar event creation
4. **Sync Emails**: Click "Sync Emails" to analyze recent job-related emails with AI
5. **Review Analysis**: View categorized emails with priority levels, summaries, and action items
6. **Filter Results**: Use category and priority filters to focus on specific types of emails
7. **Automatic Scheduling**: Calendar events are created automatically when the AI detects appointment information in emails

## Troubleshooting

### Common Issues

**1. "Backend server is not running" error**

- Ensure PostgreSQL is running: `sudo systemctl status postgresql`
- Check Ollama is running: `curl http://localhost:11434/api/tags`
- Verify server is running on port 4000

**2. "Embedding model not found" error**

- Install the required embedding model: `ollama pull mxbai-embed-large`

**3. Database connection issues**

- Verify PostgreSQL credentials in `server/.env`
- Check if pgvector extension is installed: `SELECT * FROM pg_extension WHERE extname = 'vector';`

**4. Port conflicts**

- Change ports in environment files if needed
- Default ports: Frontend (3000), Backend (4000), PostgreSQL (5432), Ollama (11434)

### Performance Optimization

**For better performance:**

- Use smaller Ollama models if you have limited RAM (e.g., `llama3.1:8b` instead of `llama3.1:70b`)
- Increase PostgreSQL shared memory settings for better vector search performance
- Consider using GPU acceleration for Ollama if available

### WSL2 Specific Notes

- Access files from Windows: `/mnt/c/Users/YourUsername/`
- PostgreSQL data persists between WSL restarts
- Use Windows Terminal for better experience
- Install VS Code with WSL extension for development

## Development

### Project Structure

```
my-chatbot/
├── client/                 # React frontend
│   ├── src/
│   │   ├── App.js         # Main React component
│   │   └── services/      # API services
├── server/                 # Express backend
│   ├── lib/
│   │   ├── controllers/   # Route handlers
│   │   ├── models/        # Database models
│   │   └── utils/         # Utility functions
│   └── server.js          # Server entry point
├── package.json           # Root dependencies
└── README.md
```

### Key Technologies

- **Frontend**: React, React Markdown, Syntax Highlighting
- **Backend**: Express.js, Node.js, CORS
- **Database**: PostgreSQL with pgvector extension
- **AI**: Ollama (Local LLM inference with function calling)
- **Vector Search**: Cosine similarity with hybrid memory
- **Email Integration**: IMAP (Gmail), Vector-based email filtering
- **Calendar Integration**: Google Calendar API, OAuth 2.0 authentication

## License

This project is licensed under the ISC License.

## Support

For issues and questions:

1. Check the troubleshooting section
2. Verify all prerequisites are installed
3. Check service status (PostgreSQL, Ollama)
4. Review environment configuration
