'use client';

import { useState, useEffect } from 'react';
import { Radio, ScrollText } from 'lucide-react';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { useSocket } from '@/hooks/useSocket';
import RefreshButton from '@/components/RefreshButton';

export default function ActivityLogs() {
  const socket = useSocket();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);

  const { token, isReady } = useAdminAuth();

  const fetchLogs = async () => {
    try {
      const res = await fetch('/api/logs', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setLogs(await res.json());
        setLastUpdated(new Date());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isReady) fetchLogs();
  }, [isReady]);

  // Real-time WebSocket synchronization for Activity Logs (NO polling)
  useEffect(() => {
    if (!socket) return;
    socket.emit('join_admin_room');

    const handleNewActivity = (activity) => {
      if (activity && activity.id) {
        setLogs((prev) => [activity, ...prev]);
      } else {
        fetchLogs();
      }
    };

    socket.on('admin_activity', handleNewActivity);

    return () => {
      socket.off('admin_activity', handleNewActivity);
    };
  }, [socket]);

  const formatDate = (dateString) => {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const isSocketConnected = socket?.isConnected ?? false;

  return (
    <div>
      <div className="header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: 800, margin: '0 0 6px 0', color: '#1e293b' }}>
            System Activity Logs
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <p style={{ color: '#64748b', fontSize: '14px', margin: 0 }}>
              Live audit record of administrative, faculty, and student actions.
            </p>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                fontSize: '11px',
                fontWeight: 600,
                padding: '2px 8px',
                borderRadius: '999px',
                backgroundColor: isSocketConnected ? '#ecfdf5' : '#fffbeb',
                color: isSocketConnected ? '#059669' : '#d97706',
                border: `1px solid ${isSocketConnected ? '#a7f3d0' : '#fde68a'}`,
              }}
              title={isSocketConnected ? 'Connected to WebSocket server' : 'Reconnecting to WebSocket server'}
            >
              <Radio size={12} style={{ animation: isSocketConnected ? 'pulse 2s infinite' : 'none' }} />
              {isSocketConnected ? 'WebSocket Live' : 'Reconnecting...'}
            </span>
          </div>
        </div>

        <RefreshButton
          onRefresh={fetchLogs}
          lastUpdated={lastUpdated}
          label="Refresh Logs"
          variant="default"
        />
      </div>

      <div className="table-container" style={{ border: '1px solid #e2e8f0', borderRadius: '12px', backgroundColor: '#ffffff', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        {loading ? (
          <p style={{ padding: '24px', textAlign: 'center', color: '#94a3b8' }}>Loading activity logs...</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                  <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Time</th>
                  <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>User</th>
                  <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Role</th>
                  <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Action</th>
                  <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Details</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '12px 16px', color: '#94a3b8', fontSize: '12px', whiteSpace: 'nowrap' }}>
                      {formatDate(log.created_at)}
                    </td>
                    <td style={{ padding: '12px 16px', fontWeight: 600, color: '#1e293b', fontSize: '14px' }}>
                      {log.user_name || 'System Admin'}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{
                        padding: '3px 8px',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: 700,
                        backgroundColor: log.role === 'admin' ? '#eef2ff' : log.role === 'faculty' ? '#f5f3ff' : '#ecfeff',
                        color: log.role === 'admin' ? '#4338ca' : log.role === 'faculty' ? '#6d28d9' : '#0e7490'
                      }}>
                        {log.role?.toUpperCase() || 'SYSTEM'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ 
                        padding: '4px 10px', 
                        borderRadius: '20px', 
                        fontSize: '11px', 
                        fontWeight: '700',
                        backgroundColor: log.action?.includes('CREATE') ? '#ecfdf5' : log.action?.includes('LOGIN') ? '#eff6ff' : log.action?.includes('DELETE') ? '#fef2f2' : '#fef3c7',
                        color: log.action?.includes('CREATE') ? '#059669' : log.action?.includes('LOGIN') ? '#2563eb' : log.action?.includes('DELETE') ? '#dc2626' : '#d97706'
                      }}>
                        {log.action}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', color: '#475569', fontSize: '13px' }}>
                      {log.details}
                    </td>
                  </tr>
                ))}
                {logs.length === 0 && (
                  <tr>
                    <td colSpan="5" style={{ textAlign: 'center', color: '#94a3b8', padding: '48px 16px', fontSize: '14px' }}>
                      <ScrollText size={32} style={{ margin: '0 auto 8px', color: '#cbd5e1' }} />
                      No activity logs recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
