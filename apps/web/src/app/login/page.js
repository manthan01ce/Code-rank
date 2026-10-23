'use client';

import { useState, useRef, useEffect } from 'react';
import { signInRequest } from '@/lib/sign-in-request';
import {SignInPage} from '@/components/ui/sign-in';

export default function Login() {
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const pending = useRef(null);
  useEffect(() => () => pending.current?.abort(), []);

  const handleLogin = async (e, credentials) => {
    e.preventDefault();
    if (pending.current) return;
    const controller = new AbortController();
    pending.current = controller;
    setError('');
    setLoading(true);

    try {
      const data = await signInRequest(credentials, {signal: controller.signal});

        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));

        // Use direct window location assignment to ensure synchronous storage persistence
        // and eliminate any client-side router hydration race conditions.
        if (data.user.role === 'admin') {
          window.location.href = '/admin';
        } else if (data.user.role === 'faculty') {
          window.location.href = '/faculty';
        } else if (data.user.role === 'student') {
          window.location.href = '/student';
        } else {
          setSuccess(`Login Successful! Logged in as ${data.user.role.toUpperCase()}.`);
        }
    } catch (err) {
      if (controller.signal.aborted) return;
      const msg = err.message || '';
      if (msg.toLowerCase().includes('fetch') || msg.toLowerCase().includes('network')) {
        setError('Unable to reach the server. Please check your connection.');
      } else if (msg.toLowerCase().includes('json')) {
        setError('Received an unexpected response. Please try again.');
      } else {
        setError(msg || 'Something went wrong. Please try again.');
      }
    } finally {
      if (pending.current === controller) pending.current = null;
      if (!controller.signal.aborted) setLoading(false);
    }
  };

  return <SignInPage loading={loading} error={error || success}
    onSignIn={(event) => {
      const form = new FormData(event.currentTarget);
      handleLogin(event, {email: String(form.get('email') || '').trim(), password: String(form.get('password') || '')});
    }}
    heroImageSrc="https://images.unsplash.com/photo-1461749280684-dccba630e2f6?auto=format&fit=crop&w=1200&q=80"
  />;
}
