'use client';

import { useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { IconLayoutDashboard, IconInbox, IconChartBar, IconUser, IconKey, IconLogout } from '@tabler/icons-react';
import ChangePasswordModal from './ChangePasswordModal';
import LogoutConfirmModal from './LogoutConfirmModal';

function subscribe(callback) { window.addEventListener('storage', callback); return () => window.removeEventListener('storage', callback); }
function snapshot() { try { return localStorage.getItem('user'); } catch { return null; } }
const links = [['Dashboard', '/faculty?tab=practicals', IconLayoutDashboard], ['Student submissions', '/faculty?tab=submissions', IconInbox], ['Marks overview', '/faculty?tab=marks', IconChartBar]];
export default function FacultySidebar() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = searchParams.get('tab') || 'practicals';
  const stored = useSyncExternalStore(subscribe, snapshot, () => null);
  let user = null;
  try { user = JSON.parse(stored); } catch { /* The workspace auth gate handles invalid sessions. */ }
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const navigation = <>
    <Link href="/faculty" className="faculty-brand"><Image src="/coderank-logo.jpg" width={36} height={36} alt=""/><span>CodeRank<small>FACULTY WORKSPACE</small></span></Link>
    <nav aria-label="Faculty navigation">{links.map(([label, href, Icon]) => <Link key={href} href={href} aria-current={(href === '/faculty' ? tab === 'practicals' : href.endsWith(`tab=${tab}`)) ? 'page' : undefined} onClick={() => setMenuOpen(false)}><Icon size={19} aria-hidden="true"/><span>{label}</span></Link>)}</nav>
    <div className="faculty-account"><div className="faculty-identity"><b>{user?.name?.charAt(0) || 'F'}</b><span>{user?.name || 'Faculty'}<small>FACULTY</small></span></div><Link href={user?.email ? `/profile/${encodeURIComponent(user.email.split('@')[0])}` : '/login'}><IconUser size={19}/>My profile</Link><button onClick={() => { setMenuOpen(false); setPasswordOpen(true); }}><IconKey size={19}/>Change password</button><button onClick={() => { setMenuOpen(false); setLogoutOpen(true); }}><IconLogout size={19}/>Sign out</button></div>
  </>;
  return <><aside className="faculty-sidebar">{navigation}</aside><div className="faculty-mobile-bar"><span>CodeRank · Faculty</span><button aria-expanded={menuOpen} aria-controls="faculty-mobile-navigation" onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? 'Close menu' : 'Menu'}</button>{menuOpen && <div id="faculty-mobile-navigation" className="faculty-mobile-navigation">{navigation}</div>}</div><ChangePasswordModal isOpen={passwordOpen} onClose={() => setPasswordOpen(false)}/><LogoutConfirmModal isOpen={logoutOpen} onCancel={() => setLogoutOpen(false)} onConfirm={() => { localStorage.removeItem('token'); localStorage.removeItem('user'); router.push('/login'); }}/></>;
}
