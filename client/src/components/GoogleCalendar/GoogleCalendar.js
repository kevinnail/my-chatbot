import React, { useState, useEffect } from 'react';
import './GoogleCalendar.css';

const GoogleCalendar = ({ userId }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [connectionError, setConnectionError] = useState(null);

  // Check if Google Calendar is connected on component mount
  useEffect(() => {
    checkCalendarConnection();
  }, [userId]);

  const checkCalendarConnection = async () => {
    try {
      const response = await fetch(`/api/calendar/status/${userId}`);
      const data = await response.json();
      setIsConnected(data.connected);
      setConnectionError(data.error || null);
    } catch (err) {
      console.error('Error checking Calendar connection:', err);
      setConnectionError('Failed to check connection status');
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
        // Open OAuth URL in a new window
        window.open(data.authUrl, '_blank', 'width=600,height=600');

        // Check connection status periodically
        const checkInterval = setInterval(async () => {
          await checkCalendarConnection();
          if (isConnected) {
            clearInterval(checkInterval);
            setLoading(false);
          }
        }, 2000);

        // Stop checking after 2 minutes
        setTimeout(() => {
          clearInterval(checkInterval);
          setLoading(false);
        }, 120000);
      } else {
        throw new Error(data.error || 'Failed to connect to Google Calendar');
      }
    } catch (err) {
      setError(err.message);
      setConnectionError(err.message);
      setLoading(false);
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
