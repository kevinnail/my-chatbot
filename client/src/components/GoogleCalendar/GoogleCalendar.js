import React, { useState, useEffect } from 'react';
import './GoogleCalendar.css';

const GoogleCalendar = ({ userId, onConnectionChange }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [connectionError, setConnectionError] = useState(null);
  const [oauthPopup, setOauthPopup] = useState(null);

  // Check if Google Calendar is connected on component mount
  useEffect(() => {
    checkCalendarConnection();
  }, [userId]);

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
    try {
      const response = await fetch(`/api/calendar/status/${userId}`);
      const data = await response.json();
      setIsConnected(data.connected);
      setConnectionError(data.error || null);

      // Notify parent component about connection status change
      if (onConnectionChange) {
        onConnectionChange(data.connected);
      }
    } catch (err) {
      console.error('Error checking Calendar connection:', err);
      setConnectionError('Failed to check connection status');
      if (onConnectionChange) {
        onConnectionChange(false);
      }
    }
  };

  const connectCalendar = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/calendar/connect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId }),
      });

      const data = await response.json();

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
        <h2>Google Calendar Integration</h2>
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
          <h3>Connect to Google Calendar</h3>
          <p>
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
                <strong>Examples:</strong>
                <br />
                "Doctor appointment Tuesday 3PM" → Calendar event created
                <br />
                "Interview scheduled for Friday 10AM" → Calendar event created
              </li>
            </ol>
          </div>

          {connectionError && (
            <div className="connection-error">
              <strong>Connection Issue:</strong> {connectionError}
              <br />
              <small>Make sure you've completed the Google Cloud setup.</small>
            </div>
          )}

          <div className="features-section">
            <p>
              <strong>Smart Calendar Features:</strong>
            </p>
            <ul style={{ width: '50%', textAlign: 'left', margin: 'auto' }}>
              <li> LLM-powered appointment detection</li>
              <li> Automatic email-to-calendar conversion</li>
              <li> Doctor appointments</li>
              <li> Job interviews</li>
              <li> Phone calls and meetings</li>
              <li> Secure OAuth2 authentication</li>
              <li> Automatic token refresh</li>
              <li> No user interaction needed after setup</li>
            </ul>
          </div>

          <button onClick={connectCalendar} disabled={loading} className="connect-button">
            {loading ? 'Connecting...' : 'Connect Google Calendar'}
          </button>
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
