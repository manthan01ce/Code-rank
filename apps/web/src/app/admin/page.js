'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { IconSchool, IconUsers, IconBook } from '@tabler/icons-react';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { usePolling } from '@/hooks/usePolling';

const cards = [
  ['faculty', 'Faculty members', '/admin/faculty', IconUsers, 'Manage teaching staff'],
  ['students', 'Students', '/admin/students', IconSchool, 'Manage student enrollment'],
  ['courses', 'Courses', '/admin/courses', IconBook, 'View the course catalog'],
];

export default function AdminDashboard() {
  const router = useRouter();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const { token, isReady } = useAdminAuth();
  const fetchDashboardData = useCallback(() => {
    if (!token) return Promise.resolve();
    return Promise.all([
      fetch('/api/stats', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' }),
      fetch('/api/logs?limit=8', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' }),
    ]).then(async ([statsResponse, logsResponse]) => {
      if ([statsResponse.status, logsResponse.status].some(status => status === 401 || status === 403)) {
        localStorage.removeItem('token'); localStorage.removeItem('user');
        router.replace('/login');
        return;
      }
      if (!statsResponse.ok || !logsResponse.ok) throw new Error('Unable to load dashboard data. Please refresh to try again.');
      const [stats, logs] = await Promise.all([statsResponse.json(), logsResponse.json()]);
      if (!Array.isArray(logs) || !cards.every(([key]) => Number.isInteger(stats[key]) && stats[key] >= 0)) throw new Error('Dashboard data is incomplete. Please refresh to try again.');
      setData({ stats, logs }); setError('');
    }).catch(err => setError(err.message || 'Unable to load dashboard.'))
      .finally(() => setLoading(false));
  }, [token, router]);
  useEffect(() => { if (isReady) fetchDashboardData(); }, [isReady, fetchDashboardData]);
  usePolling(fetchDashboardData, 15_000, isReady);

  return <div>
    <div className="header"><div><div className="admin-eyebrow">INSTITUTION WORKSPACE</div><h2>Dashboard overview</h2><p>Your people, courses, and recent activity in one place.</p></div><button className="btn-primary" style={{ width: 'auto', margin: 0 }} disabled={loading} onClick={() => { setLoading(true); fetchDashboardData(); }}>{loading ? 'Refreshing…' : 'Refresh overview'}</button></div>
    {error && <p role="alert" className="admin-alert">{error}{data && ' Showing the last successfully loaded overview.'}</p>}
    <div className="admin-stat-grid" aria-busy={loading}>{cards.map(([key, label, href, Icon, description]) => <Link className="admin-stat-link" href={href} key={key}><div className="admin-stat-top"><span>{label}</span><Icon aria-hidden="true" /></div><strong>{data ? data.stats[key].toLocaleString() : '—'}</strong><small>{description} ↗</small></Link>)}</div>
    <nav aria-label="Quick administration" className="admin-shortcuts"><Link href="/admin/students">Manage students ↗</Link><Link href="/admin/faculty">Manage faculty ↗</Link><Link href="/admin/mapping">Map courses ↗</Link><Link href="/admin/departments">Manage departments ↗</Link></nav>
    <section className="table-container" aria-labelledby="recent-activity-title"><div className="admin-section-heading"><div><h3 id="recent-activity-title">Recent activity</h3><p>The latest sign-ins and administrative changes.</p></div><Link href="/admin/logs">View all logs →</Link></div>
      <table><thead><tr><th scope="col">User</th><th scope="col">Action</th><th scope="col">Details</th><th scope="col">Time</th></tr></thead><tbody>{data?.logs.map(log => <tr key={log.id}><td>{log.user_name || 'System'}</td><td><span className="admin-action-badge">{log.action}</span></td><td>{log.details}</td><td style={{ color: '#64748b', whiteSpace: 'nowrap', fontSize: '11px' }}>{new Date(log.created_at).toLocaleString()}</td></tr>)}{!data && <tr><td colSpan={4}>{loading ? 'Loading recent activity…' : 'Recent activity is unavailable.'}</td></tr>}{data?.logs.length === 0 && <tr><td colSpan={4}>No activity recorded yet.</td></tr>}</tbody></table>
    </section>
  </div>;
}
