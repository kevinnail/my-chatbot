-- Use this file to define your SQL tables
-- The SQL in this file will be executed when you run `npm run setup-db`

-- Enable vector extension (required for embeddings)
CREATE EXTENSION IF NOT EXISTS vector;

-- Drop existing tables
DROP TABLE IF EXISTS chat_memory CASCADE;
DROP TABLE IF EXISTS gmail_tokens CASCADE;
DROP TABLE IF EXISTS gmail_sync_status CASCADE;
DROP TABLE IF EXISTS email_memory CASCADE;
DROP TABLE IF EXISTS google_calendar_tokens CASCADE;

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

-- Create email_memory table for vector-powered email search
CREATE TABLE email_memory (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    email_id VARCHAR(255) NOT NULL,
    subject TEXT NOT NULL,
    sender TEXT NOT NULL,
    body TEXT NOT NULL,
    email_date TIMESTAMP NOT NULL,
    embedding VECTOR(1024),
    similarity_score FLOAT DEFAULT 0,
    is_web_dev_related BOOLEAN DEFAULT FALSE,
    category VARCHAR(50),
    priority VARCHAR(20),
    sentiment VARCHAR(20),
    action_items TEXT[],
    llm_analysis JSONB,
    llm_analyzed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, email_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_chat_memory_user_id ON chat_memory(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_memory_created_at ON chat_memory(created_at);
CREATE INDEX IF NOT EXISTS idx_chat_memory_embedding ON chat_memory USING ivfflat (embedding vector_cosine_ops);

CREATE INDEX IF NOT EXISTS idx_gmail_sync_status_user_id ON gmail_sync_status(user_id);

-- Create indexes for email_memory table
CREATE INDEX IF NOT EXISTS idx_email_memory_user_id ON email_memory(user_id);
CREATE INDEX IF NOT EXISTS idx_email_memory_email_date ON email_memory(email_date);
CREATE INDEX IF NOT EXISTS idx_email_memory_embedding ON email_memory USING ivfflat (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_email_memory_category ON email_memory(category);
CREATE INDEX IF NOT EXISTS idx_email_memory_priority ON email_memory(priority);
CREATE INDEX IF NOT EXISTS idx_email_memory_web_dev ON email_memory(is_web_dev_related);

-- Create google_calendar_tokens table
CREATE TABLE google_calendar_tokens (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL UNIQUE,
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    token_type VARCHAR(50) DEFAULT 'Bearer',
    expires_at TIMESTAMP,
    scope TEXT DEFAULT 'https://www.googleapis.com/auth/calendar',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);



-- Create indexes for Google Calendar tables
CREATE INDEX IF NOT EXISTS idx_google_calendar_tokens_user_id ON google_calendar_tokens(user_id);

-- Insert sample test data (for development/testing)
INSERT INTO chat_memory (user_id, role, content, embedding) VALUES
('sample_user', 'user', 'Hello, how can I learn React?', 
 ('[' || array_to_string(ARRAY(SELECT 0.1 FROM generate_series(1, 1024)), ',') || ']')::vector),
('sample_user', 'bot', 'React is a JavaScript library for building user interfaces. You can start by learning components, props, and state.', 
 ('[' || array_to_string(ARRAY(SELECT 0.2 FROM generate_series(1, 1024)), ',') || ']')::vector);