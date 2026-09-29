'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function HomePage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('student');
  const [loggedInUser, setLoggedInUser] = useState(null);

  useEffect(() => {
    try {
      const userData = localStorage.getItem('user');
      const token = localStorage.getItem('token');
      if (userData && token) {
        setLoggedInUser(JSON.parse(userData));
      }
    } catch {
      // Ignore parse error
    }
  }, []);

  const getDashboardUrl = () => {
    if (!loggedInUser) return '/login';
    if (loggedInUser.role === 'admin') return '/admin';
    if (loggedInUser.role === 'faculty') return '/faculty';
    return '/student';
  };

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#f8fafc',
      color: '#1e293b',
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* ─── Top Navigation Header ─── */}
      <header style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        backgroundColor: 'rgba(255, 255, 255, 0.92)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid #e2e8f0',
        padding: '0 24px',
        height: '68px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '32px' }}>
          <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              fontWeight: 800,
              fontSize: '18px',
              boxShadow: '0 4px 10px rgba(79, 70, 229, 0.3)'
            }}>
              CR
            </div>
            <div>
              <span style={{ fontSize: '19px', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.5px' }}>Code</span>
              <span style={{ fontSize: '19px', fontWeight: 800, color: '#4F46E5', letterSpacing: '-0.5px' }}>Rank</span>
            </div>
          </Link>

          <nav style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <a href="#features" style={{ textDecoration: 'none', color: '#475569', fontSize: '14px', fontWeight: 500, transition: 'color 0.2s' }}>Features</a>
            <a href="#roles" style={{ textDecoration: 'none', color: '#475569', fontSize: '14px', fontWeight: 500, transition: 'color 0.2s' }}>Portals</a>
            <a href="#sandbox" style={{ textDecoration: 'none', color: '#475569', fontSize: '14px', fontWeight: 500, transition: 'color 0.2s' }}>Execution Engine</a>
          </nav>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {loggedInUser ? (
            <Link
              href={getDashboardUrl()}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '9px 18px',
                backgroundColor: '#4F46E5',
                color: '#ffffff',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 600,
                textDecoration: 'none',
                boxShadow: '0 2px 6px rgba(79, 70, 229, 0.25)',
                transition: 'background 0.2s'
              }}
            >
              Dashboard ({loggedInUser.role}) &rarr;
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                style={{
                  padding: '8px 16px',
                  color: '#334155',
                  backgroundColor: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: 600,
                  textDecoration: 'none',
                  transition: 'all 0.2s'
                }}
              >
                Sign In
              </Link>
              <Link
                href="/login"
                style={{
                  padding: '9px 18px',
                  backgroundColor: '#4F46E5',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: 600,
                  textDecoration: 'none',
                  boxShadow: '0 2px 6px rgba(79, 70, 229, 0.25)',
                  transition: 'background 0.2s'
                }}
              >
                Launch Workspace
              </Link>
            </>
          )}
        </div>
      </header>

      {/* ─── Hero Section ─── */}
      <section style={{
        padding: '72px 24px 56px',
        maxWidth: '1240px',
        margin: '0 auto',
        width: '100%',
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1.15fr) minmax(0, 0.85fr)',
        gap: '48px',
        alignItems: 'center'
      }}>
        <div>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: '#eff6ff',
            border: '1px solid #bfdbfe',
            padding: '5px 14px',
            borderRadius: '20px',
            fontSize: '13px',
            fontWeight: 600,
            color: '#1d4ed8',
            marginBottom: '20px'
          }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#2563eb', display: 'inline-block' }}></span>
            Real-Time Automated Practical Assessment Platform
          </div>

          <h1 style={{
            fontSize: '44px',
            fontWeight: 800,
            lineHeight: 1.15,
            color: '#0f172a',
            letterSpacing: '-1px',
            marginBottom: '18px'
          }}>
            Institutional Coding Lab & <span style={{ color: '#4F46E5' }}>Practical Evaluation</span> System
          </h1>

          <p style={{
            fontSize: '17px',
            lineHeight: 1.6,
            color: '#475569',
            marginBottom: '32px',
            maxWidth: '560px'
          }}>
            Streamlined for university computer science departments. Conduct automated practicals in C, C++, Java, and Python with live socket streaming, instant batch grading, anti-plagiarism guards, and faculty controls.
          </p>

          <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
            <Link
              href="/login"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '13px 26px',
                backgroundColor: '#4F46E5',
                color: '#ffffff',
                borderRadius: '10px',
                fontSize: '15px',
                fontWeight: 600,
                textDecoration: 'none',
                boxShadow: '0 4px 12px rgba(79, 70, 229, 0.3)',
                transition: 'transform 0.15s, background 0.2s'
              }}
            >
              Get Started with CodeRank &rarr;
            </Link>

            <Link
              href="/login"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '13px 22px',
                backgroundColor: '#ffffff',
                color: '#334155',
                border: '1px solid #cbd5e1',
                borderRadius: '10px',
                fontSize: '15px',
                fontWeight: 600,
                textDecoration: 'none',
                boxShadow: '0 2px 4px rgba(0,0,0,0.03)'
              }}
            >
              Sign In to Account
            </Link>
          </div>

          {/* Quick Metrics */}
          <div style={{ display: 'flex', gap: '28px', marginTop: '40px', paddingTop: '28px', borderTop: '1px solid #e2e8f0' }}>
            <div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a' }}>4+</div>
              <div style={{ fontSize: '13px', color: '#64748b', fontWeight: 500 }}>Languages Supported</div>
            </div>
            <div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a' }}>&lt; 35ms</div>
              <div style={{ fontSize: '13px', color: '#64748b', fontWeight: 500 }}>Execution Latency</div>
            </div>
            <div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a' }}>100%</div>
              <div style={{ fontSize: '13px', color: '#64748b', fontWeight: 500 }}>Automated Verification</div>
            </div>
          </div>
        </div>

        {/* Hero Preview Card */}
        <div id="sandbox" style={{
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 20px 30px -10px rgba(0,0,0,0.07)',
          overflow: 'hidden'
        }}>
          {/* Card Window Header */}
          <div style={{
            backgroundColor: '#f1f5f9',
            padding: '12px 18px',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: '11px', height: '11px', borderRadius: '50%', backgroundColor: '#ef4444' }}></span>
              <span style={{ width: '11px', height: '11px', borderRadius: '50%', backgroundColor: '#f59e0b' }}></span>
              <span style={{ width: '11px', height: '11px', borderRadius: '50%', backgroundColor: '#10b981' }}></span>
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#475569', marginLeft: '8px' }}>
                BinarySearch.cpp — Practical #4
              </span>
            </div>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#16a34a', backgroundColor: '#dcfce7', padding: '2px 8px', borderRadius: '4px' }}>
              ONLINE DAEMON
            </span>
          </div>

          {/* Code Snippet Box */}
          <div style={{
            backgroundColor: '#0f172a',
            padding: '20px',
            fontFamily: "'Fira Code', Consolas, Monaco, monospace",
            fontSize: '13px',
            lineHeight: 1.6,
            color: '#cbd5e1'
          }}>
            <div><span style={{ color: '#93c5fd' }}>#include</span> <span style={{ color: '#fca5a5' }}>&lt;iostream&gt;</span></div>
            <div><span style={{ color: '#93c5fd' }}>#include</span> <span style={{ color: '#fca5a5' }}>&lt;vector&gt;</span></div>
            <div style={{ marginTop: '8px' }}><span style={{ color: '#c084fc' }}>int</span> <span style={{ color: '#67e8f9' }}>binarySearch</span>(<span style={{ color: '#c084fc' }}>const</span> std::vector&lt;<span style={{ color: '#c084fc' }}>int</span>&gt;&amp; arr, <span style={{ color: '#c084fc' }}>int</span> target) &#123;</div>
            <div style={{ paddingLeft: '16px' }}><span style={{ color: '#c084fc' }}>int</span> low = 0, high = arr.size() - 1;</div>
            <div style={{ paddingLeft: '16px' }}><span style={{ color: '#c084fc' }}>while</span> (low &lt;= high) &#123;</div>
            <div style={{ paddingLeft: '32px' }}><span style={{ color: '#c084fc' }}>int</span> mid = low + (high - low) / 2;</div>
            <div style={{ paddingLeft: '32px' }}><span style={{ color: '#c084fc' }}>if</span> (arr[mid] == target) <span style={{ color: '#c084fc' }}>return</span> mid;</div>
            <div style={{ paddingLeft: '32px' }}><span style={{ color: '#c084fc' }}>if</span> (arr[mid] &lt; target) low = mid + 1;</div>
            <div style={{ paddingLeft: '32px' }}><span style={{ color: '#c084fc' }}>else</span> high = mid - 1;</div>
            <div style={{ paddingLeft: '16px' }}>&#125;</div>
            <div style={{ paddingLeft: '16px' }}><span style={{ color: '#c084fc' }}>return</span> -1;</div>
            <div>&#125;</div>
          </div>

          {/* Execution Result Bar */}
          <div style={{ padding: '16px 20px', backgroundColor: '#ffffff', borderTop: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#16a34a' }}>✓ Accepted (All 5 Test Cases Passed)</span>
              </div>
              <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>Score: 10 / 10</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
              <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '8px 12px', textAlign: 'center' }}>
                <div style={{ fontSize: '11px', color: '#64748b' }}>Execution Time</div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>18 ms</div>
              </div>
              <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '8px 12px', textAlign: 'center' }}>
                <div style={{ fontSize: '11px', color: '#64748b' }}>Memory Peak</div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>2.1 MB</div>
              </div>
              <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '8px 12px', textAlign: 'center' }}>
                <div style={{ fontSize: '11px', color: '#64748b' }}>Integrity</div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#16a34a' }}>Clean (0 Flags)</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Platform Features Grid ─── */}
      <section id="features" style={{
        backgroundColor: '#ffffff',
        borderTop: '1px solid #e2e8f0',
        borderBottom: '1px solid #e2e8f0',
        padding: '72px 24px'
      }}>
        <div style={{ maxWidth: '1240px', margin: '0 auto', width: '100%' }}>
          <div style={{ textAlign: 'center', marginBottom: '48px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', color: '#4F46E5', letterSpacing: '1px' }}>
              Engineered For Academic Excellence
            </span>
            <h2 style={{ fontSize: '32px', fontWeight: 800, color: '#0f172a', marginTop: '8px' }}>
              Everything Required for University Code Labs
            </h2>
            <p style={{ color: '#64748b', fontSize: '16px', maxWidth: '640px', margin: '12px auto 0' }}>
              Built specifically to handle high-concurrency university laboratory practical examinations with guaranteed fairness and reliability.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '24px' }}>
            {/* Feature 1 */}
            <div style={{
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '14px',
              padding: '24px',
              transition: 'transform 0.2s, box-shadow 0.2s'
            }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                backgroundColor: '#eff6ff',
                color: '#2563eb',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                fontSize: '18px',
                marginBottom: '16px'
              }}>⚡</div>
              <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a', marginBottom: '8px' }}>Sub-Second Multi-Language Sandbox</h3>
              <p style={{ fontSize: '14px', lineHeight: 1.6, color: '#64748b' }}>
                High-performance runner for C, C++, Java, and Python with strict memory limits, CPU quotas, and timeout containment.
              </p>
            </div>

            {/* Feature 2 */}
            <div style={{
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '14px',
              padding: '24px'
            }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                backgroundColor: '#f0fdf4',
                color: '#16a34a',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                fontSize: '18px',
                marginBottom: '16px'
              }}>✓</div>
              <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a', marginBottom: '8px' }}>Automated Test Case Grading</h3>
              <p style={{ fontSize: '14px', lineHeight: 1.6, color: '#64748b' }}>
                Batch validation across public and hidden test cases with immediate score normalization and execution profiling.
              </p>
            </div>

            {/* Feature 3 */}
            <div style={{
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '14px',
              padding: '24px'
            }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                backgroundColor: '#faf5ff',
                color: '#7c3aed',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                fontSize: '18px',
                marginBottom: '16px'
              }}>📡</div>
              <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a', marginBottom: '8px' }}>Live Socket & 15s Fallback Polling</h3>
              <p style={{ fontSize: '14px', lineHeight: 1.6, color: '#64748b' }}>
                Instant real-time submission telemetry to faculty scorebooks with zero manual refreshes required.
              </p>
            </div>

            {/* Feature 4 */}
            <div style={{
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '14px',
              padding: '24px'
            }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                backgroundColor: '#fffbeb',
                color: '#d97706',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                fontSize: '18px',
                marginBottom: '16px'
              }}>🛡️</div>
              <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a', marginBottom: '8px' }}>Academic Integrity Controls</h3>
              <p style={{ fontSize: '14px', lineHeight: 1.6, color: '#64748b' }}>
                Monitors focus loss, tab switching, copy-paste violations, and unusual submission timestamps during active exams.
              </p>
            </div>

            {/* Feature 5 */}
            <div style={{
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '14px',
              padding: '24px'
            }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                backgroundColor: '#eff6ff',
                color: '#0284c7',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                fontSize: '18px',
                marginBottom: '16px'
              }}>⏱️</div>
              <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a', marginBottom: '8px' }}>Dynamic Extra-Time Extensions</h3>
              <p style={{ fontSize: '14px', lineHeight: 1.6, color: '#64748b' }}>
                Faculty can grant immediate time extensions to entire batches or individual students during ongoing lab sessions.
              </p>
            </div>

            {/* Feature 6 */}
            <div style={{
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '14px',
              padding: '24px'
            }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                backgroundColor: '#fef2f2',
                color: '#dc2626',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                fontSize: '18px',
                marginBottom: '16px'
              }}>📊</div>
              <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a', marginBottom: '8px' }}>Automated PDF & Marks Export</h3>
              <p style={{ fontSize: '14px', lineHeight: 1.6, color: '#64748b' }}>
                Generate official university grade sheets and formatted PDF scorecards sorted by division and roll number in one click.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Role Portals Section ─── */}
      <section id="roles" style={{ padding: '72px 24px', maxWidth: '1240px', margin: '0 auto', width: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: '36px' }}>
          <span style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', color: '#4F46E5', letterSpacing: '1px' }}>
            Role-Based Workflows
          </span>
          <h2 style={{ fontSize: '32px', fontWeight: 800, color: '#0f172a', marginTop: '8px' }}>
            Designed For Every User in the Department
          </h2>
        </div>

        {/* Tab Controls */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginBottom: '32px' }}>
          {[
            { id: 'student', label: 'Student Workspace' },
            { id: 'faculty', label: 'Faculty Portal' },
            { id: 'admin', label: 'Admin Management' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '10px 22px',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 600,
                border: activeTab === tab.id ? '1px solid #4F46E5' : '1px solid #cbd5e1',
                backgroundColor: activeTab === tab.id ? '#4F46E5' : '#ffffff',
                color: activeTab === tab.id ? '#ffffff' : '#475569',
                cursor: 'pointer',
                transition: 'all 0.2s',
                boxShadow: activeTab === tab.id ? '0 2px 6px rgba(79, 70, 229, 0.25)' : 'none'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content Display */}
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          border: '1px solid #e2e8f0',
          padding: '36px',
          boxShadow: '0 4px 10px rgba(0,0,0,0.03)'
        }}>
          {activeTab === 'student' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '36px', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#0066b1', textTransform: 'uppercase' }}>Student Experience</div>
                <h3 style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a', marginTop: '6px', marginBottom: '16px' }}>
                  Distraction-Free Monaco Code Editor & Live Feedback
                </h3>
                <p style={{ color: '#64748b', fontSize: '15px', lineHeight: 1.6, marginBottom: '20px' }}>
                  Students access assigned practicals with problem statements, constraints, sample I/O, custom test case runners, and real-time submission verdicts.
                </p>
                <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: '#334155' }}>
                    <span style={{ color: '#16a34a', fontWeight: 700 }}>✓</span> Auto-saved code workspaces per practical question
                  </li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: '#334155' }}>
                    <span style={{ color: '#16a34a', fontWeight: 700 }}>✓</span> Instant custom test case execution & diff visualizer
                  </li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: '#334155' }}>
                    <span style={{ color: '#16a34a', fontWeight: 700 }}>✓</span> Dynamic countdown timer with exam extra-time support
                  </li>
                </ul>
              </div>
              <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '24px' }}>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#475569', marginBottom: '12px' }}>Student Dashboard Preview</div>
                <div style={{ backgroundColor: 'white', borderRadius: '8px', border: '1px solid #e2e8f0', padding: '16px', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#2563eb', backgroundColor: '#eff6ff', padding: '2px 8px', borderRadius: '4px' }}>CS301</span>
                    <span style={{ fontSize: '12px', color: '#16a34a', fontWeight: 600 }}>Active Practical</span>
                  </div>
                  <div style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a', marginTop: '6px' }}>Data Structures & Algorithms Lab</div>
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>Practical #3: AVL Tree Height Balancing</div>
                </div>
                <Link
                  href="/login"
                  style={{
                    display: 'block',
                    textAlign: 'center',
                    padding: '10px',
                    backgroundColor: '#4F46E5',
                    color: 'white',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: 600,
                    textDecoration: 'none'
                  }}
                >
                  Enter Student Portal &rarr;
                </Link>
              </div>
            </div>
          )}

          {activeTab === 'faculty' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '36px', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#7c3aed', textTransform: 'uppercase' }}>Faculty Command Center</div>
                <h3 style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a', marginTop: '6px', marginBottom: '16px' }}>
                  Course Practical Creation & Live Submission Telemetry
                </h3>
                <p style={{ color: '#64748b', fontSize: '15px', lineHeight: 1.6, marginBottom: '20px' }}>
                  Faculty members easily configure practical schedules, define visible and hidden test cases with input/output payloads, and observe live student scores as they solve.
                </p>
                <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: '#334155' }}>
                    <span style={{ color: '#16a34a', fontWeight: 700 }}>✓</span> Real-time live scoreboard with automated marks computation
                  </li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: '#334155' }}>
                    <span style={{ color: '#16a34a', fontWeight: 700 }}>✓</span> One-click extra time grants (+5, +10, +15 mins) for exam batches
                  </li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: '#334155' }}>
                    <span style={{ color: '#16a34a', fontWeight: 700 }}>✓</span> Instant PDF grade reports & manual marks override capabilities
                  </li>
                </ul>
              </div>
              <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '24px' }}>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#475569', marginBottom: '12px' }}>Live Class Telemetry</div>
                <div style={{ backgroundColor: 'white', borderRadius: '8px', border: '1px solid #e2e8f0', padding: '16px', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>Batch A — 42 Students</span>
                    <span style={{ fontSize: '12px', color: '#2563eb', fontWeight: 600 }}>38 Submitted</span>
                  </div>
                  <div style={{ width: '100%', height: '8px', backgroundColor: '#e2e8f0', borderRadius: '4px', margin: '10px 0', overflow: 'hidden' }}>
                    <div style={{ width: '90%', height: '100%', backgroundColor: '#10b981' }}></div>
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>Average Score: 8.8 / 10 | 0 Plagiarism Flags</div>
                </div>
                <Link
                  href="/login"
                  style={{
                    display: 'block',
                    textAlign: 'center',
                    padding: '10px',
                    backgroundColor: '#7C3AED',
                    color: 'white',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: 600,
                    textDecoration: 'none'
                  }}
                >
                  Enter Faculty Portal &rarr;
                </Link>
              </div>
            </div>
          )}

          {activeTab === 'admin' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '36px', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#0f766e', textTransform: 'uppercase' }}>Administrator Management</div>
                <h3 style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a', marginTop: '6px', marginBottom: '16px' }}>
                  Institutional Provisioning, CSV Ingestion & Audit Logs
                </h3>
                <p style={{ color: '#64748b', fontSize: '15px', lineHeight: 1.6, marginBottom: '20px' }}>
                  Centralized control for department chairs and lab administrators. Bulk enroll students and faculty via Excel/CSV, map courses to departments, and review full system security logs.
                </p>
                <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: '#334155' }}>
                    <span style={{ color: '#16a34a', fontWeight: 700 }}>✓</span> Bulk student & faculty CSV/Excel roster import
                  </li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: '#334155' }}>
                    <span style={{ color: '#16a34a', fontWeight: 700 }}>✓</span> Academic department & semester course allocations
                  </li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: '#334155' }}>
                    <span style={{ color: '#16a34a', fontWeight: 700 }}>✓</span> Real-time audit trails for logins, practical edits, and submissions
                  </li>
                </ul>
              </div>
              <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '24px' }}>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#475569', marginBottom: '12px' }}>Admin Overview</div>
                <div style={{ backgroundColor: 'white', borderRadius: '8px', border: '1px solid #e2e8f0', padding: '16px', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>System Audit Logs</span>
                    <span style={{ fontSize: '11px', color: '#16a34a', fontWeight: 700, backgroundColor: '#dcfce7', padding: '2px 6px', borderRadius: '4px' }}>SECURE</span>
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '8px' }}>Active Users: 1,240 | Total Practicals: 86</div>
                </div>
                <Link
                  href="/login"
                  style={{
                    display: 'block',
                    textAlign: 'center',
                    padding: '10px',
                    backgroundColor: '#0f766e',
                    color: 'white',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: 600,
                    textDecoration: 'none'
                  }}
                >
                  Enter Admin Portal &rarr;
                </Link>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ─── Ready to Deploy CTA Banner ─── */}
      <section style={{
        padding: '56px 24px',
        backgroundColor: '#ffffff',
        borderTop: '1px solid #e2e8f0',
        marginTop: 'auto'
      }}>
        <div style={{
          maxWidth: '1000px',
          margin: '0 auto',
          backgroundColor: '#4F46E5',
          borderRadius: '20px',
          padding: '48px 36px',
          color: '#ffffff',
          textAlign: 'center',
          boxShadow: '0 20px 25px -5px rgba(79, 70, 229, 0.25)',
          background: 'linear-gradient(135deg, #4F46E5 0%, #4338CA 100%)'
        }}>
          <h2 style={{ fontSize: '32px', fontWeight: 800, marginBottom: '14px' }}>
            Ready to Streamline Your Code Laboratory?
          </h2>
          <p style={{ fontSize: '16px', opacity: 0.9, maxWidth: '580px', margin: '0 auto 28px', lineHeight: 1.6 }}>
            Launch your student sessions with sub-second execution, automated grading, and comprehensive departmental dashboards.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '14px', flexWrap: 'wrap' }}>
            <Link
              href="/login"
              style={{
                padding: '12px 28px',
                backgroundColor: '#ffffff',
                color: '#4338CA',
                borderRadius: '10px',
                fontSize: '15px',
                fontWeight: 700,
                textDecoration: 'none',
                boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
              }}
            >
              Sign In to Your Account
            </Link>
          </div>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer style={{
        backgroundColor: '#f8fafc',
        borderTop: '1px solid #e2e8f0',
        padding: '32px 24px',
        textAlign: 'center',
        fontSize: '13px',
        color: '#64748b'
      }}>
        <div style={{ maxWidth: '1240px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontWeight: 800, color: '#0f172a' }}>CodeRank</span>
            <span>— Institutional Code Assessment Engine</span>
          </div>
          <div>
            &copy; {new Date().getFullYear()} CodeRank. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
