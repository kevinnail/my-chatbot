import React, { useState, useEffect } from 'react';
import './GmailMCP.css';

const GmailMCP = ({ userId }) => {
  const [emails, setEmails] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState(null);
  const [lastSync, setLastSync] = useState(null);
  const [filterPriority, setFilterPriority] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');

  useEffect(() => {
    // Check if Gmail is connected on component mount
    checkGmailConnection();
  }, []);

  const checkGmailConnection = async () => {
    try {
      const response = await fetch(`/api/mcp/gmail/status/${userId}`);
      const data = await response.json();
      setIsConnected(data.connected);
      setConnectionError(data.error || null);
      if (data.lastSync) {
        setLastSync(new Date(data.lastSync));
      }
    } catch (err) {
      console.error('Error checking Gmail connection:', err);
      setConnectionError('Failed to check connection status');
    }
  };

  const connectGmail = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/mcp/gmail/connect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId }),
      });

      const data = await response.json();

      if (response.ok) {
        setIsConnected(true);
        setConnectionError(null);
        setLastSync(new Date());
      } else {
        throw new Error(data.error || 'Failed to connect to Gmail');
      }
    } catch (err) {
      setError(err.message);
      setConnectionError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const syncEmails = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/mcp/gmail/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId }),
      });

      if (response.ok) {
        const data = await response.json();
        setEmails(data.emails);
        setLastSync(new Date());
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to sync emails');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date) => {
    if (!date) return 'Never';
    return date.toLocaleString();
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high':
        return '#ff4444';
      case 'medium':
        return '#ff8800';
      case 'low':
        return '#888';
      default:
        return '#ccc';
    }
  };

  const getCategoryIcon = (category) => {
    switch (category) {
      case 'job_rejection':
        return '✗'; // Keep the X but cleaner
      case 'job_offer':
        return '★'; // Star for offers
      case 'job_interview':
        return '◆'; // Diamond for interviews
      default:
        return ''; // Remove other emojis
    }
  };

  const getSentimentIcon = (sentiment) => {
    // Remove all sentiment emojis - too "chatgpt like"
    return '';
  };

  const filteredEmails = emails.filter((email) => {
    const priorityMatch = filterPriority === 'all' || email.analysis?.priority === filterPriority;
    const categoryMatch = filterCategory === 'all' || email.analysis?.category === filterCategory;
    return priorityMatch && categoryMatch;
  });

  const jobCategories = [
    'all',
    'job_application',
    'job_rejection',
    'job_acceptance',
    'job_interview',
    'job_offer',
    'other',
  ];
  const priorities = ['all', 'high', 'medium', 'low'];

  return (
    <div className="gmail-mcp">
      <div className="gmail-mcp-header">
        <h2>Gmail Assistant (IMAP)</h2>
        <div className="connection-status">
          <span className={`status-indicator ${isConnected ? 'connected' : 'disconnected'}`}>
            {isConnected ? '●' : '●'}
          </span>
          <span>{isConnected ? 'Connected' : 'Disconnected'}</span>
        </div>
      </div>

      {!isConnected ? (
        <div className="connect-section">
          <h3>Connect to Gmail via IMAP</h3>
          <p>
            <strong>100% Local & Secure</strong> - No Google Cloud APIs required!
          </p>

          <div className="setup-instructions">
            <h4>Setup Instructions:</h4>
            <ol>
              <li>
                <strong>Enable Gmail IMAP:</strong>
                <br />
                Gmail Settings → Forwarding and POP/IMAP → Enable IMAP
              </li>
              <li>
                <strong>Create App Password:</strong>
                <br />
                Google Account → Security → 2-Step Verification → App passwords
              </li>
              <li>
                <strong>Add to server/.env:</strong>
                <pre>
                  GMAIL_USER=your.email@gmail.com{'\n'}
                  GMAIL_APP_PASSWORD=your_16_character_app_password
                </pre>
              </li>
              <li>
                <strong>Restart your server</strong>
              </li>
            </ol>
          </div>

          {connectionError && (
            <div className="connection-error">
              <strong>Connection Issue:</strong> {connectionError}
              <br />
              <small>Make sure you've completed the setup steps above.</small>
            </div>
          )}

          <div className="features-list">
            <p>
              <strong>Agentic Features:</strong>
            </p>
            <ul>
              <li>Smart job-related email detection</li>
              <li>Priority scoring and categorization</li>
              <li>Actionable insights and suggestions</li>
              <li>Local LLM analysis (no external APIs)</li>
              <li>Complete privacy - all processing local</li>
            </ul>
          </div>

          <button onClick={connectGmail} disabled={loading} className="connect-button">
            {loading ? 'Testing Connection...' : 'Test Gmail Connection'}
          </button>
        </div>
      ) : (
        <div className="email-section">
          <div className="sync-controls">
            <div className="sync-left">
              <button onClick={syncEmails} disabled={loading} className="sync-button">
                {loading ? 'Analyzing...' : 'Find Relevant Emails'}
              </button>
              <span className="last-sync">Last sync: {formatDate(lastSync)}</span>
            </div>

            <div className="filters">
              <select
                value={filterPriority}
                onChange={(e) => setFilterPriority(e.target.value)}
                className="filter-select"
              >
                <option value="all">All Priorities</option>
                {priorities.slice(1).map((priority) => (
                  <option key={priority} value={priority}>
                    {priority.charAt(0).toUpperCase() + priority.slice(1)} Priority
                  </option>
                ))}
              </select>

              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="filter-select"
              >
                <option value="all">All Categories</option>
                {jobCategories.slice(1).map((category) => (
                  <option key={category} value={category}>
                    {getCategoryIcon(category)}{' '}
                    {category.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {error && (
            <div className="error-message">
              <strong>Error:</strong> {error}
            </div>
          )}

          <div className="emails-container">
            {filteredEmails.length === 0 ? (
              <div className="no-emails">
                <p>No job-related emails found.</p>
                <p>The agent looks for relevant job search emails in your unread messages.</p>
                <p>Click "Find Relevant Emails" to analyze your inbox.</p>
              </div>
            ) : (
              <div className="emails-list">
                {filteredEmails.map((email, index) => (
                  <div
                    key={index}
                    className={`email-card priority-${email.analysis?.priority || 'medium'}`}
                  >
                    <div className="email-header">
                      <div className="email-main-info">
                        <div className="email-title-section">
                          <h4>{email.subject}</h4>
                          <div className="email-badges">
                            <span
                              className="priority-badge"
                              style={{
                                backgroundColor: getPriorityColor(email.analysis?.priority),
                              }}
                            >
                              {email.analysis?.priority || 'unknown'}
                            </span>
                            <span className="category-badge">
                              {getCategoryIcon(email.analysis?.category)}
                              {email.analysis?.category?.replace('_', ' ') || 'other'}
                            </span>
                          </div>
                        </div>
                        <div className="email-meta-compact">
                          <span className="email-from">{email.from}</span>
                          <span className="email-date">{formatDate(new Date(email.date))}</span>
                        </div>
                      </div>
                    </div>

                    <div className="email-content-compact">
                      <div className="email-summary-compact">
                        <strong>Summary:</strong> {email.analysis?.summary || email.summary}
                      </div>

                      {email.analysis?.actionItems && email.analysis.actionItems.length > 0 && (
                        <div className="action-items-compact">
                          <strong>Actions:</strong>
                          <span className="action-list">
                            {email.analysis.actionItems.join(' • ')}
                          </span>
                        </div>
                      )}

                      {email.analysis?.draftResponse && (
                        <div className="draft-response-compact">
                          <strong>Draft:</strong> {email.analysis.draftResponse}
                        </div>
                      )}
                    </div>

                    <div className="email-actions-compact">
                      <button
                        onClick={() => window.open(email.webLink, '_blank')}
                        className="view-email-button"
                      >
                        View Gmail
                      </button>
                      {email.analysis?.draftResponse && (
                        <button
                          onClick={() => {
                            const mailtoLink = `mailto:${email.from}?subject=Re: ${email.subject}&body=${encodeURIComponent(email.analysis.draftResponse)}`;
                            window.open(mailtoLink);
                          }}
                          className="draft-response-button"
                        >
                          Use Draft
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default GmailMCP;
