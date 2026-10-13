'use client';

import { useState, useEffect } from 'react';
import LoadingOverlay from '@/components/LoadingOverlay';
import { useAdminAuth } from '@/hooks/useAdminAuth';

export default function CoursesManagement() {
  const [courses, setCourses] = useState([]);
  const [faculties, setFaculties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  // Form State
  const [showAddModal, setShowAddModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [newCourseCode, setNewCourseCode] = useState('');
  const [newCourseName, setNewCourseName] = useState('');
  const [newCourseSem, setNewCourseSem] = useState('');

  const { token: authToken, isReady } = useAdminAuth();

  useEffect(() => {
    if (isReady) fetchCourses();
  }, [search, isReady]);

  const fetchCourses = async () => {
    setLoading(true);
    try {
      const token = authToken;
      const url = search ? `/api/courses?search=${search}` : '/api/courses';
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) setCourses(await res.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // Auto-refresh courses list every 15s (pauses while modal is open)
  // usePolling removed — use the Refresh button below instead



  const handleAddOrEditCourse = async (e) => {
    e.preventDefault();
    setProcessing(true);
    try {
      const token = localStorage.getItem('token');
      const payload = { 
        course_code: newCourseCode,
        name: newCourseName, 
        semester: parseInt(newCourseSem)
      };

      if (editId) {
        const res = await fetch(`/api/courses/${editId}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });
        if (res.ok) {
           setCourses(prev => prev.map(c => c.id === editId ? { ...c, ...payload } : c));
           resetForm();
        }
      } else {
        const res = await fetch('/api/courses', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });

        if (res.ok) {
          const newCourse = await res.json();
          setCourses(prev => [newCourse, ...prev]);
          resetForm();
        }
      }
    } catch (err) {
      alert('Error saving course');
    } finally {
      setProcessing(false);
    }
  };

  const deleteCourse = async (id) => {
    if (!confirm('Are you sure you want to delete this course permanently?')) return;
    setProcessing(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/courses/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setCourses(prev => prev.filter(c => c.id !== id));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setProcessing(false);
    }
  };

  const handleEditClick = (c) => {
    setEditId(c.id);
    setNewCourseCode(c.course_code || '');
    setNewCourseName(c.name || '');
    setNewCourseSem(c.semester || '');
    setShowAddModal(true);
  };

  const resetForm = () => {
    setEditId(null);
    setNewCourseCode('');
    setNewCourseName('');
    setNewCourseSem('');
    setShowAddModal(false);
  };

  return (
    <div>
      {processing && <LoadingOverlay />}
      <div className="header">
        <h2>Courses Management</h2>
        <input 
          type="text" 
          className="search-bar" 
          placeholder="Search courses..." 
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div style={{ marginBottom: '20px', display: 'flex', gap: '12px' }}>
        <button className="btn-primary" style={{ width: 'auto', padding: '10px 20px', margin: 0 }} onClick={() => {
            if (showAddModal) resetForm();
            else setShowAddModal(true);
        }}>
          {showAddModal ? 'Cancel' : '+ Add New Course'}
        </button>
        <button
          className="btn-small"
          style={{
            padding: '10px 16px', borderRadius: '8px', border: '1px solid var(--border-color)',
            background: 'transparent', cursor: refreshing ? 'not-allowed' : 'pointer',
            fontSize: '13px', color: 'var(--text-muted)', opacity: refreshing ? 0.6 : 1,
          }}
          onClick={async () => {
            if (refreshing) return;
            setRefreshing(true);
            try { await fetchCourses(); } finally { setRefreshing(false); }
          }}
          disabled={refreshing}
        >
          {refreshing ? '↻ Refreshing...' : '↻ Refresh'}
        </button>
      </div>

      {showAddModal && (
        <div className="table-container" style={{ marginBottom: '20px' }}>
          <h3>{editId ? 'Edit Course' : 'Add New Course'}</h3>
          <form onSubmit={handleAddOrEditCourse} style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '15px', maxWidth: '500px' }}>
            <input type="text" className="input-field" placeholder="Course Code (e.g. CE101)" value={newCourseCode} onChange={e => setNewCourseCode(e.target.value)} required />
            <input type="text" className="input-field" placeholder="Course Name" value={newCourseName} onChange={e => setNewCourseName(e.target.value)} required />
            <select className="input-field" value={newCourseSem} onChange={e => setNewCourseSem(e.target.value)} required>
              <option value="" disabled>Select Semester *</option>
              {[1, 2, 3, 4, 5, 6, 7, 8].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <button type="submit" className="btn-primary" style={{ margin: 0 }}>
                {editId ? 'Save Changes' : 'Create Course'}
            </button>
          </form>
        </div>
      )}

      <div className="table-container">
        {loading ? <p>Loading courses...</p> : (
          <table>
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Semester</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {courses.map(c => (
                <tr key={c.id}>
                  <td style={{ fontWeight: 600, color: 'var(--primary)' }}>{c.course_code}</td>
                  <td style={{ fontWeight: 600 }}>{c.name}</td>
                  <td>{c.semester}</td>
                  <td>
                    <span className={`status-badge ${c.status === 'ongoing' ? 'status-active' : 'status-inactive'}`}>
                      {c.status.toUpperCase()}
                    </span>
                  </td>
                  <td>
                      <div className="btn-actions">
                        <button className="btn-small" style={{ backgroundColor: '#f59e0b', color: 'white' }} onClick={() => handleEditClick(c)}>
                          Edit
                        </button>
                        <button className="btn-small" style={{ backgroundColor: '#ef4444', color: 'white' }} onClick={() => deleteCourse(c.id)}>
                          Delete
                        </button>
                      </div>
                  </td>
                </tr>
              ))}
              {!loading && courses.length === 0 && (
                <tr><td colSpan="5" style={{ textAlign: 'center', color: '#888' }}>No courses found.</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
