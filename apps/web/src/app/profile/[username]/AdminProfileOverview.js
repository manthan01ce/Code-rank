'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import ChangePasswordModal from '@/components/ChangePasswordModal';
import styles from './profile.module.css';

const destinations = [
  ['Students', '/admin/students', 'Manage enrollment and student accounts.'],
  ['Faculty', '/admin/faculty', 'Manage teaching staff and access.'],
  ['Departments', '/admin/departments', 'Organize your institution’s departments.'],
  ['Courses', '/admin/courses', 'Maintain the academic course catalog.'],
  ['Course mapping', '/admin/mapping', 'Connect faculty and courses.'],
  ['Activity logs', '/admin/logs', 'Review sign-ins and administrative changes.'],
];

export default function AdminProfileOverview({ onEdit }) {
  const router = useRouter();
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const load = useCallback((signal) => {
    return fetch('/api/stats', {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }, cache: 'no-store', signal,
    }).then(async response => {
      if (response.status === 401 || response.status === 403) { router.replace('/login'); return null; }
      if (!response.ok) throw new Error('Institution overview is unavailable. Please retry.');
      const data = await response.json();
      if (!['students', 'faculty', 'courses'].every(key => data[key] !== null && data[key] !== undefined && Number.isFinite(Number(data[key])) && Number(data[key]) >= 0)) {
        throw new Error('Institution overview returned incomplete data. Please retry.');
      }
      return data;
    });
  }, [router]);
  const refresh = () => {
    setLoading(true); setError('');
    load().then(setStats).catch(err => setError(err.message || 'Unable to load overview.')).finally(() => setLoading(false));
  };
  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal).then(data => { if (!controller.signal.aborted) setStats(data); })
      .catch(err => { if (!controller.signal.aborted) setError(err.message || 'Unable to load overview.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [load]);

  return <div className={styles.adminOverview}>
    <section className={styles.adminSection} aria-labelledby="institution-heading" aria-busy={loading}>
      <div className={styles.adminHeading}><div><p className={styles.adminEyebrow}>ADMINISTRATOR WORKSPACE</p><h2 id="institution-heading">Institution overview</h2></div><button onClick={refresh} disabled={loading}>{loading ? 'Loading…' : 'Refresh'}</button></div>
      <p>Manage your institution and account from one place.</p>
      {error ? <p role="alert" className={styles.adminError}>{error}</p> : <div className={styles.adminStats}>{[['students', 'Students', '/admin/students'], ['faculty', 'Faculty', '/admin/faculty'], ['courses', 'Courses', '/admin/courses']].map(([key, label, href]) => <Link key={key} href={href}><strong>{loading ? '—' : Number(stats?.[key]).toLocaleString()}</strong><span>{label} ↗</span></Link>)}</div>}
      <Link className={styles.adminTextLink} href="/admin">Open full dashboard →</Link>
    </section>
    <section className={styles.adminSection} aria-labelledby="management-heading"><h2 id="management-heading">Management shortcuts</h2><div className={styles.adminLinks}>{destinations.map(([title, href, text]) => <Link href={href} key={href}><strong>{title} ↗</strong><span>{text}</span></Link>)}</div></section>
    <section className={styles.adminSection} aria-labelledby="security-heading"><h2 id="security-heading">Account & security</h2><p>Keep your account details current. Password changes require your current password and replace your previous sign-in session.</p><div className={styles.adminButtons}><button onClick={onEdit}>Edit account details</button><button onClick={() => setPasswordOpen(true)}>Change password</button><Link href="/admin/logs">Review activity logs →</Link></div></section>
    <ChangePasswordModal isOpen={passwordOpen} onClose={() => setPasswordOpen(false)} />
  </div>;
}
