'use client';

import { useState, useRef, useEffect } from 'react';
import { signInRequest } from '@/lib/sign-in-request';
import Link from 'next/link';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const pending = useRef(null);
  useEffect(() => () => pending.current?.abort(), []);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (pending.current) return;
    const controller = new AbortController();
    pending.current = controller;
    setError('');
    setLoading(true);

    try {
      const data = await signInRequest({email, password}, {signal: controller.signal});

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

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#f8fafc',
      backgroundImage: `
        radial-gradient(at 0% 0%, rgba(0, 102, 177, 0.09) 0px, transparent 50%),
        radial-gradient(at 100% 100%, rgba(0, 102, 177, 0.06) 0px, transparent 50%),
        radial-gradient(at 50% 50%, #ffffff 0px, #f8fafc 100%)
      `,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      position: 'relative',
      overflow: 'hidden',
      padding: '24px 16px',
    }}>
      {/* Decorative ambient blue color accents */}
      <div style={{
        position: 'absolute',
        top: '-120px',
        right: '-80px',
        width: '450px',
        height: '450px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(0, 102, 177, 0.12) 0%, transparent 70%)',
        filter: 'blur(50px)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute',
        bottom: '-120px',
        left: '-80px',
        width: '400px',
        height: '400px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(0, 102, 177, 0.08) 0%, transparent 70%)',
        filter: 'blur(50px)',
        pointerEvents: 'none',
      }} />

      {/* Main Login Card */}
      <div style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '24px',
        padding: '0',
        width: '100%',
        maxWidth: '430px',
        position: 'relative',
        zIndex: 2,
        boxShadow: '0 20px 45px -12px rgba(0, 102, 177, 0.10), 0 4px 16px -2px rgba(15, 23, 42, 0.04)',
        overflow: 'hidden',
      }}>
        {/* Top brand accent stripe: Global theme blue gradient */}
        <div style={{
          height: '5px',
          width: '100%',
          background: 'linear-gradient(90deg, #004b87 0%, #0066b1 50%, #38bdf8 100%)',
        }} />

        <div style={{ padding: '42px 36px 36px' }}>
          {/* CodeRank Logo */}
          <div style={{
            width: '76px',
            height: '76px',
            margin: '0 auto 18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '20px',
            padding: '5px',
            background: '#ffffff',
            border: '2px solid #e2e8f0',
            boxShadow: '0 8px 24px -4px rgba(0, 102, 177, 0.18)',
          }}>
            <img
              src="/coderank-logo.jpg"
              alt="CodeRank Logo"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                if (e.currentTarget.nextSibling) {
                  e.currentTarget.nextSibling.style.display = 'flex';
                }
              }}
              style={{ width: '100%', height: '100%', borderRadius: '15px', objectFit: 'cover' }}
            />
            <div style={{
              display: 'none',
              width: '100%',
              height: '100%',
              background: 'linear-gradient(135deg, #0066b1, #0284c7)',
              borderRadius: '15px',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '24px',
              color: '#ffffff',
              fontWeight: 800,
            }}>
              CR
            </div>
          </div>

          {/* Heading */}
          <div style={{ textAlign: 'center', marginBottom: '28px' }}>
            <h1 style={{
              color: '#0f172a',
              fontSize: '28px',
              fontWeight: 800,
              letterSpacing: '-0.025em',
              margin: '0 0 6px',
            }}>
              Code<span style={{ color: '#0066b1' }}>Rank</span>
            </h1>
            <p style={{
              color: '#64748b',
              fontSize: '14px',
              fontWeight: 500,
              margin: 0,
            }}>
              Rank Up Your Coding
            </p>
          </div>

          {/* Error Banner */}
          {error && (
            <div role="alert" style={{
              background: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#dc2626',
              padding: '12px 16px',
              borderRadius: '12px',
              fontSize: '13px',
              fontWeight: 500,
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}>
              <span style={{ fontSize: '15px', lineHeight: 1 }}>⚠️</span>
              <span style={{ flex: 1 }}>{error}</span>
            </div>
          )}

          {/* Success Banner */}
          {success && (
            <div style={{
              background: '#f0fdf4',
              border: '1px solid #bbf7d0',
              color: '#16a34a',
              padding: '12px 16px',
              borderRadius: '12px',
              fontSize: '13px',
              fontWeight: 500,
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}>
              <span style={{ fontSize: '15px', lineHeight: 1 }}>✓</span>
              <span style={{ flex: 1 }}>{success}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <div>
              <label style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: 600,
                color: '#334155',
                marginBottom: '6px',
              }}>
                Username or Email
              </label>
              <input
                type="text"
                placeholder="e.g. reyapatel@charusat.ac.in"
                aria-label="Username or Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                suppressHydrationWarning
                style={{
                  width: '100%',
                  padding: '13px 16px',
                  background: '#f8fafc',
                  border: '1.5px solid #e2e8f0',
                  borderRadius: '12px',
                  color: '#0f172a',
                  fontSize: '14px',
                  fontWeight: 500,
                  outline: 'none',
                  transition: 'all 0.2s ease',
                  boxSizing: 'border-box',
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#0066b1';
                  e.target.style.background = '#ffffff';
                  e.target.style.boxShadow = '0 0 0 4px rgba(0, 102, 177, 0.12)';
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
                fontSize: '13px',
                fontWeight: 600,
                color: '#334155',
                marginBottom: '6px',
              }}>
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  aria-label="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  suppressHydrationWarning
                  style={{
                    width: '100%',
                    padding: '13px 44px 13px 16px',
                    background: '#f8fafc',
                    border: '1.5px solid #e2e8f0',
                    borderRadius: '12px',
                    color: '#0f172a',
                    fontSize: '14px',
                    fontWeight: 500,
                    outline: 'none',
                    transition: 'all 0.2s ease',
                    boxSizing: 'border-box',
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#0066b1';
                    e.target.style.background = '#ffffff';
                    e.target.style.boxShadow = '0 0 0 4px rgba(0, 102, 177, 0.12)';
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
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: '#64748b',
                    cursor: 'pointer',
                    fontSize: '17px',
                    padding: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            {/* Submit Button with Global Theme Blue Color */}
            <button
              type="submit"
              disabled={loading}
              style={{
                marginTop: '8px',
                padding: '14px',
                background: loading
                  ? 'linear-gradient(135deg, #94a3b8, #cbd5e1)'
                  : 'linear-gradient(135deg, #0066b1 0%, #0284c7 100%)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '12px',
                fontSize: '15px',
                fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: loading
                  ? 'none'
                  : '0 6px 20px -2px rgba(0, 102, 177, 0.40)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}
              onMouseEnter={(e) => {
                if (!loading) {
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = '0 8px 24px -2px rgba(0, 102, 177, 0.50)';
                  e.currentTarget.style.background = 'linear-gradient(135deg, #005697 0%, #0284c7 100%)';
                }
              }}
              onMouseLeave={(e) => {
                if (!loading) {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 6px 20px -2px rgba(0, 102, 177, 0.40)';
                  e.currentTarget.style.background = 'linear-gradient(135deg, #0066b1 0%, #0284c7 100%)';
                }
              }}
            >
              {loading ? (
                <>
                  <span style={{
                    width: '16px',
                    height: '16px',
                    border: '2px solid rgba(255,255,255,0.4)',
                    borderTopColor: '#ffffff',
                    borderRadius: '50%',
                    display: 'inline-block',
                    animation: 'spin 0.7s linear infinite',
                  }} />
                  Signing in…
                </>
              ) : (
                'Sign In →'
              )}
            </button>
          </form>

          {/* Footer Back Link */}
          <div style={{
            marginTop: '28px',
            paddingTop: '20px',
            borderTop: '1px solid #f1f5f9',
            textAlign: 'center',
          }}>
            <Link
              href="/"
              style={{
                color: '#64748b',
                fontSize: '13px',
                fontWeight: 500,
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'color 0.2s ease',
              }}
              onMouseEnter={(e) => e.currentTarget.style.color = '#0066b1'}
              onMouseLeave={(e) => e.currentTarget.style.color = '#64748b'}
            >
              ← Back to Home
            </Link>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        input::placeholder { color: #94a3b8; font-weight: 400; }
        input:-webkit-autofill {
          -webkit-box-shadow: 0 0 0 1000px #f8fafc inset !important;
          -webkit-text-fill-color: #0f172a !important;
        }
      `}</style>
    </div>
  );
}
