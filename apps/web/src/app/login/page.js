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
  const [logoError, setLogoError] = useState(false);
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
      background: 'linear-gradient(135deg, #f8fafc 0%, #eff1ff 50%, #f0f4ff 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'Inter, sans-serif',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Background decorative blobs */}
      <div style={{
        position: 'absolute', width: '600px', height: '600px',
        borderRadius: '50%', background: 'radial-gradient(circle, rgba(79,70,229,0.08) 0%, transparent 70%)',
        top: '-200px', right: '-100px', filter: 'blur(60px)', pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', width: '500px', height: '500px',
        borderRadius: '50%', background: 'radial-gradient(circle, rgba(139,92,246,0.06) 0%, transparent 70%)',
        bottom: '-150px', left: '-100px', filter: 'blur(60px)', pointerEvents: 'none',
      }} />

      <div style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '20px',
        padding: '48px 40px',
        width: '100%',
        maxWidth: '420px',
        textAlign: 'center',
        position: 'relative',
        zIndex: 1,
        boxShadow: '0 10px 30px rgba(0,0,0,0.08)',
      }}>
        {/* Logo */}
        <div style={{
          width: '80px', height: '80px',
          margin: '0 auto 24px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          borderRadius: '16px',
          overflow: 'hidden',
          boxShadow: '0 4px 12px rgba(79,70,229,0.15)',
          background: 'linear-gradient(135deg, #4F46E5, #7C3AED)',
        }}>
          {!logoError ? (
            <img
              src="/coderank-logo.jpg"
              alt="CodeRank Logo"
              onError={() => setLogoError(true)}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <div style={{
              width: '100%', height: '100%',
              background: 'linear-gradient(135deg, #4F46E5, #7C3AED)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '28px', color: 'white', fontWeight: 800,
            }}>
              CR
            </div>
          )}
        </div>

        <h1 style={{ color: '#1e293b', fontSize: '28px', fontWeight: 800, marginBottom: '8px' }}>
          CodeRank
        </h1>
        <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '32px', fontWeight: '500' }}>
          Rank Up Your Coding Skills
        </p>

        {error && (
          <div style={{
            background: '#fef2f2', border: '1px solid #fecaca',
            color: '#dc2626', padding: '12px 16px', borderRadius: '10px',
            fontSize: '13px', marginBottom: '20px', textAlign: 'left',
            fontWeight: '500',
          }}>
            ⚠️ {error}
          </div>
        )}
        {success && (
          <div style={{
            background: '#f0fdf4', border: '1px solid #86efac',
            color: '#16a34a', padding: '12px 16px', borderRadius: '10px',
            fontSize: '13px', marginBottom: '20px', textAlign: 'left',
            fontWeight: '500',
          }}>
            ✓ {success}
          </div>
        )}

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{
              display: 'block',
              textAlign: 'left',
              fontSize: '13px',
              fontWeight: '600',
              color: '#1e293b',
              marginBottom: '6px',
            }}>
              Email or Username
            </label>
            <input
              type="text"
              placeholder="Enter your email or username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              suppressHydrationWarning
              style={{
                padding: '12px 14px',
                background: '#f8fafc',
                border: '1.5px solid #e2e8f0',
                borderRadius: '8px',
                color: '#1e293b',
                fontSize: '14px',
                outline: 'none',
                transition: 'all 0.2s',
                fontFamily: 'inherit',
                width: '100%',
                boxSizing: 'border-box',
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#4F46E5';
                e.target.style.background = '#ffffff';
                e.target.style.boxShadow = '0 0 0 3px rgba(79,70,229,0.1)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#e2e8f0';
                e.target.style.background = '#f8fafc';
                e.target.style.boxShadow = 'none';
              }}
            />
          </div>

          <div>
            <label style={{
              display: 'block',
              textAlign: 'left',
              fontSize: '13px',
              fontWeight: '600',
              color: '#1e293b',
              marginBottom: '6px',
            }}>
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                suppressHydrationWarning
                style={{
                  width: '100%',
                  padding: '12px 44px 12px 14px',
                  background: '#f8fafc',
                  border: '1.5px solid #e2e8f0',
                  borderRadius: '8px',
                  color: '#1e293b',
                  fontSize: '14px',
                  outline: 'none',
                  transition: 'all 0.2s',
                  fontFamily: 'inherit',
                  boxSizing: 'border-box',
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#4F46E5';
                  e.target.style.background = '#ffffff';
                  e.target.style.boxShadow = '0 0 0 3px rgba(79,70,229,0.1)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#e2e8f0';
                  e.target.style.background = '#f8fafc';
                  e.target.style.boxShadow = 'none';
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute', right: '12px', top: '50%',
                  transform: 'translateY(-50%)', background: 'none', border: 'none',
                  color: '#94a3b8', cursor: 'pointer', fontSize: '16px',
                  padding: 0, marginTop: '20px',
                }}
              >
                {showPassword ? '🙈' : '👁'}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              padding: '12px 16px',
              background: loading
                ? '#cbd5e1'
                : 'linear-gradient(135deg, #4F46E5 0%, #6366f1 100%)',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '15px',
              fontWeight: '700',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
              marginTop: '8px',
              fontFamily: 'inherit',
              boxShadow: loading ? 'none' : '0 4px 12px rgba(79,70,229,0.3)',
              letterSpacing: '0.02em',
              width: '100%',
            }}
            onHover={(e) => {
              if (!loading) {
                e.target.style.boxShadow = '0 6px 16px rgba(79,70,229,0.4)';
                e.target.style.transform = 'translateY(-1px)';
              }
            }}
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <div style={{
          marginTop: '24px',
          paddingTop: '24px',
          borderTop: '1px solid #e2e8f0',
          color: '#94a3b8',
          fontSize: '12px',
        }}>
          <p style={{ margin: 0 }}>🔒 Secure login powered by CodeRank</p>
        </div>
      </div>

      <style>{`
        input::placeholder { color: #cbd5e1; }
        input:-webkit-autofill {
          -webkit-box-shadow: 0 0 0 1000px #f8fafc inset !important;
          -webkit-text-fill-color: #1e293b !important;
        }
        input:-webkit-autofill:focus {
          -webkit-box-shadow: 0 0 0 1000px #ffffff inset !important;
          -webkit-text-fill-color: #1e293b !important;
        }
      `}</style>
    </div>
  );
}
