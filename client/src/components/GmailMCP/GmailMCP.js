import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import './GmailMCP.css';
import GoogleCalendar from '../GoogleCalendar/GoogleCalendar.js';

const GmailMCP = ({ userId }) => {
  const [emails, setEmails] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState(null);
  const [lastSync, setLastSync] = useState(null);
  const [filterPriority, setFilterPriority] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [syncStartTime, setSyncStartTime] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [analysisProgress, setAnalysisProgress] = useState({ analyzed: 0, total: 0 });
  const [analysisInProgress, setAnalysisInProgress] = useState(false);
  const socketRef = useRef(null);
  // Initialize Socket.IO connection
  useEffect(() => {
    const socket = io('http://localhost:4000');
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('Connected to real-time updates');
      socket.emit('join-sync-updates', userId);
    });

    socket.on('connect_error', (error) => {
      console.error('🔌 Socket.IO connection error:', error);
    });

    socket.on('email-analyzed', (data) => {
      console.log('🔍 Email analysis complete:', data);
      console.log('🔍 Looking for email ID:', data.emailId);
      console.log('🔍 Analysis data received:', data.analysis);

      setAnalysisProgress({ analyzed: data.analyzedCount, total: data.totalToAnalyze });

      // Update the specific email with analysis results
      setEmails((prevEmails) => {
        console.log('📧 Current emails before update:');
        prevEmails.forEach((e, i) => {
          console.log(
            `  ${i}: ID=${e.id}, Status=${e.status}, Summary="${e.summary?.substring(0, 50)}..."`,
          );
        });

        const emailFound = prevEmails.find((email) => email.id === data.emailId);
        console.log('📧 Email found in state:', emailFound ? 'YES' : 'NO');
        if (emailFound) {
          console.log('📧 Found email details:', {
            id: emailFound.id,
            currentStatus: emailFound.status,
            currentSummary: emailFound.summary?.substring(0, 50),
          });
        }

        const updated = prevEmails.map((email) =>
          email.id === data.emailId
            ? {
                ...email,
                analysis: data.analysis,
                analyzed: true,
                status: 'analyzed',
                summary: data.analysis?.summary || email.summary,
                category: data.analysis?.category,
                priority: data.analysis?.priority,
              }
            : email,
        );

        console.log('📧 Updated emails after mapping:');
        updated.forEach((e, i) => {
          if (e.id === data.emailId) {
            console.log(
              `  ✅ ${i}: ID=${e.id}, Status=${e.status}, Summary="${e.summary?.substring(0, 50)}..."`,
            );
          }
        });

        return updated;
      });
    });

    socket.on('sync-complete', (data) => {
      console.log('✅ Sync complete:', data);
      setAnalysisInProgress(false);
      setLoading(false);
      setSyncStartTime(null);
      setAnalysisProgress({ analyzed: data.analyzed, total: data.analyzed });
    });

    socket.on('sync-error', (data) => {
      console.error('❌ Sync error:', data);
      setError(data.error);
      setAnalysisInProgress(false);
      setLoading(false);
      setSyncStartTime(null);
    });

    socket.on('disconnect', () => {
      console.log('Disconnected from real-time updates');
    });

    return () => {
      socket.disconnect();
    };
  }, [userId]);

  const calculateTimeSinceSync = () => {
    if (!syncStartTime) return null;
    const now = currentTime;
    const startTime = new Date(syncStartTime);
    const diffTime = Math.abs(now - startTime);
    const diffMinutes = Math.floor(diffTime / (1000 * 60));
    const diffSeconds = Math.floor((diffTime % (1000 * 60)) / 1000);

    if (diffMinutes === 0) {
      return `${diffSeconds}s ago`;
    } else if (diffMinutes === 1) {
      return '1 min ago';
    } else {
      return `${diffMinutes} mins ago`;
    }
  };

  // Update current time every 30 seconds for sync time display (only when needed)
  useEffect(() => {
    // Only run interval if we're loading or have a sync start time to display
    if (loading || syncStartTime) {
      const interval = setInterval(() => {
        console.log('Updating sync timer display');
        setCurrentTime(new Date());
      }, 30000); // Update every 30 seconds

      return () => clearInterval(interval);
    }
  }, [loading, syncStartTime]);

  // Check if Gmail is connected on component mount
  useEffect(() => {
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
      setSyncStartTime(new Date());
      setAnalysisInProgress(true);
      setAnalysisProgress({ analyzed: 0, total: 0 });

      const response = await fetch('/api/mcp/gmail/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId }),
      });

      if (response.ok) {
        const data = await response.json();

        // Set preliminary results immediately
        setEmails(data.emails);
        setLastSync(new Date());
        setLoading(false); // Stop loading since we have preliminary results

        // Analysis continues in background via Socket.IO
        if (data.analysisInProgress) {
          console.log('Preliminary results loaded, analysis continuing...');
        } else {
          // No analysis needed, sync complete
          setAnalysisInProgress(false);
          setSyncStartTime(null);
        }
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to sync emails');
      }
    } catch (err) {
      setError(err.message);
      setSyncStartTime(null);
      setAnalysisInProgress(false);
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

  const getStatusIndicator = (email) => {
    if (email.status === 'analyzed' || email.analyzed) {
      return '✅';
    } else if (analysisInProgress) {
      return '🔄';
    } else {
      return '⏳';
    }
  };

  const filteredEmails = emails.filter((email) => {
    const priorityMatch = filterPriority === 'all' || email.analysis?.priority === filterPriority;
    const categoryMatch = filterCategory === 'all' || email.analysis?.category === filterCategory;
    return priorityMatch && categoryMatch;
  });

  const webDevCategories = [
    'all',
    'job_application',
    'job_rejection',
    'job_acceptance',
    'job_interview',
    'job_offer',
    'event',
    'learning',
    'tools',
    'networking',
    'newsletter',
    'community',
    'freelance',
    'other',
  ];
  const priorities = ['all', 'high', 'medium', 'low'];

  return (
    <div className="gmail-mcp">
      <div className="gmail-mcp-header">
        <h2>Gmail Assistant (Web Dev)</h2>
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
              <strong>Smart Web Dev Email Features:</strong>
            </p>
            <ul>
              <li>Smart web development email detection</li>
              <li>Job opportunities and career tracking</li>
              <li>Tech events and conference notifications</li>
              <li>Learning resources and course updates</li>
              <li>Tool updates and platform changes</li>
              <li>Developer community and networking</li>
              <li>Newsletter and digest management</li>
              <li>Priority scoring and categorization</li>
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
              <button
                onClick={syncEmails}
                disabled={loading || analysisInProgress}
                className="sync-button"
              >
                {loading
                  ? 'Fetching...'
                  : analysisInProgress
                    ? 'Analyzing...'
                    : 'Find Web Dev Emails'}
              </button>
              <div className="sync-info">
                {calculateTimeSinceSync() && (
                  <span className="last-sync">Sync started {calculateTimeSinceSync()}</span>
                )}
                {analysisInProgress && analysisProgress.total > 0 && (
                  <span className="analysis-progress">
                    Completed analyzing: {analysisProgress.analyzed}/{analysisProgress.total} emails
                  </span>
                )}
                <span className="last-sync">Last sync: {formatDate(lastSync)}</span>
                {emails.length > 0 && (
                  <span className="email-count">
                    {emails.filter((email) => email.isNewSinceLastSync).length} new, {emails.length}{' '}
                    total
                  </span>
                )}
              </div>
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
                {webDevCategories.slice(1).map((category) => (
                  <option key={category} value={category}>
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
            {filteredEmails.length === 0 && !loading && !analysisInProgress ? (
              <div className="no-emails">
                <p>No web development emails found.</p>
                <p>
                  The agent looks for relevant professional emails including jobs, events, learning
                  resources, and tools.
                </p>
                <p>Click "Find Web Dev Emails" to analyze your inbox.</p>
              </div>
            ) : (
              <div className="emails-list">
                {filteredEmails.map((email, index) => (
                  <div
                    key={index}
                    className={`email-card priority-${email.analysis?.priority || 'medium'} ${
                      email.status === 'pending' ? 'pending-analysis' : ''
                    }`}
                  >
                    <div className="email-header">
                      <div className="email-main-info">
                        <div className="email-title-section">
                          <h4>
                            {getStatusIndicator(email)} {email.subject}
                          </h4>
                          <div className="email-badges">
                            {email.isNewSinceLastSync && <span className="new-badge">NEW</span>}
                            <span
                              className="priority-badge"
                              style={{
                                backgroundColor: getPriorityColor(email.analysis?.priority),
                              }}
                            >
                              {email.analysis?.priority || 'unknown'}
                            </span>
                            <span className="category-badge">
                              {email.analysis?.category?.replace('_', ' ') || 'other'}
                            </span>
                            <span className="similarity-badge">
                              Similarity: {email.vectorSimilarity}
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

                    <div
                      className="email-actions-compact"
                      style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}
                    >
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
      <GoogleCalendar userId={userId} />
    </div>
  );
};

export default GmailMCP;
