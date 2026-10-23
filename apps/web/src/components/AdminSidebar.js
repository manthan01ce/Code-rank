"use client";
import {useRouter,usePathname} from 'next/navigation';
import {useEffect,useState} from 'react';
import {IconLayoutDashboard,IconBuilding,IconUsers,IconSchool,IconBook,IconArrowsShuffle,IconHistory,IconSettings,IconLogout,IconUser,IconKey} from '@tabler/icons-react';
import {Sidebar,SidebarBody,SidebarLink} from '@/components/ui/sidebar';
import ChangePasswordModal from './ChangePasswordModal';
import LogoutConfirmModal from './LogoutConfirmModal';
// Preserve the exact existing admin destinations and labels.
const links=[['Dashboard','/admin',IconLayoutDashboard],['Department Master','/admin/departments',IconBuilding],['Faculty Master','/admin/faculty',IconUsers],['Student Master','/admin/students',IconSchool],['Courses','/admin/courses',IconBook],['Course Mapping','/admin/mapping',IconArrowsShuffle],['Activity Logs','/admin/logs',IconHistory],['Settings','/admin/settings',IconSettings]];
export default function AdminSidebar(){const router=useRouter(),pathname=usePathname();const [user,setUser]=useState(null),[passwordOpen,setPasswordOpen]=useState(false),[logoutOpen,setLogoutOpen]=useState(false);
 useEffect(()=>{try{const value=localStorage.getItem('user');if(value){const parsed=JSON.parse(value);if(parsed.role!=='admin')router.push('/');setUser(parsed);}else router.push('/');}catch{router.push('/');}},[router]);
 const logout=()=>{localStorage.removeItem('token');localStorage.removeItem('user');router.push('/');};
 return <Sidebar><SidebarBody><a aria-label="CodeRank Admin Panel" className="admin-brand" href="/admin"><img src="/coderank-logo.jpg" alt=""/><span>CodeRank<small>Admin Panel</small></span></a><nav aria-label="Administration">{links.map(([label,href,Icon])=><SidebarLink key={href} href={href} label={label} icon={<Icon size={22}/>} active={pathname===href}/>)}</nav><div className="admin-account"><div className="admin-identity"><b aria-hidden="true">{user?.name?.charAt(0).toUpperCase()||'A'}</b><span>{user?.name||'Admin'}<small>ADMIN</small></span></div><SidebarLink href={`/profile/${user?.email?.split('@')[0]||'admin'}`} label="Profile" icon={<IconUser size={22}/>}/><button aria-label="Change Password" onClick={()=>setPasswordOpen(true)}><IconKey size={22}/><span>Change Password</span></button><button aria-label="Logout" onClick={()=>setLogoutOpen(true)}><IconLogout size={22}/><span>Logout</span></button></div></SidebarBody><ChangePasswordModal isOpen={passwordOpen} onClose={()=>setPasswordOpen(false)}/><LogoutConfirmModal isOpen={logoutOpen} onConfirm={logout} onCancel={()=>setLogoutOpen(false)}/></Sidebar>;
}
