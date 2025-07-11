# Test Setup Guide

This guide explains how to set up and run tests for the chatbot server.

## Prerequisites

1. **Node.js** (v18 or higher)
2. **PostgreSQL** (v12 or higher with vector extension)
3. **Jest** and **Supertest** (already included in devDependencies)

## Database Setup

### 1. Create Test Database

First, create a test database in PostgreSQL:

```sql
-- Connect to PostgreSQL as superuser
CREATE DATABASE chatbot_test;
```

### 2. Set up Test Environment Variables

Create a `.env.test` file in the server directory:

```env
# Test Environment Variables
NODE_ENV=test
PG_USER=postgres
PG_HOST=localhost
PG_DATABASE=chatbot_test
PG_PASSWORD=your_password
PG_PORT=5432

# Mock URLs for testing
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=llama2
API_URL=http://localhost
PORT=7890
```

### 3. Run Database Setup Script

Execute the test database setup script:

```bash
# From the server directory
psql -U postgres -d chatbot_test -f scripts/test-db-setup.sql
```

## Installation

Install test dependencies:

```bash
npm install
```

## Running Tests

### Run All Tests

```bash
npm test
```

### Run Tests in Watch Mode

```bash
npm run test:watch
```

### Run Specific Test File

```bash
npx jest __tests__/controllers/chat.test.js
```

### Run Tests with Coverage

```bash
npx jest --coverage
```

## Test Structure

The test suite follows this structure:

```
server/
├── __tests__/
│   ├── controllers/
│   │   └── chat.test.js          # API endpoint tests
│   ├── models/
│   │   └── ChatMemory.test.js    # Database model tests
│   └── utils/
│       └── buildPrompt.test.js   # Utility function tests
├── jest.config.js                # Jest configuration
├── test-setup.js                 # Test setup and database initialization
└── scripts/
    └── test-db-setup.sql         # Database setup script
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

## Test Data

Tests use prefixed test data to avoid conflicts:
- User IDs: `test_user_*`
- Isolated test data per test case
- Automatic cleanup between tests

## Mocking Strategy

### External Dependencies

- **Ollama API**: Mocked using Jest's `global.fetch`
- **Vector embeddings**: Mocked `ollamaEmbed.js` utility
- **Database**: Real PostgreSQL database with test data isolation

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
beforeEach(async () => {
  await setup(); // Clears test data
});

afterAll(async () => {
  jest.clearAllMocks();
  await pool.end();
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

1. **Database Connection**: Ensure PostgreSQL is running and test database exists
2. **Vector Extension**: Make sure `vector` extension is installed in PostgreSQL
3. **Environment Variables**: Verify `.env.test` file is configured correctly
4. **Port Conflicts**: Ensure test ports don't conflict with running services

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