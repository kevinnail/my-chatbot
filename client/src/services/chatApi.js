const BASE_URL = process.env.REACT_APP_BASE_URL;

// Pure API functions - no state, no side effects beyond network calls

export async function sendChatMessage({ msg, userId, coachOrChat, chatId }) {
  const response = await fetch(`${BASE_URL}/api/chatbot`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ msg, userId, coachOrChat, chatId }),
    credentials: 'include',
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(errorData.error || 'Failed to send message');
  }

  return response.json();
}

export async function checkChatTitle({ chatId, userId }) {
  const response = await fetch(`${BASE_URL}/api/chatbot/has-title`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chatId, userId }),
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error('Failed to check chat title');
  }

  return response.json();
}

export async function summarizeChat({ prompt, chatId, userId }) {
  const response = await fetch(`${BASE_URL}/api/chatbot/summarize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, chatId, userId }),
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error('Failed to summarize chat');
  }

  return response.json();
}

export async function deleteUserMessages(userId) {
  const response = await fetch(`${BASE_URL}/api/chatbot/${userId}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId }),
    credentials: 'include',
  });

  const contentType = response.headers.get('content-type');

  if (contentType && contentType.includes('application/json')) {
    return response.json();
  } else {
    const textResponse = await response.text();

    if (response.ok) {
      return { success: true };
    } else {
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
}
