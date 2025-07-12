import { pool } from '../utils/db.js';
import { getEmbedding } from '../utils/ollamaEmbed.js';

class EmailMemory {
  // Store email with vector embedding and similarity score
  static async storeEmail({
    userId,
    emailId,
    subject,
    sender,
    body,
    emailDate,
    similarityScore = 0,
    llmAnalysis = null,
  }) {
    const emailContent = `${subject} ${body} ${sender}`;
    const embedding = await getEmbedding(emailContent);

    const query = `
      INSERT INTO email_memory (
        user_id, email_id, subject, sender, body, email_date, embedding, similarity_score,
        is_web_dev_related, category, priority, sentiment, action_items, llm_analysis, llm_analyzed
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      ON CONFLICT (user_id, email_id) DO UPDATE SET
        subject = EXCLUDED.subject,
        sender = EXCLUDED.sender,
        body = EXCLUDED.body,
        email_date = EXCLUDED.email_date,
        embedding = EXCLUDED.embedding,
        similarity_score = EXCLUDED.similarity_score,
        is_web_dev_related = EXCLUDED.is_web_dev_related,
        category = EXCLUDED.category,
        priority = EXCLUDED.priority,
        sentiment = EXCLUDED.sentiment,
        action_items = EXCLUDED.action_items,
        llm_analysis = EXCLUDED.llm_analysis,
        llm_analyzed = EXCLUDED.llm_analyzed,
        updated_at = CURRENT_TIMESTAMP
      RETURNING id
    `;

    const values = [
      userId,
      emailId,
      subject,
      sender,
      body,
      emailDate,
      embedding,
      similarityScore,
      llmAnalysis?.isWebDevRelated || false,
      llmAnalysis?.category || 'other',
      llmAnalysis?.priority || 'medium',
      llmAnalysis?.sentiment || 'neutral',
      llmAnalysis?.actionItems || [],
      llmAnalysis || {},
      llmAnalysis !== null,
    ];

    const result = await pool.query(query, values);
    return result.rows[0];
  }

  // Check if email exists
  static async emailExists(userId, emailId) {
    const { rows } = await pool.query(
      'SELECT id FROM email_memory WHERE user_id = $1 AND email_id = $2',
      [userId, emailId],
    );
    return rows.length > 0;
  }

  // Get web dev related emails using vector similarity
  static async getWebDevEmails({ userId, limit = 20, since = null }) {
    let query = `
      SELECT 
        email_id, subject, sender, body, email_date, similarity_score, category, priority, 
        sentiment, action_items, llm_analysis, llm_analyzed, created_at
      FROM email_memory
      WHERE user_id = $1 AND is_web_dev_related = true
    `;

    const values = [userId];

    if (since) {
      query += ` AND email_date > $2`;
      values.push(since);
    }

    query += ` ORDER BY email_date DESC LIMIT $${values.length + 1}`;
    values.push(limit);

    const { rows } = await pool.query(query, values);
    return rows;
  }

  // Find similar emails using vector search
  static async findSimilarEmails({ userId, queryText, limit = 5 }) {
    const queryEmbedding = await getEmbedding(queryText);

    const { rows } = await pool.query(
      `
      SELECT 
        email_id, subject, sender, body, email_date, category, priority,
        sentiment, action_items, llm_analysis, created_at,
        embedding <-> $2 as distance
      FROM email_memory
      WHERE user_id = $1 AND is_web_dev_related = true
      ORDER BY embedding <-> $2
      LIMIT $3
    `,
      [userId, queryEmbedding, limit],
    );

    return rows;
  }

  // Get emails by category
  static async getEmailsByCategory({ userId, category, limit = 10 }) {
    const { rows } = await pool.query(
      `
      SELECT 
        email_id, subject, sender, body, email_date, category, priority,
        sentiment, action_items, llm_analysis, created_at
      FROM email_memory
      WHERE user_id = $1 AND category = $2 AND is_web_dev_related = true
      ORDER BY email_date DESC
      LIMIT $3
    `,
      [userId, category, limit],
    );

    return rows;
  }

