'use client';

/**
 * useFacultyAuth
 * --------------
 * Shared auth gate hook for all faculty pages.
 *
 * Returns { token, isReady } where:
 *  - isReady = false  while localStorage is being read (prevents premature API calls)
 *  - isReady = true   once a valid faculty token is confirmed in localStorage
 *  - token            the raw JWT string (null if not yet ready)
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export function useFacultyAuth() {
  const router = useRouter();
  const [token, setToken] = useState(() => (typeof window !== 'undefined' ? localStorage.getItem('token') : null));
  const [isReady, setIsReady] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (!isHydrated) return;

    const storedToken = localStorage.getItem('token');
    const storedUser  = localStorage.getItem('user');

    if (!storedToken || !storedUser) {
      router.replace('/login');
      return;
    }

    try {
      const parsed = JSON.parse(storedUser);
      // Allow both 'faculty' and 'admin' — admin can view/impersonate faculty pages
      if (parsed.role !== 'faculty' && parsed.role !== 'admin') {
        router.replace('/login');
        return;
      }
      setToken(storedToken);
      setIsReady(true);
    } catch {
      router.replace('/login');
    }
  }, [router, isHydrated]);

  const activeToken = token || (typeof window !== 'undefined' ? localStorage.getItem('token') : null);

  return {
    token: activeToken,
    isReady: isReady || !!activeToken
  };
}
