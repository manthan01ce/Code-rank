'use client';
import { useEffect } from 'react';
import { PROGRESS_EVENT, PROGRESS_KEY } from '@/lib/progress-updates';
export function useProgressRefresh(refresh, enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    const onStorage = event => { if (event.key === PROGRESS_KEY) refresh(); };
    const onFocus = () => { if (document.visibilityState !== 'hidden') refresh(); };
    window.addEventListener(PROGRESS_EVENT, refresh);
    window.addEventListener('storage', onStorage);
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => { window.removeEventListener(PROGRESS_EVENT, refresh); window.removeEventListener('storage', onStorage); window.removeEventListener('focus', onFocus); document.removeEventListener('visibilitychange', onFocus); };
  }, [refresh, enabled]);
}
