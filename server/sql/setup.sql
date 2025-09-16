-- Use this file to define your SQL tables
-- The SQL in this file will be executed when you run `npm run setup-db`

-- Enable vector extension (required for embeddings)
CREATE EXTENSION IF NOT EXISTS vector;

-- Drop existing tables
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS chat_memory CASCADE;
DROP TABLE IF EXISTS chat_memory_chunks CASCADE;
DROP TABLE IF EXISTS chats CASCADE;
DROP TABLE IF EXISTS gmail_tokens CASCADE;
DROP TABLE IF EXISTS gmail_sync_status CASCADE;
DROP TABLE IF EXISTS email_memory CASCADE;
DROP TABLE IF EXISTS google_calendar_tokens CASCADE;
DROP TABLE IF EXISTS file_chunks CASCADE;
DROP TABLE IF EXISTS files CASCADE;

CREATE TABLE users (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email  VARCHAR UNIQUE,
  password_hash VARCHAR NOT NULL
);

-- Create chats table
CREATE TABLE chats (
    id SERIAL PRIMARY KEY,
    chat_id VARCHAR(255) NOT NULL UNIQUE,
    user_id VARCHAR(255) NOT NULL,
    title VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create chat_memory table
CREATE TABLE chat_memory (
    id SERIAL PRIMARY KEY,
    chat_id VARCHAR(255) NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    message_id VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL,
    content TEXT NOT NULL,
    embedding VECTOR(1024),
    is_chunked BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create chat_memory_chunks table
CREATE TABLE chat_memory_chunks (
    id SERIAL PRIMARY KEY,
    chat_id VARCHAR(255) NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    message_id VARCHAR(255) NOT NULL,
    chunk_index INTEGER NOT NULL,
    content TEXT NOT NULL,
    embedding VECTOR(1024),
    chunk_type VARCHAR(20) NOT NULL,
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
CREATE INDEX IF NOT EXISTS idx_chats_user_id ON chats(user_id);
CREATE INDEX IF NOT EXISTS idx_chats_chat_id ON chats(chat_id);
CREATE INDEX IF NOT EXISTS idx_chats_updated_at ON chats(updated_at);

CREATE INDEX IF NOT EXISTS idx_chat_memory_user_id ON chat_memory(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_memory_chat_id ON chat_memory(chat_id);
CREATE INDEX IF NOT EXISTS idx_chat_memory_message_id ON chat_memory(message_id);
CREATE INDEX IF NOT EXISTS idx_chat_memory_created_at ON chat_memory(created_at);
CREATE INDEX IF NOT EXISTS idx_chat_memory_embedding ON chat_memory USING ivfflat (embedding vector_cosine_ops);

CREATE INDEX IF NOT EXISTS idx_chat_memory_chunks_user_id ON chat_memory_chunks(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_memory_chunks_chat_id ON chat_memory_chunks(chat_id);
CREATE INDEX IF NOT EXISTS idx_chat_memory_chunks_message_id ON chat_memory_chunks(message_id);
CREATE INDEX IF NOT EXISTS idx_chat_memory_chunks_embedding ON chat_memory_chunks USING ivfflat (embedding vector_cosine_ops);

CREATE INDEX IF NOT EXISTS idx_gmail_sync_status_user_id ON gmail_sync_status(user_id);

-- Create indexes for email_memory table
CREATE INDEX IF NOT EXISTS idx_email_memory_user_id ON email_memory(user_id);
CREATE INDEX IF NOT EXISTS idx_email_memory_email_date ON email_memory(email_date);
CREATE INDEX IF NOT EXISTS idx_email_memory_embedding ON email_memory USING ivfflat (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_email_memory_category ON email_memory(category);
CREATE INDEX IF NOT EXISTS idx_email_memory_priority ON email_memory(priority);
CREATE INDEX IF NOT EXISTS idx_email_memory_web_dev ON email_memory(is_web_dev_related);

-- Create files table for chatbot intelligence
CREATE TABLE files (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    filename VARCHAR(255) NOT NULL,
    file_type VARCHAR(50),
    total_chunks INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create file_chunks table for chunked file content
CREATE TABLE file_chunks (
    id SERIAL PRIMARY KEY,
    file_id INTEGER REFERENCES files(id) ON DELETE CASCADE,
    user_id VARCHAR(255) NOT NULL,
    chunk_index INTEGER NOT NULL,
    content TEXT NOT NULL,
    embedding VECTOR(1024),
    chunk_type VARCHAR(50), -- 'paragraph', 'function', 'class', etc.
    token_count INTEGER,
    start_line INTEGER,
    end_line INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

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



-- Create indexes for files table
CREATE INDEX IF NOT EXISTS idx_files_user_id ON files(user_id);
CREATE INDEX IF NOT EXISTS idx_files_filename ON files(filename);

-- Create indexes for file_chunks table  
CREATE INDEX IF NOT EXISTS idx_file_chunks_file_id ON file_chunks(file_id);
CREATE INDEX IF NOT EXISTS idx_file_chunks_user_id ON file_chunks(user_id);
CREATE INDEX IF NOT EXISTS idx_file_chunks_embedding ON file_chunks USING ivfflat (embedding vector_cosine_ops);

-- Create indexes for Google Calendar tables
CREATE INDEX IF NOT EXISTS idx_google_calendar_tokens_user_id ON google_calendar_tokens(user_id);

-- Insert sample test data (for development/testing) with encrypted content
INSERT INTO chat_memory (chat_id, user_id, message_id, role, content, embedding, is_chunked) VALUES
('sample_chat_1', 'sample_user', 'msg_1', 'user', 'U2FsdGVkX1/QRkjJ1dJqqYeYPYSG8vtfhwq/NxOjm9x8v2MiNvVsmbuLXrwqOkqS', 
 ('[' || array_to_string(ARRAY(SELECT 0.1 FROM generate_series(1, 1024)), ',') || ']')::vector, false),
('sample_chat_1', 'sample_user', 'msg_2', 'bot', 'U2FsdGVkX1/RuOD1c7tzqVDZHHN1IHO49hbfeOnzXGMXDcu55k4DCzPkzhjYOQ5Ms+o+D9TojovO+lcHZrUB68ypulwey2lXXMilCegoFLt7wdHvsNMYqA6ia74agIt1tuKRDdq4gP4R8fzTs65psLPCT4/lOmbnaiBaqHIyIHT6iaDzU9VhR8Rvo8gH3pdv', 
 ('[' || array_to_string(ARRAY(SELECT 0.2 FROM generate_series(1, 1024)), ',') || ']')::vector, false);

-- Insert sample email data for testing with encrypted content
INSERT INTO email_memory (user_id, email_id, subject, sender, body, email_date, similarity_score, is_web_dev_related, llm_analyzed, llm_analysis) VALUES
('test_user_emails', 'test_email_1', 'U2FsdGVkX1+5qYY+Tt4FBikZTOO1cmEv8Dkz+Nhq/Bk=', 'U2FsdGVkX1/gFiUcmWzR2EX9XUCp/a7jSidRdqS2TCk=', 'U2FsdGVkX1974vj3dm2RiZl+VPoWJlRVJNcvLVirIYs=', NOW(), 0.85, true, true, '{"summary": "React help needed", "category": "technical", "priority": "medium"}'),
('test_user_emails', 'test_email_2', 'U2FsdGVkX1/vdUwTeMt2ud9oVxMc7H7miksp0X3n3QA=', 'U2FsdGVkX197u7telm9EtJcQbOJuAW0dwhMy6XB6lR0=', 'U2FsdGVkX18XmnD/mMSyJXMCaI34lAjb0JXanwGcgEw=', NOW(), 0.75, true, false, NULL);