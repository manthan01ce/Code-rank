'use client';
import { useEffect, useState } from 'react';
import { fetchGradePage } from '../api/reports-api';

export function usePracticalGradeReport(practical, token) {
  const [cursor, setCursor] = useState(null);
  const key = JSON.stringify([practical.id,token,cursor]);
  const [result, setResult] = useState({ key: null, report: null, error: '' });
  const loading = result.key !== key;
  const { report, error } = result;
  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const { data } = await fetchGradePage(practical.id, token, cursor, controller.signal);
        if (!controller.signal.aborted) setResult({ key, report: data, error: '' });
      } catch (failure) { if (!controller.signal.aborted) setResult({ key, report: null, error: failure.message }); }
    })();
    return () => controller.abort();
  }, [practical.id, token, cursor, key]);
  return { cursor, setCursor, loading, report, error };
}
