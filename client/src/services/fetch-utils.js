const BASE_URL = process.env.REACT_APP_BASE_URL;

export async function processFolder(files, userId) {
  try {
    const formData = new FormData();
    files.forEach((file) => formData.append('files', file));
    formData.append('userId', userId);
    const response = await fetch(`${BASE_URL}/api/rag/process-folder`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      // Handle 401 specifically
      if (response.status === 401) {
        // Let the component handle the redirect
        throw new Error('AUTHENTICATION_REQUIRED');
      }

      throw new Error('Failed to process folder');
    }

    return response.json();
  } catch (error) {
    console.error('Error processing folder:', error);
    throw error;
  }
}

export async function getChatList(userId) {
  try {
    const response = await fetch(`${BASE_URL}/api/chatbot/list/${userId}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    });

    if (!response.ok) {
      // Handle 401 specifically
      if (response.status === 401) {
        // Let the component handle the redirect
        throw new Error('AUTHENTICATION_REQUIRED');
      }

      throw new Error('Failed to fetch chat list');
    }

    return response.json();
  } catch (error) {
    console.error('Error fetching chat list:', error);
    throw error;
  }
}

export async function deleteChat(userId, chatId) {
  try {
    const response = await fetch(`${BASE_URL}/api/chatbot/${userId}/${chatId}`, {
      method: 'DELETE',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    });

    if (!response.ok) {
      // Handle 401 specifically
      if (response.status === 401) {
        // Let the component handle the redirect
        throw new Error('AUTHENTICATION_REQUIRED');
      }

      throw new Error('Failed to delete chat');
    }

    return response.json();
  } catch (error) {
    console.error('Error deleting chat:', error);
    throw error;
  }
}

export async function checkCalendarConnection(userId) {
  try {
    const response = await fetch(`${BASE_URL}/api/calendar/status/${userId}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      // Handle 401 specifically
      if (response.status === 401) {
        // Let the component handle the redirect
        throw new Error('AUTHENTICATION_REQUIRED');
      }

      throw new Error('Failed to check calendar connection');
    }

    return response.json();
  } catch (error) {
    console.error('Error checking calendar connection:', error);
    throw error;
  }
}

export async function checkGmailStatus(userId) {
  try {
    const response = await fetch(`${BASE_URL}/api/gmail/status/${userId}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      // Handle 401 specifically
      if (response.status === 401) {
        // Let the component handle the redirect
        throw new Error('AUTHENTICATION_REQUIRED');
      }

      throw new Error('Failed to check Gmail status');
    }

    return response.json();
  } catch (error) {
    console.error('Error checking Gmail status:', error);
    throw error;
  }
}

export async function syncGmail(userId) {
  try {
    const response = await fetch(`${BASE_URL}/api/gmail/sync`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userId }),
    });

    if (!response.ok) {
      // Handle 401 specifically
      if (response.status === 401) {
        // Let the component handle the redirect
        throw new Error('AUTHENTICATION_REQUIRED');
      }

      throw new Error('Failed to sync Gmail');
    }

    return response.json();
  } catch (error) {
    console.error('Error syncing Gmail:', error);
    throw error;
  }
}

export async function checkCalendarStatus(userId) {
  try {
    const response = await fetch(`${BASE_URL}/api/calendar/status/${userId}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
    });

    // Check if response is actually JSON before parsing
    const contentType = response.headers.get('content-type');

    let data;
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      // Get the actual response text to see the full error
      const responseText = await response.text();
      throw new Error(`Server returned non-JSON response: ${responseText.substring(0, 200)}...`);
    }

    return data;
  } catch (error) {
    console.error('Error checking calendar status:', error);
    throw error;
  }
}

export async function connectCalendar(userId) {
  try {
    const response = await fetch(`${BASE_URL}/api/calendar/connect`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userId }),
    });

    // Check if response is actually JSON before parsing
    const contentType = response.headers.get('content-type');

    let data;
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      // Get the actual response text to see the full error
      const responseText = await response.text();
      throw new Error(`Server returned non-JSON response: ${responseText.substring(0, 200)}...`);
    }

    return { data, response };
  } catch (error) {
    console.error('Error connecting calendar:', error);
    throw error;
  }
}

export async function stopChat(userId, chatId) {
  try {
    const response = await fetch(`${BASE_URL}/api/chatbot/stop`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ userId, chatId }),
    });

    if (!response.ok) {
      // Handle 401 specifically
      if (response.status === 401) {
        // Let the component handle the redirect
        throw new Error('AUTHENTICATION_REQUIRED');
      }

      throw new Error('Failed to stop chat');
    }

    return response;
  } catch (error) {
    console.error('Error stopping chat:', error);
    throw error;
  }
}

export const fetchContextPercent = async (chatId, userId, mode) => {
  try {
    const response = await fetch(`/api/chatbot/context/${userId}/${chatId}?mode=${mode}`);
    if (response.ok) {
      const data = await response.json();
      return data.contextPercent || 0;
    }
  } catch (error) {
    console.error('Error fetching context percentage:', error);
  }
  return 0;
};
