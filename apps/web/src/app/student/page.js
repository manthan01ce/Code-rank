'use client';
import styles from './overview.module.css';
import { useAccountIdentity } from '@/hooks/useAccountIdentity';
import { StudentThemeToggle } from '@/components/student/StudentTheme';
import Link from 'next/link';
import QuestionList from '@/components/student/QuestionList';
import { practicalDestination, practicalHasStarted, practicalBelongsToCourse } from '@/lib/practical-navigation';
import { usePracticalPage } from '@/hooks/usePracticalPage';
import { fetchCollection } from '@/lib/fetch-collection';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import LoadingOverlay from '@/components/LoadingOverlay';
import LogoutConfirmModal from '@/components/LogoutConfirmModal';
import { useSocket } from '@/hooks/useSocket';
import { usePolling } from '@/hooks/usePolling';

export default function StudentDashboard() {
  const router = useRouter();
  const currentIdentity = useAccountIdentity();
  const socket = useSocket();
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [isHydrated, setIsHydrated] = useState(false);
  const [courses, setCourses] = useState([]);
  const practicalPage = usePracticalPage(null, Boolean(user));
  const { rows: practicals, refresh: fetchStudentPracticals } = practicalPage;

  useEffect(() => {
    // Wait for client-side hydration before accessing localStorage
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (!isHydrated) return; // Don't check auth until hydrated
    
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
    
    // Profile determines the course filter; practicals can load independently.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    let active = true;
    const options = {headers: {'Authorization': `Bearer ${token}`}, signal: controller.signal};
    setLoading(true);
    setLoadError('');
    const read = async (url) => {
      const res = await fetch(url, options);
      if (res.status === 401 || res.status === 403) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        router.replace('/login');
        throw Error('Please sign in again.');
      }
      if (!res.ok) throw Error(`Request failed (${res.status})`);
      return res.json();
    };
    const fetchData = async () => {
      try {
        const results = await Promise.allSettled([
          (async () => {
            const data = await read('/api/auth/profile');
            if (!active) return;
            setProfile(data);
            const sem = data.user?.extra_info?.semester;
            if (sem) {
              const rows = await fetchCollection(`/api/courses?semester=${encodeURIComponent(sem)}`, options);
              if (active) setCourses(rows);
            }
          })(),
        ]);
        if (active && results.some(result => result.status === 'rejected')) {
          setLoadError(controller.signal.aborted
            ? 'Loading took too long. Check your connection and retry.'
            : 'Some dashboard sections could not load. Please retry.');
        }
      } finally {
        clearTimeout(timer);
        if (active) setLoading(false);
      }
    };
    fetchData();
    return () => {active = false; clearTimeout(timer); controller.abort();};
  }, [router, isHydrated]);

  // Real-time socket updates for new, updated, or deleted practicals
  useEffect(() => {
    if (!socket) return;

    const handleSocketUpdate = () => {
      fetchStudentPracticals();
    };

    socket.on('new_submission_marks', handleSocketUpdate);
    socket.on('practical_added', handleSocketUpdate);
    socket.on('practical_updated', handleSocketUpdate);
    socket.on('practical_deleted', handleSocketUpdate);

    return () => {
      socket.off('new_submission_marks', handleSocketUpdate);
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

  const semester = profile?.user?.extra_info?.semester || user?.extra_info?.semester || '';
  const batch = profile?.user?.extra_info?.batch || user?.extra_info?.batch || '';

  return (
    <div className={`student-dashboard ${styles.surface}`} style={{ minHeight: '100vh', backgroundColor: 'var(--student-ui-bg-f8fafc, #f8fafc)', fontFamily: 'Inter, sans-serif' }}>
      {loading && <LoadingOverlay />}
      {loadError && <div role="alert" style={{padding: '12px 20px', background: 'var(--student-ui-bg-fff3cd, #fff3cd)', color: '#664d03', display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center'}}>
        <span>{loadError}</span>
        <button type="button" onClick={() => window.location.reload()}>Retry loading</button>
      </div>}
      
      {/* Top Navbar */}
      <div className={`student-dashboard-header ${styles.toolbar}`} style={{
        height: '70px', backgroundColor: 'var(--student-ui-bg-ffffff, white)', borderBottom: '1px solid var(--border-color)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 40px',
        position: 'sticky', top: 0, zIndex: 100
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <div style={{ 
            width: '40px', height: '40px', 
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: '50%', background: 'var(--student-ui-bg-ffffff, #ffffff)', overflow: 'hidden',
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
                background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
                borderRadius: '50%',
                alignItems: 'center', justifyContent: 'center',
                fontSize: '16px', color: 'white', fontWeight: 700
              }}
            >
              CR
            </div>
          </div>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: 'var(--student-ui-text-1e293b, #1e293b)' }}>CodeRank</h2>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--student-ui-text-1e293b, #1e293b)' }}>{currentIdentity?.name || user.name}</div>
            <div style={{ fontSize: '12px', color: 'var(--student-ui-text-64748b, #64748b)' }}>{[semester && `Semester ${semester}`, batch && `Batch ${batch}`].filter(Boolean).join(' · ') || 'Student workspace'}</div>
          </div>
          <StudentThemeToggle />
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
            style={{ padding: '8px 16px', background: 'var(--student-ui-bg-f1f5f9, #f1f5f9)', border: '1px solid var(--student-ui-border-cbd5e1, #cbd5e1)', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, color: 'var(--student-ui-text-475569, #475569)', transition: 'all 0.2s' }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--student-ui-bg-e2e8f0, #e2e8f0)'}
            onMouseLeave={e => e.currentTarget.style.background = 'var(--student-ui-bg-f1f5f9, #f1f5f9)'}
          >
            Logout
          </button>
        </div>
      </div>

      <div className={styles.content}>
        <div className={styles.intro}>
          <p className={styles.eyebrow}>YOUR LEARNING, IN FOCUS</p>
          <h1 style={{ fontSize: '28px', fontWeight: 700, color: 'var(--student-ui-text-1e293b, #1e293b)', marginBottom: '8px' }}>My learning workspace</h1>
          <p style={{ color: 'var(--student-ui-text-64748b, #64748b)', fontSize: '15px' }}>
            View practicals assigned by your faculty{semester ? ` for Semester ${semester}` : ''}. Choose a practical to continue learning.
          </p>
        </div>

        <div className={styles.overview} aria-label="Workspace overview">
          <div><span>Enrolled courses</span><strong>{courses.length}</strong></div>
          <div><span>Practicals on this page</span><strong>{practicals.length}</strong></div>
          <div><span>Solved on this page</span><strong>{practicals.filter(practical => practical.my_status === 'Accepted').length}</strong></div>
        </div>
        <nav className={styles.pagination} aria-label="Dashboard practical pages" style={{ marginBottom: '20px', display: 'flex', gap: '8px' }}>
          <button disabled={practicalPage.loading || !practicalPage.cursor} onClick={practicalPage.first}>First page</button>{' '}
          <button disabled={practicalPage.loading || !practicalPage.next} onClick={practicalPage.nextPage}>Next page</button>
        </nav>
        {practicalPage.error && <p role="alert">{practicalPage.error}</p>}
        {courses.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
            {courses.map(course => {
              const coursePracticals = practicals.filter(practical => practicalBelongsToCourse(practical, course));
              const firstAvailable = coursePracticals.find(practical => practicalHasStarted(practical) && practicalDestination(practical, course.course_code));
              const openWorkspaceUrl = firstAvailable ? practicalDestination(firstAvailable, course.course_code) : null;

              return (
                <div className={`student-course-card ${styles.courseCard}`}
                  key={course.id}
                  style={{
                    background: 'var(--student-ui-bg-ffffff, white)', border: '1px solid var(--student-ui-border-e2e8f0, #e2e8f0)', borderRadius: '16px', padding: '24px',
                    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.04)', display: 'flex', flexDirection: 'column', gap: '20px'
                  }}
                >
                  {/* Subject Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--student-ui-border-f1f5f9, #f1f5f9)', paddingBottom: '16px' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span className={styles.courseCode} style={{ fontSize: '12px', fontWeight: 700, color: 'var(--overview-accent)', backgroundColor: 'var(--student-ui-bg-e0f2fe, #e0f2fe)', padding: '3px 8px', borderRadius: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          {course.course_code}
                        </span>
                        <span style={{ fontSize: '12px', color: 'var(--student-ui-text-64748b, #64748b)', fontWeight: 500 }}>
                          Semester {course.semester}
                        </span>
                      </div>
                      <h3 style={{ fontSize: '20px', fontWeight: 700, marginTop: '8px', marginBottom: '4px', color: 'var(--student-ui-text-1e293b, #1e293b)' }}>
                        {course.name}
                      </h3>
                      <p style={{ margin: 0, fontSize: '13px', color: 'var(--student-ui-text-64748b, #64748b)' }}>
                        {coursePracticals.length} {coursePracticals.length === 1 ? 'practical' : 'practicals'} on this page · {coursePracticals.filter(practical => practical.my_status === 'Accepted').length} solved
                      </p>
                    </div>

                    {openWorkspaceUrl ? <Link className="course-workspace-link" href={openWorkspaceUrl}>Open workspace <span aria-hidden="true">↗</span></Link> : <span className="course-workspace-empty">{coursePracticals.length ? 'Practicals open at their scheduled time' : 'No practicals available'}</span>}
                  </div>

                  {/* Practicals List */}
                  <div>
                    {coursePracticals.length > 0 ? (
                      <QuestionList practicals={coursePracticals} courseCode={course.course_code} />
                    ) : (
                      <div style={{ textAlign: 'center', padding: '30px 20px', background: 'var(--student-ui-bg-f8fafc, #f8fafc)', borderRadius: '12px', border: '1px dashed var(--student-ui-border-cbd5e1, #cbd5e1)' }}>
                        <p style={{ color: 'var(--student-ui-text-64748b, #64748b)', fontSize: '13px', margin: 0 }}>
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
          <div style={{ textAlign: 'center', padding: '60px 20px', background: 'var(--student-ui-bg-ffffff, white)', borderRadius: '16px', border: '1px dashed var(--student-ui-border-cbd5e1, #cbd5e1)' }}>
            <div style={{ fontSize: '40px', marginBottom: '15px' }}>📭</div>
            <h3 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--student-ui-text-1e293b, #1e293b)', marginBottom: '8px' }}>No Subjects Found</h3>
            <p style={{ color: 'var(--student-ui-text-64748b, #64748b)', fontSize: '14px', maxWidth: '400px', margin: '0 auto' }}>
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
