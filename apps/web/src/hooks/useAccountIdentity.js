'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useSyncExternalStore } from 'react';
const eventName = 'coderank:account';
function subscribe(callback) { window.addEventListener('storage', callback); window.addEventListener(eventName, callback); return () => { window.removeEventListener('storage', callback); window.removeEventListener(eventName, callback); }; }
function snapshot() { try { return localStorage.getItem('user'); } catch { return null; } }
export function useAccountIdentity() {
  const router = useRouter();
  const saved = useSyncExternalStore(subscribe, snapshot, () => null);
  useEffect(() => {
    let active = true, pending = false;
    const controller = new AbortController();
    const refresh = async () => {
      if (pending || document.visibilityState === 'hidden') return;
      const token = localStorage.getItem('token');
      if (!token) return;
      pending = true;
      try {
        const response = await fetch('/api/auth/profile', { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal, cache: 'no-store' });
        if (!active || token !== localStorage.getItem('token')) return;
        if (response.status === 401) { localStorage.removeItem('token'); localStorage.removeItem('user'); router.replace('/login'); return; }
        if (!response.ok) return;
        const { user } = await response.json();
        if (!active || !user || token !== localStorage.getItem('token')) return;
        const next = JSON.stringify(user);
        if (next !== localStorage.getItem('user')) { localStorage.setItem('user', next); window.dispatchEvent(new Event(eventName)); }
      } catch { /* A temporary outage must not destroy a valid session. */ }
      finally { pending = false; }
    };
    refresh();
    const timer = setInterval(refresh, 10000);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => { active = false; controller.abort(); clearInterval(timer); window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh); };
  }, [router]);
  try { return JSON.parse(saved); } catch { return null; }
}
