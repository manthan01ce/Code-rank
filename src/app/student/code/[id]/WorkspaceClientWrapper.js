'use client';

/**
 * WorkspaceClientWrapper.js — CLIENT COMPONENT
 *
 * Checks authorization:
 * - JWT token presence.
 * - Confirms role is student, admin, or faculty.
 * - Restricts student access strictly to 4th-semester students only.
 */

import { useState, useEffect } from 'react';
import { useRouter }           from 'next/navigation';
import WorkspaceLayout         from '@/components/compiler/WorkspaceLayout';

export default function WorkspaceClientWrapper({ problem }) {
  const router = useRouter();

  const [mounted, setMounted] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [isSemesterAuthorized, setIsSemesterAuthorized] = useState(null); // null = checking, true = ok, false = blocked
  const [userProfile, setUserProfile] = useState(null);

  useEffect(() => {
    setMounted(true);

    const userData = localStorage.getItem('user');
    const token = localStorage.getItem('token');
    if (!userData || !token) {
      router.replace('/');
      return;
    }

    setAuthed(true);

    // Fetch full profile from backend to inspect semester dynamically
    fetch('/api/auth/profile', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load profile');
        return res.json();
      })
      .then((data) => {
        const profile = data.user;
        setUserProfile(profile);
        
        // Authorization rule:
        // - Allow admin/faculty to view and test.
        // - Allow students ONLY if they are strictly in the 4th semester.
        if (profile.role === 'student') {
          const sem = String(profile.extra_info?.semester || '').trim();
          if (sem === '4') {
            setIsSemesterAuthorized(true);
          } else {
            setIsSemesterAuthorized(false);
          }
        } else {
          // Admins/Faculty are authorized
          setIsSemesterAuthorized(true);
        }
      })
      .catch((err) => {
        console.error('Profile fetch failed:', err);
        // Fallback: block access if authorization cannot be verified
        setIsSemesterAuthorized(false);
      });
  }, [router]);

  // ── 1. Loading State ──
  if (!mounted || !authed || isSemesterAuthorized === null) {
    return (
      <div className="h-screen w-full bg-[#0a0a0a] flex items-center justify-center" style={{ height: '100vh', width: '100vw', background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: '#7e7e7e' }}>
          <span
            style={{ width: '20px', height: '20px', border: '2px solid #10b981', borderTopColor: 'transparent', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }}
            aria-hidden="true"
          />
          <span style={{ fontSize: '13px', fontFamily: 'JetBrains Mono, monospace' }}>Verifying authorization…</span>
        </div>
      </div>
    );
  }

  // ── 2. Access Restricted State ──
  if (isSemesterAuthorized === false) {
    const userSem = userProfile?.extra_info?.semester || 'unspecified';
    return (
      <div style={{
        height: '100vh',
        width: '100vw',
        background: '#070707',
        color: '#ffffff',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'Inter, sans-serif',
        padding: '24px',
        textAlign: 'center'
      }}>
        <div style={{
          width: '72px',
          height: '72px',
          borderRadius: '50%',
          background: 'rgba(226,39,24,0.1)',
          border: '2px solid #e22718',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '32px',
          color: '#e22718',
          marginBottom: '24px'
        }}>
          !
        </div>
        <h2 style={{ fontSize: '20px', fontWeight: 700, margin: '0 0 8px 0', letterSpacing: '0.5px' }}>
          Access Restricted
        </h2>
        <p style={{ color: '#7e7e7e', fontSize: '13px', lineHeight: 1.6, maxWidth: '420px', margin: '0 0 24px 0' }}>
          Only students in the <strong>4th semester</strong> are authorized to access the CodeRank Student Coding Workspace.<br/>
          Your current registered semester is <strong>{userSem}</strong>.
        </p>
        <button
          onClick={() => router.push('/student')}
          style={{
            background: '#1a1a1a',
            border: '1px solid #333333',
            color: '#ffffff',
            padding: '10px 24px',
            borderRadius: '4px',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'background 0.2s'
          }}
          onMouseEnter={e => e.currentTarget.style.background = '#262626'}
          onMouseLeave={e => e.currentTarget.style.background = '#1a1a1a'}
        >
          Return to Student Portal
        </button>
      </div>
    );
  }

  // ── 3. Authenticated and Authorized Workspace ──
  return (
    <main style={{ height: '100vh', width: '100vw', backgroundColor: '#0a0a0a', overflow: 'hidden' }}>
      <WorkspaceLayout problem={problem} />
    </main>
  );
}
