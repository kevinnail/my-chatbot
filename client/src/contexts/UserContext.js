import { createContext, useEffect, useState } from 'react';
// import { authUser } from '../services/auth.js';
import { getUser } from '../services/fetch-auth.js';

const UserContext = createContext();

const UserProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUser = async () => {
      // For demo mode (non-local), skip auth and set demo user
      if (!window.isLocal) {
        setUser({
          id: 'demo-user',
          email: 'demo@example.com',
        });
        setLoading(false);
        return;
      }

      try {
        const user = await getUser();
        // Only set user if we get valid user data from the server
        if (user && user.id && user.email) {
          setUser(user);
        } else {
          setUser(null);
        }
        setLoading(false);
      } catch (error) {
        setError(error);
        setUser(null);
        setLoading(false);
        // If it's an auth error, clear any stale cookies
        if (error.status === 401) {
          // Could call signOut here to clear cookies
        }
      }
    };
    fetchUser();
  }, []);

  return (
    <UserContext.Provider value={{ user, setUser, error, setError, loading, setLoading }}>
      {children}
    </UserContext.Provider>
  );
};

export { UserProvider, UserContext };
