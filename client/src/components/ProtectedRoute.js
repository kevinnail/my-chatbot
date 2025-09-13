import { Navigate, useLocation } from 'react-router-dom';
import { useUser } from '../hooks/useUser.js';
import ChatLoadingInline from './ChatLoadingInline/ChatLoadingInline.js';

export default function ProtectedRoute({ children }) {
  const { user, loading } = useUser();
  const location = useLocation();

  if (loading) {
    return <ChatLoadingInline />;
  }

  if (!user) {
    // Redirect to auth page, but save the attempted location
    return <Navigate to="/auth/sign-in" state={{ from: location }} replace />;
  }

  return children;
}
