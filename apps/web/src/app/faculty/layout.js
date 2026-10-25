import '../admin/admin.css';
import './faculty.css';
import { Suspense } from 'react';
import FacultySidebar from '@/components/FacultySidebar';

export default function FacultyLayout({ children }) {
  return <div className="admin-shell faculty-shell"><a className="admin-skip-link" href="#faculty-main">Skip to faculty content</a><Suspense fallback={<aside className="faculty-sidebar" aria-label="Loading navigation"/>}><FacultySidebar/></Suspense><main id="faculty-main" className="admin-content faculty-content">{children}</main></div>;
}
