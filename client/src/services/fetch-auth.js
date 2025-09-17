const BASE_URL = process.env.REACT_APP_BASE_URL;

/* Auth related functions */

export async function getUser() {
  try {
    const resp = await fetch(`${BASE_URL}/api/users/me`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    });

    if (resp.ok) {
      const user = await resp.json();
      return user;
    }
    return null;
  } catch (error) {
    console.error('Error in getUser:', error);
    throw new Error(`Failed to get user: ${error.message}`);
  }
}

export async function signUpUser(email, password) {
  try {
    const resp = await fetch(`${BASE_URL}/api/users`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
      credentials: 'include',
    });
    const data = await resp.json();

    if (resp.ok) {
      await signInUser(email, password);
      return { user: data, error: null };
    } else {
      return { user: null, error: data.message };
    }
  } catch (error) {
    console.error('Error in signUpUser:', error);
    return { user: null, error: `Failed to sign up: ${error.message}` };
  }
}

export async function signInUser(email, password) {
  try {
    const resp = await fetch(`${BASE_URL}/api/users/sessions`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
      credentials: 'include',
      mode: 'cors',
    });

    const data = await resp.json();
    if (resp.ok) {
      return { user: data.user, error: null };
    } else {
      return { user: null, error: data.message };
    }
  } catch (error) {
    console.error('Error in signInUser:', error);
    return { user: null, error: `Failed to sign in: ${error.message}` };
  }
}

export async function signOutUser() {
  try {
    const resp = await fetch(`${BASE_URL}/api/users/sessions`, {
      method: 'DELETE',
      credentials: 'include',
    });

    if (resp.ok) {
      return { success: true };
    } else {
      return { success: false, error: 'Failed to sign out' };
    }
  } catch (error) {
    console.error('Error in signOutUser:', error);
    return { success: false, error: `Failed to sign out: ${error.message}` };
  }
}
