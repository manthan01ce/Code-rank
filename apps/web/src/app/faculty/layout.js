import FacultySidebar from '@/components/FacultySidebar';

export default function FacultyLayout({ children }) {
  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-color)' }}>
      <FacultySidebar />
      <div style={{ marginLeft: '280px', marginTop: '70px', padding: '30px', minHeight: 'calc(100vh - 70px)' }}>
        {children}
      </div>
    </div>
  );
}
