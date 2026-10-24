'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import WorkspaceLayout from '@/components/compiler/WorkspaceLayout';

export default function WorkspaceClientWrapper({ problem = null, practicalId = null }) {
  const router = useRouter();
  const [result,setResult] = useState(null);
  useEffect(() => {
    const controller = new AbortController();
    const token = localStorage.getItem('token');
    if (!token) { router.replace('/login'); return; }
    (async () => {
      try {
        const response = await fetch(practicalId ? `/api/student/practicals/${encodeURIComponent(practicalId)}` : '/api/auth/profile', {
          headers: { Authorization: `Bearer ${token}` }, signal: controller.signal,
        });
        const data=await response.json();
        if (!response.ok) throw Error(data.error || 'Unable to verify access');
        if (!practicalId && data.user?.role !== 'student') throw Error('Student authentication required');
        if (!controller.signal.aborted) setResult({ practicalId, problem: practicalId ? data : problem });
      } catch (error) {
        if (!controller.signal.aborted) setResult({ practicalId, error: error.message });
      }
    })();
    return () => controller.abort();
  }, [practicalId,problem,router]);
  if (!result || result.practicalId !== practicalId) return <p role="status">Verifying authorization…</p>;
  if (result.error) return <main><h1>Access unavailable</h1><p role="alert">{result.error}</p><button onClick={() => router.push('/student')}>Return to Student Portal</button></main>;
  return <main style={{ height: '100vh', width: '100vw', backgroundColor: '#0a0a0a', overflow: 'hidden' }}><WorkspaceLayout problem={result.problem} /></main>;
}
