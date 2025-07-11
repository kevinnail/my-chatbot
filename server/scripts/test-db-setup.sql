-- Test database setup script
-- Run this script to create the test database and required extensions

-- Create test database (run this as superuser)
-- CREATE DATABASE chatbot_test;

-- Connect to the test database and run the following:
-- \c chatbot_test;

-- Enable vector extension for embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- Create the chat_memory table
CREATE TABLE IF NOT EXISTS chat_memory (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL,
    content TEXT NOT NULL,
    embedding VECTOR(1536),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_chat_memory_user_id ON chat_memory(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_memory_created_at ON chat_memory(created_at);
CREATE INDEX IF NOT EXISTS idx_chat_memory_embedding ON chat_memory USING ivfflat (embedding vector_cosine_ops);

-- Insert some test data (optional)
INSERT INTO chat_memory (user_id, role, content, embedding) VALUES
('sample_user', 'user', 'Hello, how can I learn React?', ARRAY[0.1, 0.2, 0.3]::vector),
('sample_user', 'bot', 'React is a JavaScript library for building user interfaces. You can start by learning components, props, and state.', ARRAY[0.1, 0.2, 0.3]::vector)
ON CONFLICT DO NOTHING; 