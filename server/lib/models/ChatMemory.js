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

  static async updateChatTitle({ chatId, userId, title }) {
    await pool.query(
      `
 UPDATE chat_memory SET title = $1 
WHERE chat_id = $2 AND user_id = $3 AND role = 'user'
      `,
      [title, chatId, userId],
    );
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
      preview: row.user_messages ? row.user_messages.substring(0, 100) + '...' : 'No messages',
      title: row.title,
    }));
  }
}

// Export the class itself
export default ChatMemory;
