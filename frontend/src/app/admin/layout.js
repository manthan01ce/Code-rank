import AdminSidebar from '@/components/AdminSidebar';

export default function AdminLayout({ children }) {
  return (
    <div className="dashboard-layout">
      <AdminSidebar />
      <div className="main-content" style={{ marginTop: '70px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: 'bold' }}>CodeRank</h1>
        {children}
      </div>
    </div>
  );
}
