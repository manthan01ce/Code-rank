'use client';

/**
 * useAdminAuth
 * -----------
 * Shared auth gate hook for all admin pages.
 *
 * Returns { token, isReady } where:
 *  - isReady = false  while localStorage is being read (prevents premature API calls)
 *  - isReady = true   once a valid admin token is confirmed in localStorage
 *  - token            the raw JWT string (null if not yet ready)
 *
 * Pages should gate their data-fetch useEffects on `isReady`:
 *   const { token, isReady } = useAdminAuth();
 *   useEffect(() => { if (isReady) fetchData(); }, [isReady]);
 *
 * The AdminSidebar already handles the redirect-to-login if role !== 'admin',
 * so this hook just needs to surface the ready state.
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export function useAdminAuth() {
  const router = useRouter();
  const [token, setToken] = useState(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    const storedUser  = localStorage.getItem('user');

    if (!storedToken || !storedUser) {
      router.replace('/');
      return;
    }

    try {
      const parsed = JSON.parse(storedUser);
      if (parsed.role !== 'admin') {
        router.replace('/');
        return;
      }
      setToken(storedToken);
      setIsReady(true);
    } catch {
      router.replace('/');
    }
  }, [router]);

  return { token, isReady };
}
