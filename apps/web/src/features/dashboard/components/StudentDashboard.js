'use client';
import WorkspaceReturn from '@/components/layout/WorkspaceReturn';
import styles from '@/features/dashboard/components/overview.module.css';
import { useAccountIdentity } from '@/features/auth/hooks/useAccountIdentity';
import { StudentThemeToggle } from '@/components/layout/StudentTheme';
import Link from 'next/link';
import QuestionList from '@/components/student/QuestionList';
import { practicalDestination, practicalHasStarted, practicalBelongsToCourse } from '@/lib/shared/practical-navigation';
import { usePracticalPage } from '@/features/practicals/hooks/usePracticalPage';
import { fetchCollection } from '@/lib/client/fetch-collection';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import LoadingOverlay from '@/components/ui/LoadingOverlay';
import LogoutConfirmModal from '@/components/ui/LogoutConfirmModal';
import { useSocket } from '@/hooks/useSocket';
import { usePolling } from '@/hooks/usePolling';
import { useStudentDashboard } from '@/features/dashboard/hooks/useStudentDashboard';

export default function StudentDashboard() {
  const { router, currentIdentity, socket, user, setUser, profile, setProfile, loading, setLoading, loadError, setLoadError, isHydrated, setIsHydrated, courses, setCourses, practicalPage, practicals, fetchStudentPracticals, isSocketConnected, showLogoutModal, setShowLogoutModal, handleLogout, confirmLogout } = useStudentDashboard();
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

      <WorkspaceReturn />
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
