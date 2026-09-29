'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const userData = localStorage.getItem('user');
    const token = localStorage.getItem('token');
    if (userData && token) {
      try {
        const user = JSON.parse(userData);
        if (user.role === 'admin') {
          router.replace('/admin');
        } else if (user.role === 'student') {
          router.replace('/student');
        } else if (user.role === 'faculty') {
          router.replace('/faculty');
        }
      } catch (e) {}
    }
  }, [router]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (res.ok) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));

        if (data.user.role === 'admin') {
          router.push('/admin');
        } else if (data.user.role === 'student') {
          router.push('/student');
        } else if (data.user.role === 'faculty') {
          router.push('/faculty');
        } else {
          setSuccess(`Login Successful! Logged in as ${data.user.role.toUpperCase()}.`);
        }
      } else {
        setError(data.error || 'Login failed');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="logo-container">
          <div className="logo-circle">CR</div>
        </div>
        <h1 className="brand-text">CodeRank</h1>
        <p className="tagline">Rank Up Coding.</p>

        {error && <p style={{color: '#ef4444', fontSize: '14px', marginBottom: '15px', background: '#fee2e2', padding: '10px', borderRadius: '6px'}}>{error}</p>}
        {success && <p style={{color: '#10b981', fontSize: '14px', marginBottom: '15px', background: '#ecfdf5', padding: '10px', borderRadius: '6px'}}>{success}</p>}

        <form onSubmit={handleLogin}>
          <div className="input-group">
            <input 
              type="text" 
              className="input-field" 
              placeholder="Enter Username or Email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              suppressHydrationWarning
            />
          </div>
          
          <div className="input-group">
            <input 
              type={showPassword ? "text" : "password"} 
              className="input-field" 
              placeholder="Enter Password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              suppressHydrationWarning
            />
            <span 
              className="password-toggle"
              onClick={() => setShowPassword(!showPassword)}
            >
              👁
            </span>
          </div>

          <button type="submit" className="btn-primary" disabled={loading} suppressHydrationWarning>
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>
      </div>
    </div>
  );
}
