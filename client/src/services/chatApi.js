const BASE_URL = process.env.REACT_APP_BASE_URL;

// Pure API functions - no state, no side effects beyond network calls

export async function sendChatMessage({ msg, userId, coachOrChat, chatId, messageId, image }) {
  try {
    let requestBody;
    const headers = {};

    if (image) {
      // Use FormData for image uploads
      const formData = new FormData();
      formData.append('msg', msg);
      formData.append('userId', userId);
      formData.append('coachOrChat', coachOrChat);
      formData.append('chatId', chatId);
      formData.append('messageId', messageId);
      formData.append('image', image);

      requestBody = formData;
      // Don't set Content-Type header - let browser set it with boundary
    } else {
      // Use JSON for text-only messages
      headers['Content-Type'] = 'application/json';
      requestBody = JSON.stringify({ msg, userId, coachOrChat, chatId, messageId });
    }

    const response = await fetch(`${BASE_URL}/api/chatbot`, {
      method: 'POST',
      headers,
      body: requestBody,
      credentials: 'include',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(errorData.error || 'Failed to send message');
    }

    return response.json();
  } catch (error) {
    console.error('Error in sendChatMessage:', error);
    throw new Error(`Failed to send chat message: ${error.message}`);
  }
}

export async function checkChatTitle({ chatId, userId }) {
  try {
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
  } catch (error) {
    console.error('Error in checkChatTitle:', error);
    throw new Error(`Failed to check chat title: ${error.message}`);
  }
}

export async function summarizeChat({ prompt, chatId, userId }) {
  try {
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
  } catch (error) {
    console.error('Error in summarizeChat:', error);
    throw new Error(`Failed to summarize chat: ${error.message}`);
  }
}

export async function deleteUserMessages(userId) {
  try {
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
  } catch (error) {
    console.error('Error in deleteUserMessages:', error);
    throw new Error(`Failed to delete user messages: ${error.message}`);
  }
}
