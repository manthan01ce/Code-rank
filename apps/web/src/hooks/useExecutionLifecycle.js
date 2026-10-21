'use client';
import { useEffect, useRef, useState } from 'react';

export function useExecutionLifecycle(problemId) {
  const current = useRef(null);
  const [phase, setPhase] = useState('Idle');
  const [elapsed, setElapsed] = useState(0);
  const [busy, setBusy] = useState(false);
  useEffect(() => () => {
    current.current?.controller.abort(new DOMException('Workspace changed', 'AbortError'));
    current.current = null;
  }, [problemId]);
  useEffect(() => {
    setBusy(false); setPhase('Idle'); setElapsed(0);
  }, [problemId]);
  useEffect(() => {
    if (!busy) return;
    const timer = setInterval(() => {
      if (current.current) setElapsed(Math.floor((Date.now() - current.current.startedAt) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [busy]);
  function begin() {
    if (current.current) return null;
    const action = { controller: new AbortController(), startedAt: Date.now() };
    current.current = action;
    setBusy(true); setElapsed(0); setPhase('Saving');
    return action;
  }
  function update(action, next) { if (current.current === action) setPhase(next); }
  function finish(action, next) {
    if (current.current !== action) return;
    current.current = null; setPhase(next); setBusy(false);
  }
  return { begin, update, finish, phase, elapsed, busy };
}
