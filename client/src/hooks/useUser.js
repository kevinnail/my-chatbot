import { useContext } from 'react';
import { UserContext } from '../contexts/UserContext.js';
import { authUser } from '../services/auth.js';

export function useUser() {
  const { user, setUser, loading, error, setError } = useContext(UserContext);

  const logInUser = async (email, password, type) => {
    const user = await authUser(email, password, type);
    setUser(user);
  };

  return { user, setUser, error, setError, logInUser, loading };
}
