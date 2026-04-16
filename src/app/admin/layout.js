import AdminSidebar from '@/components/AdminSidebar';

export default function AdminLayout({ children }) {
  return (
    <div className="dashboard-layout">
      <AdminSidebar />
      <div className="main-content" style={{ marginTop: '70px' }}>
        {children}
      </div>
    </div>
  );
}
