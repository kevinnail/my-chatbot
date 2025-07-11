# Test Setup Guide

This guide explains how to set up and run tests for the chatbot server using our bootcamp-style testing approach.

## Prerequisites

1. **Node.js** (v18 or higher)
2. **PostgreSQL** (v12 or higher with vector extension)
3. **Jest** and **Supertest** (already included in devDependencies)

## Database Setup

### 1. Environment Variables

Ensure your `.env` file in the server directory contains your PostgreSQL credentials:

```env
# PostgreSQL Configuration
PG_USER=your_username
PG_HOST=localhost
PG_PASSWORD=your_password
PG_PORT=5432

# These will be set automatically for tests
NODE_ENV=test
PG_DATABASE=chatbot_test
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=llama2
```

### 2. One-Time Test Database Setup

Run this command once to create the test database and set up the schema:

```bash
# From the server directory
npm run setup-test-db
```

This command will:
- Create the `chatbot_test` database (separate from your main database)
- Install the vector extension
- Run the `sql/setup.sql` file to create tables and sample data

## Installation

Install test dependencies:

```bash
npm install
```

## Running Tests

### First Time Setup

```bash
# Create and set up the test database (run once)
npm run setup-test-db
```

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode (for development)
npm run test:watch

# Run specific test file
npx jest __tests__/controllers/chat.test.js

# Run tests with coverage report
npx jest --coverage
```

### Database Management

```bash
# Set up main application database
npm run setup-db

# Recreate test database (if needed)
npm run setup-test-db
```

## Test Structure

The test suite follows this bootcamp-style structure:

```
server/
├── sql/
│   └── setup.sql                 # Database schema and sample data
├── __tests__/
│   ├── controllers/
│   │   └── chat.test.js          # API endpoint tests
│   ├── models/
│   │   └── ChatMemory.test.js    # Database model tests
│   └── utils/
│       └── buildPrompt.test.js   # Utility function tests
├── setup-db.js                  # Main database setup script
├── setup-test-db.js             # Test database creation script
└── test-setup.js                # Runs before each test
```

## Test Features

### Integration Tests

- **Chat API endpoints** (`POST /api/chat`, `DELETE /api/chat/:userId`)
- **Database operations** (message storage, retrieval, deletion)
- **External API mocking** (Ollama API responses)
- **Error handling** (database errors, API failures)

### Model Tests

- **ChatMemory methods** (storeMessage, getRecentMessages, getAllMessages, etc.)
- **Vector embeddings** (mocked for consistent testing)
- **Data validation** and edge cases

### Utility Tests

- **Prompt building** with memory context
- **Time formatting** for conversation history
- **Message limits** and ordering

## Key Benefits of This Approach

This testing setup provides:

1. **Complete Isolation**: Tests never interfere with your main application database
2. **Consistent State**: Every test starts with identical, fresh data from `sql/setup.sql`
3. **Fast & Reliable**: No need to clean up test data - just drop and recreate tables
4. **Easy Debugging**: Test failures are reproducible since data state is always the same
5. **Production-Like**: Tests run against a real PostgreSQL database, not mocks

## Test Data

Tests use a completely separate database for full isolation:
- **Separate Database**: `chatbot_test` (completely isolated from main app database)
- **Fresh Data**: `sql/setup.sql` runs before each test, dropping and recreating all tables
- **Sample Data**: Each test starts with the same clean sample data from `setup.sql`
- **No Pollution**: Your main application database is never touched by tests

## Mocking Strategy

### External Dependencies

- **Ollama API**: Mocked using Jest's `global.fetch` for consistent responses
- **Embedding API**: Mocked to return consistent 1024-dimension vectors
- **Database**: Real PostgreSQL test database with complete isolation

### Mock Examples

```javascript
// Mock Ollama API response
fetch.mockResolvedValueOnce({
  ok: true,
  json: jest.fn().mockResolvedValueOnce({
    message: { content: 'Test response' },
    prompt_eval_count: 150
  })
});

// Mock vector embedding
jest.mock('../../lib/utils/ollamaEmbed.js', () => ({
  getEmbedding: jest.fn().mockResolvedValue(new Array(1536).fill(0.1))
}));
```

## Common Test Patterns

### Database Setup

```javascript
import setup, { pool, cleanup } from '../../test-setup.js';

beforeEach(async () => {
  await setup(); // Runs sql/setup.sql - drops/creates fresh tables
});

afterAll(async () => {
  jest.clearAllMocks();
  await cleanup(); // Properly closes test database connection
});
```

### API Testing

```javascript
const response = await request(app)
  .post('/api/chat')
  .send({ msg: 'test message', userId: 'test_user' });

expect(response.status).toBe(200);
expect(response.body).toEqual({
  bot: expect.any(String),
  prompt_eval_count: expect.any(Number),
  context_percent: expect.any(String)
});
```

## Troubleshooting

### Common Issues

1. **Test Database Not Created**: Run `npm run setup-test-db` to create the test database
2. **Database Connection**: Ensure PostgreSQL is running and credentials in `.env` are correct
3. **Vector Extension**: The setup script automatically installs the vector extension
4. **Permission Issues**: Ensure your PostgreSQL user has CREATE DATABASE permissions

### Debug Tests

```bash
# Run with verbose output
npx jest --verbose

# Run single test with debugging
npx jest --testNamePattern="should send a message" --verbose
```

## Continuous Integration

For CI/CD pipelines, ensure:
1. PostgreSQL service is available
2. Test database is created
3. Vector extension is installed
4. Environment variables are set

Example GitHub Actions setup:

```yaml
services:
  postgres:
    image: ankane/pgvector
    env:
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: chatbot_test
    options: >-
      --health-cmd pg_isready
      --health-interval 10s
      --health-timeout 5s
      --health-retries 5
``` 