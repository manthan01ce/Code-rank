'use client';

import { useState, useEffect } from 'react';
import LoadingOverlay from '@/components/LoadingOverlay';

export default function AdminDashboard() {
  const [stats, setStats] = useState({ faculty: 0, students: 0, courses: 0 });
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const token = localStorage.getItem('token');
      
      const [statsRes, logsRes] = await Promise.all([
        fetch('/api/stats', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/logs?limit=8', { headers: { 'Authorization': `Bearer ${token}` } })
      ]);

      if (statsRes.ok) setStats(await statsRes.json());
      if (logsRes.ok) setLogs(await logsRes.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <div>
      {loading && <LoadingOverlay />}
      <div className="header">
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: '700' }}>Dashboard Overview</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Welcome back to your administration command center.</p>
        </div>
        <div style={{ display: 'flex', gap: '15px' }}>
             <button className="btn-primary" style={{ width: 'auto', padding: '10px 20px', margin: 0 }} onClick={fetchDashboardData}>
               Refresh Data
             </button>
        </div>
      </div>

      <div className="stat-cards">
        <div className="stat-card">
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <h3>Faculty Members</h3>
                <span style={{ fontSize: '20px' }}>👨‍🏫</span>
            </div>
            <p style={{ fontSize: '32px', fontWeight: '800', color: 'var(--primary)' }}>
              {stats.faculty}
            </p>
          </div>
          <div style={{ marginTop: '15px', fontSize: '12px', color: '#10b981' }}>
             ↑ 12% from last month
          </div>
        </div>
        
        <div className="stat-card">
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <h3>Active Students</h3>
                <span style={{ fontSize: '20px' }}>🎓</span>
            </div>
            <p style={{ fontSize: '32px', fontWeight: '800', color: '#10b981' }}>
              {stats.students}
            </p>
          </div>
          <div style={{ marginTop: '15px', fontSize: '12px', color: '#10b981' }}>
             ↑ 5% from last month
          </div>
        </div>

        <div className="stat-card">
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <h3>Ongoing Courses</h3>
                <span style={{ fontSize: '20px' }}>📚</span>
            </div>
            <p style={{ fontSize: '32px', fontWeight: '800', color: '#f59e0b' }}>
              {stats.courses}
            </p>
          </div>
          <div style={{ marginTop: '15px', fontSize: '12px', color: '#888' }}>
             Stabilized
          </div>
        </div>
      </div>

      <div className="table-container" style={{ border: '1px solid var(--border-color)', boxShadow: 'none' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: '600' }}>Recent Activity</h3>
            <button className="btn-small" style={{ color: 'var(--primary)', border: 'none', fontWeight: '600' }}>View All Logs</button>
        </div>
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
            {logs.map(log => (
              <tr key={log.id}>
                <td style={{ fontWeight: '500' }}>{log.user_name || 'System'}</td>
                <td>
                    <span style={{ 
                        padding: '4px 10px', 
                        borderRadius: '20px', 
                        fontSize: '11px', 
                        fontWeight: '600',
                        backgroundColor: log.action.includes('CREATE') ? '#ecfdf5' : log.action.includes('LOGIN') ? '#eff6ff' : '#fef3c7',
                        color: log.action.includes('CREATE') ? '#10b981' : log.action.includes('LOGIN') ? '#3b82f6' : '#f59e0b'
                    }}>
                        {log.action}
                    </span>
                </td>
                <td style={{ color: '#4b5563' }}>{log.details}</td>
                <td style={{ color: '#94a3b8', fontSize: '12px' }}>{formatDate(log.created_at)}</td>
              </tr>
            ))}
            {logs.length === 0 && !loading && (
              <tr><td colSpan="4" style={{ textAlign: 'center', color: '#888', padding: '40px' }}>No activity logs found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
