import { createContext, useEffect, useState } from 'react';
// import { authUser } from '../services/auth.js';
import { getUser } from '../services/fetch-utils.js';

const UserContext = createContext();

const UserProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const user = await getUser();
        setUser(user);
        setLoading(false);
      } catch (error) {
        setError(error);
        setLoading(false);
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
