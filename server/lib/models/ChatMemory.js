import { pool } from '../utils/db.js';
import { getEmbedding } from '../utils/ollamaEmbed.js';
import { encrypt, decrypt } from '../services/encryption.js';
import { recursiveChunk } from '../utils/textChunking.js';

class ChatMemory {
  static async storeMessage({ chatId, userId, role, content }) {
    const startTime = performance.now();
    // eslint-disable-next-line no-console
    console.log(`Starting message storage for ${role} message (${content.length} chars)`);

    const messageId = `${chatId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const chunks = recursiveChunk(content);
    const isChunked = chunks.length > 1;

    if (isChunked) {
      // eslint-disable-next-line no-console
      console.log(`Content chunked into ${chunks.length} pieces`);
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Store full message
      // eslint-disable-next-line no-console
      console.log('Generating embedding for full message...');
      const fullEmbedding = await getEmbedding(content);
      await client.query(
        `INSERT INTO chat_memory (chat_id, user_id, message_id, role, content, embedding, is_chunked)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [chatId, userId, messageId, role, encrypt(content), fullEmbedding, isChunked],
      );

      // Store chunks if content was chunked
      if (isChunked) {
        // eslint-disable-next-line no-console
        console.log(`Generating embeddings for ${chunks.length} chunks...`);
        for (let i = 0; i < chunks.length; i++) {
          const chunk = chunks[i];
          // eslint-disable-next-line no-console
          console.log(`Processing chunk ${i + 1}/${chunks.length} (${chunk.length} chars)`);
          const chunkEmbedding = await getEmbedding(chunk);
          const chunkType = i === 0 ? 'paragraph' : 'sentence'; // Simplified type detection

          await client.query(
            `INSERT INTO chat_memory_chunks (chat_id, user_id, message_id, chunk_index, content, embedding, chunk_type)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [chatId, userId, messageId, i, encrypt(chunk), chunkEmbedding, chunkType],
          );
        }
      }

      await client.query(
        `INSERT INTO chats (chat_id, user_id)
         VALUES ($1, $2)
         ON CONFLICT (chat_id) DO NOTHING`,
        [chatId, userId],
      );

      await client.query('COMMIT');

      const endTime = performance.now();
      const duration = ((endTime - startTime) / 1000).toFixed(3);
      // eslint-disable-next-line no-console
      console.log(
        `✅ Message storage completed in ${duration} seconds (${isChunked ? `${chunks.length} chunks` : 'no chunking'})`,
      );
    } catch (error) {
      await client.query('ROLLBACK');
      const endTime = performance.now();
      const duration = ((endTime - startTime) / 1000).toFixed(3);
      console.error(`❌ Message storage failed after ${duration} seconds:`, error);
      throw error;
    } finally {
      client.release();
    }
  }

  static async getRelevantMessages({ chatId, userId, inputText, limit = 5 }) {
    const startTime = performance.now();
    // eslint-disable-next-line no-console
    console.log(`Starting relevant message search for "${inputText.substring(0, 50)}..."`);

    const queryEmbedding = await getEmbedding(inputText);

    // Search chunks first for better granular matching
    // eslint-disable-next-line no-console
    console.log('Searching chunks for relevant content...');
    const chunkRows = await pool.query(
      `
      SELECT message_id, chunk_index, content, embedding <-> $3 as distance
      FROM chat_memory_chunks
      WHERE chat_id = $1 AND user_id = $2
      ORDER BY embedding <-> $3
      LIMIT $4
    `,
      [chatId, userId, queryEmbedding, limit * 2], // Get more chunks to ensure we have enough messages
    );

    // Get unique message_ids from chunk results
    const messageIds = [...new Set(chunkRows.rows.map((row) => row.message_id))];
    // eslint-disable-next-line no-console
    console.log(
      `Found ${chunkRows.rows.length} relevant chunks from ${messageIds.length} messages`,
    );

    if (messageIds.length === 0) {
      // Fallback to full message search if no chunks found
      // eslint-disable-next-line no-console
      console.log('No chunks found, falling back to full message search...');
      const { rows } = await pool.query(
        `
        SELECT role, content, created_at
        FROM chat_memory
        WHERE chat_id = $1 AND user_id = $2
        ORDER BY embedding <-> $3
        LIMIT $4
      `,
        [chatId, userId, queryEmbedding, limit],
      );

      const endTime = performance.now();
      const duration = ((endTime - startTime) / 1000).toFixed(3);
      // eslint-disable-next-line no-console
      console.log(
        `✅ Message search completed in ${duration} seconds (fallback mode, ${rows.length} messages)`,
      );

      return rows.map(({ role, content, created_at }) => ({
        role,
        content: decrypt(content),
        timestamp: created_at,
      }));
    }

    // Get full messages for the relevant message_ids
    // eslint-disable-next-line no-console
    console.log('Retrieving full messages for relevant chunks...');
    const { rows } = await pool.query(
      `
      SELECT role, content, created_at
      FROM chat_memory
      WHERE chat_id = $1 AND user_id = $2 AND message_id = ANY($3)
      ORDER BY created_at ASC
    `,
      [chatId, userId, messageIds],
    );

    const endTime = performance.now();
    const duration = ((endTime - startTime) / 1000).toFixed(3);
    // eslint-disable-next-line no-console
    console.log(
      `✅ Message search completed in ${duration} seconds (chunk mode, ${rows.length} messages)`,
    );

    return rows.map(({ role, content, created_at }) => ({
      role,
      content: decrypt(content),
      timestamp: created_at,
    }));
  }

  static async getRecentMessages({ chatId, userId, limit = 5 }) {
    const { rows } = await pool.query(
      `
      SELECT role, content, created_at
      FROM chat_memory
      WHERE chat_id = $1 AND user_id = $2
      ORDER BY created_at DESC
      LIMIT $3
    `,
      [chatId, userId, limit],
    );

    return rows
      .map(({ role, content, created_at }) => ({
        role,
        content: decrypt(content),
        timestamp: created_at,
      }))
      .reverse(); // Most recent last
  }

  static async getHybridMessages({
    chatId,
    userId,
    inputText,
    relevantLimit = 3,
    recentLimit = 5,
  }) {
    const [relevant, recent] = await Promise.all([
      this.getRelevantMessages({ chatId, userId, inputText, limit: relevantLimit }),
      this.getRecentMessages({ chatId, userId, limit: recentLimit }),
    ]);

    // Start with recent messages (prioritizing recency)
    const combined = [...recent];

    // Add relevant messages only if they're not already in recent
    for (const msg of relevant) {
      if (!combined.some((existing) => existing.content === msg.content)) {
        combined.push(msg);
      }
    }

    // Sort by timestamp for chronological order
    return combined.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  }

  static async getAllMessages({ chatId, userId }) {
    const { rows } = await pool.query(
      `
      SELECT role, content
      FROM chat_memory
      WHERE chat_id = $1 AND user_id = $2
      ORDER BY created_at ASC
    `,
      [chatId, userId],
    );

    return rows.map(({ role, content }) => ({
      role,
      content: decrypt(content),
    }));
  }

  // Additional utility methods
  static async deleteUserMessages({ userId }) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      await client.query(
        `
      DELETE FROM chat_memory_chunks WHERE user_id = $1;
      `,
        [userId],
      );

      await client.query(
        `
      DELETE FROM chat_memory WHERE user_id = $1;
      `,
        [userId],
      );

      await client.query(
        `
      DELETE FROM chats WHERE user_id = $1;
      `,
        [userId],
      );

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  static async deleteChatMessages({ chatId, userId }) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      await client.query(
        `
      DELETE FROM chat_memory_chunks WHERE chat_id = $1 AND user_id = $2;
         `,
        [chatId, userId],
      );

      await client.query(
        `
      DELETE FROM chat_memory WHERE chat_id = $1 AND user_id = $2;
         `,
        [chatId, userId],
      );

      await client.query(
        `
        DELETE FROM chats WHERE chat_id = $1 AND user_id = $2;
        `,
        [chatId, userId],
      );

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  static async getMessageCount({ chatId, userId }) {
    const { rows } = await pool.query(
      `
      SELECT COUNT(*) as count FROM chat_memory WHERE chat_id = $1 AND user_id = $2
    `,
      [chatId, userId],
    );

    return parseInt(rows[0].count);
  }

  static async updateChatTitle({ chatId, userId, title }) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      await client.query(
        `UPDATE chat_memory SET title = $1 
         WHERE chat_id = $2 AND user_id = $3 AND role = 'user'`,
        [encrypt(title), chatId, userId],
      );

      await client.query('UPDATE chats SET title = $1 WHERE chat_id = $2 AND user_id = $3', [
        encrypt(title),
        chatId,
        userId,
      ]);

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  static async hasTitle({ chatId, userId }) {
    const { rows } = await pool.query(
      "SELECT title FROM chat_memory WHERE chat_id = $1 AND user_id = $2 AND role = 'user' ORDER BY created_at ASC LIMIT 1",
      [chatId, userId],
    );
    return rows.length > 0 && rows[0].title !== null;
  }

  static async getChatList(userId) {
    const { rows } = await pool.query(
      `
      SELECT 
        c.chat_id,
        c.title,
        c.created_at as first_message,
        c.updated_at as last_message,
        COUNT(cm.id) as message_count,
        STRING_AGG(
          CASE WHEN cm.role = 'user' THEN cm.content ELSE NULL END, 
          ' | ' ORDER BY cm.created_at
        ) as user_messages
      FROM chats c
      LEFT JOIN chat_memory cm ON c.chat_id = cm.chat_id
      WHERE c.user_id = $1 
      GROUP BY c.chat_id, c.title, c.created_at, c.updated_at
      ORDER BY c.updated_at DESC
    `,
      [userId],
    );

    return rows.map((row) => ({
      id: row.chat_id,
      chatId: row.chat_id,
      messageCount: parseInt(row.message_count),
      firstMessage: row.first_message,
      lastMessage: row.last_message,
      preview: row.user_messages
        ? (decrypt(row.user_messages) || '').substring(0, 100) + '...'
        : 'No messages',
      title: row.title ? decrypt(row.title) : null,
    }));
  }
}

// Export the class itself
export default ChatMemory;
