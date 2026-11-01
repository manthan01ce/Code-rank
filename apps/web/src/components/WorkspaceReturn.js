'use client';

import { useSyncExternalStore } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from './WorkspaceReturn.module.css';

function subscribe(callback) {
  window.addEventListener('storage', callback);
  return () => window.removeEventListener('storage', callback);
}
function readRole() {
  try {
    return localStorage.getItem('token') ? JSON.parse(localStorage.getItem('user'))?.role ?? null : null;
  } catch { return null; }
}
const destinations = { student: '/student', faculty: '/faculty', admin: '/admin' };

export default function WorkspaceReturn({ compact = false }) {
  const role = useSyncExternalStore(subscribe, readRole, () => null);
  const pathname = usePathname();
  const dashboard = Object.hasOwn(destinations, role) ? destinations[role] : '/';
  const target = pathname === dashboard ? '/' : dashboard;
  return (
    <nav aria-label="Return navigation" className={compact ? styles.compact : styles.trail}>
      <Link href={target} className={styles.back}>
        <span aria-hidden="true">←</span> {target === '/' ? 'Home' : 'Dashboard'}
      </Link>
      {!compact && target !== '/' && <Link href="/" className={styles.home}>CodeRank home</Link>}
    </nav>
  );
}
