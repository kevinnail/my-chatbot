# Agentic Gmail MCP Setup Guide

This guide will help you set up the **Agentic Gmail MCP** (Model Context Protocol) functionality for your chatbot application. This implementation uses **100% local LLMs** via Ollama for intelligent job search assistance.

## 🤖 What Makes This Agentic?

Unlike simple automation, this agent:

- **Intelligently filters** job-related emails from your inbox
- **Analyzes context** to detect job applications, rejections, interviews, offers
- **Prioritizes emails** based on importance and urgency
- **Suggests actionable steps** for each email
- **Drafts responses** when appropriate
- **Uses local LLMs only** - no external API calls

## Prerequisites

1. **Google Cloud Project** with Gmail API enabled
2. **Ollama** running locally with your preferred model
3. **PostgreSQL** database configured
4. **Existing chatbot setup** (since this shares the same Ollama instance)

## Environment Variables

Add these environment variables to your `server/.env` file:

```env
# Google OAuth Configuration (for Gmail API)
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here
GOOGLE_REDIRECT_URI=http://localhost:4000/api/gmail/callback

# Client URL (for OAuth redirects)
CLIENT_URL=http://localhost:3000

# Ollama Configuration (should already be set for your chatbot)
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=llama3.1:8b
```

## Google Cloud Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Gmail API:
   - Go to "APIs & Services" > "Library"
   - Search for "Gmail API"
   - Click "Enable"

4. Create OAuth 2.0 credentials:
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "OAuth 2.0 Client ID"
   - Choose "Web application"
   - Add authorized redirect URIs:
     - `http://localhost:4000/api/gmail/callback`
   - Copy the Client ID and Client Secret

## Database Setup

Run the database setup to create the required tables:

```bash
npm run setup-db
```

This will create the following tables:

- `gmail_tokens` - Stores OAuth tokens for users
- `gmail_sync_status` - Tracks last sync times

## Ollama Model Requirements

The agent uses your existing Ollama setup. Ensure you have:

```bash
# Your main chat model (should already be running)
ollama run llama3.1:8b  # Or whatever model you're using

# Embedding model for context (should already be installed)
ollama run mxbai-embed-large
```

## Testing the Agentic Features

1. Start the server: `npm start`
2. Navigate to `http://localhost:3000/gmail-mcp`
3. Click "Connect Gmail"
4. Authorize the application
5. Click "🔍 Find Relevant Emails"

## 🎯 Agentic Features

### Smart Email Detection

- Searches your inbox for job-related emails (last 30 days)
- Uses keywords: interview, application, position, job, career, hiring, recruiter, etc.
- Filters out noise and focuses on relevant communications

### Intelligent Analysis

Each email gets analyzed for:

- **Job Relevance**: Is this actually job-related?
- **Category**: Application, rejection, interview, offer, etc.
- **Priority**: High, medium, low based on content
- **Sentiment**: Positive, negative, neutral
- **Action Items**: Specific steps you should take
- **Draft Responses**: When appropriate

### Filtering & Organization

- Filter by priority level
- Filter by job category
- Visual indicators for quick scanning
- Actionable insights prominently displayed

### Response Suggestions

- Generates contextual draft responses
- One-click to open in your email client
- Learns from your job search patterns

## Example Agent Analysis

```json
{
  "isJobRelated": true,
  "category": "job_interview",
  "priority": "high",
  "summary": "Interview invitation for Software Engineer position at TechCorp, scheduled for next Tuesday",
  "actionItems": [
    "Confirm interview availability",
    "Research TechCorp's recent projects",
    "Prepare technical questions",
    "Review job description details"
  ],
  "sentiment": "positive",
  "draftResponse": "Thank you for the interview opportunity. I'm excited to discuss the Software Engineer position. I'm available Tuesday at the proposed time. Looking forward to learning more about TechCorp's innovative projects."
}
```

## Advanced Configuration

### Model Tuning

For better job-search analysis, you can:

- Use a more specialized model if available
- Adjust temperature in the controller (currently 0.3 for consistency)
- Modify the system prompt for your specific needs

### Custom Keywords

Update the `jobKeywords` array in `gmailMcp.js` to include:

- Industry-specific terms
- Company names you've applied to
- Role-specific keywords

### Multi-Model Setup (Future)

The architecture supports:

- Switching between models based on task
- Dedicated summarization model
- Code analysis model for technical roles

## Troubleshooting

### Common Issues

1. **No Emails Found**: Check if you have job-related emails in the last 30 days
2. **Analysis Fails**: Ensure Ollama is running and model is loaded
3. **OAuth Error**: Make sure redirect URI matches exactly
4. **Database Connection**: Ensure PostgreSQL is running

### Debug Mode

Enable debug logging by adding to your `.env`:

```env
DEBUG=gmail-mcp
```

## Local LLM Benefits

✅ **Privacy**: All analysis happens locally
✅ **Cost**: No API fees
✅ **Customization**: Modify prompts and logic
✅ **Speed**: No external API latency
✅ **Reliability**: No external dependencies

## Security Notes

- OAuth tokens stored securely in database
- No email content sent to external services
- All processing happens on your machine
- Gmail API uses read-only permissions

## Future Enhancements

This MCP foundation enables:

- 📧 **Email categorization** for other purposes
- 📅 **Calendar integration** for interview scheduling
- 📄 **Resume optimization** based on job requirements
- 🔍 **Company research** automation
- 📊 **Job search analytics** and tracking

## Scaling the Agent

As your job search evolves:

- Add more sophisticated analysis
- Integrate with job boards
- Connect to LinkedIn
- Track application outcomes
- Build job search analytics

The MCP architecture makes all of this possible while keeping everything local and private! 🚀

---

**Remember**: This is a _true agent_ - it doesn't just summarize emails, it understands context, prioritizes actions, and helps you stay organized in your job search. All powered by your local LLM!
