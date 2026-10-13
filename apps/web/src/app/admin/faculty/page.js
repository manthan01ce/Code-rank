'use client';

import { useState, useEffect, useRef } from 'react';
import LoadingOverlay from '@/components/LoadingOverlay';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { useSocket } from '@/hooks/useSocket';
import RefreshButton from '@/components/RefreshButton';

// ─── PDF Generator ────────────────────────────────────────────────────────────
async function downloadCredentialsPDF(users) {
  const { default: jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');

  const doc = new jsPDF();
  doc.setFontSize(18);
  doc.setTextColor(90, 106, 252);
  doc.text('CodeRank — Faculty Credentials', 14, 20);

  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Generated: ${new Date().toLocaleString()}  |  CONFIDENTIAL — delete after distribution`, 14, 28);

  autoTable(doc, {
    startY: 35,
    head: [['Name', 'Email', 'Department', 'Designation', 'Password']],
    body: users.map(u => [
      u.name,
      u.email,
      u.extra_info?.department || '-',
      u.extra_info?.designation || '-',
      u.rawPassword,
    ]),
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 4 },
    headStyles: { fillColor: [90, 106, 252], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [245, 247, 255] },
  });

  doc.save(`CodeRank_Faculty_${Date.now()}.pdf`);
}

// ─── File parser ──────────────────────────────────────────────────────────────
async function parseFile(file) {
  if (file.name.endsWith('.csv')) {
    const text = await file.text();
    const lines = text.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    return lines.slice(1).map(line => {
      const cols = line.split(',').map(c => c.trim().replace(/^"|"$/g, ''));
      const obj = {};
      headers.forEach((h, i) => { obj[h] = cols[i] || ''; });
      return obj;
    }).filter(r => r.Name || r.name);
  } else {
    // Excel files: client-side parsing removed (xlsx had critical CVEs, no safe browser alternative).
    // The file is uploaded directly to the server API which parses it with ExcelJS.
    // Return null to signal the upload handler to skip preview and go straight to upload.
    return null;
  }
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function FacultyManagement() {
  const { token: authToken, isReady } = useAdminAuth();
  const socket = useSocket();

  const [faculty, setFaculty]         = useState([]);
  const [departmentsList, setDepartmentsList] = useState([]);
  const [loading, setLoading]         = useState(true);
  const [processing, setProcessing]   = useState(false);
  const [search, setSearch]           = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // Show all users by default
  const [showModal, setShowModal]     = useState(false);
  const [editTarget, setEditTarget]   = useState(null);
  const [toast, setToast]             = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const fileRef                       = useRef();

  const [form, setForm] = useState({ facultyId: '', firstName: '', lastName: '', emailPrefix: '', department: '', designation: '', password: '' });

  const token = () => authToken;

  const showToast = (type, msg) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 5000);
  };

  // ── Fetch ──
  const fetchFaculty = async () => {
    setLoading(true);
    try {
      let url = `/api/users?role=faculty&status=${statusFilter}`;
      if (search) url += `&search=${encodeURIComponent(search)}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token()}` } });
      if (res.ok) {
        const data = await res.json();
        setFaculty(Array.isArray(data) ? data : []);
        setLastUpdated(new Date());
      } else {
        console.error('Failed to fetch faculty:', res.status);
        setFaculty([]);
      }
    } catch (e) { 
      console.error('Fetch faculty error:', e); 
      setFaculty([]);
    }
    finally { setLoading(false); }
  };

  // Real-time WebSocket synchronization for faculty master
  useEffect(() => {
    if (!socket) return;
    socket.emit('join_admin_room');

    const handleFacultyUpdate = () => {
      fetchFaculty();
    };

    socket.on('user_created', handleFacultyUpdate);
    socket.on('user_updated', handleFacultyUpdate);
    socket.on('user_deleted', handleFacultyUpdate);
    socket.on('admin_stats_changed', handleFacultyUpdate);

    return () => {
      socket.off('user_created', handleFacultyUpdate);
      socket.off('user_updated', handleFacultyUpdate);
      socket.off('user_deleted', handleFacultyUpdate);
      socket.off('admin_stats_changed', handleFacultyUpdate);
    };
  }, [socket]);

  const fetchDepartments = async () => {
    try {
      const res = await fetch('/api/departments', { headers: { Authorization: `Bearer ${token()}` } });
      if (res.ok) {
        setDepartmentsList(await res.json());
      }
    } catch (e) { console.error(e); }
  };

  useEffect(() => { if (isReady) { fetchFaculty(); } }, [search, statusFilter, isReady]);
  useEffect(() => { if (isReady) fetchDepartments(); }, [isReady]);

  // ── Open modal ──
  const openAdd = () => {
    setEditTarget(null);
    setForm({ facultyId: '', firstName: '', lastName: '', emailPrefix: '', department: '', designation: '', password: '' });
    setShowModal(true);
  };

  const openEdit = (f) => {
    setEditTarget(f);
    setForm({
      facultyId: f.extra_info?.facultyId || '',
      firstName: f.first_name || f.name?.split(' ')[0] || '',
      lastName: f.last_name || f.name?.split(' ').slice(1).join(' ') || '',
      emailPrefix: f.email ? f.email.split('@')[0] : '',
      department: f.extra_info?.department || '',
      designation: f.extra_info?.designation || '',
      password: '',
    });
    setShowModal(true);
  };

  // ── Submit ──
  const handleSubmit = async (e) => {
    e.preventDefault();
    setProcessing(true);
    try {
      const email = `${form.emailPrefix}@charusat.ac.in`;
      if (editTarget) {
        // EDIT
        const res = await fetch(`/api/users/${editTarget.id}`, {
          method: 'PUT',
          headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            first_name: form.firstName,
            last_name: form.lastName,
            email: email,
            role: 'faculty',
            status: editTarget.status,
            extra_info: { facultyId: form.facultyId, department: form.department, designation: form.designation },
            password: form.password || undefined,
          }),
        });
        const data = await res.json();
        if (!res.ok) { showToast('error', data.error || 'Update failed'); return; }

        // Live update with returned user data
        setFaculty(prev => prev.map(f =>
          f.id === editTarget.id ? data.user : f
        ));
        showToast('success', `${form.firstName} updated successfully`);
        setShowModal(false);

      } else {
        // CREATE
        const res = await fetch('/api/users', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            first_name: form.firstName,
            last_name: form.lastName,
            email: email,
            role: 'faculty',
            extra_info: { facultyId: form.facultyId, department: form.department, designation: form.designation },
          }),
        });
        const data = await res.json();
        if (!res.ok) { showToast('error', data.error || 'Create failed'); return; }

        // Live update with returned user data
        const newFaculty = {
          ...data.user,
          status: 'active',
        };
        setFaculty(prev => [newFaculty, ...prev]);
        await downloadCredentialsPDF([{ ...newFaculty, rawPassword: data.rawPassword }]);
        showToast('success', `${form.firstName} created! PDF downloaded.`);
        setShowModal(false);
      }
    } catch (err) {
      showToast('error', 'Network error — please try again');
    } finally {
      setProcessing(false);
      setForm({ facultyId: '', firstName: '', lastName: '', emailPrefix: '', department: '', designation: '' });
    }
  };

  // ── Delete (Deactivate) ──
  const handleDelete = async (f) => {
    if (!confirm(`Deactivate ${f.name}? This will mark the account as inactive.`)) return;
    setProcessing(true);
    try {
      const res = await fetch(`/api/users/${f.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token()}` },
      });
      const data = await res.json();
      if (!res.ok) { showToast('error', data.error || 'Deactivation failed'); return; }
      
      // Update the faculty status in the list (keep in same list, just change status)
      setFaculty(prev => prev.map(faculty => 
        faculty.id === f.id ? { ...faculty, status: 'inactive' } : faculty
      ));
      showToast('success', `${f.name} deactivated and moved to inactive status`);
    } catch (e) {
      showToast('error', 'Network error');
    } finally { setProcessing(false); }
  };

  // ── Reactivate ──
  const handleReactivate = async (f) => {
    if (!confirm(`Reactivate ${f.name}? This will restore the account.`)) return;
    setProcessing(true);
    try {
      const res = await fetch(`/api/users/${f.id}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'active' }),
      });
      const data = await res.json();
      if (!res.ok) { showToast('error', data.error || 'Reactivation failed'); return; }
      
      // Update the faculty status in the list (keep in same list, just change status)
      setFaculty(prev => prev.map(faculty => 
        faculty.id === f.id ? data.user : faculty
      ));
      showToast('success', `${f.name} reactivated and moved to active status`);
    } catch (e) {
      showToast('error', 'Network error');
    } finally { setProcessing(false); }
  };

  // ── Bulk Upload ──
  const handleBulkUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = null;
    setProcessing(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('role', 'faculty');

      const res = await fetch('/api/users/bulk', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token()}` },
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        showToast('error', `Bulk upload failed: ${data.error || 'Unknown error'}`);
        return;
      }

      const { created = [], updated = [], errors = [], summary = {}, skipped = [], skippedCount = 0 } = data;

      if (created.length > 0) {
        const newFaculty = created.map(u => ({ ...u, status: 'active' }));
        setFaculty(prev => [...newFaculty, ...prev]);
      }

      if (updated.length > 0) {
        setFaculty(prev => prev.map(f => {
          const match = updated.find(u => u.id === f.id);
          return match ? { ...match, status: 'active' } : f;
        }));
      }

      if (created.length > 0) {
        await downloadCredentialsPDF(created);
      }

      const parts = [];
      if (created.length > 0) parts.push(`${created.length} created`);
      if (updated.length > 0) parts.push(`${updated.length} updated`);
      if (skippedCount > 0)  parts.push(`${skippedCount} skipped`);
      if (errors.length > 0)  parts.push(`${errors.length} failed`);

      const msg = `${summary.total || 0} rows processed: ${parts.join(', ')}.${created.length > 0 ? ' PDF downloaded!' : ''}`;

      // Show detailed skipped users in console and alert
      if (skipped.length > 0) {
        console.group(' Skipped Users Details:');
        skipped.forEach((skip, idx) => {
          console.log(`${idx + 1}. ${skip.name} (${skip.email})`);
          console.log(`   Reason: ${skip.reason}`);
        });
        console.groupEnd();

        // Show detailed modal with skipped users
        const skippedDetails = skipped.map((s, i) => 
          `${i + 1}. ${s.name} (${s.email})\n   → ${s.reason}`
        ).join('\n\n');
        
        alert(` ${skippedCount} user(s) were skipped:\n\n${skippedDetails}\n\nCheck console for full details.`);
      }

      if (errors.length > 0 && created.length === 0 && updated.length === 0) {
        showToast('error', `Upload failed for all rows. Check your file format.`);
      } else {
        showToast('success', msg);
      }

      if (errors.length > 0) console.warn('Bulk upload errors:', errors);

    } catch (err) {
      console.error(err);
      showToast('error', 'Error processing bulk upload — ' + err.message);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div style={{ position: 'relative' }}>
      {processing && <LoadingOverlay />}

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: '20px', right: '20px', zIndex: 9999,
          padding: '14px 20px', borderRadius: '10px', fontWeight: 600, fontSize: '14px',
          backgroundColor: toast.type === 'success' ? '#ecfdf5' : '#fef2f2',
          color: toast.type === 'success' ? '#065f46' : '#991b1b',
          border: `1px solid ${toast.type === 'success' ? '#6ee7b7' : '#fca5a5'}`,
          boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
          maxWidth: '360px',
        }}>
          {toast.type === 'success' ? ' ' : ' '}{toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="header">
        <div>
          <h2 style={{ fontSize: '22px', fontWeight: 700 }}>Faculty Master</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
            {loading ? 'Loading...' : `${faculty.length} faculty member${faculty.length !== 1 ? 's' : ''} total`}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            style={{
              padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)',
              backgroundColor: 'white', fontSize: '14px', minWidth: '120px'
            }}
          >
            <option value="all">All Faculty</option>
            <option value="active">Active Only</option>
            <option value="inactive">Inactive Only</option>
          </select>
          <input
            type="text"
            className="search-bar"
            placeholder="Search name or email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Actions */}
      <div style={{ marginBottom: '20px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        <button className="btn-primary" style={{ width: 'auto', padding: '10px 22px', margin: 0 }} onClick={openAdd}>
          + Add Faculty Member
        </button>

        <label style={{
          display: 'inline-flex', alignItems: 'center', gap: '8px',
          padding: '10px 22px', borderRadius: '8px', cursor: 'pointer',
          backgroundColor: '#10b981', color: 'white', fontWeight: 600, fontSize: '14px',
        }}>
          ⬆ Bulk Upload (Excel/CSV)
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }} onChange={handleBulkUpload} />
        </label>

        <RefreshButton
          onRefresh={fetchFaculty}
          lastUpdated={lastUpdated}
          label="Refresh"
          variant="default"
        />
      </div>

      <p style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '16px' }}>
        Bulk Upload expects columns: <strong>Name, Email, Department, Designation</strong>. Passwords are auto-generated and included in the downloaded PDF.
      </p>

      {/* Modal */}
      {showModal && (
        <div style={{
          position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }}>
          <div style={{
            background: 'white', borderRadius: '16px', padding: '32px',
            width: '100%', maxWidth: '500px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
          }}>
            <h3 style={{ marginBottom: '20px', fontSize: '20px', fontWeight: 700 }}>
              {editTarget ? `Edit ${editTarget.name}` : 'Add New Faculty Member'}
            </h3>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <input
                className="input-field"
                type="number"
                placeholder="Faculty ID (Max 5 digits) *"
                value={form.facultyId}
                onChange={e => e.target.value.length <= 5 && setForm(f => ({ ...f, facultyId: e.target.value }))}
                required
              />
              <div style={{ display: 'flex', gap: '10px' }}>
                <input
                  className="input-field"
                  placeholder="First Name *"
                  value={form.firstName}
                  onChange={e => setForm(f => ({ ...f, firstName: e.target.value.replace(/[^A-Za-z\s]/g, '') }))}
                  required
                  style={{ flex: 1 }}
                />
                <input
                  className="input-field"
                  placeholder="Last Name *"
                  value={form.lastName}
                  onChange={e => setForm(f => ({ ...f, lastName: e.target.value.replace(/[^A-Za-z\s]/g, '') }))}
                  required
                  style={{ flex: 1 }}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', border: '1px solid var(--border-color)', borderRadius: '6px', overflow: 'hidden' }}>
                <input
                  className="input-field"
                  placeholder="Email Prefix *"
                  value={form.emailPrefix}
                  onChange={e => setForm(f => ({ ...f, emailPrefix: e.target.value.replace(/[^a-zA-Z0-9.\-_]/g, '') }))}
                  required
                  disabled={!!editTarget}
                  style={{ flex: 1, border: 'none', borderRadius: 0, ...(editTarget ? { opacity: 0.5, cursor: 'not-allowed', backgroundColor: '#f8fafc' } : {}) }}
                />
                <span style={{ padding: '0 15px', backgroundColor: '#f1f5f9', color: '#64748b', fontSize: '14px', borderLeft: '1px solid var(--border-color)', height: '100%', display: 'flex', alignItems: 'center', minHeight: '44px' }}>
                  @charusat.ac.in
                </span>
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <select
                  className="input-field"
                  value={form.department}
                  onChange={e => setForm(f => ({ ...f, department: e.target.value }))}
                  required
                  style={{ flex: 1 }}
                >
                  <option value="" disabled>Select Department *</option>
                  {departmentsList.map(d => (
                    <option key={d.id} value={d.name}>{d.name} ({d.institute_name})</option>
                  ))}
                </select>
                <input
                  className="input-field"
                  placeholder="Designation (Optional)"
                  value={form.designation}
                  onChange={e => setForm(f => ({ ...f, designation: e.target.value }))}
                  style={{ flex: 1 }}
                />
              </div>

              {editTarget && (
                <input
                  type="password"
                  className="input-field"
                  placeholder="New Password (leave blank to keep unchanged)"
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                />
              )}

              {!editTarget && (
                <p style={{ fontSize: '12px', color: '#64748b', background: '#f8fafc', padding: '10px', borderRadius: '8px' }}>
                  🔐 A secure password will be auto-generated and a PDF will be downloaded immediately.
                </p>
              )}

              <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                <button type="submit" className="btn-primary" style={{ flex: 1, margin: 0 }} disabled={processing}>
                  {processing ? 'Saving...' : editTarget ? '💾 Save Changes' : ' Create Faculty'}
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

      {/* Table */}
      <div className="table-container">
        {loading ? (
          <p style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Loading faculty...</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Faculty ID</th>
                <th>Name</th>
                <th>Email</th>
                <th>Department</th>
                <th>Designation</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {faculty.map(f => {
                const info = f.extra_info || {};
                return (
                  <tr key={f.id}>
                    <td style={{ fontWeight: 600, color: 'var(--primary)' }}>{info.facultyId || '—'}</td>
                    <td style={{ fontWeight: 500 }}>{f.name}</td>
                    <td style={{ color: '#64748b' }}>{f.email}</td>
                    <td>{info.department || '—'}</td>
                    <td>
                      <span style={{
                        padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 600,
                        backgroundColor: '#eff6ff', color: '#2563eb',
                      }}>
                        {info.designation || '—'}
                      </span>
                    </td>
                    <td>
                      <span style={{
                        padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 600,
                        backgroundColor: f.status === 'active' ? '#ecfdf5' : '#fef2f2',
                        color: f.status === 'active' ? '#065f46' : '#991b1b',
                      }}>
                        {f.status.toUpperCase()}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          onClick={() => openEdit(f)}
                          style={{ padding: '6px 14px', borderRadius: '6px', border: 'none', backgroundColor: '#4F46E5', color: 'white', cursor: 'pointer', fontWeight: 600, fontSize: '12px' }}
                        >
                          ✏️ Edit
                        </button>
                        {f.status === 'active' ? (
                          <button
                            onClick={() => handleDelete(f)}
                            style={{ padding: '6px 14px', borderRadius: '6px', border: 'none', backgroundColor: '#1F2937', color: 'white', cursor: 'pointer', fontWeight: 600, fontSize: '12px' }}
                          >
                            🚫 Deactivate
                          </button>
                        ) : (
                          <button
                            onClick={() => handleReactivate(f)}
                            style={{ padding: '6px 14px', borderRadius: '6px', border: 'none', backgroundColor: '#06B6D4', color: 'white', cursor: 'pointer', fontWeight: 600, fontSize: '12px' }}
                          >
                             Reactivate
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!loading && faculty.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', color: '#94a3b8', padding: '40px' }}>
                    No faculty members found for the selected filter.
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
