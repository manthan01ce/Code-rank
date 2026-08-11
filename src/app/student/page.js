'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import LoadingOverlay from '@/components/LoadingOverlay';

export default function StudentDashboard() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [courses, setCourses] = useState([]);

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
    
    // Fetch user profile and courses
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
        } else {
          router.push('/');
        }
      } catch (err) {
        console.error('Error fetching profile:', err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [router]);

  const handleLogout = () => {
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
          <img src="/coderank-logo.png" alt="Logo" style={{ height: '40px' }} onError={(e) => { e.target.src = '/coderank-logo.svg'; }} />
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: '#1e293b' }}>CodeRank Student</h2>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '14px', fontWeight: 600, color: '#1e293b' }}>{user.name}</div>
            <div style={{ fontSize: '12px', color: '#64748b' }}>Semester {semester} &bull; Batch {batch}</div>
          </div>
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
        <div style={{ marginBottom: '40px' }}>
          <h1 style={{ fontSize: '28px', fontWeight: 700, color: '#1e293b', marginBottom: '10px' }}>My Subjects</h1>
          <p style={{ color: '#64748b', fontSize: '15px' }}>Select a subject below to access your assigned practicals and coding workspace.</p>
        </div>

        {courses.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '25px' }}>
            {courses.map(course => (
              <div 
                key={course.id}
                onClick={() => router.push(`/student/code/1?subject=${encodeURIComponent(course.course_code)}`)}
                style={{
                  background: 'white', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '24px',
                  cursor: 'pointer', transition: 'transform 0.2s, box-shadow 0.2s, border-color 0.2s',
                  boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
                  display: 'flex', flexDirection: 'column', height: '160px', justifyContent: 'space-between'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-4px)';
                  e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1)';
                  e.currentTarget.style.borderColor = '#0066b1';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0,0,0,0.05)';
                  e.currentTarget.style.borderColor = 'var(--border-color)';
                }}
              >
                <div>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#0066b1', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    {course.course_code}
                  </span>
                  <h3 style={{ fontSize: '18px', fontWeight: 600, marginTop: '10px', color: '#1e293b', lineHeight: 1.3 }}>
                    {course.name}
                  </h3>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto' }}>
                  <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 500 }}>
                    Semester {course.semester}
                  </span>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: '#0066b1' }}>
                    Open Workspace &rarr;
                  </span>
                </div>
              </div>
            ))}
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
    </div>
  );
}
