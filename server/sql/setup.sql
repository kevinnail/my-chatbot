-- Use this file to define your SQL tables
-- The SQL in this file will be executed when you run `npm run setup-db`

-- Enable vector extension (required for embeddings)
CREATE EXTENSION IF NOT EXISTS vector;

-- Drop existing tables
DROP TABLE IF EXISTS chat_memory CASCADE;
DROP TABLE IF EXISTS gmail_tokens CASCADE;
DROP TABLE IF EXISTS gmail_sync_status CASCADE;

-- Create chat_memory table
CREATE TABLE chat_memory (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL,
    content TEXT NOT NULL,
    embedding VECTOR(1024),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create gmail_sync_status table (OAuth tokens not needed for IMAP)
CREATE TABLE gmail_sync_status (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL UNIQUE,
    last_sync TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_chat_memory_user_id ON chat_memory(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_memory_created_at ON chat_memory(created_at);
CREATE INDEX IF NOT EXISTS idx_chat_memory_embedding ON chat_memory USING ivfflat (embedding vector_cosine_ops);

CREATE INDEX IF NOT EXISTS idx_gmail_sync_status_user_id ON gmail_sync_status(user_id);

-- Insert sample test data (for development/testing)
INSERT INTO chat_memory (user_id, role, content, embedding) VALUES
('sample_user', 'user', 'Hello, how can I learn React?', 
 ('[' || array_to_string(ARRAY(SELECT 0.1 FROM generate_series(1, 1024)), ',') || ']')::vector),
('sample_user', 'bot', 'React is a JavaScript library for building user interfaces. You can start by learning components, props, and state.', 
 ('[' || array_to_string(ARRAY(SELECT 0.2 FROM generate_series(1, 1024)), ',') || ']')::vector);