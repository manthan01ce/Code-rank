import WorkspaceReturn from '@/components/WorkspaceReturn';
import './admin.css';
import AdminSidebar from '@/components/AdminSidebar';
export default function AdminLayout({children}){return <div className="admin-shell"><a className="admin-skip-link" href="#admin-main">Skip to admin content</a><AdminSidebar/><main id="admin-main" className="admin-content"><WorkspaceReturn />{children}</main></div>;}
