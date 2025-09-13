import { Navigate, useLocation } from 'react-router-dom';
import { useUser } from '../hooks/useUser.js';
import ChatLoadingInline from './ChatLoadingInline/ChatLoadingInline.js';

// Helper function to validate user object
const isValidUser = (user) => {
  return user && user.id && user.email && typeof user.email === 'string';
};

export default function ProtectedRoute({ children }) {
  const { user, loading } = useUser();
  const location = useLocation();

  if (loading) {
    return <ChatLoadingInline />;
  }

  if (!isValidUser(user)) {
    // Redirect to auth page, but save the attempted location
    return <Navigate to="/auth/sign-in" state={{ from: location }} replace />;
  }

  return children;
}
