import { pool } from '../utils/db.js';
import { getEmbedding } from '../utils/ollamaEmbed.js';

class ChatMemory {
  static async storeMessage({ chatId, userId, role, content }) {
    const embedding = await getEmbedding(content);

    await pool.query(
      `
      INSERT INTO chat_memory (chat_id, user_id, role, content, embedding)
      VALUES ($1, $2, $3, $4, $5)
    `,
      [chatId, userId, role, content, embedding],
    );
  }

  static async getRelevantMessages({ chatId, userId, inputText, limit = 5 }) {
    const queryEmbedding = await getEmbedding(inputText);

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

    return rows.map(({ role, content, created_at }) => ({
      role,
      content,
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
        content,
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
      content,
    }));
  }

  // Additional utility methods
  static async deleteUserMessages({ userId }) {
    await pool.query(
      `
      DELETE FROM chat_memory WHERE user_id = $1
    `,
      [userId],
    );
  }

  static async deleteChatMessages({ chatId, userId }) {
    await pool.query(
      `
      DELETE FROM chat_memory WHERE chat_id = $1 AND user_id = $2
    `,
      [chatId, userId],
    );
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

  static async getChatList(userId) {
    const { rows } = await pool.query(
      `
      SELECT 
        chat_id,
        COUNT(*) as message_count,
        MIN(created_at) as first_message,
        MAX(created_at) as last_message,
        STRING_AGG(
          CASE WHEN role = 'user' THEN content ELSE NULL END, 
          ' | ' ORDER BY created_at
        ) as user_messages
      FROM chat_memory 
      WHERE user_id = $1 
      GROUP BY chat_id
      ORDER BY MAX(created_at) DESC
    `,
      [userId],
    );

    return rows.map((row) => ({
      id: row.chat_id,
      chatId: row.chat_id,
      messageCount: parseInt(row.message_count),
      firstMessage: row.first_message,
      lastMessage: row.last_message,
      preview: row.user_messages ? row.user_messages.substring(0, 100) + '...' : 'No messages',
    }));
  }
}

// Export the class itself
export default ChatMemory;

// Export specific functions for backward compatibility
export const storeMessage = ChatMemory.storeMessage.bind(ChatMemory);
export const getAllMessages = ChatMemory.getAllMessages.bind(ChatMemory);
