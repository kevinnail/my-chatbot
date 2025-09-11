import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import './GmailMCP.css';
import { useLoading } from '../../contexts/LoadingContext';
import GoogleCalendar from '../GoogleCalendar/GoogleCalendar.js';

const GmailMCP = ({ userId }) => {
  const [emails, setEmails] = useState([]);
  const { gmailLoading, setGmailLoading } = useLoading();
  const loading = gmailLoading;
  const setLoading = setGmailLoading;
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
  const [currentlyAnalyzing, setCurrentlyAnalyzing] = useState(null);
  const [calendarConnected, setCalendarConnected] = useState(false);
  const [showGmailInstructions, setShowGmailInstructions] = useState(false);
  const [showCalendarInstructions, setShowCalendarInstructions] = useState(false);
  const socketRef = useRef(null);

  // Fake emails data
  const fakeEmails = [
    {
      id: '1',
      subject: 'Demo: Frontend Developer Position',
      from: 'hr@techcompany.com',
      date: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
      snippet: 'Thank you for your application. We would like to schedule an interview...',
      analysis: {
        priority: 'high',
        category: 'job_application',
        hasInterview: true,
        hasDeadline: true,
        actionItems: [
          'Confirm interview availability',
          "Research TechCorp's recent projects",
          'Prepare technical questions',
          'Review job description details',
        ],
        sentiment: 'positive',
        draftResponse:
          "Thank you for the interview opportunity. I'm excited to discuss the Software Engineer position. I'm available Tuesday at the proposed time. Looking forward to learning more about TechCorp's innovative projects.",
        calendarEvents: [
          {
            summary: 'Interview - Frontend Developer Position',
            startTime: new Date(Date.now() + 86400000 + 10 * 3600000).toISOString(), // Tomorrow at 10 AM
            endTime: new Date(Date.now() + 86400000 + 11 * 3600000).toISOString(), // Tomorrow at 11 AM
            location: 'TechCorp Office, 456 Tech St, Conference Room A',
          },
        ],
      },
      analyzed: true,
      summary: 'Thank you for your application. We would like to schedule an interview...',
    },
    {
      id: '2',
      subject: 'Demo: Project Proposal - Web Development',
      from: 'client@startup.io',
      date: new Date(Date.now() - 172800000).toISOString(), // 2 days ago
      snippet: 'We have reviewed your portfolio and would like to discuss a potential project...',
      analysis: {
        priority: 'medium',
        category: 'client_inquiry',
        hasInterview: false,
        hasDeadline: true,
        actionItems: [
          'Review project proposal',
          'Discuss timeline and deliverables',
          'Confirm project scope',
        ],
        sentiment: 'neutral',
        draftResponse:
          "Thank you for the project proposal. I'm excited to discuss the potential project. I'm available next week at the proposed time. Looking forward to discussing the details of the project.",
      },
      analyzed: true,
      summary: 'We have reviewed your portfolio and would like to discuss a potential project...',
    },
    {
      id: '3',
      subject: 'Demo: React Newsletter - Latest Updates',
      from: 'newsletter@react.dev',
      date: new Date(Date.now() - 259200000).toISOString(), // 3 days ago
      snippet: 'Check out the latest React features and community updates...',
    },
  ];

  // Function to check calendar connection status
  const checkCalendarConnection = async () => {
    if (!window.isLocal) {
      // Fake calendar connection for netlify deploy
      setCalendarConnected(true);
      return;
    }
    try {
      const response = await fetch(`/api/calendar/status/${userId}`);
      const data = await response.json();
      setCalendarConnected(data.connected);
    } catch (err) {
      console.error('Error checking Calendar connection:', err);
      setCalendarConnected(false);
    }
  };

  // Initialize Socket.IO connection
  useEffect(() => {
    let socket;
    if (window.isLocal) {
      socket = io('http://localhost:4000');
    } else {
      // Mock socket for demo
      socket = {
        on: () => {},
        emit: () => {},
        disconnect: () => {},
      };
    }
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('Connected to real-time updates');
      socket.emit('join-sync-updates', userId);
    });

    socket.on('sync-progress', (data) => {
      console.log(' Sync progress:', data);
      setAnalysisProgress(data);
    });

    socket.on('email-analyzed', (data) => {
      console.log(' Email analyzed:', data.emailId);
      setEmails((prevEmails) => {
        const updatedEmails = prevEmails.map((email) => {
          if (email.id === data.emailId) {
            return {
              ...email,
              analysis: data.analysis,
              status: 'analyzed',
              analyzed: true,
              summary: data.analysis?.summary || 'Analysis complete',
              category: data.analysis?.category,
              priority: data.analysis?.priority,
            };
          }
          return email;
        });

        console.log(' Updated emails after mapping:');
        updatedEmails.forEach((e, i) => {
          if (e.analysis) {
            console.log(
              `  ✅ ${i}: ID=${e.id}, Status=${e.status}, Summary="${e.summary?.substring(0, 50)}..."`,
            );
          }
        });

        return updatedEmails;
      });

      // Update analysis progress
      setAnalysisProgress((prev) => ({
        analyzed: data.analyzedCount || prev.analyzed + 1,
        total: data.totalToAnalyze || prev.total,
      }));

      // Clear currently analyzing when done
      setCurrentlyAnalyzing(null);
    });

    socket.on('email-analyzing', (data) => {
      console.log('Email being analyzed:', data.emailId);
      setCurrentlyAnalyzing({
        emailId: data.emailId,
        subject: data.subject,
        progress: data.analyzedCount || 0,
        total: data.totalToAnalyze || 0,
      });
    });

    socket.on('sync-complete', (data) => {
      console.log('✅ Sync complete:', data);
      // Don't replace emails - they're already set from preliminary results and updated via email-analyzed events
      setLastSync(new Date());
      setLoading(false);
      setAnalysisInProgress(false);
      setSyncStartTime(null);
      setCurrentlyAnalyzing(null);
    });

    socket.on('sync-error', (data) => {
      console.error('❌ Sync error:', data);
      setError(data.error);
      setAnalysisInProgress(false);
      setLoading(false);
      setSyncStartTime(null);
      setCurrentlyAnalyzing(null);
    });

    socket.on('disconnect', () => {
      console.log('Disconnected from real-time updates');
    });

    return () => {
      socket.disconnect();
    };
  }, [userId]);

  // Check calendar connection when component mounts
  useEffect(() => {
    checkCalendarConnection();
  }, [userId]);

  const calculateTimeSinceSync = () => {
    if (!syncStartTime) return null;
    const now = currentTime;
    const startTime = new Date(syncStartTime);
    const diffMs = now - startTime;
    const diffSeconds = Math.max(0, Math.floor(diffMs / 1000)); // Ensure non-negative
    const diffMinutes = Math.floor(diffSeconds / 60);
    const remainingSeconds = diffSeconds % 60;

    if (diffMinutes > 0) {
      return `${diffMinutes}m ${remainingSeconds}s`;
    }
    return `${diffSeconds}s`;
  };

  // Update current time every second for live timer
  useEffect(() => {
    if (syncStartTime) {
      const interval = setInterval(() => {
        setCurrentTime(new Date());
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [syncStartTime]);

  const checkConnection = async () => {
    if (!window.isLocal) {
      // Fake Gmail connection for netlify deploy
      setLoading(true);
      setTimeout(() => {
        setIsConnected(true);
        setConnectionError(null);
        setError(null);

        setEmails(fakeEmails);
        setLastSync(new Date().toISOString());
        setLoading(false);
      }, 1000);
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`/api/gmail/status/${userId}`);
      const data = await response.json();

      setIsConnected(data.connected);
      if (data.error) {
        setConnectionError(data.error);
      } else {
        setConnectionError(null);
      }

      if (data.connected && data.emails) {
        setEmails(data.emails);
        if (data.lastSync) {
          setLastSync(data.lastSync);
        }
      }
    } catch (err) {
      console.error('Error checking connection:', err);
      setError('Failed to check connection');
      setConnectionError('Network error - make sure server is running');
      setIsConnected(false);
    } finally {
      setLoading(false);
    }
  };

  // Check connection on component mount
  useEffect(() => {
    checkConnection();
  }, []);

  const syncEmails = async () => {
    if (!window.isLocal) {
      setEmails(fakeEmails);
      return;
    }
    // Check if both Gmail and Calendar are connected before syncing
    if (!isConnected) {
      setError('Gmail must be connected before syncing emails');
      return;
    }

    if (!calendarConnected) {
      setError(
        'Google Calendar must be connected before syncing emails. Calendar integration is required for automatic event creation.',
      );
      return;
    }

    if (!window.isLocal) {
      // Fake sync for netlify deploy
      setLoading(true);
      setError(null);
      setSyncStartTime(new Date());
      setAnalysisInProgress(true);
      setAnalysisProgress({ analyzed: 0, total: 3 });

      // Simulate sync progress
      setTimeout(() => {
        setAnalysisProgress({ analyzed: 1, total: 3 });
        setCurrentlyAnalyzing('Demo: Frontend Developer Position');
      }, 500);

      setTimeout(() => {
        setAnalysisProgress({ analyzed: 2, total: 3 });
        setCurrentlyAnalyzing('Demo: Project Proposal - Web Development');
      }, 1500);

      setTimeout(() => {
        setAnalysisProgress({ analyzed: 3, total: 3 });
        setCurrentlyAnalyzing('Demo: React Newsletter - Latest Updates');
      }, 2500);

      setTimeout(() => {
        setAnalysisInProgress(false);
        setCurrentlyAnalyzing(null);
        setLoading(false);
        setSyncStartTime(null);
        setLastSync(new Date().toISOString());
      }, 3500);

      return;
    }

    try {
      setLoading(true);
      setError(null);
      setSyncStartTime(new Date());
      setAnalysisInProgress(true);
      setAnalysisProgress({ analyzed: 0, total: 0 });

      const response = await fetch('/api/gmail/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId }),
      });

      if (!response.ok) {
        throw new Error('Failed to sync emails');
      }

      const data = await response.json();

      // Set preliminary emails immediately
      if (data.emails) {
        console.log(`Setting ${data.emails.length} preliminary emails`);
        setEmails(data.emails);
        setAnalysisProgress({
          analyzed: data.emails.filter((e) => e.analyzed).length,
          total: data.emails.length,
        });
      }
    } catch (err) {
      setError(err.message);
      setLoading(false);
      setAnalysisInProgress(false);
      setSyncStartTime(null);
    }
  };

  // Filter emails based on selected priority and category
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
        <div className="consolidated-status">
          <div className="status-item">
            <span className="status-label">Gmail:</span>
            <span className={`status-indicator ${isConnected ? 'connected' : 'disconnected'}`}>
              {isConnected ? '●' : '●'}
            </span>
            <span className="status-text">{isConnected ? 'Connected' : 'Disconnected'}</span>
          </div>
          <div className="status-item">
            <span className="status-label">Calendar:</span>
            <span
              className={`status-indicator ${calendarConnected ? 'connected' : 'disconnected'}`}
            >
              {calendarConnected ? '●' : '●'}
            </span>
            <span className="status-text">{calendarConnected ? 'Connected' : 'Disconnected'}</span>
          </div>
          <div
            className={`overall-status ${isConnected && calendarConnected ? 'ready' : 'not-ready'}`}
          >
            {isConnected && calendarConnected ? 'Ready' : ' Setup Required'}
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="error-message">
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Setup Instructions - Collapsible */}
      {!isConnected && (
        <div className="setup-section">
          <div
            className="setup-header"
            onClick={() => setShowGmailInstructions(!showGmailInstructions)}
          >
            <h3> Gmail Setup</h3>
            <span className="toggle-icon">{showGmailInstructions ? '▼' : '▶'}</span>
          </div>
          {showGmailInstructions && (
            <div className="setup-content">
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
                      GMAIL_APP_PASSWORD=your_16_character_app_password{'\n'}
                      GMAIL_IMAP_HOST=imap.gmail.com {'\n'}
                      GMAIL_IMAP_PORT=993
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
                  <small>Make sure you&apos;ve completed the setup steps above.</small>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {!calendarConnected && (
        <div className="setup-section">
          <div
            className="setup-header"
            onClick={() => setShowCalendarInstructions(!showCalendarInstructions)}
          >
            <h3> Calendar Setup</h3>
            <span className="toggle-icon">{showCalendarInstructions ? '▼' : '▶'}</span>
          </div>
          {showCalendarInstructions && (
            <div className="setup-content">
              <GoogleCalendar userId={userId} onConnectionChange={setCalendarConnected} />
            </div>
          )}
        </div>
      )}

      {/* Main Content - Only show when both are connected */}
      {isConnected && calendarConnected && (
        <div className="main-content">
          <div className="sync-section">
            <div className="sync-header">
              <h3>Email Sync & Analysis</h3>
              {lastSync && !loading && (
                <div className="last-sync">
                  <small>Last sync: {new Date(lastSync).toLocaleString()}</small>
                </div>
              )}
              <button onClick={syncEmails} disabled={loading} className="sync-button">
                {loading ? 'Syncing...' : 'Sync & Analyze Emails'}
              </button>
            </div>

            {analysisInProgress && (
              <div className="analysis-progress">
                <div className="progress-header">
                  <span>Analyzing emails...</span>
                  <span>
                    {analysisProgress.analyzed}/{analysisProgress.total}
                  </span>
                </div>
                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{
                      width: `${
                        analysisProgress.total > 0
                          ? (analysisProgress.analyzed / analysisProgress.total) * 100
                          : 0
                      }%`,
                    }}
                  ></div>
                </div>
                {currentlyAnalyzing && (
                  <div className="currently-analyzing">
                    <small>
                      🔍 Analyzing: &quot;{currentlyAnalyzing.subject?.substring(0, 50)}...&quot;
                    </small>
                  </div>
                )}
                {syncStartTime && (
                  <div className="time-info">
                    <small>
                      {calculateTimeSinceSync()
                        ? `Running for: ${calculateTimeSinceSync()}`
                        : 'Starting...'}
                    </small>
                  </div>
                )}
              </div>
            )}

            {emails.length > 0 && (
              <div className="filters-section">
                <div className="filter-group">
                  <label>Priority:</label>
                  <select
                    value={filterPriority}
                    onChange={(e) => setFilterPriority(e.target.value)}
                    className="filter-select"
                  >
                    {priorities.map((priority) => (
                      <option key={priority} value={priority}>
                        {priority.charAt(0).toUpperCase() + priority.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="filter-group">
                  <label>Category:</label>
                  <select
                    value={filterCategory}
                    onChange={(e) => setFilterCategory(e.target.value)}
                    className="filter-select"
                  >
                    {webDevCategories.map((category) => (
                      <option key={category} value={category}>
                        {category.replace('_', ' ').charAt(0).toUpperCase() +
                          category.replace('_', ' ').slice(1)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {filteredEmails.length > 0 && (
              <div className="emails-list">
                {filteredEmails.map((email, index) => (
                  <div
                    key={email.id || index}
                    className="email-card"
                    style={{
                      border: `2px solid ${
                        email.analysis?.priority === 'high'
                          ? '#ff6b6b'
                          : email.analysis?.priority === 'medium'
                            ? '#ffd93d'
                            : '#95e1d3'
                      }`,
                    }}
                  >
                    <div
                      className="email-content-compact"
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        gap: '20px',
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <div className="email-header-compact">
                          <h4 style={{ margin: '0 0 5px 0', color: '#639cff' }}>
                            subject: &quot;{email.subject}&quot;
                          </h4>
                          <div
                            className="email-meta-compact"
                            style={{ fontSize: '0.9rem', color: '#ccc' }}
                          >
                            <span>From: {email.from}</span> |{' '}
                            <span>{new Date(email.date).toLocaleDateString()}</span>
                            {email.analysis?.priority && (
                              <>
                                {' '}
                                |{' '}
                                <span
                                  style={{
                                    color:
                                      email.analysis.priority === 'high'
                                        ? '#ff6b6b'
                                        : email.analysis.priority === 'medium'
                                          ? '#ffd93d'
                                          : '#95e1d3',
                                    fontWeight: 'bold',
                                  }}
                                >
                                  {email.analysis.priority.toUpperCase()}
                                </span>
                              </>
                            )}
                            {email.analysis?.category && (
                              <>
                                {' '}
                                |{' '}
                                <span style={{ color: '#639cff' }}>
                                  {email.analysis.category.replace('_', ' ').toUpperCase()}
                                </span>
                              </>
                            )}
                          </div>
                        </div>

                        {email.bodyPreview && (
                          <div
                            className="email-preview-compact"
                            style={{ margin: '10px 0', color: '#ddd' }}
                          >
                            <p style={{ margin: 0, fontSize: '0.95rem', lineHeight: '1.4' }}>
                              {email.bodyPreview.length > 200
                                ? email.bodyPreview.substring(0, 200) + '...'
                                : email.bodyPreview}
                            </p>
                          </div>
                        )}

                        <div className="analysis-summary-compact">
                          <div style={{ marginTop: '15px' }}>
                            <strong style={{ color: '#639cff' }}>AI Summary:</strong>
                            <p
                              style={{
                                margin: '5px 0',
                                fontSize: '0.95rem',
                                color: email.analyzed ? '#f0f0f0' : '#ffa500',
                                fontStyle: email.analyzed ? 'normal' : 'italic',
                              }}
                            >
                              {email.analysis?.summary || email.summary || 'Analysis pending...'}
                            </p>
                            {email.analysis?.sentiment && (
                              <span className={`sentiment-badge ${email.analysis.sentiment}`}>
                                {email.analysis.sentiment.toUpperCase()}
                              </span>
                            )}
                          </div>
                        </div>
                        {email.analysis?.actionItems && email.analysis.actionItems.length > 0 && (
                          <div className="action-items">
                            <h5>Action Items:</h5>
                            <ul>
                              {email.analysis.actionItems.map((action, idx) => (
                                <li key={idx}>{action}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                      <div>
                        {' '}
                        {(() => {
                          if (
                            !email.analysis?.calendarEvents ||
                            email.analysis.calendarEvents.length === 0
                          ) {
                            return null;
                          }
                          return (
                            <div className="calendar-events">
                              <h5>Calendar Events Created:</h5>
                              {email.analysis.calendarEvents.map((event, idx) => (
                                <div key={idx} className="calendar-event">
                                  <strong>{email.summary}</strong>
                                  <br />
                                  {new Date(event.startTime).toLocaleDateString()}{' '}
                                  {new Date(event.startTime).toLocaleTimeString()} -{' '}
                                  {new Date(event.endTime).toLocaleDateString()}{' '}
                                  {new Date(event.endTime).toLocaleTimeString()}
                                  <br />
                                  {/* <div class="event-link-wrapper"> */}
                                  <a
                                    className="event-link"
                                    href={event.link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                  >
                                    Event Link
                                  </a>
                                  {/* </div> */}
                                  {event.location && (
                                    <>
                                      <br />
                                      📍 {event.location}
                                    </>
                                  )}
                                </div>
                              ))}
                            </div>
                          );
                        })()}
                        {email.analysis?.draftResponse && (
                          <div className="draft-response">
                            <h5>Draft Response:</h5>
                            <div className="draft-text">{email.analysis.draftResponse}</div>
                          </div>
                        )}
                      </div>
                      <div
                        className="email-actions-compact"
                        style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}
                      >
                        <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
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
                                window.isLocal && window.open(mailtoLink);
                              }}
                              className="draft-response-button"
                            >
                              Use Draft
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Features List - Only show when not connected */}
      {(!isConnected || !calendarConnected) && (
        <div className="features-section">
          <h3> Features</h3>
          <div className="features-grid">
            <div className="feature-item"> Automatically sync and analyze emails</div>
            <div className="feature-item"> AI-powered email categorization</div>
            <div className="feature-item"> Priority detection (High/Medium/Low)</div>
            <div className="feature-item"> Draft response generation</div>
            <div className="feature-item"> Web development focus</div>
            <div className="feature-item"> Real-time sync updates</div>
            <div className="feature-item"> 100% local processing</div>
            <div className="feature-item"> Automatic calendar event creation</div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GmailMCP;
