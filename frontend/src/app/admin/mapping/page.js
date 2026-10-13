'use client';

import { useState, useEffect } from 'react';
import LoadingOverlay from '@/components/LoadingOverlay';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { useSocket } from '@/hooks/useSocket';
import RefreshButton from '@/components/RefreshButton';

export default function CourseMapping() {
  const socket = useSocket();
  const [courses, setCourses] = useState([]);
  const [faculties, setFaculties] = useState([]);
  const [mappings, setMappings] = useState({}); // { course_id: { faculty_ids: [...], co_coordinator_id: null } }
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [toast, setToast] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const showToast = (type, msg) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3000);
  };

  const { token: authToken, isReady } = useAdminAuth();

  useEffect(() => {
    if (isReady) fetchData();
  }, [isReady]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const token = authToken;
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
        for (const [cid, facs] of Object.entries(mappingData)) {
          const co = facs.find(f => f.is_co_coordinator);
          initialMap[cid] = {
            faculty_ids: facs.map(f => f.id),
            co_coordinator_id: co ? co.id : (facs[0]?.id || null)
          };
        }
        setMappings(initialMap);
      }
      setLastUpdated(new Date());
    } catch (e) {
      console.error(e);
      showToast('error', 'Error loading data');
    } finally {
      setLoading(false);
    }
  };

  // Real-time WebSocket synchronization for course mapping
  useEffect(() => {
    if (!socket) return;
    socket.emit('join_admin_room');

    const handleUpdate = () => {
      fetchData();
    };

    socket.on('course_updated', handleUpdate);
    socket.on('admin_stats_changed', handleUpdate);

    return () => {
      socket.off('course_updated', handleUpdate);
      socket.off('admin_stats_changed', handleUpdate);
    };
  }, [socket]);

  const handleSelectFaculty = (courseId, facultyId) => {
    if (!facultyId) return; // Empty selection
    
    setMappings(prev => {
      const current = prev[courseId] || { faculty_ids: [], co_coordinator_id: null };
      // If already added, don't add again
      if (current.faculty_ids.includes(facultyId)) return prev;
      
      // Limit to 4
      if (current.faculty_ids.length >= 4) {
        showToast('error', 'You can assign a maximum of 4 faculties per course.');
        return prev;
      }
      
      const newFids = [...current.faculty_ids, facultyId];
      return { 
        ...prev, 
        [courseId]: {
          faculty_ids: newFids,
          co_coordinator_id: current.co_coordinator_id || facultyId
        }
      };
    });
  };

  const handleRemoveFaculty = (courseId, facultyId) => {
    setMappings(prev => {
      const current = prev[courseId] || { faculty_ids: [], co_coordinator_id: null };
      const newFids = current.faculty_ids.filter(id => id !== facultyId);
      let newCo = current.co_coordinator_id;
      if (newCo === facultyId) {
        newCo = newFids[0] || null;
      }
      return { 
        ...prev, 
        [courseId]: {
          faculty_ids: newFids,
          co_coordinator_id: newCo
        }
      };
    });
  };

  const handleSetCoCoordinator = (courseId, facultyId) => {
    setMappings(prev => {
      const current = prev[courseId] || { faculty_ids: [], co_coordinator_id: null };
      return {
        ...prev,
        [courseId]: {
          ...current,
          co_coordinator_id: facultyId
        }
      };
    });
  };

  const handleSaveMapping = async (courseId) => {
    setProcessing(true);
    try {
      const token = authToken;
      const current = mappings[courseId] || { faculty_ids: [], co_coordinator_id: null };
      const payload = {
        course_id: courseId,
        faculty_ids: current.faculty_ids,
        co_coordinator_id: current.co_coordinator_id
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
        showToast('success', 'Mapping and Co-coordinator saved successfully');
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
        <RefreshButton
          onRefresh={fetchData}
          lastUpdated={lastUpdated}
          label="Refresh"
          variant="default"
        />
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
                const current = mappings[c.id] || { faculty_ids: [], co_coordinator_id: null };
                const assigned = current.faculty_ids;
                return (
                  <tr key={c.id}>
                    <td style={{ fontWeight: 600 }}>
                      <span style={{ color: 'var(--primary)', marginRight: '8px' }}>{c.course_code}</span>
                      <br/>{c.name}
                    </td>
                    <td>{c.semester}</td>
                    <td>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '10px' }}>
                        {assigned.map(fid => {
                          const isCo = current.co_coordinator_id === fid;
                          return (
                            <div key={fid} style={{ 
                              display: 'flex', alignItems: 'center', gap: '8px', 
                              padding: '6px 12px', borderRadius: '6px', 
                              backgroundColor: isCo ? '#fef3c7' : '#eff6ff', 
                              border: `1px solid ${isCo ? '#fde68a' : '#bfdbfe'}`, 
                              fontSize: '13px', color: isCo ? '#92400e' : '#1e40af' 
                            }}>
                              <span style={{ fontWeight: isCo ? 'bold' : 'normal' }}>
                                {isCo ? '👑 ' : ''}{getFacultyName(fid)}
                              </span>
                              {!isCo && (
                                <button
                                  onClick={() => handleSetCoCoordinator(c.id, fid)}
                                  title="Make Co-coordinator"
                                  style={{ background: 'none', border: 'none', color: '#b45309', cursor: 'pointer', fontSize: '11px', textDecoration: 'underline', padding: 0 }}
                                >
                                  Make Co
                                </button>
                              )}
                              <button 
                                onClick={() => handleRemoveFaculty(c.id, fid)}
                                style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontWeight: 'bold', marginLeft: '4px' }}
                              >×</button>
                            </div>
                          );
                        })}
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
