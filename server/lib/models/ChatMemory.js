import { pool } from '../utils/db.js';
import { getEmbedding } from '../utils/ollamaEmbed.js';

class ChatMemory {
  static async storeMessage({ userId, role, content }) {
    const embedding = await getEmbedding(content);
    
    await pool.query(`
      INSERT INTO chat_memory (user_id, role, content, embedding)
      VALUES ($1, $2, $3, $4)
    `, [userId, role, content, embedding]);
  }

  static async getRelevantMessages({ userId, inputText, limit = 5 }) {
    const queryEmbedding = await getEmbedding(inputText);

    const { rows } = await pool.query(`
      SELECT role, content, created_at
      FROM chat_memory
      WHERE user_id = $1
      ORDER BY embedding <-> $2
      LIMIT $3
    `, [userId, queryEmbedding, limit]);

    return rows.map(({ role, content, created_at }) => ({ 
      role, 
      content,
      timestamp: created_at
    }));
  }

  static async getRecentMessages({ userId, limit = 5 }) {
    const { rows } = await pool.query(`
      SELECT role, content, created_at
      FROM chat_memory
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    `, [userId, limit]);

    return rows.map(({ role, content, created_at }) => ({ 
      role, 
      content,
      timestamp: created_at
    })).reverse(); // Most recent last
  }

  static async getHybridMessages({ userId, inputText, relevantLimit = 3, recentLimit = 5 }) {
    const [relevant, recent] = await Promise.all([
      this.getRelevantMessages({ userId, inputText, limit: relevantLimit }),
      this.getRecentMessages({ userId, limit: recentLimit })
    ]);

    // Combine and deduplicate based on content
    const combined = [...relevant];
    for (const msg of recent) {
      if (!combined.some(existing => existing.content === msg.content)) {
        combined.push(msg);
      }
    }

    // Sort by timestamp for chronological order
    return combined.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  }

  static async getAllMessages({ userId }) {
    const { rows } = await pool.query(`
      SELECT role, content
      FROM chat_memory
      WHERE user_id = $1
      ORDER BY created_at ASC
    `, [userId]);

    return rows.map(({ role, content }) => ({ 
      role, 
      content 
    }));
  }

  // Additional utility methods
  static async deleteUserMessages({ userId }) {
    await pool.query(`
      DELETE FROM chat_memory WHERE user_id = $1
    `, [userId]);
  }

  static async getMessageCount(userId) {
    const { rows } = await pool.query(`
      SELECT COUNT(*) as count FROM chat_memory WHERE user_id = $1
    `, [userId]);
    
    return parseInt(rows[0].count);
  }
}

// Export the class itself
export default ChatMemory;

// Export specific functions for backward compatibility
export const storeMessage = ChatMemory.storeMessage.bind(ChatMemory);
export const getAllMessages = ChatMemory.getAllMessages.bind(ChatMemory);
