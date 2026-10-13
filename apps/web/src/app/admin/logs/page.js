'use client';

import { useCallback, useEffect, useState } from 'react';
import LoadingOverlay from '@/components/LoadingOverlay';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { usePolling } from '@/hooks/usePolling';

export default function ActivityLogsPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { token, isReady } = useAdminAuth();

  const fetchLogs = useCallback(async () => {
    try {
      setError('');
      const response = await fetch('/api/logs?limit=100', {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/';
        return;
      }

      if (!response.ok) throw new Error('Unable to load activity logs');
      setLogs(await response.json());
    } catch (fetchError) {
      console.error('Fetch activity logs error:', fetchError);
      setError('Unable to load activity logs. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (isReady) fetchLogs();
  }, [isReady, fetchLogs]);

  usePolling(fetchLogs, 15_000, isReady);

  return (
    <div>
      {loading && <LoadingOverlay />}
      <div className="header">
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: 700 }}>Activity Logs</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>The latest administrative and user actions.</p>
        </div>
        <button className="btn-primary" style={{ width: 'auto', padding: '10px 20px', margin: 0 }} onClick={fetchLogs}>
          Refresh Logs
        </button>
      </div>

      {error && <p style={{ color: '#dc2626', marginBottom: '16px' }}>{error}</p>}

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>User</th>
              <th>Action</th>
              <th>Details</th>
              <th>Time</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id}>
                <td style={{ fontWeight: 500 }}>{log.user_name || 'System'}</td>
                <td>{log.action}</td>
                <td style={{ color: '#4b5563' }}>{log.details}</td>
                <td style={{ color: '#94a3b8', fontSize: '12px' }}>{new Date(log.created_at).toLocaleString()}</td>
              </tr>
            ))}
            {!loading && logs.length === 0 && (
              <tr><td colSpan="4" style={{ textAlign: 'center', color: '#888', padding: '40px' }}>No activity logs found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
