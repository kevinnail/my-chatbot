// const BASE_URL = 'https://react-fs-ex-to-do-list.herokuapp.com';
// const BASE_URL = 'http://localhost:7890';
const BASE_URL = process.env.REACT_APP_BASE_URL;

/* Auth related functions */

export async function getUser() {
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
}

export async function signUpUser(email, password) {
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
}

export async function signInUser(email, password) {
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
}

export async function signOutUser() {
  const resp = await fetch(`${BASE_URL}/api/users/sessions`, {
    method: 'DELETE',
    credentials: 'include',
  });

  if (resp.ok) {
    return { success: true };
  } else {
    return { success: false, error: 'Failed to sign out' };
  }
}
