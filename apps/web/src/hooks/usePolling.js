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
 *  - Resumes immediately when the tab becomes visible again, but does NOT double-fire
 *    if the interval already fired recently (to prevent UI refresh jitter)
 *  - Clears timer cleanly on unmount
 *  - Stable callback via useRef (no need to memoize callback at call site)
 *  - Deduplication via `isRunning` flag to prevent concurrent calls
 *
 * @param {function} callback   – Async or sync function to call on each tick
 * @param {number}   intervalMs – Polling interval in milliseconds (default: 15000)
 * @param {boolean}  enabled    – Set to false to pause polling (default: true)
 */
export function usePolling(callback, intervalMs = 15_000, enabled = true) {
  const callbackRef = useRef(callback);
  const timerRef = useRef(null);
  const isRunningRef = useRef(false);
  const lastFiredRef = useRef(0);

  // Keep callbackRef current without re-triggering the effect
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  const runCallback = useCallback(async () => {
    // Deduplicate: don't run if already running
    if (isRunningRef.current) return;
    isRunningRef.current = true;
    lastFiredRef.current = Date.now();
    try {
      await callbackRef.current();
    } catch (e) {
      // Silently ignore errors in polling callbacks
    } finally {
      isRunningRef.current = false;
    }
  }, []);

  const startPolling = useCallback((immediate = true) => {
    if (timerRef.current) clearInterval(timerRef.current);
    // Fire immediately only if requested
    if (immediate) runCallback();
    timerRef.current = setInterval(() => runCallback(), intervalMs);
  }, [intervalMs, runCallback]);

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

    startPolling(true);

    // Pause when tab is hidden, resume when visible — but don't double-fire
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        stopPolling();
      } else {
        // Only fire immediately if enough time has passed since last poll
        const elapsed = Date.now() - lastFiredRef.current;
        const shouldFireNow = elapsed >= intervalMs * 0.8;
        startPolling(shouldFireNow);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      stopPolling();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [enabled, startPolling, stopPolling, intervalMs]);
}

