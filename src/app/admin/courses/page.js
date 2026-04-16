'use client';

import { useState, useEffect } from 'react';
import LoadingOverlay from '@/components/LoadingOverlay';

export default function CoursesManagement() {
  const [courses, setCourses] = useState([]);
  const [faculties, setFaculties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [search, setSearch] = useState('');

  // Form State
  const [showAddModal, setShowAddModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [newCourseName, setNewCourseName] = useState('');
  const [newCourseDesc, setNewCourseDesc] = useState('');
  const [newCourseFaculty, setNewCourseFaculty] = useState('');

  useEffect(() => {
    fetchCourses();
    fetchFaculties();
  }, [search]);

  const fetchCourses = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
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

  const fetchFaculties = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/users?role=faculty', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) setFaculties(await res.json());
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddOrEditCourse = async (e) => {
    e.preventDefault();
    setProcessing(true);
    try {
      const token = localStorage.getItem('token');
      const payload = { 
        name: newCourseName, 
        description: newCourseDesc, 
        assigned_faculty: newCourseFaculty || null 
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
           const faculty = faculties.find(f => f.id == newCourseFaculty);
           setCourses(prev => prev.map(c => c.id === editId ? { ...c, ...payload, faculty_name: faculty ? faculty.name : null } : c));
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
          const faculty = faculties.find(f => f.id == newCourseFaculty);
          setCourses(prev => [{ ...newCourse, faculty_name: faculty ? faculty.name : null }, ...prev]);
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
    setNewCourseName(c.name);
    setNewCourseDesc(c.description || '');
    setNewCourseFaculty(c.assigned_faculty || '');
    setShowAddModal(true);
  };

  const resetForm = () => {
    setEditId(null);
    setNewCourseName('');
    setNewCourseDesc('');
    setNewCourseFaculty('');
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

      <div style={{ marginBottom: '20px' }}>
        <button className="btn-primary" style={{ width: 'auto', padding: '10px 20px', margin: 0 }} onClick={() => {
            if (showAddModal) resetForm();
            else setShowAddModal(true);
        }}>
          {showAddModal ? 'Cancel' : '+ Add New Course'}
        </button>
      </div>

      {showAddModal && (
        <div className="table-container" style={{ marginBottom: '20px' }}>
          <h3>{editId ? 'Edit Course' : 'Add New Course'}</h3>
          <form onSubmit={handleAddOrEditCourse} style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '15px', maxWidth: '500px' }}>
            <input type="text" className="input-field" placeholder="Course Name" value={newCourseName} onChange={e => setNewCourseName(e.target.value)} required />
            <textarea className="input-field" placeholder="Description" rows="3" value={newCourseDesc} onChange={e => setNewCourseDesc(e.target.value)} />
            <select className="input-field" value={newCourseFaculty} onChange={e => setNewCourseFaculty(e.target.value)}>
              <option value="">Unassigned</option>
              {faculties.map(f => (
                <option key={f.id} value={f.id}>{f.name} ({f.email})</option>
              ))}
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
                <th>Name</th>
                <th>Description</th>
                <th>Assigned Faculty</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {courses.map(c => (
                <tr key={c.id}>
                  <td style={{ fontWeight: 600 }}>{c.name}</td>
                  <td style={{ color: '#666' }}>{c.description?.slice(0, 50) || 'N/A'}{c.description?.length > 50 ? '...' : ''}</td>
                  <td>{c.faculty_name || <span style={{ color: '#999', fontStyle: 'italic' }}>Unassigned</span>}</td>
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
