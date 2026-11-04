'use client';
import { useLogin } from '../hooks/useLogin';

import {SignInPage} from '@/features/auth/components/SignIn';

export default function Login() {
  const { error, setError, success, setSuccess, loading, setLoading, pending, handleLogin } = useLogin();
  return <SignInPage loading={loading} error={error || success}
    onSignIn={(event) => {
      const form = new FormData(event.currentTarget);
      handleLogin(event, {email: String(form.get('email') || '').trim(), password: String(form.get('password') || '')});
    }}
  />;
}
