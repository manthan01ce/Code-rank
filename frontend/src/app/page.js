'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

/* ─── Micro-animation keyframes injected via <style> ─── */
const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(28px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes float {
    0%, 100% { transform: translateY(0px) rotate(0deg); }
    50%       { transform: translateY(-12px) rotate(2deg); }
  }
  @keyframes pulse-glow {
    0%, 100% { box-shadow: 0 0 0 0 rgba(79,70,229,0); }
    50%       { box-shadow: 0 0 40px 8px rgba(79,70,229,0.25); }
  }
  @keyframes spin-slow {
    from { transform: rotate(0deg); }
    to   { transform: rotate(360deg); }
  }
  @keyframes counter {
    from { opacity: 0; transform: scale(0.6); }
    to   { opacity: 1; transform: scale(1); }
  }
  @keyframes shimmer {
    0%   { background-position: -1000px 0; }
    100% { background-position:  1000px 0; }
  }
  @keyframes bounce-x {
    0%, 100% { transform: translateX(0); }
    50%       { transform: translateX(5px); }
  }

  html { scroll-behavior: smooth; }
  body { font-family: 'Inter', sans-serif; background: #050714; color: #e2e8f0; overflow-x: hidden; }

  .hero-badge {
    display: inline-flex; align-items: center; gap: 8px;
    background: rgba(79,70,229,0.15); border: 1px solid rgba(79,70,229,0.35);
    border-radius: 100px; padding: 6px 16px; font-size: 13px;
    color: #a5b4fc; font-weight: 500; margin-bottom: 28px;
    animation: fadeUp 0.6s ease both;
  }
  .hero-badge span { width: 8px; height: 8px; background: #4F46E5; border-radius: 50%; display: inline-block; animation: pulse-glow 2s ease infinite; }

  .btn-primary-hero {
    display: inline-flex; align-items: center; gap: 10px;
    padding: 16px 32px; background: linear-gradient(135deg, #4F46E5, #7C3AED);
    color: white; border: none; border-radius: 14px; font-size: 16px; font-weight: 700;
    cursor: pointer; text-decoration: none; font-family: inherit;
    transition: all 0.25s; box-shadow: 0 8px 32px rgba(79,70,229,0.45);
    animation: fadeUp 0.8s 0.4s ease both;
  }
  .btn-primary-hero:hover { transform: translateY(-2px); box-shadow: 0 16px 40px rgba(79,70,229,0.55); }

  .btn-secondary-hero {
    display: inline-flex; align-items: center; gap: 8px;
    padding: 16px 28px; background: rgba(255,255,255,0.06);
    color: #cbd5e1; border: 1px solid rgba(255,255,255,0.12); border-radius: 14px;
    font-size: 16px; font-weight: 600; cursor: pointer; text-decoration: none; font-family: inherit;
    transition: all 0.25s; animation: fadeUp 0.8s 0.5s ease both;
  }
  .btn-secondary-hero:hover { background: rgba(255,255,255,0.1); border-color: rgba(255,255,255,0.2); transform: translateY(-2px); }

  .feature-card {
    background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07);
    border-radius: 20px; padding: 32px; transition: all 0.3s;
    position: relative; overflow: hidden;
  }
  .feature-card::before {
    content: ''; position: absolute; top: 0; left: 0; right: 0; height: 1px;
    background: linear-gradient(90deg, transparent, rgba(79,70,229,0.6), transparent);
    opacity: 0; transition: opacity 0.3s;
  }
  .feature-card:hover { transform: translateY(-4px); border-color: rgba(79,70,229,0.25); background: rgba(79,70,229,0.05); }
  .feature-card:hover::before { opacity: 1; }

  .stat-pill {
    background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08);
    border-radius: 16px; padding: 24px 32px; text-align: center;
    transition: all 0.3s; animation: counter 0.6s ease both;
  }
  .stat-pill:hover { border-color: rgba(79,70,229,0.3); transform: scale(1.03); }

  .code-window {
    background: #0d1117; border-radius: 16px; overflow: hidden;
    border: 1px solid rgba(255,255,255,0.08);
    box-shadow: 0 24px 60px rgba(0,0,0,0.5);
    animation: float 6s ease-in-out infinite;
  }
  .code-topbar {
    background: #161b22; padding: 14px 20px; display: flex; gap: 8px; align-items: center;
    border-bottom: 1px solid rgba(255,255,255,0.06);
  }
  .dot { width: 12px; height: 12px; border-radius: 50%; }

  .nav-link {
    color: rgba(255,255,255,0.55); text-decoration: none; font-size: 14px;
    font-weight: 500; transition: color 0.2s; padding: 6px 12px; border-radius: 8px;
  }
  .nav-link:hover { color: #ffffff; background: rgba(255,255,255,0.07); }

  .gradient-text {
    background: linear-gradient(135deg, #4F46E5 0%, #7C3AED 40%, #06b6d4 100%);
    -webkit-background-clip: text; -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .role-card {
    background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08);
    border-radius: 20px; padding: 28px; cursor: pointer;
    transition: all 0.3s; text-decoration: none; display: block;
  }
  .role-card:hover { transform: translateY(-6px); background: rgba(79,70,229,0.08); border-color: rgba(79,70,229,0.3); }

  .scroll-arrow {
    animation: bounce-x 1.5s ease-in-out infinite;
    display: inline-block;
  }

  @media (max-width: 768px) {
    .hero-grid { flex-direction: column !important; }
    .features-grid { grid-template-columns: 1fr !important; }
    .stats-row { flex-direction: column !important; }
    .roles-grid { grid-template-columns: 1fr !important; }
  }
`;

const FEATURES = [
  {
    icon: '⚡',
    color: '#f59e0b',
    title: 'Live Code Execution',
    desc: 'Run Python, C++, C, Java, and JavaScript in isolated sandboxes with real-time output. Resource-constrained for security.',
  },
  {
    icon: '🎯',
    color: '#4F46E5',
    title: 'Dynamic Practicals',
    desc: 'Faculty create timed practicals with test cases, marking schemes, and per-student deadlines. Real-time countdowns for students.',
  },
  {
    icon: '📊',
    color: '#10b981',
    title: 'Automated Grading',
    desc: 'Every submission is automatically evaluated against all test cases. Normalized scores and highest-marks preservation.',
  },
  {
    icon: '🔒',
    color: '#ef4444',
    title: 'Single-Device Sessions',
    desc: 'JWT auth with session tokens ensures students can only log in from one device at a time during exams.',
  },
  {
    icon: '📡',
    color: '#06b6d4',
    title: 'Real-Time Updates',
    desc: 'Socket.IO + smart polling keeps dashboards live — practical activation, submissions, and countdowns sync instantly.',
  },
  {
    icon: '📥',
    color: '#8b5cf6',
    title: 'Bulk Management',
    desc: 'Admins upload students and faculty via CSV/Excel. Auto-generated credentials with PDF download.',
  },
];

const STATS = [
  { value: '5+', label: 'Languages Supported', icon: '🌐' },
  { value: '200', label: 'Concurrent Users Tested', icon: '👥' },
  { value: '30s', label: 'k6 Load Test Concurrency', icon: '⚡' },
  { value: '100%', label: 'Serverless Architecture', icon: '☁️' },
];

const CODE_SNIPPET = `# Practical: Binary Search
# Faculty: Prof. Sharma  |  Time: 45 min

def binary_search(arr, target):
    left, right = 0, len(arr) - 1
    while left <= right:
        mid = (left + right) // 2
        if arr[mid] == target:
            return mid          # ✅ Found
        elif arr[mid] < target:
            left = mid + 1
        else:
            right = mid - 1
    return -1                   # ❌ Not found

# Test Cases: 4/4 Passed
# Score: 10/10 ✨`;

export default function HomePage() {
  const router = useRouter();
  const [scrolled, setScrolled] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [userRole, setUserRole] = useState(null);

  useEffect(() => {
    // Check if already logged in
    const userData = localStorage.getItem('user');
    const token = localStorage.getItem('token');
    if (userData && token) {
      try {
        const user = JSON.parse(userData);
        setLoggedIn(true);
        setUserRole(user.role);
      } catch {}
    }

    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const dashboardHref = userRole === 'admin' ? '/admin' : userRole === 'faculty' ? '/faculty' : '/student';

  return (
    <>
      <style>{STYLES}</style>

      {/* ── NAV ── */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1000,
        padding: '0 40px', height: '64px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: scrolled ? 'rgba(5,7,20,0.85)' : 'transparent',
        backdropFilter: scrolled ? 'blur(20px)' : 'none',
        borderBottom: scrolled ? '1px solid rgba(255,255,255,0.06)' : 'none',
        transition: 'all 0.3s',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '36px', height: '36px', background: 'linear-gradient(135deg, #4F46E5, #7C3AED)',
            borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '18px', boxShadow: '0 4px 12px rgba(79,70,229,0.4)',
          }}>⚡</div>
          <span style={{ fontWeight: 800, fontSize: '18px', color: '#fff', letterSpacing: '-0.03em' }}>CodeRank</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <a href="#features" className="nav-link">Features</a>
          <a href="#how-it-works" className="nav-link">How it Works</a>
          <a href="#roles" className="nav-link">Roles</a>
        </div>

        <div>
          {loggedIn ? (
            <Link href={dashboardHref} className="btn-primary-hero" style={{ padding: '10px 22px', fontSize: '14px', animation: 'none' }}>
              My Dashboard →
            </Link>
          ) : (
            <Link href="/login" className="btn-primary-hero" style={{ padding: '10px 22px', fontSize: '14px', animation: 'none' }}>
              Sign In →
            </Link>
          )}
        </div>
      </nav>

      {/* ── HERO ── */}
      <section style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center',
        padding: '80px 40px 60px', maxWidth: '1280px', margin: '0 auto',
        position: 'relative',
      }}>
        {/* Background gradient blobs */}
        <div style={{
          position: 'fixed', width: '700px', height: '700px', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(79,70,229,0.18) 0%, transparent 70%)',
          top: '-200px', left: '-200px', filter: 'blur(60px)', pointerEvents: 'none', zIndex: 0,
        }} />
        <div style={{
          position: 'fixed', width: '500px', height: '500px', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(124,58,237,0.12) 0%, transparent 70%)',
          bottom: '-100px', right: '10%', filter: 'blur(60px)', pointerEvents: 'none', zIndex: 0,
        }} />

        <div className="hero-grid" style={{ display: 'flex', alignItems: 'center', gap: '60px', width: '100%', position: 'relative', zIndex: 1 }}>
          {/* Left */}
          <div style={{ flex: 1 }}>
            <div className="hero-badge">
              <span /> Academic Coding Platform · Built for Institutions
            </div>

            <h1 style={{
              fontSize: 'clamp(42px, 5vw, 72px)', fontWeight: 900, lineHeight: 1.05,
              letterSpacing: '-0.04em', color: '#ffffff', marginBottom: '24px',
              animation: 'fadeUp 0.7s 0.1s ease both',
            }}>
              Where Students<br />
              <span className="gradient-text">Rank Up</span> Their<br />
              Coding Skills
            </h1>

            <p style={{
              fontSize: '18px', color: 'rgba(255,255,255,0.55)', lineHeight: 1.7,
              maxWidth: '500px', marginBottom: '40px',
              animation: 'fadeUp 0.7s 0.25s ease both',
            }}>
              A real-time, secure coding platform for academic labs — dynamic practicals,
              live code execution, faculty dashboards, and automated grading.
            </p>

            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
              <Link href={loggedIn ? dashboardHref : '/login'} className="btn-primary-hero">
                {loggedIn ? '→ Go to Dashboard' : '🚀 Get Started'}
              </Link>
              <a href="#features" className="btn-secondary-hero">
                Explore Features <span className="scroll-arrow">→</span>
              </a>
            </div>

            {/* Mini stats */}
            <div style={{
              display: 'flex', gap: '32px', marginTop: '52px',
              animation: 'fadeUp 0.7s 0.6s ease both',
            }}>
              {[['5+', 'Languages'], ['200', 'Concurrent Users'], ['10ms', 'Avg Response']].map(([val, lbl]) => (
                <div key={lbl}>
                  <div style={{ fontSize: '22px', fontWeight: 800, color: '#fff' }}>{val}</div>
                  <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginTop: '2px' }}>{lbl}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Right – floating code window */}
          <div style={{ flex: 1, maxWidth: '500px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="code-window">
              <div className="code-topbar">
                <div className="dot" style={{ background: '#ff5f57' }} />
                <div className="dot" style={{ background: '#febc2e' }} />
                <div className="dot" style={{ background: '#28c840' }} />
                <span style={{ marginLeft: '12px', fontSize: '12px', color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace' }}>
                  student_workspace.py
                </span>
              </div>
              <div style={{ padding: '20px 24px', fontFamily: '"Fira Code", "Consolas", monospace', fontSize: '13px', lineHeight: 1.8, color: '#e2e8f0', overflowX: 'auto' }}>
                {CODE_SNIPPET.split('\n').map((line, i) => (
                  <div key={i} style={{
                    color: line.startsWith('#') ? '#6b7280'
                      : line.includes('def ') ? '#60a5fa'
                      : line.includes('return') ? '#c084fc'
                      : line.includes('✅') || line.includes('✨') ? '#34d399'
                      : line.includes('❌') ? '#f87171'
                      : '#e2e8f0',
                    whiteSpace: 'pre',
                  }}>
                    {line || '\u00a0'}
                  </div>
                ))}
              </div>
            </div>

            {/* Floating badge */}
            <div style={{
              background: 'linear-gradient(135deg, rgba(16,185,129,0.15), rgba(16,185,129,0.05))',
              border: '1px solid rgba(16,185,129,0.25)',
              borderRadius: '14px', padding: '14px 20px',
              display: 'flex', alignItems: 'center', gap: '12px',
              animation: 'float 5s 2s ease-in-out infinite',
            }}>
              <span style={{ fontSize: '28px' }}>🏆</span>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#34d399' }}>Practical Submitted!</div>
                <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>Score: 10/10 · All test cases passed</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── STATS BAND ── */}
      <section style={{
        background: 'rgba(255,255,255,0.02)', borderTop: '1px solid rgba(255,255,255,0.06)',
        borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '48px 40px',
      }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
          <div className="stats-row" style={{ display: 'flex', gap: '20px', justifyContent: 'center', flexWrap: 'wrap' }}>
            {STATS.map((s, i) => (
              <div key={i} className="stat-pill" style={{ animationDelay: `${i * 0.1}s`, flex: '1', minWidth: '180px' }}>
                <div style={{ fontSize: '32px', marginBottom: '8px' }}>{s.icon}</div>
                <div style={{ fontSize: '28px', fontWeight: 900, color: '#fff', letterSpacing: '-0.03em' }}>{s.value}</div>
                <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.45)', marginTop: '4px' }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section id="features" style={{ padding: '100px 40px', maxWidth: '1280px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '64px' }}>
          <div style={{ display: 'inline-block', background: 'rgba(79,70,229,0.12)', border: '1px solid rgba(79,70,229,0.25)', borderRadius: '100px', padding: '4px 16px', fontSize: '12px', fontWeight: 600, color: '#a5b4fc', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '16px' }}>
            Platform Features
          </div>
          <h2 style={{ fontSize: 'clamp(32px, 4vw, 52px)', fontWeight: 800, color: '#fff', letterSpacing: '-0.03em', marginBottom: '16px' }}>
            Everything your lab needs,<br /><span className="gradient-text">nothing you don't</span>
          </h2>
          <p style={{ fontSize: '17px', color: 'rgba(255,255,255,0.45)', maxWidth: '500px', margin: '0 auto' }}>
            Built for real academic environments — not just demos.
          </p>
        </div>

        <div className="features-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
          {FEATURES.map((f, i) => (
            <div key={i} className="feature-card">
              <div style={{
                width: '52px', height: '52px', borderRadius: '14px',
                background: `${f.color}18`, border: `1px solid ${f.color}30`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '24px', marginBottom: '20px',
              }}>
                {f.icon}
              </div>
              <h3 style={{ fontSize: '17px', fontWeight: 700, color: '#fff', marginBottom: '10px' }}>{f.title}</h3>
              <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.45)', lineHeight: 1.7 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section id="how-it-works" style={{
        padding: '100px 40px',
        background: 'radial-gradient(ellipse at 50% 0%, rgba(79,70,229,0.08) 0%, transparent 70%)',
        borderTop: '1px solid rgba(255,255,255,0.05)',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
      }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '64px' }}>
            <h2 style={{ fontSize: 'clamp(32px, 4vw, 48px)', fontWeight: 800, color: '#fff', letterSpacing: '-0.03em' }}>
              How it <span className="gradient-text">works</span>
            </h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px', position: 'relative' }}>
            {[
              { step: '01', icon: '👩‍💼', title: 'Admin Setup', desc: 'Admin creates departments, uploads faculty & students via CSV, and maps courses.' },
              { step: '02', icon: '📝', title: 'Faculty Creates', desc: 'Faculty designs practicals with test cases, time limits, and difficulty levels.' },
              { step: '03', icon: '💻', title: 'Student Codes', desc: 'Students access their assigned practicals and write code in the Monaco editor.' },
              { step: '04', icon: '🏆', title: 'Auto Graded', desc: 'Submissions are evaluated against test cases. Scores normalized and saved instantly.' },
            ].map((step, i) => (
              <div key={i} style={{
                background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: '20px', padding: '32px 24px', position: 'relative', textAlign: 'center',
              }}>
                <div style={{
                  position: 'absolute', top: '-16px', left: '50%', transform: 'translateX(-50%)',
                  background: 'linear-gradient(135deg, #4F46E5, #7C3AED)',
                  borderRadius: '100px', padding: '4px 14px', fontSize: '11px', fontWeight: 700, color: '#fff',
                  letterSpacing: '0.05em',
                }}>
                  STEP {step.step}
                </div>
                <div style={{ fontSize: '40px', marginBottom: '16px', marginTop: '8px' }}>{step.icon}</div>
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#fff', marginBottom: '10px' }}>{step.title}</h3>
                <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.45)', lineHeight: 1.7 }}>{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── ROLES ── */}
      <section id="roles" style={{ padding: '100px 40px', maxWidth: '1280px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '64px' }}>
          <h2 style={{ fontSize: 'clamp(32px, 4vw, 48px)', fontWeight: 800, color: '#fff', letterSpacing: '-0.03em' }}>
            Built for <span className="gradient-text">every role</span>
          </h2>
          <p style={{ fontSize: '17px', color: 'rgba(255,255,255,0.45)', marginTop: '16px' }}>
            Each role gets a tailored, purpose-built experience.
          </p>
        </div>

        <div className="roles-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
          {[
            {
              icon: '👩‍💼', color: '#4F46E5', role: 'Administrator',
              perks: ['Department & course management', 'Bulk CSV student/faculty upload', 'Activity logs & audit trail', 'System statistics overview'],
            },
            {
              icon: '👨‍🏫', color: '#7C3AED', role: 'Faculty',
              perks: ['Create & manage practicals', 'Real-time submission viewer', 'Marks export (CSV/PDF)', 'Extra time for students'],
            },
            {
              icon: '👨‍🎓', color: '#06b6d4', role: 'Student',
              perks: ['Monaco-based code editor', 'Multi-language support', 'Live countdown timer', 'Submit & view scores instantly'],
            },
          ].map((r, i) => (
            <Link key={i} href="/login" className="role-card">
              <div style={{
                width: '56px', height: '56px', borderRadius: '16px',
                background: `${r.color}20`, border: `1px solid ${r.color}40`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '26px', marginBottom: '20px',
              }}>
                {r.icon}
              </div>
              <h3 style={{ fontSize: '20px', fontWeight: 700, color: '#fff', marginBottom: '16px' }}>{r.role}</h3>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {r.perks.map((p, j) => (
                  <li key={j} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '14px', color: 'rgba(255,255,255,0.55)' }}>
                    <span style={{ color: r.color, fontSize: '16px', flexShrink: 0, marginTop: '1px' }}>✓</span> {p}
                  </li>
                ))}
              </ul>
              <div style={{ marginTop: '24px', fontSize: '14px', fontWeight: 600, color: r.color }}>
                Login as {r.role} →
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ── CTA ── */}
      <section style={{
        padding: '100px 40px', textAlign: 'center',
        background: 'radial-gradient(ellipse at 50% 100%, rgba(79,70,229,0.12) 0%, transparent 70%)',
        borderTop: '1px solid rgba(255,255,255,0.05)',
      }}>
        <div style={{ maxWidth: '640px', margin: '0 auto' }}>
          <div style={{ fontSize: '48px', marginBottom: '24px' }}>⚡</div>
          <h2 style={{ fontSize: 'clamp(32px, 4vw, 52px)', fontWeight: 900, color: '#fff', letterSpacing: '-0.04em', marginBottom: '20px' }}>
            Ready to <span className="gradient-text">Rank Up?</span>
          </h2>
          <p style={{ fontSize: '17px', color: 'rgba(255,255,255,0.5)', lineHeight: 1.7, marginBottom: '40px' }}>
            Sign in with your institution credentials to access your dashboard.
          </p>
          <Link href="/login" className="btn-primary-hero" style={{ fontSize: '17px', padding: '18px 40px' }}>
            Sign In to CodeRank 🚀
          </Link>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{
        borderTop: '1px solid rgba(255,255,255,0.06)', padding: '32px 40px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        maxWidth: '1280px', margin: '0 auto', flexWrap: 'wrap', gap: '16px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '28px', height: '28px', background: 'linear-gradient(135deg, #4F46E5, #7C3AED)',
            borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px',
          }}>⚡</div>
          <span style={{ fontWeight: 700, color: '#fff', fontSize: '15px' }}>CodeRank</span>
        </div>
        <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.3)' }}>
          © {new Date().getFullYear()} CodeRank. Academic coding platform.
        </p>
        <Link href="/login" style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)', textDecoration: 'none', transition: 'color 0.2s' }}
          onMouseEnter={(e) => e.target.style.color = '#fff'}
          onMouseLeave={(e) => e.target.style.color = 'rgba(255,255,255,0.4)'}
        >
          Sign In →
        </Link>
      </footer>
    </>
  );
}
