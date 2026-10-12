'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import LoadingOverlay from '@/components/LoadingOverlay';
import LogoutConfirmModal from '@/components/LogoutConfirmModal';
import { useSocket } from '@/hooks/useSocket';
import { usePolling } from '@/hooks/usePolling';

export default function StudentDashboard() {
  const router = useRouter();
  const socket = useSocket();
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [courses, setCourses] = useState([]);
  const [practicals, setPracticals] = useState([]);

  const fetchStudentPracticals = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
      const res = await fetch('/api/student/practicals', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setPracticals(data);
        }
      }
    } catch (err) {
      console.error('Error fetching practicals for dashboard:', err);
    }
  }, []);

  useEffect(() => {
    const userData = localStorage.getItem('user');
    const token = localStorage.getItem('token');
    if (!userData || !token) {
      router.push('/');
      return;
    }
    
    try {
      setUser(JSON.parse(userData));
    } catch {
      router.push('/');
      return;
    }
    
    // Fetch user profile, courses, and practicals
    const fetchData = async () => {
      try {
        const res = await fetch('/api/auth/profile', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setProfile(data);
          
          const sem = data.user?.extra_info?.semester;
          if (sem) {
            const coursesRes = await fetch(`/api/courses?semester=${sem}`, {
              headers: { 'Authorization': `Bearer ${token}` }
            });
            if (coursesRes.ok) {
              const coursesData = await coursesRes.json();
              setCourses(coursesData);
            }
          }

          // Fetch student's assigned practicals
          await fetchStudentPracticals();
        } else if (res.status === 401) {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          router.push('/');
        }
      } catch (err) {
        console.error('Error fetching profile or courses:', err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [router, fetchStudentPracticals]);

  // Real-time socket updates for new, updated, or deleted practicals
  useEffect(() => {
    if (!socket) return;

    const handleSocketUpdate = () => {
      fetchStudentPracticals();
    };

    socket.on('practical_added', handleSocketUpdate);
    socket.on('practical_updated', handleSocketUpdate);
    socket.on('practical_deleted', handleSocketUpdate);

    return () => {
      socket.off('practical_added', handleSocketUpdate);
      socket.off('practical_updated', handleSocketUpdate);
      socket.off('practical_deleted', handleSocketUpdate);
    };
  }, [socket, fetchStudentPracticals]);

  // Join course rooms for student courses to receive course-specific socket events
  useEffect(() => {
    if (!socket || !courses || courses.length === 0) return;
    courses.forEach(c => socket.emit('join_course_room', c.id));
    return () => {
      courses.forEach(c => socket.emit('leave_course_room', c.id));
    };
  }, [socket, courses]);

  // Polling fallback – refresh practicals every 60s (only when socket unavailable, supplements socket events)
  // Only enable polling when socket is not connected or user is active
  const isSocketConnected = socket?.connected;
  usePolling(fetchStudentPracticals, 60_000, !!user && !isSocketConnected);

  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const handleLogout = () => setShowLogoutModal(true);

  const confirmLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    router.push('/');
  };

  if (!user) return null;

  const semester = profile?.user?.extra_info?.semester || '';
  const batch = profile?.user?.extra_info?.batch || '';

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', fontFamily: 'Inter, sans-serif' }}>
      {loading && <LoadingOverlay />}
      
      {/* Top Navbar */}
      <div style={{
        height: '70px', backgroundColor: 'white', borderBottom: '1px solid var(--border-color)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 40px',
        position: 'sticky', top: 0, zIndex: 100
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <div style={{ 
            width: '40px', height: '40px', 
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: '50%', background: '#ffffff', overflow: 'hidden',
            boxShadow: '0 2px 8px rgba(79, 70, 229, 0.15)'
          }}>
            <img 
              src="/coderank-logo.jpg" 
              alt="Logo" 
              style={{ height: '40px', width: '40px', objectFit: 'cover', borderRadius: '50%' }}
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                if (e.currentTarget.nextSibling) e.currentTarget.nextSibling.style.display = 'flex';
              }}
            />
            <div 
              style={{
                display: 'none', width: '40px', height: '40px',
                background: 'linear-gradient(135deg, #4F46E5, #7C3AED)',
                borderRadius: '50%',
                alignItems: 'center', justifyContent: 'center',
                fontSize: '16px', color: 'white', fontWeight: 700
              }}
            >
              CR
            </div>
          </div>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: '#1e293b' }}>CodeRank</h2>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '14px', fontWeight: 600, color: '#1e293b' }}>{user.name}</div>
            <div style={{ fontSize: '12px', color: '#64748b' }}>Semester {semester} &bull; Batch {batch}</div>
          </div>
          <button
            onClick={() => {
              const handle = user?.email ? user.email.split('@')[0] : '';
              router.push(`/profile/${handle}`);
            }}
            style={{ padding: '8px 16px', background: '#4f46e5', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, color: 'white', transition: 'all 0.2s', boxShadow: '0 2px 4px rgba(79, 70, 229, 0.2)' }}
            onMouseEnter={e => e.currentTarget.style.background = '#4338ca'}
            onMouseLeave={e => e.currentTarget.style.background = '#4f46e5'}
          >
            👤 Profile
          </button>
          <button 
            onClick={handleLogout}
            style={{ padding: '8px 16px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, color: '#475569', transition: 'all 0.2s' }}
            onMouseEnter={e => e.currentTarget.style.background = '#e2e8f0'}
            onMouseLeave={e => e.currentTarget.style.background = '#f1f5f9'}
          >
            Logout
          </button>
        </div>
      </div>

      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '40px 20px' }}>
        <div style={{ marginBottom: '35px' }}>
          <h1 style={{ fontSize: '28px', fontWeight: 700, color: '#1e293b', marginBottom: '8px' }}>My Assigned Subjects & Practicals</h1>
          <p style={{ color: '#64748b', fontSize: '15px' }}>
            View questions assigned by your faculty for Semester {semester}. Click any practical question to open your coding workspace.
          </p>
        </div>

        {courses.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
            {courses.map(course => {
              const coursePracticals = practicals.filter(p => 
                p.course_id === course.id || 
                p.course_code === course.course_code ||
                p.course_name === course.name
              );
              const firstPracticalId = coursePracticals.length > 0 ? coursePracticals[0].id : null;
              const openWorkspaceUrl = firstPracticalId 
                ? `/student/code/practical_${firstPracticalId}?subject=${encodeURIComponent(course.course_code)}`
                : `/student/code/1?subject=${encodeURIComponent(course.course_code)}`;

              return (
                <div 
                  key={course.id}
                  style={{
                    background: 'white', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '24px',
                    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.04)', display: 'flex', flexDirection: 'column', gap: '20px'
                  }}
                >
                  {/* Subject Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #f1f5f9', paddingBottom: '16px' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '12px', fontWeight: 700, color: '#0066b1', backgroundColor: '#e0f2fe', padding: '3px 8px', borderRadius: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          {course.course_code}
                        </span>
                        <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 500 }}>
                          Semester {course.semester}
                        </span>
                      </div>
                      <h3 style={{ fontSize: '20px', fontWeight: 700, marginTop: '8px', marginBottom: '4px', color: '#1e293b' }}>
                        {course.name}
                      </h3>
                      <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
                        {coursePracticals.length} {coursePracticals.length === 1 ? 'practical question' : 'practical questions'} assigned
                      </p>
                    </div>

                    <button
                      onClick={() => router.push(openWorkspaceUrl)}
                      style={{
                        padding: '10px 20px',
                        background: '#0066b1',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        fontWeight: 600,
                        fontSize: '13px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        boxShadow: '0 2px 4px rgba(0,102,177,0.2)',
                        transition: 'background 0.2s'
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = '#004c85'}
                      onMouseLeave={e => e.currentTarget.style.background = '#0066b1'}
                    >
                      Open Workspace &rarr;
                    </button>
                  </div>

                  {/* Practicals List */}
                  <div>
                    {coursePracticals.length > 0 ? (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
                        {coursePracticals.map((p, idx) => {
                          const diffColor = p.difficulty === 'Easy' ? '#10b981' : p.difficulty === 'Medium' ? '#f59e0b' : '#ef4444';
                          const isSolved = p.my_status === 'Accepted';
                          const isAttempted = p.my_status && p.my_status !== 'Accepted';

                          const now = new Date();
                          const startTime = p.start_time ? new Date(p.start_time) : null;
                          const endTime = p.end_time ? new Date(p.end_time) : null;
                          const isUpcoming = startTime && now < startTime;
                          const isExpired = endTime && now > endTime;
                          const hasTimeLimit = !!endTime;

                          let timeBadge = null;
                          if (isUpcoming) {
                            timeBadge = (
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#2563eb', backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', padding: '3px 8px', borderRadius: '6px', fontWeight: 600, marginTop: '6px' }}>
                                 Starts: {startTime.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                              </div>
                            );
                          } else if (isExpired) {
                            timeBadge = (
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#ef4444', backgroundColor: '#fef2f2', border: '1px solid #fecaca', padding: '3px 8px', borderRadius: '6px', fontWeight: 600, marginTop: '6px' }}>
                                ⛔ Deadline Passed: {endTime.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                              </div>
                            );
                          } else if (hasTimeLimit) {
                            const diffMinutes = Math.max(0, Math.round((endTime - now) / 60000));
                            const hours = Math.floor(diffMinutes / 60);
                            const mins = diffMinutes % 60;
                            const timeStr = hours > 0 ? `${hours}h ${mins}m left` : `${mins}m left`;
                            timeBadge = (
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#059669', backgroundColor: '#ecfdf5', border: '1px solid #a7f3d0', padding: '3px 8px', borderRadius: '6px', fontWeight: 600, marginTop: '6px' }}>
                                 Time Limit: {timeStr} (Deadline: {endTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})
                              </div>
                            );
                          }

                          return (
                            <div
                              key={p.id}
                              onClick={() => {
                                if (isUpcoming) {
                                  alert(`This practical has not started yet. It is scheduled to start at ${startTime.toLocaleString()}`);
                                  return;
                                }
                                router.push(`/student/code/practical_${p.id}?subject=${encodeURIComponent(course.course_code)}`);
                              }}
                              style={{
                                border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px', background: isUpcoming ? '#f1f5f9' : '#f8fafc',
                                cursor: isUpcoming ? 'not-allowed' : 'pointer', transition: 'transform 0.15s, box-shadow 0.15s, border-color 0.15s',
                                display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '135px',
                                opacity: isUpcoming ? 0.8 : 1
                              }}
                              onMouseEnter={(e) => {
                                if (isUpcoming) return;
                                e.currentTarget.style.transform = 'translateY(-2px)';
                                e.currentTarget.style.boxShadow = '0 6px 12px -2px rgba(0, 0, 0, 0.08)';
                                e.currentTarget.style.borderColor = '#0066b1';
                                e.currentTarget.style.background = '#ffffff';
                              }}
                              onMouseLeave={(e) => {
                                if (isUpcoming) return;
                                e.currentTarget.style.transform = 'translateY(0)';
                                e.currentTarget.style.boxShadow = 'none';
                                e.currentTarget.style.borderColor = '#e2e8f0';
                                e.currentTarget.style.background = '#f8fafc';
                              }}
                            >
                              <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                  <span style={{ fontSize: '11px', fontWeight: 600, color: '#64748b' }}>
                                    Practical #{idx + 1}
                                  </span>
                                  <span style={{
                                    fontSize: '10px', fontWeight: 700, color: diffColor, background: `${diffColor}18`,
                                    border: `1px solid ${diffColor}40`, padding: '2px 8px', borderRadius: '12px', textTransform: 'uppercase'
                                  }}>
                                    {p.difficulty || 'Easy'}
                                  </span>
                                </div>
                                <h4 style={{ fontSize: '15px', fontWeight: 600, margin: '0 0 4px 0', color: '#1e293b', lineHeight: 1.3 }}>
                                  {p.title}
                                </h4>

                                {timeBadge}
                              </div>

                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', paddingTop: '10px', borderTop: '1px dashed #e2e8f0' }}>
                                <span style={{
                                  fontSize: '11.5px', fontWeight: 600,
                                  color: isSolved ? '#10b981' : isAttempted ? '#f59e0b' : '#64748b'
                                }}>
                                  {isSolved ? `✓ Solved (Highest: ${p.my_marks || 0}/10)` : isAttempted ? `● Attempted (Highest: ${p.my_marks || 0}/10)` : '○ Unsolved'}
                                </span>
                                <span style={{ fontSize: '12px', fontWeight: 600, color: isUpcoming ? '#94a3b8' : '#0066b1' }}>
                                  {isUpcoming ? 'Not Started' : 'Solve \u2192'}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div style={{ textAlign: 'center', padding: '30px 20px', background: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1' }}>
                        <p style={{ color: '#64748b', fontSize: '13px', margin: 0 }}>
                          No practical questions have been added for this subject yet.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : !loading && (
          <div style={{ textAlign: 'center', padding: '60px 20px', background: 'white', borderRadius: '16px', border: '1px dashed #cbd5e1' }}>
            <div style={{ fontSize: '40px', marginBottom: '15px' }}>📭</div>
            <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#1e293b', marginBottom: '8px' }}>No Subjects Found</h3>
            <p style={{ color: '#64748b', fontSize: '14px', maxWidth: '400px', margin: '0 auto' }}>
              We couldn't find any subjects assigned to your current semester ({semester || 'Unknown'}). 
              Please contact your administrator if this is a mistake.
            </p>
          </div>
        )}
      </div>
      <LogoutConfirmModal
        isOpen={showLogoutModal}
        onConfirm={confirmLogout}
        onCancel={() => setShowLogoutModal(false)}
      />
    </div>
  );
}
