'use client';

import { useEffect, useRef, useCallback } from 'react';

/**
 * usePolling
 * ----------
 * A reliable polling hook that calls `callback` every `intervalMs` milliseconds.
 *
 * Features:
 *  - Runs immediately on mount (first call at t=0)
 *  - Pauses when the tab/window is hidden (Page Visibility API) to save resources
 *  - Resumes immediately when the tab becomes visible again
 *  - Clears timer cleanly on unmount
 *  - Stable callback via useRef (no need to memoize callback at call site)
 *
 * Usage:
 *   usePolling(fetchDashboardData, 30_000); // poll every 30 seconds
 *
 * @param {function} callback   – Async or sync function to call on each tick
 * @param {number}   intervalMs – Polling interval in milliseconds (default: 30000)
 * @param {boolean}  enabled    – Set to false to pause polling (default: true)
 */
export function usePolling(callback, intervalMs = 30_000, enabled = true) {
  const callbackRef = useRef(callback);
  const timerRef = useRef(null);

  // Keep callbackRef current without re-triggering the effect
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  const startPolling = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    // Fire immediately, then on schedule
    callbackRef.current();
    timerRef.current = setInterval(() => callbackRef.current(), intervalMs);
  }, [intervalMs]);

  const stopPolling = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      stopPolling();
      return;
    }

    startPolling();

    // Pause when tab is hidden, resume when visible
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        stopPolling();
      } else {
        startPolling();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      stopPolling();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [enabled, startPolling, stopPolling]);
}
