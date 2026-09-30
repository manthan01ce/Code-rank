import FacultySidebar from '@/components/FacultySidebar';

export default function FacultyLayout({ children }) {
  return (
    <div className="dashboard-layout">
      <FacultySidebar />
      <div className="main-content" style={{ marginTop: '70px', marginLeft: '280px' }}>
        {children}
      </div>
    </div>
  );
}
