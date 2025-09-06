# 🔒 Gmail IMAP Setup Guide (100% Local & Free)

This guide will help you set up Gmail access using IMAP - **no Google Cloud account required!** Everything runs locally with your existing Ollama setup.

## ✅ Why IMAP?

- **🆓 Completely free** - no external services
- **🔒 100% local** - no cloud APIs
- **🚀 Simple setup** - just username and app password
- **🤖 Same agentic intelligence** - powered by your local LLM
- **📧 Works with any email provider** - Gmail, Outlook, Yahoo, etc.

## 📋 Step-by-Step Setup

### Step 1: Enable Gmail IMAP Access

1. **Go to Gmail Settings:**
   - Open Gmail in your browser
   - Click the gear icon (⚙️) in the top right
   - Select "See all settings"

2. **Enable IMAP:**
   - Click the "Forwarding and POP/IMAP" tab
   - In the "IMAP access" section, select "Enable IMAP"
   - Click "Save Changes"

### Step 2: Choose Your Authentication Method

**Option A: Regular Google Password (Simpler)**

- If you don't have 2-factor authentication enabled
- Use your normal Google account password
- ⚠️ **Security Note**: Less secure than App Passwords

**Option B: App Password (More Secure)**

- If you have 2-factor authentication enabled (recommended)
- Must generate a special 16-character App Password
- 🔒 **Security Note**: More secure and recommended

### Step 3A: Using Regular Password (No 2FA)

If you chose Option A:

- Skip to Step 4
- Use your regular Google password in the configuration
- Your password can be any length

### Step 3B: Create Gmail App Password (With 2FA)

If you chose Option B:

1. **Enable 2-Step Verification first (if not already):**
   - Visit [myaccount.google.com](https://myaccount.google.com)
   - Click "Security" in the left sidebar
   - Look for "2-Step Verification" and enable it

2. **Generate App Password:**
   - Still in Google Account Security settings
   - Look for "App passwords" (only visible after 2FA is enabled)
   - Click "App passwords"
   - Select "Mail" from the dropdown
   - Click "Generate"
   - **Copy the 16-character password** (you'll need this!)

### Step 4: Configure Your Application

Add these environment variables to your `server/.env` file:

```env
# Gmail IMAP Configuration
GMAIL_USER=your.email@gmail.com
GMAIL_APP_PASSWORD=your_password_or_app_password

# For GMAIL_APP_PASSWORD, use either:
# - Your regular Google password (if no 2FA)
# - Your 16-character App Password (if 2FA enabled)

# Optional IMAP settings (defaults shown)
GMAIL_IMAP_HOST=imap.gmail.com
GMAIL_IMAP_PORT=993

# Make sure these are also set for your LLM
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=llama3.1:8b
```

### Step 5: Update Database Schema

Run the database setup to create the required tables:

```bash
cd server
npm run setup-db
```

### Step 6: Restart Your Server

```bash
npm start
```

## 🧪 Testing Your Setup

1. **Start your application:**

   ```bash
   npm run dev
   ```

2. **Navigate to Gmail MCP:**
   - Open `http://localhost:3000/gmail-mcp`

3. **Test Connection:**
   - Click "Test Gmail Connection"
   - Should show "Connected" if successful

4. **Find Emails:**
   - Click "Find Relevant Emails"
   - Watch your local LLM analyze job-related emails!

## 🎯 How It Works

### Email Detection

- Searches unread emails for job-related keywords
- Uses IMAP search to filter by subjects and content
- Processes up to 50 emails per sync

### Agentic Analysis

For each relevant email, your local LLM analyzes:

- **Job Relevance**: Is this actually job-related?
- **Category**: Application, rejection, interview, offer, etc.
- **Priority**: High, medium, low
- **Sentiment**: Positive, negative, neutral
- **Action Items**: Specific next steps
- **Draft Response**: Suggested reply when appropriate

### Privacy Features

- ✅ **All analysis happens locally** - no external API calls
- ✅ **No email storage** - emails are processed and discarded
- ✅ **Secure connection** - IMAP uses SSL/TLS encryption
- ✅ **App password** - more secure than regular password

## 🔧 Advanced Configuration

### Custom Keywords

Edit `server/lib/controllers/gmailMcp.js` to add industry-specific terms:

```javascript
const jobKeywords = [
  'interview',
  'application',
  'position',
  'job',
  'career',
  // Add your own keywords here
  'software engineer',
  'developer',
  'react',
  'node.js',
];
```

### Search Optimization

Modify the IMAP search criteria to focus on specific timeframes or senders:

```javascript
// Example: Only search emails from last 7 days
const searchDate = new Date();
searchDate.setDate(searchDate.getDate() - 7);
```

### Model Tuning

Adjust the LLM parameters for better job search analysis:

```javascript
// In analyzeEmailWithLLM function
options: {
  temperature: 0.2, // Lower for more consistent analysis
  top_p: 0.8,       // Adjust creativity
}
```

## 🛠️ Troubleshooting

### Common Issues

**1. "IMAP connection failed"**

- Check your username and password
- If using regular password: make sure it's your correct Google account password
- If using App Password: ensure it's the 16-character code from Google
- Ensure IMAP is enabled in Gmail settings
- Note: If you have 2FA enabled, you MUST use an App Password (not your regular password)

**2. "IMAP credentials not configured"**

- Make sure `GMAIL_USER` and `GMAIL_APP_PASSWORD` are in your `.env` file
- Restart your server after adding environment variables

**3. "No emails found"**

- Check if you have unread emails
- Try sending yourself a test email with job-related keywords
- Verify your email account has job-related emails

**4. "Analysis failed"**

- Ensure Ollama is running: `ollama serve`
- Check if your model is loaded: `ollama list`
- Verify `OLLAMA_URL` and `OLLAMA_MODEL` in your `.env`

### Debug Mode

Enable detailed logging by adding to your `.env`:

```env
DEBUG=gmail-mcp
```

## 📊 Performance Tips

### For Better Results:

- Use recent emails (last 30 days) for better context
- Keep email bodies under 2000 characters for faster analysis
- Consider using a smaller, faster model for email analysis

### For Faster Processing:

- Limit search results to 20-30 emails per sync
- Use specific IMAP search criteria
- Process emails in batches

## 🔄 Migration from Gmail API

If you previously set up the Gmail API version:

1. **Remove Google Cloud dependencies:**

   ```bash
   npm uninstall googleapis
   ```

2. **Update environment variables:**
   - Remove `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`
   - Add `GMAIL_USER` and `GMAIL_APP_PASSWORD`

3. **Run database migration:**
   ```bash
   npm run setup-db
   ```

## 🚀 What's Next?

Your agentic Gmail assistant is now ready! It will:

- **🔍 Intelligently find** job-related emails
- **📊 Categorize and prioritize** them automatically
- **💡 Suggest actionable next steps**
- **💬 Draft responses** when appropriate
- **🤖 Learn from your job search patterns**

All powered by your local LLM - no external dependencies, complete privacy, and zero ongoing costs!

## 🔮 Future Enhancements

The IMAP foundation enables:

- **📧 Multi-account support** (personal + work emails)
- **📅 Calendar integration** for interview scheduling
- **🔄 Automated responses** for common scenarios
- **📊 Job search analytics** and tracking
- **🎯 Custom filters** for different job types

---

**🎉 Congratulations!** You now have a completely local, privacy-respecting, agentic email assistant that helps with your job search. No cloud services, no API fees, just pure local intelligence!
