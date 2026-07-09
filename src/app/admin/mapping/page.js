'use client';

import { useState, useEffect } from 'react';
import LoadingOverlay from '@/components/LoadingOverlay';

export default function CourseMapping() {
  const [courses, setCourses] = useState([]);
  const [faculties, setFaculties] = useState([]);
  const [mappings, setMappings] = useState({}); // { course_id: [faculty_id_1, ...] }
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (type, msg) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const headers = { 'Authorization': `Bearer ${token}` };

      // Fetch courses, faculties, and current mappings in parallel
      const [cRes, fRes, mRes] = await Promise.all([
        fetch('/api/courses', { headers }),
        fetch('/api/users?role=faculty&status=active', { headers }),
        fetch('/api/mapping', { headers })
      ]);

      if (cRes.ok) setCourses(await cRes.json());
      if (fRes.ok) setFaculties(await fRes.json());
      if (mRes.ok) {
        const mappingData = await mRes.json();
        const initialMap = {};
        // mappingData is an object grouped by course_id
        for (const [cid, facs] of Object.entries(mappingData)) {
          initialMap[cid] = facs.map(f => f.id);
        }
        setMappings(initialMap);
      }
    } catch (e) {
      console.error(e);
      showToast('error', 'Error loading data');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectFaculty = (courseId, facultyId) => {
    if (!facultyId) return; // Empty selection
    
    setMappings(prev => {
      const current = prev[courseId] || [];
      // If already added, don't add again
      if (current.includes(facultyId)) return prev;
      
      // Limit to 4
      if (current.length >= 4) {
        showToast('error', 'You can assign a maximum of 4 faculties per course.');
        return prev;
      }
      
      return { ...prev, [courseId]: [...current, facultyId] };
    });
  };

  const handleRemoveFaculty = (courseId, facultyId) => {
    setMappings(prev => {
      const current = prev[courseId] || [];
      return { ...prev, [courseId]: current.filter(id => id !== facultyId) };
    });
  };

  const handleSaveMapping = async (courseId) => {
    setProcessing(true);
    try {
      const token = localStorage.getItem('token');
      const payload = {
        course_id: courseId,
        faculty_ids: mappings[courseId] || []
      };

      const res = await fetch('/api/mapping', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        showToast('success', 'Mapping saved successfully');
      } else {
        const data = await res.json();
        showToast('error', data.error || 'Failed to save mapping');
      }
    } catch (e) {
      showToast('error', 'Network error');
    } finally {
      setProcessing(false);
    }
  };

  const getFacultyName = (id) => {
    const f = faculties.find(f => f.id === id);
    return f ? f.name : 'Unknown';
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
          <h2 style={{ fontSize: '22px', fontWeight: 700 }}>Course-Faculty Mapping</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Assign up to 4 faculties per course.</p>
        </div>
        <button
          className="btn-small"
          style={{ padding: '10px 16px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'transparent', cursor: 'pointer' }}
          onClick={fetchData}
        >
          ↻ Refresh
        </button>
      </div>

      <div className="table-container">
        {loading ? <p style={{ padding: '20px', color: '#888' }}>Loading courses and faculties...</p> : (
          <table>
            <thead>
              <tr>
                <th style={{ width: '20%' }}>Course</th>
                <th style={{ width: '10%' }}>Semester</th>
                <th style={{ width: '50%' }}>Assigned Faculty (Max 4)</th>
                <th style={{ width: '20%' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {courses.map(c => {
                const assigned = mappings[c.id] || [];
                return (
                  <tr key={c.id}>
                    <td style={{ fontWeight: 600 }}>
                      <span style={{ color: 'var(--primary)', marginRight: '8px' }}>{c.course_code}</span>
                      <br/>{c.name}
                    </td>
                    <td>{c.semester}</td>
                    <td>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '10px' }}>
                        {assigned.map(fid => (
                          <div key={fid} style={{ 
                            display: 'flex', alignItems: 'center', gap: '5px', 
                            padding: '4px 8px', borderRadius: '4px', 
                            backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', fontSize: '13px', color: '#1e40af' 
                          }}>
                            {getFacultyName(fid)}
                            <button 
                              onClick={() => handleRemoveFaculty(c.id, fid)}
                              style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontWeight: 'bold' }}
                            >×</button>
                          </div>
                        ))}
                        {assigned.length === 0 && <span style={{ color: '#94a3b8', fontSize: '13px', fontStyle: 'italic' }}>Unassigned</span>}
                      </div>
                      
                      {assigned.length < 4 && (
                        <select 
                          className="input-field" 
                          style={{ padding: '6px', fontSize: '13px' }}
                          onChange={(e) => {
                            handleSelectFaculty(c.id, parseInt(e.target.value));
                            e.target.value = "";
                          }}
                          defaultValue=""
                        >
                          <option value="" disabled>+ Add Faculty</option>
                          {faculties.filter(f => !assigned.includes(f.id)).map(f => (
                            <option key={f.id} value={f.id}>{f.name} ({f.extra_info?.department || 'N/A'})</option>
                          ))}
                        </select>
                      )}
                    </td>
                    <td>
                      <button 
                        className="btn-primary" 
                        style={{ margin: 0, padding: '8px 16px', fontSize: '13px', width: 'auto' }}
                        onClick={() => handleSaveMapping(c.id)}
                      >
                        Save Mapping
                      </button>
                    </td>
                  </tr>
                );
              })}
              {courses.length === 0 && (
                <tr><td colSpan="4" style={{ textAlign: 'center', padding: '30px', color: '#888' }}>No courses found.</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
