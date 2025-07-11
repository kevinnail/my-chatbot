# My Coding Assistant Chatbot

A full-stack AI-powered chatbot application built with React, Express.js, PostgreSQL, and Ollama. Features semantic search capabilities using vector embeddings for intelligent conversation memory and context-aware responses.

## Features

- **AI-Powered Chat**: Integrated with Ollama for local LLM inference
- **Smart Memory**: Vector-based semantic search for conversation history
- **Persistent Storage**: PostgreSQL with pgvector extension for embeddings
- **Hybrid Memory System**: Combines recent and semantically relevant messages
- **Context Tracking**: Real-time token counting and context percentage
- **Modern UI**: React-based interface with markdown support and syntax highlighting

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

# Connect to PostgreSQL and enable extension
sudo -u postgres psql my_chatbot_db
```

```sql
-- Run these commands in the PostgreSQL console
CREATE EXTENSION IF NOT EXISTS vector;

-- Create the chat_memory table
CREATE TABLE chat_memory (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL,
    content TEXT NOT NULL,
    embedding vector(1024),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for faster vector similarity search
CREATE INDEX chat_memory_embedding_idx ON chat_memory USING ivfflat (embedding vector_cosine_ops);

-- Exit PostgreSQL
\q
```

#### Option B: Docker Installation (Alternative)

```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Start PostgreSQL with pgvector
docker run -d \
  --name postgres-pgvector \
  -e POSTGRES_DB=my_chatbot_db \
  -e POSTGRES_USER=chatbot_user \
  -e POSTGRES_PASSWORD=your_password \
  -p 5432:5432 \
  pgvector/pgvector:pg16

# Connect and create table
docker exec -it postgres-pgvector psql -U chatbot_user -d my_chatbot_db
```

### 4. Install Ollama

```bash
# Install Ollama
curl -fsSL https://ollama.com/install.sh | sh

# Start Ollama service
ollama serve

# In a new terminal, pull required models
ollama run llama3.1:8b              # Main chat model (adjust size as needed)
ollama run mxbai-embed-large        # Embedding model (required)

# Verify installation
ollama list
```

**Note**: The embedding model `mxbai-embed-large` is required for the vector search functionality. The chat model can be adjusted based on your hardware capabilities.

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

Add the following to `server/.env`:

```env
# PostgreSQL Configuration
PG_USER=your_username
PG_HOST=localhost
PG_DATABASE=my_chatbot_db
PG_PASSWORD=your_password
PG_PORT=5432

# Ollama Configuration
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=llama3.1:8b

# Server Configuration
PORT=4000
API_URL=http://localhost
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

If you haven't already created the database table, run:

```bash
# Connect to your PostgreSQL database
psql -U your_username -d my_chatbot_db

# Or if using Docker:
# docker exec -it postgres-pgvector psql -U chatbot_user -d my_chatbot_db
```

```sql
-- Create the chat_memory table
CREATE TABLE IF NOT EXISTS chat_memory (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL,
    content TEXT NOT NULL,
    embedding vector(1024),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for faster vector similarity search
CREATE INDEX IF NOT EXISTS chat_memory_embedding_idx ON chat_memory USING ivfflat (embedding vector_cosine_ops);
```

## Running the Application

### 1. Start Required Services

```bash
# Start PostgreSQL (if not using Docker)
sudo systemctl start postgresql

# Start Ollama (in a separate terminal)
ollama serve

# If using Docker PostgreSQL
docker start postgres-pgvector
```

### 2. Start the Application

```bash
# From the /client directory, start client
npm run start
# From the /server directory, start server
npm run start --watch
```

This will start:
- **Backend server** on `http://localhost:4000`
- **Frontend client** on `http://localhost:3000`

The app will automatically open in your browser at `http://localhost:3000`.

## Testing

The application includes a comprehensive test suite using Jest and Supertest for integration testing.

### Test Setup

1. **Create Test Database**:
```bash
# Create a separate database for testing
sudo -u postgres createdb chatbot_test

# Or if using Docker:
docker exec -it postgres-pgvector createdb -U chatbot_user chatbot_test
```

2. **Set up Test Database Schema**:
```bash
# From the server directory
cd server
psql -U your_username -d chatbot_test -f scripts/test-db-setup.sql

# Or if using Docker:
docker exec -i postgres-pgvector psql -U chatbot_user -d chatbot_test < scripts/test-db-setup.sql
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
  - POST `/api/chat` - Message sending and bot responses
  - DELETE `/api/chat/:userId` - Message deletion and user isolation
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

1. **Start Chatting**: Type your message in the input field and press Enter
2. **Context Awareness**: The bot remembers your conversation using semantic search
3. **Delete History**: Click the "Delete Messages" button to clear conversation history
4. **Code Support**: The bot can help with React, Express, Node.js, and PostgreSQL questions

## Troubleshooting

### Common Issues

**1. "Backend server is not running" error**
- Ensure PostgreSQL is running: `sudo systemctl status postgresql`
- Check Ollama is running: `curl http://localhost:11434/api/tags`
- Verify server is running on port 7890

**2. "Embedding model not found" error**
- Install the required embedding model: `ollama pull mxbai-embed-large`
- Ensure Ollama service is running

**3. Database connection issues**
- Verify PostgreSQL credentials in `server/.env`
- Check if pgvector extension is installed: `SELECT * FROM pg_extension WHERE extname = 'vector';`

**4. Port conflicts**
- Change ports in environment files if needed
- Default ports: Frontend (3000), Backend (7890), PostgreSQL (5432), Ollama (11434)

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
- **AI**: Ollama (Local LLM inference)
- **Vector Search**: Cosine similarity with hybrid memory

## License

This project is licensed under the ISC License.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## Support

For issues and questions:
1. Check the troubleshooting section
2. Verify all prerequisites are installed
3. Check service status (PostgreSQL, Ollama)
4. Review environment configuration 