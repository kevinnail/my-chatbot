import React, { useState, useEffect } from 'react';
import './GoogleCalendar.css';
import { checkCalendarStatus, connectCalendar } from '../../services/fetch-utils';
import { useUser } from '../../hooks/useUser.js';

const GoogleCalendar = ({ onConnectionChange }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [connectionError, setConnectionError] = useState(null);
  const [oauthPopup, setOauthPopup] = useState(null);
  const { userId } = useUser();

  // Check if Google Calendar is connected on component mount
  useEffect(() => {
    checkCalendarConnection();
  }, [userId]);

  // Add periodic token validation check
  useEffect(() => {
    if (!isConnected || !userId) return;

    const checkInterval = setInterval(async () => {
      try {
        const data = await checkCalendarStatus(userId);
        if (!data.connected && isConnected) {
          // Token has expired, update UI state
          console.log('Google Calendar token expired - updating UI state');
          setIsConnected(false);
          setConnectionError('Google Calendar token has expired. Please reconnect.');
          if (onConnectionChange) {
            onConnectionChange(false);
          }
        }
      } catch (err) {
        console.error('Error checking calendar token status:', err);
      }
    }, 30000); // Check every 30 seconds

    return () => clearInterval(checkInterval);
  }, [isConnected, userId, onConnectionChange]);

  // Handle OAuth popup messages
  useEffect(() => {
    const handleMessage = (event) => {
      // Verify origin for security
      if (event.origin !== window.location.origin) {
        return;
      }

      if (event.data.type === 'GOOGLE_CALENDAR_OAUTH_SUCCESS') {
        setLoading(false);
        setError(null);
        setConnectionError(null);
        checkCalendarConnection(); // Refresh connection status

        // Close popup if still open
        if (oauthPopup && !oauthPopup.closed) {
          oauthPopup.close();
        }
        setOauthPopup(null);
      } else if (event.data.type === 'GOOGLE_CALENDAR_OAUTH_ERROR') {
        setLoading(false);
        setError(event.data.error);
        setConnectionError(event.data.error);

        // Close popup if still open
        if (oauthPopup && !oauthPopup.closed) {
          oauthPopup.close();
        }
        setOauthPopup(null);
      }
    };

    window.addEventListener('message', handleMessage);

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [oauthPopup]);

  // Cleanup popup on component unmount
  useEffect(() => {
    return () => {
      if (oauthPopup && !oauthPopup.closed) {
        oauthPopup.close();
      }
    };
  }, [oauthPopup]);

  const checkCalendarConnection = async () => {
    if (!window.isLocal) {
      // Fake calendar connection for netlify deploy
      setIsConnected(true);
      setConnectionError(null);
      if (onConnectionChange) {
        onConnectionChange(true);
      }
      return;
    }

    try {
      const data = await checkCalendarStatus(userId);

      setIsConnected(data.connected);
      setConnectionError(data.error || null);

      // Notify parent component about connection status change
      if (onConnectionChange) {
        onConnectionChange(data.connected);
      }
    } catch (err) {
      console.error(err.message || 'Error checking Calendar connection:');

      setConnectionError('Failed to check connection status');
      if (onConnectionChange) {
        onConnectionChange(false);
      }
    }
  };

  const handleConnectCalendar = async () => {
    if (!window.isLocal) {
      // Fake OAuth popup for netlify deploy
      setLoading(true);
      setError(null);

      // Create a fake popup window with demo content
      const popup = window.open(
        'about:blank',
        'google-oauth-demo',
        'width=500,height=600,scrollbars=yes,resizable=yes',
      );

      if (!popup || popup.closed) {
        setError('Popup was blocked. Please allow popups for this site.');
        setLoading(false);
        return;
      }

      // Add demo content to the popup
      popup.document.write(`
        <html>
          <head>
            <title>Google OAuth Demo</title>
            <style>
              body { 
                font-family: Arial, sans-serif; 
                padding: 20px; 
                text-align: center;
                background: #f5f5f5;
              }
              .demo-box {
                background: white;
                padding: 30px;
                border-radius: 8px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                max-width: 400px;
                margin: 50px auto;
              }
              button {
                background: #4285f4;
                color: white;
                border: none;
                padding: 12px 24px;
                border-radius: 4px;
                cursor: pointer;
                font-size: 16px;
                margin-top: 20px;
              }
              button:hover {
                background: #3367d6;
              }
            </style>
          </head>
          <body>
            <div class="demo-box">
              <h2>Google OAuth Demo</h2>
              <p>This is a demonstration of the Google Calendar OAuth flow.</p>
              <p>In the actual application running locally, this would redirect to Google's OAuth page.</p>
              <button onclick="window.close()">Connect Calendar (Demo)</button>
            </div>
          </body>
        </html>
      `);

      setOauthPopup(popup);

      // Simulate successful connection after a delay
      setTimeout(() => {
        if (!popup.closed) {
          popup.close();
        }
        setIsConnected(true);
        setConnectionError(null);
        setError(null);
        setLoading(false);
        setOauthPopup(null);
        if (onConnectionChange) {
          onConnectionChange(true);
        }
      }, 5000);

      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data, response } = await connectCalendar(userId);

      if (response.ok) {
        // Open OAuth URL in a new popup window
        const popup = window.open(
          data.authUrl,
          'google-oauth',
          'width=500,height=600,scrollbars=yes,resizable=yes',
        );

        setOauthPopup(popup);

        // Check if popup was blocked
        if (!popup || popup.closed) {
          throw new Error('Popup was blocked. Please allow popups for this site.');
        }

        // Optional: Monitor if user manually closes the popup
        const checkClosed = setInterval(() => {
          if (popup.closed) {
            clearInterval(checkClosed);
            setLoading(false);
            setOauthPopup(null);
            // Don't show error if user just closed the popup
          }
        }, 1000);

        // Clean up interval after 5 minutes
        setTimeout(() => {
          clearInterval(checkClosed);
        }, 300000);
      } else {
        throw new Error(data.error || 'Failed to connect to Google Calendar');
      }
    } catch (err) {
      setError(err.message);
      setConnectionError(err.message);
      setLoading(false);
      setOauthPopup(null);
    }
  };

  return (
    <div className="google-calendar">
      <div className="google-calendar-header">
        <h3>Google Calendar Integration</h3>
        <div className="connection-status">
          <span className={`status-indicator ${isConnected ? 'connected' : 'disconnected'}`}>
            {isConnected ? '●' : '●'}
          </span>
          <span>{isConnected ? 'Connected' : 'Disconnected'}</span>
        </div>
      </div>

      {error && (
        <div className="error-message">
          <strong>Error:</strong> {error}
        </div>
      )}

      {!isConnected ? (
        <div className="connect-section">
          <button
            onClick={handleConnectCalendar}
            disabled={loading}
            className="connect-button"
            style={{
              height: '35px',
              boxShadow: '4px 4px 15px 0 black',
              borderTop: '1px solid rgb(255,255,255,0.75',
              borderLeft: '1px solid rgb(255,255,255,0.75',
            }}
          >
            {loading ? 'Connecting...' : 'Connect Google Calendar Now!'}
          </button>
          <h3>Create Appointments</h3>
          <p style={{ textAlign: 'left' }}>
            <strong>LLM Calendar Event Creation</strong> - Enable your chatbot to automatically
            create calendar events from emails!
          </p>

          <div className="setup-instructions">
            <h4>How It Works:</h4>
            <ol>
              <li>
                <strong>One-time Authorization:</strong>
                <br />
                Click connect → Google popup → Allow access → Done forever
              </li>
              <li>
                <strong>Automatic Event Creation:</strong>
                <br />
                LLM detects appointments in emails → Creates calendar events automatically
              </li>
              <li>
                <strong>Example:</strong>
                <br />
                &quot;Interview scheduled for Friday 10AM&quot; → Calendar event created
              </li>
            </ol>
          </div>

          {connectionError && (
            <div className="connection-error">
              <strong>Connection Issue:</strong> {connectionError}
              <br />
              <small>Make sure you&apos;ve completed the Google Cloud setup.</small>
            </div>
          )}

          <div className="features-section">
            <p>
              <strong>Smart Calendar Tech:</strong>
            </p>
            <ul style={{ width: '80%', textAlign: 'left', margin: 'auto' }}>
              <li> LLM-powered appointment detection</li>
              <li> Automatic email-to-calendar conversion</li>
              <li> Secure OAuth2 authentication</li>
              <li> Automatic token refresh</li>
              <li> No user interaction needed after setup</li>
            </ul>
          </div>
        </div>
      ) : (
        <div className="connected-section">
          <div className="success-message">
            <h3>✅ Google Calendar Connected!</h3>
            <p>Your LLM can now automatically create calendar events from emails.</p>
            <p>
              No further action needed - events will be created automatically when the LLM detects
              appointments in your emails.
            </p>
          </div>

          <div className="test-section">
            <h4>Test Event Creation</h4>
            <p>
              You can test the calendar integration by running the Gmail email analysis. When the
              LLM detects appointment-related emails, it will automatically create calendar events.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default GoogleCalendar;
