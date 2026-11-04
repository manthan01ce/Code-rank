'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { roleSession } from '../api/role-session.js';

export function useRoleSession(role, redirect) {
  const router = useRouter();
  const [session, setSession] = useState({ token: null, isReady: false });
  useEffect(() => {
    const refresh = () => {
      const next = roleSession(localStorage, role);
      setSession(next);
      if (!next.isReady) router.replace(redirect);
    };
    refresh();
    window.addEventListener('storage', refresh);
    window.addEventListener('coderank:account', refresh);
    return () => {
      window.removeEventListener('storage', refresh);
      window.removeEventListener('coderank:account', refresh);
    };
  }, [role, redirect, router]);
  return session;
}
