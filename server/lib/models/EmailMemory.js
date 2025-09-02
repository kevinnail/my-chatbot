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
    // Check if this might be an appointment email
    const emailContent = `${subject} ${body} ${sender}`;
    const isAppointmentRelated =
      /\b(appointment|appt|meeting|call|schedule|scheduled|reschedule|confirm|confirmation|reminder|calendar|invite|invitation|doctor|dentist|medical|clinic|hospital|consultation|follow-up|follow up|catch up|phone call|video call|zoom|teams|meet|coffee|lunch|dinner|one-on-one|standup|sync|check-in|service|maintenance)\b/i.test(
        emailContent,
      );

    if (isAppointmentRelated) {
      console.log(
        ` Storing appointment-related email: "${subject}" (similarity: ${similarityScore?.toFixed(3)})`,
      );
    }
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

  // Get emails that need LLM analysis (high similarity OR appointment-related but not yet analyzed)
  static async getEmailsNeedingAnalysis({ userId, minSimilarity, limit = 10 }) {
    console.log(
      ` Getting emails needing analysis for user ${userId} with minSimilarity ${minSimilarity}`,
    );

    const { rows } = await pool.query(
      `
      SELECT 
        email_id, subject, sender, body, email_date, similarity_score, created_at,
        CASE WHEN similarity_score >= $2 THEN 'web_dev' ELSE 'appointment' END as selection_reason
      FROM email_memory
      WHERE user_id = $1 AND llm_analyzed = false
      AND (
        similarity_score >= $2
        OR subject ILIKE '%appt%'
        OR subject ILIKE '%appointment%'
        OR subject ILIKE '%meeting%'
        OR subject ILIKE '%call%'
        OR subject ILIKE '%schedule%'
        OR subject ILIKE '%scheduled%'
        OR subject ILIKE '%reschedule%'
        OR subject ILIKE '%confirm%'
        OR subject ILIKE '%confirmation%'
        OR subject ILIKE '%reminder%'
      )
      ORDER BY 
        CASE WHEN similarity_score >= $2 THEN 0 ELSE 1 END, -- Web dev emails first
        similarity_score DESC, 
        email_date DESC
      LIMIT $3
    `,
      [userId, minSimilarity, limit],
    );

    console.log(` Found ${rows.length} emails needing analysis:`);
    rows.forEach((row) => {
      console.log(
        `  - "${row.subject}" (${row.selection_reason}, similarity: ${row.similarity_score?.toFixed(3)})`,
      );
    });

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

  // Get email by ID
  static async getEmailById(userId, emailId) {
    const { rows } = await pool.query(
      'SELECT email_id, subject, sender, body, email_date, similarity_score, llm_analysis, llm_analyzed FROM email_memory WHERE user_id = $1 AND email_id = $2',
      [userId, emailId],
    );
    return rows[0];
  }
}

export default EmailMemory;
