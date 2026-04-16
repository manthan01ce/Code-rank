'use client';

import { useState, useEffect } from 'react';

export default function ActivityLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/logs', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) setLogs(await res.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    const d = new Date(dateString);
    return d.toLocaleString();
  };

  return (
    <div>
      <div className="header">
        <h2>Activity Logs</h2>
      </div>

      <div className="table-container">
        {loading ? <p>Loading logs...</p> : (
          <table>
            <thead>
              <tr>
                <th>Time</th>
                <th>User</th>
                <th>Role</th>
                <th>Action</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {logs.map(log => (
                <tr key={log.id}>
                  <td style={{ color: '#888', fontSize: '13px' }}>{formatDate(log.created_at)}</td>
                  <td style={{ fontWeight: 500 }}>{log.user_name || 'System'}</td>
                  <td>
                    {log.user_role ? (
                      <span className="status-badge" style={{ background: '#f1f5f9', color: '#475569' }}>
                        {log.user_role.toUpperCase()}
                      </span>
                    ) : '-'}
                  </td>
                  <td style={{ color: 'var(--primary)' }}>{log.action}</td>
                  <td>{log.details}</td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', color: '#888' }}>No activity logs found.</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