  // Get emails by priority
  static async getEmailsByPriority({ userId, priority, limit = 10 }) {
    const { rows } = await pool.query(
      `
      SELECT 
        email_id, subject, sender, body, email_date, category, priority,
        sentiment, action_items, llm_analysis, created_at
      FROM email_memory
      WHERE user_id = $1 AND priority = $2 AND is_web_dev_related = true
      ORDER BY email_date DESC
      LIMIT $3
    `,
      [userId, priority, limit],
    );

    return rows;
  }

  // Get recent emails that might be relevant to a query
  static async getRelevantEmails({ userId, queryText, limit = 10 }) {
    const queryEmbedding = await getEmbedding(queryText);

    const { rows } = await pool.query(
      `
      SELECT 
        email_id, subject, sender, body, email_date, category, priority,
        sentiment, action_items, llm_analysis, created_at,
        embedding <-> $2 as distance
      FROM email_memory
      WHERE user_id = $1 AND is_web_dev_related = true
      AND email_date > NOW() - INTERVAL '30 days'
      ORDER BY embedding <-> $2
      LIMIT $3
    `,
      [userId, queryEmbedding, limit],
    );

    return rows;
  }

  // Get emails that need LLM analysis (high similarity but not yet analyzed)
  static async getEmailsNeedingAnalysis({ userId, minSimilarity = 0.55, limit = 10 }) {
    const { rows } = await pool.query(
      `
      SELECT 
        email_id, subject, sender, body, email_date, similarity_score, created_at
      FROM email_memory
      WHERE user_id = $1 AND similarity_score >= $2 AND llm_analyzed = false
      ORDER BY similarity_score DESC, email_date DESC
      LIMIT $3
    `,
      [userId, minSimilarity, limit],
    );

    return rows;
  }

  // Get unanalyzed emails (for batch processing)
  static async getUnanalyzedEmails({ userId, limit = 50 }) {
    const { rows } = await pool.query(
      `
      SELECT 
        email_id, subject, sender, body, email_date, created_at
      FROM email_memory
      WHERE user_id = $1 AND (llm_analysis IS NULL OR llm_analysis = '{}')
      ORDER BY email_date DESC
      LIMIT $2
    `,
      [userId, limit],
    );

    return rows;
  }

  // Update email analysis
  static async updateEmailAnalysis(userId, emailId, llmAnalysis) {
    const query = `
      UPDATE email_memory SET
        is_web_dev_related = $3,
        category = $4,
        priority = $5,
        sentiment = $6,
        action_items = $7,
        llm_analysis = $8,
        llm_analyzed = true,
        updated_at = CURRENT_TIMESTAMP
      WHERE user_id = $1 AND email_id = $2
      RETURNING id
    `;

    const values = [
      userId,
      emailId,
      llmAnalysis?.isWebDevRelated || false,
      llmAnalysis?.category || 'other',
      llmAnalysis?.priority || 'medium',
      llmAnalysis?.sentiment || 'neutral',
      llmAnalysis?.actionItems || [],
      llmAnalysis || {},
    ];

    const result = await pool.query(query, values);
    return result.rows[0];
  }

  // Delete old emails to keep storage manageable
  static async cleanupOldEmails({ userId, daysToKeep = 90 }) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const { rowCount } = await pool.query(
      `
      DELETE FROM email_memory
      WHERE user_id = $1 AND email_date < $2
    `,
      [userId, cutoffDate],
    );

    return rowCount;
  }

  // Get email statistics
  static async getEmailStats(userId) {
    const { rows } = await pool.query(
      `
      SELECT 
        COUNT(*) as total_emails,
        COUNT(CASE WHEN is_web_dev_related = true THEN 1 END) as web_dev_emails,
        COUNT(CASE WHEN category = 'job_interview' THEN 1 END) as interviews,
        COUNT(CASE WHEN category = 'job_offer' THEN 1 END) as offers,
        COUNT(CASE WHEN priority = 'high' THEN 1 END) as high_priority,
        MIN(email_date) as oldest_email,
        MAX(email_date) as newest_email
      FROM email_memory
      WHERE user_id = $1
    `,
      [userId],
    );

    return rows[0];
  }
}

export default EmailMemory;
