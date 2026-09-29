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
        if (user.role === 'admin') router.replace('/admin');
        else if (user.role === 'student') router.replace('/student');
        else if (user.role === 'faculty') router.replace('/faculty');
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

        if (data.user.role === 'admin') router.push('/admin');
        else if (data.user.role === 'student') router.push('/student');
        else if (data.user.role === 'faculty') router.push('/faculty');
        else setSuccess(`Login Successful! Logged in as ${data.user.role.toUpperCase()}.`);
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
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'Inter, sans-serif',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Background orbs */}
      <div style={{
        position: 'absolute', width: '500px', height: '500px',
        borderRadius: '50%', background: 'radial-gradient(circle, rgba(79,70,229,0.2) 0%, transparent 70%)',
        top: '-150px', left: '-100px', filter: 'blur(40px)',
      }} />
      <div style={{
        position: 'absolute', width: '400px', height: '400px',
        borderRadius: '50%', background: 'radial-gradient(circle, rgba(139,92,246,0.15) 0%, transparent 70%)',
        bottom: '-100px', right: '-50px', filter: 'blur(40px)',
      }} />

      <div style={{
        background: 'rgba(255,255,255,0.05)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '24px',
        padding: '48px 40px',
        width: '100%',
        maxWidth: '420px',
        textAlign: 'center',
        position: 'relative',
        zIndex: 1,
        boxShadow: '0 25px 50px rgba(0,0,0,0.4)',
      }}>
        {/* Logo */}
        <div style={{
          width: '72px', height: '72px',
          background: 'linear-gradient(135deg, #4F46E5, #7C3AED)',
          borderRadius: '20px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 20px',
          fontSize: '28px',
          boxShadow: '0 8px 24px rgba(79,70,229,0.4)',
        }}>
          ⚡
        </div>

        <h1 style={{ color: '#ffffff', fontSize: '28px', fontWeight: 800, marginBottom: '6px' }}>
          CodeRank
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px', marginBottom: '32px' }}>
          Rank Up Your Coding
        </p>

        {error && (
          <div style={{
            background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)',
            color: '#fca5a5', padding: '12px 16px', borderRadius: '10px',
            fontSize: '13px', marginBottom: '20px', textAlign: 'left',
          }}>
            ⚠ {error}
          </div>
        )}
        {success && (
          <div style={{
            background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)',
            color: '#6ee7b7', padding: '12px 16px', borderRadius: '10px',
            fontSize: '13px', marginBottom: '20px', textAlign: 'left',
          }}>
            ✓ {success}
          </div>
        )}

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <input
            type="text"
            placeholder="Username or Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            suppressHydrationWarning
            style={{
              padding: '14px 16px',
              background: 'rgba(255,255,255,0.07)',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: '12px',
              color: '#ffffff',
              fontSize: '14px',
              outline: 'none',
              transition: 'border-color 0.2s',
              fontFamily: 'inherit',
            }}
            onFocus={(e) => e.target.style.borderColor = '#4F46E5'}
            onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.15)'}
          />

          <div style={{ position: 'relative' }}>
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              suppressHydrationWarning
              style={{
                width: '100%',
                padding: '14px 48px 14px 16px',
                background: 'rgba(255,255,255,0.07)',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: '12px',
                color: '#ffffff',
                fontSize: '14px',
                outline: 'none',
                transition: 'border-color 0.2s',
                fontFamily: 'inherit',
                boxSizing: 'border-box',
              }}
              onFocus={(e) => e.target.style.borderColor = '#4F46E5'}
              onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.15)'}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              style={{
                position: 'absolute', right: '14px', top: '50%',
                transform: 'translateY(-50%)', background: 'none', border: 'none',
                color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: '16px',
                padding: 0,
              }}
            >
              {showPassword ? '🙈' : '👁'}
            </button>
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              padding: '14px',
              background: loading
                ? 'rgba(79,70,229,0.5)'
                : 'linear-gradient(135deg, #4F46E5, #7C3AED)',
              color: '#ffffff',
              border: 'none',
              borderRadius: '12px',
              fontSize: '15px',
              fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
              marginTop: '6px',
              fontFamily: 'inherit',
              boxShadow: '0 4px 16px rgba(79,70,229,0.4)',
              letterSpacing: '0.02em',
            }}
          >
            {loading ? 'Signing in…' : 'Sign In →'}
          </button>
        </form>

        <div style={{ marginTop: '28px', paddingTop: '20px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <a
            href="/"
            style={{
              color: 'rgba(255,255,255,0.4)', fontSize: '13px',
              textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px',
            }}
          >
            ← Back to Home
          </a>
        </div>
      </div>

      <style>{`
        input::placeholder { color: rgba(255,255,255,0.3); }
        input:-webkit-autofill {
          -webkit-box-shadow: 0 0 0 1000px rgba(30,27,75,0.9) inset !important;
          -webkit-text-fill-color: #ffffff !important;
        }
      `}</style>
    </div>
  );
}
