import { createContext, useEffect, useState } from 'react';
// import { authUser } from '../services/auth.js';
import { getUser } from '../services/fetch-auth.js';

const UserContext = createContext();

// Read environment variable at module level
const googleId = process.env.REACT_APP_GOOGLE_USER_ID;

const UserProvider = ({ children }) => {
  console.log('UserProvider component rendering');
  const [user, setUser] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState();

  useEffect(() => {
    console.log('UserContext useEffect running');
    console.log('About to call fetchUser');

    const fetchUser = async () => {
      console.log('fetchUser function called');
      console.log('window.isLocal:', window.isLocal);

      // For demo mode (non-local), skip auth and set demo user
      if (!window.isLocal) {
        console.log('Setting demo user');
        setUser({
          id: 'demo-user',
          email: 'demo@example.com',
        });
        setUserId('demo-user');
        setLoading(false);
        return;
      }

      try {
        console.log('setting user');
        const user = await getUser();
        console.log('fetched user: ', user);
        // Only set user if we get valid user data from the server
        if (user && user.id && user.email) {
          setUser(user);
          console.log('googleId', googleId);
          setUserId(googleId);
        } else {
          setUser(null);
        }
        setLoading(false);
      } catch (error) {
        console.log('Error in fetchUser:', error);
        setError(error);
        setUser(null);
        setLoading(false);
        // If it's an auth error, clear any stale cookies
        if (error.status === 401) {
          // Could call signOut here to clear cookies
        }
      }
    };

    console.log('Calling fetchUser now');
    fetchUser();
    console.log('fetchUser call completed');
  }, []);

  return (
    <UserContext.Provider
      value={{ user, setUser, error, setError, loading, setLoading, userId, setUserId }}
    >
      {children}
    </UserContext.Provider>
  );
};

export { UserProvider, UserContext };
