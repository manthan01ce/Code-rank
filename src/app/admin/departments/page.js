'use client';

import { useState, useEffect } from 'react';
import LoadingOverlay from '@/components/LoadingOverlay';
import { useAdminAuth } from '@/hooks/useAdminAuth';

export default function DepartmentMaster() {
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [search, setSearch] = useState('');
  
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [toast, setToast] = useState(null);

  const [form, setForm] = useState({ name: '', institute_name: '' });

  const { token: authToken, isReady } = useAdminAuth();
  const token = () => authToken;

  const showToast = (type, msg) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 5000);
  };

  const fetchDepartments = async () => {
    setLoading(true);
    try {
      let url = '/api/departments';
      if (search) url += `?search=${encodeURIComponent(search)}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token()}` } });
      if (res.ok) {
        const data = await res.json();
        setDepartments(Array.isArray(data) ? data : []);
      } else {
        setDepartments([]);
      }
    } catch (e) {
      console.error(e);
      setDepartments([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (isReady) fetchDepartments(); }, [search, isReady]);

  const openAdd = () => {
    setEditTarget(null);
    setForm({ name: '', institute_name: '' });
    setShowModal(true);
  };

  const openEdit = (d) => {
    setEditTarget(d);
    setForm({
      name: d.name || '',
      institute_name: d.institute_name || ''
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setProcessing(true);
    try {
      if (editTarget) {
        // EDIT
        const res = await fetch(`/api/departments/${editTarget.id}`, {
          method: 'PUT',
          headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        });
        const data = await res.json();
        if (!res.ok) { showToast('error', data.error || 'Update failed'); return; }
        
        setDepartments(prev => prev.map(d => d.id === editTarget.id ? data.department : d));
        showToast('success', `${form.name} updated successfully`);
        setShowModal(false);
      } else {
        // CREATE
        const res = await fetch('/api/departments', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        });
        const data = await res.json();
        if (!res.ok) { showToast('error', data.error || 'Create failed'); return; }

        setDepartments(prev => [data, ...prev]);
        showToast('success', `${form.name} created!`);
        setShowModal(false);
      }
    } catch (err) {
      showToast('error', 'Network error');
    } finally {
      setProcessing(false);
      setForm({ name: '', institute_name: '' });
    }
  };

  const handleDelete = async (d) => {
    if (!confirm(`Are you sure you want to delete ${d.name}?`)) return;
    setProcessing(true);
    try {
      const res = await fetch(`/api/departments/${d.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token()}` },
      });
      const data = await res.json();
      if (!res.ok) { showToast('error', data.error || 'Deletion failed'); return; }
      
      setDepartments(prev => prev.filter(dept => dept.id !== d.id));
      showToast('success', `${d.name} deleted successfully`);
    } catch (e) {
      showToast('error', 'Network error');
    } finally { setProcessing(false); }
  };

  return (
    <div style={{ position: 'relative' }}>
      {processing && <LoadingOverlay />}

      {toast && (
        <div style={{
          position: 'fixed', top: '20px', right: '20px', zIndex: 9999,
          padding: '14px 20px', borderRadius: '10px', fontWeight: 600, fontSize: '14px',
          backgroundColor: toast.type === 'success' ? '#ecfdf5' : '#fef2f2',
          color: toast.type === 'success' ? '#065f46' : '#991b1b',
          border: `1px solid ${toast.type === 'success' ? '#6ee7b7' : '#fca5a5'}`,
          boxShadow: '0 4px 20px rgba(0,0,0,0.12)'
        }}>
          {toast.msg}
        </div>
      )}

      <div className="header">
        <div>
          <h2 style={{ fontSize: '22px', fontWeight: 700 }}>Department Master</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
            {loading ? 'Loading...' : `${departments.length} department${departments.length !== 1 ? 's' : ''} total`}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <input
            type="text"
            className="search-bar"
            placeholder="Search departments..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div style={{ marginBottom: '20px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        <button className="btn-primary" style={{ width: 'auto', padding: '10px 22px', margin: 0 }} onClick={openAdd}>
          + Add Department
        </button>
        <button
          onClick={fetchDepartments}
          style={{
            padding: '10px 16px', borderRadius: '8px', border: '1px solid var(--border-color)',
            background: 'transparent', cursor: 'pointer', fontSize: '13px', color: 'var(--text-muted)',
          }}
        >
          ↻ Refresh
        </button>
      </div>

      {showModal && (
        <div style={{
          position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }}>
          <div style={{
            background: 'white', borderRadius: '16px', padding: '32px',
            width: '100%', maxWidth: '400px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
          }}>
            <h3 style={{ marginBottom: '20px', fontSize: '20px', fontWeight: 700 }}>
              {editTarget ? `Edit ${editTarget.name}` : 'Add New Department'}
            </h3>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <input
                className="input-field"
                placeholder="Department Name (e.g. CSE) *"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value.replace(/[^A-Za-z\s]/g, '') }))}
                required
              />
              <input
                className="input-field"
                placeholder="Institute Name (e.g. CSPIT) *"
                value={form.institute_name}
                onChange={e => setForm(f => ({ ...f, institute_name: e.target.value.replace(/[^A-Za-z\s]/g, '') }))}
                required
              />

              <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
                <button type="submit" className="btn-primary" style={{ flex: 1, margin: 0 }} disabled={processing}>
                  {processing ? 'Saving...' : editTarget ? '💾 Save Changes' : '✅ Create'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  style={{ flex: 1, padding: '12px', border: '1px solid var(--border-color)', borderRadius: '8px', background: 'transparent', cursor: 'pointer', fontWeight: 600 }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="table-container">
        {loading ? (
          <p style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Loading departments...</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Department Name</th>
                <th>Institute Name</th>
                <th>Created At</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {departments.map(d => (
                <tr key={d.id}>
                  <td style={{ fontWeight: 600, color: 'var(--primary)' }}>{d.name}</td>
                  <td style={{ fontWeight: 500 }}>{d.institute_name}</td>
                  <td style={{ color: '#64748b' }}>{new Date(d.created_at).toLocaleDateString()}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={() => openEdit(d)}
                        style={{ padding: '6px 14px', borderRadius: '6px', border: 'none', backgroundColor: '#4F46E5', color: 'white', cursor: 'pointer', fontWeight: 600, fontSize: '12px' }}
                      >
                        ✏️ Edit
                      </button>
                      <button
                        onClick={() => handleDelete(d)}
                        style={{ padding: '6px 14px', borderRadius: '6px', border: 'none', backgroundColor: '#ef4444', color: 'white', cursor: 'pointer', fontWeight: 600, fontSize: '12px' }}
                      >
                        🚫 Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && departments.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'center', color: '#94a3b8', padding: '40px' }}>
                    No departments found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
