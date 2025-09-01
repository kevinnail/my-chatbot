const BASE_URL = process.env.REACT_APP_BASE_URL;

export async function sendPrompt(userId, input, setLog, setInput, setLoading, setContextPercent) {
  if (!input.trim()) return;
  const userMsg = input;
  setLog((l) => [...l, { text: userMsg, role: 'user' }]);
  setInput('');
  setLoading(true);
  try {
    const res = await fetch(`${BASE_URL}/api/chatbot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ msg: userMsg, userId }),
    });

    // Check if response is JSON before parsing
    const contentType = res.headers.get('content-type');
    let data;
    let errorMessage;

    if (contentType && contentType.includes('application/json')) {
      // Response is JSON, safe to parse
      data = await res.json();
      errorMessage = data.error || 'Failed to send prompt';
    } else {
      // Response is not JSON (likely HTML error page or plain text)
      const textResponse = await res.text();
      console.log('Non-JSON response received:', textResponse);

      // Extract meaningful error message
      if (textResponse.includes('Proxy error')) {
        errorMessage = 'Backend server is not running. Please start the backend server.';
      } else if (textResponse.includes('404')) {
        errorMessage = 'API endpoint not found. Please check the backend configuration.';
      } else if (textResponse.includes('500')) {
        errorMessage = 'Internal server error. Please check the backend logs.';
      } else {
        errorMessage = 'Server returned an unexpected response. Please check the backend server.';
      }
    }

    if (!res.ok) {
      throw new Error(errorMessage);
    }

    const { bot, context_percent } = data;

    setLog((l) => [...l, { text: bot, role: 'bot' }]);
    if (context_percent !== undefined && context_percent !== null) {
      setContextPercent(Number(context_percent));
    }
  } catch (e) {
    console.error('error sending prompt', e);
    // Add error message to log to maintain proper message positioning
    setLog((l) => [
      ...l,
      {
        text: `**Error**: ${e.message || 'Unable to get response from server. Please try again.'}`,
        role: 'error',
      },
    ]);
  } finally {
    setLoading(false);
  }
}

export async function deleteMessages(userId) {
  try {
    const res = await fetch(`${BASE_URL}/api/chatbot/${userId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });

    // Check if response is JSON before parsing
    const contentType = res.headers.get('content-type');

    if (contentType && contentType.includes('application/json')) {
      return res.json();
    } else {
      // Response is not JSON (likely HTML error page or plain text)
      const textResponse = await res.text();
      console.log('Non-JSON response received:', textResponse);

      if (res.ok) {
        // If the response is ok but not JSON, assume success
        return { success: true };
      } else {
        // Extract meaningful error message
        let errorMessage;
        if (textResponse.includes('Proxy error')) {
          errorMessage = 'Backend server is not running. Please start the backend server.';
        } else if (textResponse.includes('404')) {
          errorMessage = 'API endpoint not found. Please check the backend configuration.';
        } else {
          errorMessage = 'Server returned an unexpected response. Please check the backend server.';
        }
        throw new Error(errorMessage);
      }
    }
  } catch (e) {
    console.error('error deleting messages', e);
    throw e; // Re-throw to allow caller to handle
  }
}
