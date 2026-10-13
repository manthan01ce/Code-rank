'use client';

import { useEffect, useRef, useCallback, useState } from 'react';

/**
 * usePolling
 * ----------
 * High-reliability, role-specific polling hook designed for Student dashboards.
 *
 * Requirements met:
 *  - Configurable polling interval (default 15,000ms).
 *  - Prevents overlapping async requests via `isExecutingRef`.
 *  - Pauses execution when tab is hidden (Page Visibility API) to eliminate wasted traffic.
 *  - Resumes and fires immediately when student returns to tab.
 *  - Thorough cleanup of timers on component unmount.
 *  - Returns a stable manual `triggerPoll()` that executes immediately without
 *    creating duplicate intervals or breaking the polling cadence.
 *
 * @param {Function} callback   - Async or sync data fetch function
 * @param {number}   intervalMs - Polling interval in ms (default 15000)
 * @param {boolean}  enabled    - Toggle polling active state (default true)
 */
export function usePolling(callback, intervalMs = 15_000, enabled = true) {
  const callbackRef = useRef(callback);
  const timerRef = useRef(null);
  const isExecutingRef = useRef(false);
  const [isPollingActive, setIsPollingActive] = useState(enabled);

  // Keep callbackRef current without re-triggering effects
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  // Safe executor preventing overlapping requests
  const executePoll = useCallback(async () => {
    if (isExecutingRef.current) return;
    isExecutingRef.current = true;
    try {
      if (typeof callbackRef.current === 'function') {
        await callbackRef.current();
      }
    } catch (err) {
      console.warn('[usePolling] Error during poll execution:', err);
    } finally {
      isExecutingRef.current = false;
    }
  }, []);

  const startTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      executePoll();
    }, intervalMs);
  }, [intervalMs, executePoll]);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Manual trigger function: fires immediately and keeps existing interval untouched
  const triggerPoll = useCallback(async () => {
    await executePoll();
  }, [executePoll]);

  useEffect(() => {
    if (!enabled) {
      stopTimer();
      setIsPollingActive(false);
      return;
    }

    setIsPollingActive(true);
    // Initial fetch on mount / enable
    executePoll();
    startTimer();

    // Page Visibility handling
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        stopTimer();
      } else {
        // Tab visible again: fire fresh fetch and resume schedule
        executePoll();
        startTimer();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      stopTimer();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [enabled, startTimer, stopTimer, executePoll]);

  return { triggerPoll, isPollingActive };
}

export default usePolling;
