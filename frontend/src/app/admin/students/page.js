'use client';

import { useState, useEffect, useRef } from 'react';
import LoadingOverlay from '@/components/LoadingOverlay';
import { useAdminAuth } from '@/hooks/useAdminAuth';

// ─── PDF Generator (inline, no jspdf-autotable import issues) ───────────────
async function downloadCredentialsPDF(users) {
  const { default: jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');

  const doc = new jsPDF();
  doc.setFontSize(18);
  doc.setTextColor(90, 106, 252);
  doc.text('CodeRank — Student Credentials', 14, 20);

  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Generated: ${new Date().toLocaleString()}  |  CONFIDENTIAL — delete after distribution`, 14, 28);

  autoTable(doc, {
    startY: 35,
    head: [['Name', 'Email', 'Roll No', 'Department', 'Division', 'Semester', 'Password']],
    body: users.map(u => [
      u.name,
      u.email,
      u.extra_info?.roll_number || '-',
      u.extra_info?.department || '-',
      u.extra_info?.division || '-',
      u.extra_info?.semester || '-',
      u.rawPassword,
    ]),
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 4 },
    headStyles: { fillColor: [90, 106, 252], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [245, 247, 255] },
  });

  doc.save(`CodeRank_Students_${Date.now()}.pdf`);
}

// ─── CSV / Excel parser (pure JS, works for .csv and .xlsx) ─────────────────
async function parseFile(file) {
  const isCsv = file.name.endsWith('.csv');

  if (isCsv) {
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
    // Excel — use XLSX
    const XLSX = await import('xlsx');
    const buffer = await file.arrayBuffer();
    const wb = XLSX.read(buffer, { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    return XLSX.utils.sheet_to_json(ws);
  }
}

// ─── Component ───────────────────────────────────────────────────────────────
export default function StudentManagement() {
  const { token: authToken, isReady } = useAdminAuth();

  const [students, setStudents]       = useState([]);
  const [departmentsList, setDepartmentsList] = useState([]);
  const [loading, setLoading]         = useState(true);
  const [processing, setProcessing]   = useState(false);
  const [search, setSearch]           = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // Show all users by default
  const [divisionFilter, setDivisionFilter] = useState('all');
  const [showModal, setShowModal]     = useState(false);
  const [editTarget, setEditTarget]   = useState(null); // null = create mode
  const [toast, setToast]             = useState(null); // { type: 'success'|'error', msg }
  const fileRef                       = useRef();

  // Form fields
  const [form, setForm] = useState({ firstName: '', lastName: '', roll: '', department: '', semester: '', division: '', password: '' });

  const token = () => authToken;

  const showToast = (type, msg) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 5000);
  };

  const validateDivision = (div) => {
    if (!div || !div.trim()) return 'Division is compulsory.';
    const alphaMatches = div.match(/[a-zA-Z]/g) || [];
    const digitMatches = div.match(/[0-9]/g) || [];
    if (alphaMatches.length < 2) return 'Division must contain at least 2 alphabetic letters (e.g., CE1, IT2).';
    if (digitMatches.length < 1) return 'Division must contain at least 1 numeric digit (e.g., CE1, IT2).';
    return null;
  };

  // ── Fetch ──
  const fetchStudents = async () => {
    setLoading(true);
    try {
      let url = `/api/users?role=student&status=${statusFilter}`;
      if (search) url += `&search=${encodeURIComponent(search)}`;
      if (divisionFilter && divisionFilter !== 'all') url += `&division=${encodeURIComponent(divisionFilter)}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token()}` } });
      if (res.ok) {
        const data = await res.json();
        setStudents(Array.isArray(data) ? data : []);
      } else {
        if (res.status === 401) {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          window.location.href = '/';
          return;
        }
        console.error('Failed to fetch students:', res.status);
        setStudents([]);
      }
    } catch (e) { 
      console.error('Fetch students error:', e); 
      setStudents([]);
    }
    finally { setLoading(false); }
  };

  const fetchDepartments = async () => {
    try {
      const res = await fetch('/api/departments', { headers: { Authorization: `Bearer ${token()}` } });
      if (res.ok) {
        setDepartmentsList(await res.json());
      } else if (res.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/';
      }
    } catch (e) { console.error(e); }
  };

  useEffect(() => { if (isReady) { fetchStudents(); } }, [search, statusFilter, divisionFilter, isReady]);
  useEffect(() => { if (isReady) fetchDepartments(); }, [isReady]);

  // ── Open modal ──
  const openAdd = () => {
    setEditTarget(null);
    setForm({ firstName: '', lastName: '', roll: '', department: '', semester: '', division: '', password: '' });
    setShowModal(true);
  };

  const openEdit = (s) => {
    setEditTarget(s);
    setForm({
      firstName: s.first_name || s.name?.split(' ')[0] || '',
      lastName: s.last_name || s.name?.split(' ').slice(1).join(' ') || '',
      roll: s.extra_info?.roll_number || '',
      department: s.extra_info?.department || '',
      semester: s.extra_info?.semester || '',
      division: s.extra_info?.division || '',
      password: '',
    });
    setShowModal(true);
  };

  // ── Submit form ──
  const handleSubmit = async (e) => {
    e.preventDefault();

    const divErr = validateDivision(form.division);
    if (divErr) {
      showToast('error', divErr);
      return;
    }

    setProcessing(true);
    try {
      const email = form.roll ? `${form.roll.toLowerCase()}@charusat.edu.in` : '';
      const cleanDivision = form.division.trim().toUpperCase();

      if (editTarget) {
        // ── EDIT ──
        const res = await fetch(`/api/users/${editTarget.id}`, {
          method: 'PUT',
          headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            first_name: form.firstName,
            last_name: form.lastName,
            email: email,
            role: 'student',
            status: editTarget.status,
            extra_info: { roll_number: form.roll, department: form.department, semester: form.semester, division: cleanDivision },
            password: form.password || undefined,
          }),
        });
        const data = await res.json();
        if (!res.ok) { showToast('error', data.error || 'Update failed'); return; }

        // Live update in table with the returned user data
        setStudents(prev => prev.map(s =>
          s.id === editTarget.id ? data.user : s
        ));
        showToast('success', `${form.firstName} updated successfully`);
        setShowModal(false);

      } else {
        // ── CREATE ──
        const res = await fetch('/api/users', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            first_name: form.firstName,
            last_name: form.lastName,
            email: email,
            role: 'student',
            extra_info: { roll_number: form.roll, department: form.department, semester: form.semester, division: cleanDivision },
          }),
        });
        const data = await res.json();
        if (!res.ok) { showToast('error', data.error || 'Create failed'); return; }

        // Live update in table with the returned user data
        const newStudent = {
          ...data.user,
          status: 'active',
        };
        setStudents(prev => [newStudent, ...prev]);

        // Download single credential PDF
        await downloadCredentialsPDF([{ ...newStudent, rawPassword: data.rawPassword }]);
        showToast('success', `${form.firstName} created! Password PDF downloaded.`);
        setShowModal(false);
      }
    } catch (err) {
      showToast('error', 'Network error — please try again');
    } finally {
      setProcessing(false);
      setForm({ firstName: '', lastName: '', roll: '', department: '', semester: '', division: '', password: '' });
    }
  };

  // ── Delete (Deactivate) ──
  const handleDelete = async (s) => {
    if (!confirm(`Deactivate ${s.name}? This will mark the account as inactive.`)) return;
    setProcessing(true);
    try {
      const res = await fetch(`/api/users/${s.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token()}` },
      });
      const data = await res.json();
      if (!res.ok) { showToast('error', data.error || 'Deactivation failed'); return; }
      
      // Update the student status in the list (keep in same list, just change status)
      setStudents(prev => prev.map(student => 
        student.id === s.id ? { ...student, status: 'inactive' } : student
      ));
      showToast('success', `${s.name} deactivated and moved to inactive status`);
    } catch (e) {
      showToast('error', 'Network error');
    } finally { setProcessing(false); }
  };

  // ── Reactivate ──
  const handleReactivate = async (s) => {
    if (!confirm(`Reactivate ${s.name}? This will restore the account.`)) return;
    setProcessing(true);
    try {
      const res = await fetch(`/api/users/${s.id}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'active' }),
      });
      const data = await res.json();
      if (!res.ok) { showToast('error', data.error || 'Reactivation failed'); return; }
      
      // Update the student status in the list (keep in same list, just change status)
      setStudents(prev => prev.map(student => 
        student.id === s.id ? data.user : student
      ));
      showToast('success', `${s.name} reactivated and moved to active status`);
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
      formData.append('role', 'student');

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

      // Add newly created students to the list
      if (created.length > 0) {
        const newStudents = created.map(u => ({ ...u, status: 'active' }));
        setStudents(prev => [...newStudents, ...prev]);
      }

      // Update existing students in the list
      if (updated.length > 0) {
        setStudents(prev => prev.map(s => {
          const match = updated.find(u => u.id === s.id);
          return match ? { ...match, status: 'active' } : s;
        }));
      }

      // Download PDF only for newly created users (they have new passwords)
      if (created.length > 0) {
        await downloadCredentialsPDF(created);
      }

      // Build summary message
      const parts = [];
      if (created.length > 0) parts.push(`${created.length} created`);
      if (updated.length > 0) parts.push(`${updated.length} updated`);
      if (skippedCount > 0)  parts.push(`${skippedCount} skipped`);
      if (errors.length > 0)  parts.push(`${errors.length} failed`);

      const totalProcessed = (summary.total || 0);
      const msg = `${totalProcessed} rows processed: ${parts.join(', ')}.${created.length > 0 ? ' PDF downloaded!' : ''}`;

      // Show detailed skipped users in console and alert
      if (skipped.length > 0) {
        console.group('⚠️ Skipped Users Details:');
        skipped.forEach((skip, idx) => {
          console.log(`${idx + 1}. ${skip.name} (${skip.email})`);
          console.log(`   Reason: ${skip.reason}`);
        });
        console.groupEnd();

        // Show detailed modal with skipped users
        const skippedDetails = skipped.map((s, i) => 
          `${i + 1}. ${s.name} (${s.email})\n   → ${s.reason}`
        ).join('\n\n');
        
        alert(`⚠️ ${skippedCount} user(s) were skipped:\n\n${skippedDetails}\n\nCheck console for full details.`);
      }

      if (errors.length > 0 && created.length === 0 && updated.length === 0) {
        showToast('error', `Upload failed for all rows. Check your file format.`);
      } else {
        showToast('success', msg);
      }

      // Log any errors to console for debugging
      if (errors.length > 0) {
        console.warn('Bulk upload errors:', errors);
      }

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
          {toast.type === 'success' ? '✅ ' : '❌ '}{toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="header">
        <div>
          <h2 style={{ fontSize: '22px', fontWeight: 700 }}>Student Master</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
            {loading ? 'Loading...' : `${students.length} student${students.length !== 1 ? 's' : ''} total`}
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
            <option value="all">All Students</option>
            <option value="active">Active Only</option>
            <option value="inactive">Inactive Only</option>
          </select>
          <select
            value={divisionFilter}
            onChange={e => setDivisionFilter(e.target.value)}
            style={{
              padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)',
              backgroundColor: 'white', fontSize: '14px', minWidth: '130px'
            }}
          >
            <option value="all">All Divisions</option>
            {Array.from(new Set(students.map(s => s.extra_info?.division).filter(Boolean))).sort().map(d => (
              <option key={d} value={d}>Div: {d}</option>
            ))}
          </select>
          <input
            type="text"
            className="search-bar"
            placeholder="Search name, email, roll, division..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Action buttons */}
      <div style={{ marginBottom: '20px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        <button className="btn-primary" style={{ width: 'auto', padding: '10px 22px', margin: 0 }} onClick={openAdd}>
          + Add Student
        </button>

        <label style={{
          display: 'inline-flex', alignItems: 'center', gap: '8px',
          padding: '10px 22px', borderRadius: '8px', cursor: 'pointer',
          backgroundColor: '#10b981', color: 'white', fontWeight: 600, fontSize: '14px',
        }}>
          ⬆ Bulk Upload (Excel/CSV)
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }} onChange={handleBulkUpload} />
        </label>

        <button
          style={{
            padding: '10px 16px', borderRadius: '8px', border: '1px solid var(--border-color)',
            background: 'transparent', cursor: 'pointer', fontSize: '13px', color: 'var(--text-muted)',
          }}
          onClick={fetchStudents}
        >
          ↻ Refresh
        </button>
      </div>

      {/* Hint */}
      <p style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '16px' }}>
        Bulk Upload expects columns: <strong>Name, RollNumber, Department, Semester, Division</strong>. Emails and Passwords are auto-generated and included in the downloaded PDF.
      </p>

      {/* Modal */}
      {showModal && (
        <div style={{
          position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }}>
          <div style={{
            background: 'white', borderRadius: '16px', padding: '32px',
            width: '100%', maxWidth: '560px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
          }}>
            <h3 style={{ marginBottom: '20px', fontSize: '20px', fontWeight: 700 }}>
              {editTarget ? `Edit ${editTarget.name}` : 'Add New Student'}
            </h3>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
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
              <div style={{ display: 'flex', gap: '10px' }}>
                <input
                  className="input-field"
                  placeholder="Roll Number (e.g. 25ce097 or D25ce097) *"
                  value={form.roll}
                  onChange={e => setForm(f => ({ ...f, roll: e.target.value }))}
                  pattern="^[dD]?\d+[a-zA-Z]{2,3}\d+$"
                  title="Roll number must start with D (optional) or digits, followed by 2-3 letters, and end with digits (e.g. 25ce097 or D25ce097)"
                  required
                  style={{ flex: 1.2 }}
                />
                <input
                  className="input-field"
                  placeholder="Division (e.g. CE1, IT2) *"
                  value={form.division}
                  onChange={e => setForm(f => ({ ...f, division: e.target.value.toUpperCase() }))}
                  title="Division must contain at least 2 letters and at least 1 digit (e.g., CE1, IT2)"
                  required
                  style={{ flex: 1 }}
                />
                <select
                  className="input-field"
                  value={form.semester}
                  onChange={e => setForm(f => ({ ...f, semester: e.target.value }))}
                  required
                  style={{ flex: 0.9 }}
                >
                  <option value="" disabled>Select Semester *</option>
                  {[1, 2, 3, 4, 5, 6, 7, 8].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <select
                  className="input-field"
                  value={form.department}
                  onChange={e => setForm(f => ({ ...f, department: e.target.value }))}
                  required
                  style={{ flex: 1.2 }}
                >
                  <option value="" disabled>Select Department *</option>
                  {departmentsList.map(d => (
                    <option key={d.id} value={d.name}>{d.name} ({d.institute_name})</option>
                  ))}
                </select>
              </div>
              <p style={{ fontSize: '11.5px', color: '#64748b', margin: '-4px 0 4px 2px' }}>
                ℹ️ <strong>Division is compulsory:</strong> must contain at least 2 alphabets and at least 1 digit (e.g., <strong>CE1</strong>, <strong>IT2</strong>, <strong>CSE1</strong>).
              </p>
              
              <div style={{ display: 'flex', alignItems: 'center', border: '1px solid var(--border-color)', borderRadius: '6px', overflow: 'hidden' }}>
                <input
                  className="input-field"
                  placeholder="Email"
                  value={form.roll ? form.roll.toLowerCase() : ''}
                  disabled
                  style={{ flex: 1, border: 'none', borderRadius: 0, opacity: 0.7, cursor: 'not-allowed', backgroundColor: '#f8fafc' }}
                />
                <span style={{ padding: '0 15px', backgroundColor: '#f1f5f9', color: '#64748b', fontSize: '14px', borderLeft: '1px solid var(--border-color)', height: '100%', display: 'flex', alignItems: 'center', minHeight: '44px' }}>
                  @charusat.edu.in
                </span>
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
                  {processing ? 'Saving...' : editTarget ? '💾 Save Changes' : '✅ Create Student'}
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
          <p style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Loading students...</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Roll No</th>
                <th>Name</th>
                <th>Email</th>
                <th>Branch</th>
                <th>Division</th>
                <th>Semester</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {students.map(s => {
                const info = s.extra_info || {};
                return (
                  <tr key={s.id}>
                    <td style={{ fontWeight: 600, color: 'var(--primary)' }}>{info.roll_number || '—'}</td>
                    <td style={{ fontWeight: 500 }}>{s.name}</td>
                    <td style={{ color: '#64748b' }}>{s.email}</td>
                    <td>{info.department || '—'}</td>
                    <td>
                      <span style={{ fontSize: '12px', fontWeight: 600, backgroundColor: '#eff6ff', color: '#1d4ed8', padding: '2px 8px', borderRadius: '4px' }}>
                        {info.division || '—'}
                      </span>
                    </td>
                    <td>{info.semester || '—'}</td>
                    <td>
                      <span style={{
                        padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 600,
                        backgroundColor: s.status === 'active' ? '#ecfdf5' : '#fef2f2',
                        color: s.status === 'active' ? '#065f46' : '#991b1b',
                      }}>
                        {s.status.toUpperCase()}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          onClick={() => openEdit(s)}
                          style={{ padding: '6px 14px', borderRadius: '6px', border: 'none', backgroundColor: '#4F46E5', color: 'white', cursor: 'pointer', fontWeight: 600, fontSize: '12px' }}
                        >
                          ✏️ Edit
                        </button>
                        {s.status === 'active' ? (
                          <button
                            onClick={() => handleDelete(s)}
                            style={{ padding: '6px 14px', borderRadius: '6px', border: 'none', backgroundColor: '#1F2937', color: 'white', cursor: 'pointer', fontWeight: 600, fontSize: '12px' }}
                          >
                            🚫 Deactivate
                          </button>
                        ) : (
                          <button
                            onClick={() => handleReactivate(s)}
                            style={{ padding: '6px 14px', borderRadius: '6px', border: 'none', backgroundColor: '#06B6D4', color: 'white', cursor: 'pointer', fontWeight: 600, fontSize: '12px' }}
                          >
                            ✅ Reactivate
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!loading && students.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', color: '#94a3b8', padding: '40px' }}>
                    No students found for the selected filter.
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
