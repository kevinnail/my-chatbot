import React, { useState } from 'react';
import { NavLink, useParams, useNavigate, useLocation } from 'react-router-dom';
import { useUser } from '../../hooks/useUser.js';
import { useLoading } from '../../contexts/LoadingContext.js';
import ChatLoadingInline from '../ChatLoadingInline/ChatLoadingInline.js';
import './Auth.css';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

export default function Auth() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignIn, setIsSignIn] = useState(true);
  const { user, logInUser } = useUser();
  const { authLoading } = useLoading();
  const { type } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(false);

  if (!window.isLocal && user.id === 'demo-user' && user.email === 'demo@example.com') {
    navigate('/');
  }

  const submitAuth = async () => {
    try {
      setLoading(true);
      await logInUser(email, password, type);

      toast.success('Successfully signed in!', {
        theme: 'colored',
        draggable: true,
        draggablePercent: 60,
        toastId: 'auth-success',
        autoClose: 3000,
      });

      // Redirect to the page they were trying to access, or home
      const from = location.state?.from?.pathname || '/';
      navigate(from, { replace: true });
    } catch (e) {
      console.error(e);
      toast.error('Sign in failed. Please check your credentials.', {
        theme: 'colored',
        draggable: true,
        draggablePercent: 60,
        toastId: 'auth-error',
        autoClose: 5000,
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="auth-container">
        <ChatLoadingInline props="authentication" />
      </div>
    );
  }

  return (
    <div className="auth-container">
      <div className="sign-in-sign-out">
        <NavLink className="link" to="/auth/sign-in" onClick={() => setIsSignIn(true)}>
          Sign-in
        </NavLink>
        <NavLink className="link" to="/auth/sign-up" onClick={() => setIsSignIn(false)}>
          Sign-up
        </NavLink>
      </div>

      <div className="email-container">
        <input
          className="input"
          type="email"
          placeholder="email@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={authLoading}
        />

        <input
          className="input"
          type="password"
          placeholder="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={authLoading}
        />
        <button onClick={submitAuth} disabled={authLoading}>
          {isSignIn ? 'Sign In' : 'Sign Up'}
        </button>
      </div>
    </div>
  );
}
