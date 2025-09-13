import { signInUser, signOutUser, signUpUser } from './fetch-utils.js';

export async function authUser(email, password, type) {
  let response;
  if (type === 'sign-up') {
    response = await signUpUser(email, password);
  } else {
    response = await signInUser(email, password);
  }
  if (response.error) {
    throw response.error;
  }
  return response.user;
}

export async function signOut() {
  await signOutUser();
}
