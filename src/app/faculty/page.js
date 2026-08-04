'use client';

import { useState, useEffect } from 'react';
import LoadingOverlay from '@/components/LoadingOverlay';

export default function FacultyDashboard() {
  const [courses, setCourses] = useState([]);
  const [batches, setBatches] = useState([]);
  
  // Context selection
  const [selectedCourse, setSelectedCourse] = useState('');
  const [selectedBatch, setSelectedBatch] = useState('');
  
  // Active Tab
  const [activeTab, setActiveTab] = useState('practicals'); // 'practicals', 'submissions', 'marks'
  
  // Practicals state
  const [practicals, setPracticals] = useState([]);
  const [loadingPracticals, setLoadingPracticals] = useState(false);
  const [showPracticalModal, setShowPracticalModal] = useState(false);
  const [editingPractical, setEditingPractical] = useState(null);
  
  // Practical Form
  const [pracTitle, setPracTitle] = useState('');
  const [pracDesc, setPracDesc] = useState('');
  const [pracInst, setPracInst] = useState('');
  const [pracDiff, setPracDiff] = useState('Easy');
  const [pracIsChallenge, setPracIsChallenge] = useState(false);
  const [pracInputFormat, setPracInputFormat] = useState('');
  const [pracOutputFormat, setPracOutputFormat] = useState('');
  const [pracConstraints, setPracConstraints] = useState('');
  const [pracSampleInput, setPracSampleInput] = useState('');
  const [pracSampleOutput, setPracSampleOutput] = useState('');
  const [allowedLanguages, setAllowedLanguages] = useState(['python', 'cpp']);
  
  // Starter code templates
  const [pyTemplate, setPyTemplate] = useState('class Solution:\n    def solution(self):\n        pass');
  const [cppTemplate, setCppTemplate] = useState('class Solution {\npublic:\n    void solution() {\n        \n    }\n};');
  
  // Test cases state
  const [testCases, setTestCases] = useState([{ input: '', expected: '', marks: '5', is_hidden: false, label: '' }]);
  const [hasSubmissions, setHasSubmissions] = useState(false);

  // Submissions state
  const [selectedPracticalId, setSelectedPracticalId] = useState('');
  const [submissions, setSubmissions] = useState([]);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');
  const [submissionStatusFilter, setSubmissionStatusFilter] = useState('all');
  const [submissionSortBy, setSubmissionSortBy] = useState('submission_time');
  const [submissionSortOrder, setSubmissionSortOrder] = useState('DESC');
  const [viewingSubmission, setViewingSubmission] = useState(null);
  const [showSubmissionModal, setShowSubmissionModal] = useState(false);

  // Marks Overview state
  const [selectedMarksPracticalId, setSelectedMarksPracticalId] = useState('');
  const [statsData, setStatsData] = useState(null);
  const [loadingStats, setLoadingStats] = useState(false);

  // General Loading & Toast
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [toast, setToast] = useState(null);

  const token = () => localStorage.getItem('token');

  const showToast = (type, msg) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    fetchContextData();
  }, []);

  const fetchContextData = async () => {
    setLoading(true);
    try {
      const [coursesRes, batchesRes] = await Promise.all([
        fetch('/api/faculty/courses', { headers: { Authorization: `Bearer ${token()}` } }),
        fetch('/api/faculty/batches', { headers: { Authorization: `Bearer ${token()}` } })
      ]);

      if (coursesRes.ok) {
        const courseList = await coursesRes.json();
        setCourses(courseList);
        if (courseList.length > 0) setSelectedCourse(courseList[0].id.toString());
      }
      if (batchesRes.ok) {
        const batchList = await batchesRes.json();
        setBatches(batchList);
        if (batchList.length > 0) {
          setSelectedBatch(batchList[0]);
        } else {
          setSelectedBatch('2024');
        }
      }
    } catch (e) {
      console.error(e);
      showToast('error', 'Error loading course or batch metadata.');
    } finally {
      setLoading(false);
    }
  };

  // Load practicals when selected course changes
  useEffect(() => {
    if (selectedCourse) {
      fetchPracticals();
    }
  }, [selectedCourse]);

  const fetchPracticals = async () => {
    setLoadingPracticals(true);
    try {
      const res = await fetch(`/api/faculty/practicals?course_id=${selectedCourse}`, {
        headers: { Authorization: `Bearer ${token()}` }
      });
      if (res.ok) {
        const data = await res.json();
        setPracticals(data);
        if (data.length > 0) {
          setSelectedPracticalId(data[0].id.toString());
          setSelectedMarksPracticalId(data[0].id.toString());
        } else {
          setSelectedPracticalId('');
          setSelectedMarksPracticalId('');
          setSubmissions([]);
          setStatsData(null);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingPracticals(false);
    }
  };

  // Load submissions
  useEffect(() => {
    if (selectedPracticalId && activeTab === 'submissions') {
      fetchSubmissions();
    }
  }, [selectedPracticalId, activeTab, studentSearch, submissionStatusFilter, submissionSortBy, submissionSortOrder]);

  const fetchSubmissions = async () => {
    setLoadingSubmissions(true);
    try {
      const url = `/api/faculty/practicals/${selectedPracticalId}/submissions?studentSearch=${studentSearch}&status=${submissionStatusFilter}&sortBy=${submissionSortBy}&sortOrder=${submissionSortOrder}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token()}` }
      });
      if (res.ok) {
        setSubmissions(await res.json());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingSubmissions(false);
    }
  };

  // Load stats
  useEffect(() => {
    if (selectedMarksPracticalId && activeTab === 'marks') {
      fetchStats();
    }
  }, [selectedMarksPracticalId, activeTab]);

  const fetchStats = async () => {
    setLoadingStats(true);
    try {
      const res = await fetch(`/api/faculty/practicals/${selectedMarksPracticalId}/stats`, {
        headers: { Authorization: `Bearer ${token()}` }
      });
      if (res.ok) {
        setStatsData(await res.json());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingStats(false);
    }
  };

  const handleOpenAddPractical = () => {
    setEditingPractical(null);
    setPracTitle('');
    setPracDesc('');
    setPracInst('');
    setPracDiff('Easy');
    setPracIsChallenge(false);
    setPracInputFormat('');
    setPracOutputFormat('');
    setPracConstraints('');
    setPracSampleInput('');
    setPracSampleOutput('');
    setAllowedLanguages(['python', 'cpp']);
    setPyTemplate('class Solution:\n    def solution(self):\n        pass');
    setCppTemplate('class Solution {\npublic:\n    void solution() {\n        \n    }\n};');
    setTestCases([{ input: '', expected: '', marks: '5', is_hidden: false, label: '' }]);
    setHasSubmissions(false);
    setShowPracticalModal(true);
  };

  const handleOpenEditPractical = async (p) => {
    setProcessing(true);
    try {
      const res = await fetch(`/api/faculty/practicals/${p.id}`, {
        headers: { Authorization: `Bearer ${token()}` }
      });
      if (res.ok) {
        const data = await res.json();
        setEditingPractical(data);
        setPracTitle(data.title || '');
        setPracDesc(data.description || '');
        setPracInst(data.instructions || '');
        setPracDiff(data.difficulty || 'Easy');
        setPracIsChallenge(data.is_challenge || false);
        setPracInputFormat(data.input_format || '');
        setPracOutputFormat(data.output_format || '');
        setPracConstraints(data.constraints || '');
        setPracSampleInput(data.sample_input || '');
        setPracSampleOutput(data.sample_output || '');
        setAllowedLanguages(data.starter_code?.allowed_languages || ['python', 'cpp']);
        setPyTemplate(data.starter_code?.python || 'class Solution:\n    def solution(self):\n        pass');
        setCppTemplate(data.starter_code?.cpp || 'class Solution {\npublic:\n    void solution() {\n        \n    }\n};');
        setTestCases(data.test_cases?.length > 0 ? data.test_cases.map(tc => ({
          ...tc,
          marks: tc.marks.toString()
        })) : [{ input: '', expected: '', marks: '5', is_hidden: false, label: '' }]);
        setHasSubmissions(data.submissions_count > 0);
        setShowPracticalModal(true);
      }
    } catch (e) {
      showToast('error', 'Failed to retrieve practical details.');
    } finally {
      setProcessing(false);
    }
  };

  const handleAddTestCaseRow = () => {
    if (testCases.length >= 20) {
      showToast('error', 'You cannot add more than 20 test cases.');
      return;
    }
    setTestCases([...testCases, { input: '', expected: '', marks: '5', is_hidden: false, label: '' }]);
  };

  const handleRemoveTestCaseRow = (idx) => {
    if (testCases.length <= 1) {
      showToast('error', 'At least 1 test case must remain.');
      return;
    }
    setTestCases(testCases.filter((_, i) => i !== idx));
  };

  const handleTestCaseChange = (idx, field, val) => {
    const updated = [...testCases];
    updated[idx][field] = val;
    setTestCases(updated);
  };

  const handleSubmitPractical = async (e) => {
    e.preventDefault();
    if (!pracTitle || !pracDesc) {
      showToast('error', 'Title and Description are required.');
      return;
    }

    setProcessing(true);

    const payload = {
      course_id: parseInt(selectedCourse),
      batch_id: 'All',
      title: pracTitle,
      description: pracDesc,
      instructions: pracInst,
      difficulty: pracDiff,
      is_challenge: true,
      starter_code: {
        allowed_languages: allowedLanguages,
        python: pyTemplate,
        cpp: cppTemplate,
        entry: {
          type: 'class-method',
          className: 'Solution',
          methodName: 'solution'
        }
      },
      input_format: pracInputFormat,
      output_format: pracOutputFormat,
      constraints: pracConstraints,
      sample_input: pracSampleInput,
      sample_output: pracSampleOutput,
      test_cases: testCases.map((tc, idx) => ({
        input: tc.input,
        expected: tc.expected,
        marks: parseFloat(tc.marks) || 0,
        is_hidden: !!tc.is_hidden,
        order_index: idx,
        label: tc.label || `Test Case ${idx + 1}`
      }))
    };

    try {
      const url = editingPractical ? `/api/faculty/practicals/${editingPractical.id}` : '/api/faculty/practicals';
      const method = editingPractical ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${token()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (res.ok) {
        showToast('success', editingPractical ? 'Practical updated successfully.' : 'Practical created successfully.');
        setShowPracticalModal(false);
        fetchPracticals();
      } else {
        showToast('error', data.error || 'Submission failed.');
      }
    } catch (err) {
      showToast('error', 'Network error.');
    } finally {
      setProcessing(false);
    }
  };

  const handleDeletePractical = async (p) => {
    const promptMsg = p.submissions_count > 0 
      ? `Practical "${p.title}" already has student submissions. Deleting it will mark it as INACTIVE so students can no longer access it, but submissions history will be preserved. Proceed?`
      : `Are you sure you want to permanently delete "${p.title}"?`;
      
    if (!confirm(promptMsg)) return;

    setProcessing(true);
    try {
      const res = await fetch(`/api/faculty/practicals/${p.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token()}` }
      });
      const data = await res.json();
      if (res.ok) {
        showToast('success', data.message || 'Practical deleted successfully.');
        fetchPracticals();
      } else {
        showToast('error', data.error || 'Failed to delete practical.');
      }
    } catch (e) {
      showToast('error', 'Network error.');
    } finally {
      setProcessing(false);
    }
  };

  const handleViewSubmission = async (s) => {
    setProcessing(true);
    try {
      const res = await fetch(`/api/faculty/submissions/${s.id}`, {
        headers: { Authorization: `Bearer ${token()}` }
      });
      if (res.ok) {
        setViewingSubmission(await res.json());
        setShowSubmissionModal(true);
      }
    } catch (e) {
      showToast('error', 'Could not fetch submission details.');
    } finally {
      setProcessing(false);
    }
  };

  const handleExportCSV = () => {
    if (!statsData || statsData.students.length === 0) {
      showToast('error', 'No data to export.');
      return;
    }

    const headers = ['Roll Number', 'Student Name', 'Email', 'Status', 'Raw Marks', 'Normalized Marks (Out of 10)', 'Submitted At'];
    const rows = statsData.students.map(s => [
      s.roll_number,
      s.name,
      s.email,
      s.status,
      s.raw_marks,
      s.normalized_marks,
      s.submitted_at ? new Date(s.submitted_at).toLocaleString() : '—'
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(r => r.map(val => `"${val}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${statsData.practical.title.replace(/\s+/g, '_')}_grades.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div style={{ position: 'relative', minHeight: '80vh' }}>
      {processing && <LoadingOverlay />}

      {/* Toast Alert */}
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

      {/* Header Selector Context */}
      <div className="header" style={{ borderBottom: '1px solid var(--border-color)', pb: '20px', mb: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: '700', color: 'var(--text-main)' }}>Practical Management</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Scope coding challenges, view student grades, and manage test cases.</p>
        </div>
        
        <div style={{ display: 'flex', gap: '15px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)' }}>Course</span>
            <select
              value={selectedCourse}
              onChange={e => setSelectedCourse(e.target.value)}
              style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'white', minWidth: '180px' }}
            >
              {courses.map(c => (
                <option key={c.id} value={c.id}>{c.course_code} - {c.name}</option>
              ))}
              {courses.length === 0 && <option value="">No courses mapped</option>}
            </select>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', marginBottom: '25px' }}>
        <button
          onClick={() => setActiveTab('practicals')}
          style={{
            padding: '12px 24px', background: 'none', border: 'none', borderBottom: activeTab === 'practicals' ? '3px solid var(--primary)' : '3px solid transparent',
            color: activeTab === 'practicals' ? 'var(--primary)' : 'var(--text-muted)', fontWeight: 600, cursor: 'pointer', fontSize: '15px'
          }}
        >
          📝 Practicals List
        </button>
        <button
          onClick={() => setActiveTab('submissions')}
          style={{
            padding: '12px 24px', background: 'none', border: 'none', borderBottom: activeTab === 'submissions' ? '3px solid var(--primary)' : '3px solid transparent',
            color: activeTab === 'submissions' ? 'var(--primary)' : 'var(--text-muted)', fontWeight: 600, cursor: 'pointer', fontSize: '15px'
          }}
        >
          📥 Student Submissions
        </button>
        <button
          onClick={() => setActiveTab('marks')}
          style={{
            padding: '12px 24px', background: 'none', border: 'none', borderBottom: activeTab === 'marks' ? '3px solid var(--primary)' : '3px solid transparent',
            color: activeTab === 'marks' ? 'var(--primary)' : 'var(--text-muted)', fontWeight: 600, cursor: 'pointer', fontSize: '15px'
          }}
        >
          📊 Marks Overview
        </button>
      </div>

      {/* TAB 1: PRACTICALS LIST */}
      {activeTab === 'practicals' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', mb: '20px', alignItems: 'center' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 600 }}>Available Practicals</h3>
            <button className="btn-primary" style={{ width: 'auto', padding: '10px 20px', margin: 0 }} onClick={handleOpenAddPractical}>
              + Add Practical / Challenge
            </button>
          </div>

          <div className="table-container" style={{ marginTop: '15px' }}>
            {loadingPracticals ? <p>Loading practicals...</p> : (
              <table>
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Difficulty</th>
                    <th>Type</th>
                    <th>Total Marks (Internal)</th>
                    <th>Test Cases</th>
                    <th>Submissions</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {practicals.map(p => (
                    <tr key={p.id}>
                      <td style={{ fontWeight: 600, color: 'var(--primary)' }}>{p.title}</td>
                      <td>
                        <span style={{
                          padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 600,
                          backgroundColor: p.difficulty === 'Easy' ? '#ecfdf5' : p.difficulty === 'Medium' ? '#fef3c7' : '#fef2f2',
                          color: p.difficulty === 'Easy' ? '#10b981' : p.difficulty === 'Medium' ? '#f59e0b' : '#ef4444'
                        }}>
                          {p.difficulty}
                        </span>
                      </td>
                      <td style={{ fontWeight: 500 }}>{p.is_challenge ? '🏆 Challenge' : '📘 Standard'}</td>
                      <td>{p.total_marks} Marks</td>
                      <td>{p.test_cases_count} cases</td>
                      <td>{p.submissions_count} attempts</td>
                      <td>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            onClick={() => handleOpenEditPractical(p)}
                            style={{ padding: '6px 12px', borderRadius: '6px', border: 'none', backgroundColor: 'var(--primary)', color: 'white', cursor: 'pointer', fontWeight: 600, fontSize: '12px' }}
                          >
                            ✏️ Edit
                          </button>
                          <button
                            onClick={() => handleDeletePractical(p)}
                            style={{ padding: '6px 12px', borderRadius: '6px', border: 'none', backgroundColor: '#ef4444', color: 'white', cursor: 'pointer', fontWeight: 600, fontSize: '12px' }}
                          >
                            🗑️ Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {practicals.length === 0 && (
                    <tr><td colSpan="7" style={{ textAlign: 'center', color: '#888', padding: '40px' }}>No practicals found. Create one to get started.</td></tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: STUDENT SUBMISSIONS */}
      {activeTab === 'submissions' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '15px', mb: '20px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: '12px', flex: 1, minWidth: '300px' }}>
              <select
                value={selectedPracticalId}
                onChange={e => setSelectedPracticalId(e.target.value)}
                style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'white', minWidth: '200px' }}
              >
                {practicals.map(p => (
                  <option key={p.id} value={p.id}>{p.title}</option>
                ))}
                {practicals.length === 0 && <option value="">No practicals available</option>}
              </select>

              <input
                type="text"
                placeholder="Search Student name or Roll No..."
                className="input-field"
                value={studentSearch}
                onChange={e => setStudentSearch(e.target.value)}
                style={{ maxWidth: '280px', padding: '8px 12px' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <select
                value={submissionStatusFilter}
                onChange={e => setSubmissionStatusFilter(e.target.value)}
                style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'white' }}
              >
                <option value="all">All Statuses</option>
                <option value="Accepted">Accepted Only</option>
                <option value="Wrong Answer">Wrong Answer Only</option>
                <option value="Compile Error">Compile Error Only</option>
              </select>

              <select
                value={submissionSortBy}
                onChange={e => setSubmissionSortBy(e.target.value)}
                style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'white' }}
              >
                <option value="submission_time">Submission Time</option>
                <option value="marks">Marks</option>
                <option value="student_name">Student Name</option>
              </select>

              <select
                value={submissionSortOrder}
                onChange={e => setSubmissionSortOrder(e.target.value)}
                style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'white' }}
              >
                <option value="DESC">Descending</option>
                <option value="ASC">Ascending</option>
              </select>
            </div>
          </div>

          <div className="table-container" style={{ marginTop: '15px' }}>
            {loadingSubmissions ? <p>Loading submissions...</p> : (
              <table>
                <thead>
                  <tr>
                    <th>Roll Number</th>
                    <th>Student Name</th>
                    <th>Submission Time</th>
                    <th>Language</th>
                    <th>Status</th>
                    <th>Raw Score</th>
                    <th>Normalized Score (Out of 10)</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {submissions.map(s => (
                    <tr key={s.id}>
                      <td style={{ fontWeight: 600, color: 'var(--primary)' }}>{s.roll_number || '—'}</td>
                      <td style={{ fontWeight: 500 }}>{s.student_name}</td>
                      <td>{new Date(s.submitted_at).toLocaleString()}</td>
                      <td>{s.language.toUpperCase()}</td>
                      <td>
                        <span style={{
                          padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 600,
                          backgroundColor: s.status === 'Accepted' ? '#ecfdf5' : '#fef2f2',
                          color: s.status === 'Accepted' ? '#10b981' : '#ef4444'
                        }}>
                          {s.status}
                        </span>
                      </td>
                      <td>{s.raw_marks} Marks</td>
                      <td style={{ fontWeight: 700, color: 'var(--primary)' }}>{s.normalized_marks} / 10</td>
                      <td>
                        <button
                          onClick={() => handleViewSubmission(s)}
                          style={{ padding: '6px 12px', borderRadius: '6px', border: 'none', backgroundColor: '#475569', color: 'white', cursor: 'pointer', fontWeight: 600, fontSize: '12px' }}
                        >
                          👁️ View Details
                        </button>
                      </td>
                    </tr>
                  ))}
                  {submissions.length === 0 && (
                    <tr><td colSpan="8" style={{ textAlign: 'center', color: '#888', padding: '40px' }}>No student submissions found.</td></tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: MARKS OVERVIEW */}
      {activeTab === 'marks' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '15px', mb: '20px', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <span style={{ fontSize: '14px', fontWeight: 600 }}>Select Practical:</span>
              <select
                value={selectedMarksPracticalId}
                onChange={e => setSelectedMarksPracticalId(e.target.value)}
                style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'white', minWidth: '200px' }}
              >
                {practicals.map(p => (
                  <option key={p.id} value={p.id}>{p.title}</option>
                ))}
                {practicals.length === 0 && <option value="">No practicals available</option>}
              </select>
            </div>

            {statsData && (
              <button
                className="btn-primary"
                style={{ width: 'auto', padding: '10px 20px', backgroundColor: '#10b981', margin: 0 }}
                onClick={handleExportCSV}
              >
                ⬆ Export CSV / Excel
              </button>
            )}
          </div>

          {loadingStats ? <p>Loading marks analytics...</p> : statsData && (
            <div>
              {/* Stat Cards */}
              <div className="stat-cards" style={{ display: 'flex', gap: '20px', marginBottom: '25px' }}>
                <div className="stat-card" style={{ flex: 1, backgroundColor: 'white', padding: '20px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <h4 style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Average Score</h4>
                  <p style={{ fontSize: '28px', fontWeight: 800, color: 'var(--primary)', marginTop: '8px' }}>{statsData.stats.average_marks} / 10</p>
                </div>
                <div className="stat-card" style={{ flex: 1, backgroundColor: 'white', padding: '20px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <h4 style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Attempted Students</h4>
                  <p style={{ fontSize: '28px', fontWeight: 800, color: '#10b981', marginTop: '8px' }}>{statsData.stats.attempted_count} / {statsData.stats.total_students}</p>
                </div>
                <div className="stat-card" style={{ flex: 1, backgroundColor: 'white', padding: '20px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <h4 style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Submissions</h4>
                  <p style={{ fontSize: '28px', fontWeight: 800, color: '#f59e0b', marginTop: '8px' }}>{statsData.stats.submissions_count} runs</p>
                </div>
              </div>

              {/* Student grade list */}
              <div className="table-container">
                <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '15px' }}>Batch Student Directory & Grades</h3>
                <table>
                  <thead>
                    <tr>
                      <th>Roll Number</th>
                      <th>Student Name</th>
                      <th>Email</th>
                      <th>Status</th>
                      <th>Raw Score</th>
                      <th>Normalized Grade (Out of 10)</th>
                      <th>Last Attempted At</th>
                    </tr>
                  </thead>
                  <tbody>
                    {statsData.students.map(s => (
                      <tr key={s.id}>
                        <td style={{ fontWeight: 600, color: 'var(--primary)' }}>{s.roll_number}</td>
                        <td style={{ fontWeight: 500 }}>{s.name}</td>
                        <td>{s.email}</td>
                        <td>
                          <span style={{
                            padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 600,
                            backgroundColor: s.attempted ? '#ecfdf5' : '#fef2f2',
                            color: s.attempted ? '#10b981' : '#ef4444'
                          }}>
                            {s.attempted ? 'Attempted' : 'Not Attempted'}
                          </span>
                        </td>
                        <td>{s.raw_marks} Marks</td>
                        <td style={{ fontWeight: 700, color: s.attempted ? 'var(--primary)' : '#64748b' }}>
                          {s.attempted ? `${s.normalized_marks} / 10` : '—'}
                        </td>
                        <td>{s.submitted_at ? new Date(s.submitted_at).toLocaleString() : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* MODAL: ADD / EDIT PRACTICAL */}
      {showPracticalModal && (
        <div style={{
          position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
          overflowY: 'auto', padding: '40px 0'
        }}>
          <div style={{
            background: 'white', borderRadius: '16px', padding: '32px',
            width: '100%', maxWidth: '850px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
            maxHeight: '90vh', overflowY: 'auto'
          }}>
            <h3 style={{ marginBottom: '20px', fontSize: '20px', fontWeight: 700 }}>
              {editingPractical ? `Edit Practical: ${editingPractical.title}` : 'Add New Coding Practical'}
            </h3>

            {hasSubmissions && (
              <div style={{ backgroundColor: '#fffbeb', border: '1px solid #fef3c7', padding: '12px', borderRadius: '8px', marginBottom: '15px', color: '#b45309', fontSize: '13px' }}>
                ⚠️ <strong>Editing test cases is disabled</strong> because students have already submitted solutions. You can still modify the metadata such as title, description, and templates.
              </div>
            )}

            <form onSubmit={handleSubmitPractical} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div style={{ display: 'flex', gap: '15px' }}>
                <div style={{ flex: 2 }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Title *</label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="e.g. Reverse an array"
                    value={pracTitle}
                    onChange={e => setPracTitle(e.target.value)}
                    required
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Difficulty</label>
                  <select
                    className="input-field"
                    value={pracDiff}
                    onChange={e => setPracDiff(e.target.value)}
                  >
                    <option value="Easy">Easy</option>
                    <option value="Medium">Medium</option>
                    <option value="Hard">Hard</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '8px' }}>Allowed Programming Languages *</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <select
                    className="input-field"
                    value=""
                    onChange={e => {
                      const val = e.target.value;
                      if (val === 'all') {
                        setAllowedLanguages(['python', 'cpp', 'java', 'c', 'javascript']);
                      } else if (val && !allowedLanguages.includes(val)) {
                        setAllowedLanguages([...allowedLanguages, val]);
                      }
                    }}
                    style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'white' }}
                  >
                    <option value="">Add language...</option>
                    {allowedLanguages.length < 5 && <option value="all">All Languages</option>}
                    {!allowedLanguages.includes('python') && <option value="python">Python</option>}
                    {!allowedLanguages.includes('cpp') && <option value="cpp">C++</option>}
                    {!allowedLanguages.includes('java') && <option value="java">Java</option>}
                    {!allowedLanguages.includes('c') && <option value="c">C</option>}
                    {!allowedLanguages.includes('javascript') && <option value="javascript">JavaScript</option>}
                  </select>

                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '4px' }}>
                    {allowedLanguages.map(lang => (
                      <span
                        key={lang}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '4px 10px',
                          borderRadius: '16px',
                          backgroundColor: '#eff6ff',
                          color: '#2563eb',
                          fontSize: '12px',
                          fontWeight: '600',
                          border: '1px solid #bfdbfe'
                        }}
                      >
                        {lang === 'cpp' ? 'C++' : lang === 'javascript' ? 'JavaScript' : lang.charAt(0).toUpperCase() + lang.slice(1)}
                        <button
                          type="button"
                          onClick={() => {
                            if (allowedLanguages.length <= 1) {
                              alert('At least one language must be enabled.');
                              return;
                            }
                            setAllowedLanguages(allowedLanguages.filter(l => l !== lang));
                          }}
                          style={{
                            border: 'none',
                            background: 'transparent',
                            color: '#ef4444',
                            cursor: 'pointer',
                            fontSize: '14px',
                            fontWeight: 'bold',
                            padding: '0 2px',
                            lineHeight: 1
                          }}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Description / Problem Statement *</label>
                <textarea
                  className="input-field"
                  rows={4}
                  placeholder="Describe the coding challenge in detail (Supports HTML/Markdown)..."
                  value={pracDesc}
                  onChange={e => setPracDesc(e.target.value)}
                  required
                  style={{ fontFamily: 'monospace' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Instructions / Constraints (Optional)</label>
                <textarea
                  className="input-field"
                  rows={2}
                  placeholder="e.g. 1 <= N <= 10^5"
                  value={pracInst}
                  onChange={e => setPracInst(e.target.value)}
                  style={{ fontFamily: 'monospace' }}
                />
              </div>

              <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '15px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <h4 style={{ fontSize: '14px', fontWeight: 600 }}>Challenge Specific Inputs / Formatting</h4>
                <div style={{ display: 'flex', gap: '15px' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Input Format *</label>
                    <textarea className="input-field" rows={2} value={pracInputFormat} onChange={e => setPracInputFormat(e.target.value)} required />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Output Format *</label>
                    <textarea className="input-field" rows={2} value={pracOutputFormat} onChange={e => setPracOutputFormat(e.target.value)} required />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '15px' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Sample Input *</label>
                    <textarea className="input-field" rows={2} value={pracSampleInput} onChange={e => setPracSampleInput(e.target.value)} required />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Sample Output *</label>
                    <textarea className="input-field" rows={2} value={pracSampleOutput} onChange={e => setPracSampleOutput(e.target.value)} required />
                  </div>
                </div>
              </div>

              {/* Test Cases configuration */}
              <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '15px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <h4 style={{ fontSize: '14px', fontWeight: 600 }}>Test Cases Config ({testCases.length} / 20)</h4>
                  {!hasSubmissions && (
                    <button type="button" className="btn-small" style={{ backgroundColor: 'var(--primary)', color: 'white' }} onClick={handleAddTestCaseRow}>
                      + Add Case Row
                    </button>
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {testCases.map((tc, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: '10px', alignItems: 'center', borderBottom: '1px solid #f1f5f9', pb: '10px' }}>
                      <div style={{ flex: 1 }}>
                        <textarea
                          className="input-field"
                          rows={2}
                          placeholder="Input arguments (e.g. 3 5) *"
                          value={tc.input}
                          onChange={e => handleTestCaseChange(idx, 'input', e.target.value)}
                          required
                          disabled={hasSubmissions}
                          style={{ padding: '6px', fontFamily: 'monospace', resize: 'vertical' }}
                        />
                      </div>
                      <div style={{ flex: 1 }}>
                        <textarea
                          className="input-field"
                          rows={2}
                          placeholder="Expected result (e.g. 8) *"
                          value={tc.expected}
                          onChange={e => handleTestCaseChange(idx, 'expected', e.target.value)}
                          required
                          disabled={hasSubmissions}
                          style={{ padding: '6px', fontFamily: 'monospace', resize: 'vertical' }}
                        />
                      </div>
                      <div style={{ width: '80px' }}>
                        <input
                          type="number"
                          className="input-field"
                          placeholder="Marks *"
                          value={tc.marks}
                          onChange={e => handleTestCaseChange(idx, 'marks', e.target.value)}
                          required
                          disabled={hasSubmissions}
                          min="0"
                          style={{ padding: '6px' }}
                        />
                      </div>
                      {!hasSubmissions && (
                        <button type="button" style={{ border: 'none', background: 'none', color: '#ef4444', fontWeight: 'bold', cursor: 'pointer', fontSize: '18px', padding: '0 5px' }} onClick={() => handleRemoveTestCaseRow(idx)}>
                          ×
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Form Buttons */}
              <div style={{ display: 'flex', gap: '15px', justifyContent: 'flex-end', marginTop: '15px' }}>
                <button
                  type="button"
                  onClick={() => setShowPracticalModal(false)}
                  style={{ padding: '10px 20px', border: '1px solid var(--border-color)', borderRadius: '6px', background: 'transparent', cursor: 'pointer', fontWeight: 600 }}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary" style={{ width: 'auto', padding: '10px 30px', margin: 0 }}>
                  Save Practical
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: VIEW SUBMISSION CODE & CASE RESULTS */}
      {showSubmissionModal && viewingSubmission && (
        <div style={{
          position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div style={{
            background: 'white', borderRadius: '16px', padding: '32px',
            width: '100%', maxWidth: '850px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
            maxHeight: '90vh', overflowY: 'auto'
          }}>
            <h3 style={{ marginBottom: '20px', fontSize: '20px', fontWeight: 700 }}>
              Submission Details - {viewingSubmission.student_name}
            </h3>

            <div style={{ display: 'flex', gap: '20px', backgroundColor: '#f8fafc', padding: '15px', borderRadius: '10px', marginBottom: '20px' }}>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Roll Number: <strong>{viewingSubmission.roll_number || '—'}</strong></p>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', mt: '5px' }}>Language: <strong>{viewingSubmission.language.toUpperCase()}</strong></p>
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Status: <strong style={{ color: viewingSubmission.status === 'Accepted' ? '#10b981' : '#ef4444' }}>{viewingSubmission.status}</strong></p>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', mt: '5px' }}>Submitted: <strong>{new Date(viewingSubmission.submitted_at).toLocaleString()}</strong></p>
              </div>
              <div style={{ flex: 1, textAlign: 'right' }}>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Score:</p>
                <p style={{ fontSize: '24px', fontWeight: 800, color: 'var(--primary)' }}>{viewingSubmission.normalized_marks} / 10</p>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>(Raw Marks: {viewingSubmission.raw_marks} / {viewingSubmission.practical_total_marks})</p>
              </div>
            </div>

            {/* Source code block */}
            <div style={{ marginBottom: '25px' }}>
              <h4 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>Submitted Source Code:</h4>
              <pre style={{
                backgroundColor: '#1e293b', color: '#f8fafc', padding: '20px', borderRadius: '8px',
                overflowX: 'auto', fontFamily: 'monospace', fontSize: '13px', maxHeight: '250px'
              }}>
                <code>{viewingSubmission.code}</code>
              </pre>
            </div>

            {/* Test case analysis */}
            <div>
              <h4 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '10px' }}>Test Cases evaluation breakdown:</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {viewingSubmission.cases.map((c, i) => (
                  <div key={c.id} style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontWeight: 600, fontSize: '13px' }}>{c.label || `Test Case ${i + 1}`} {c.is_hidden ? '🔒 (Hidden)' : ''}</span>
                      <span style={{
                        padding: '3px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: 700,
                        backgroundColor: c.passed ? '#ecfdf5' : '#fef2f2',
                        color: c.passed ? '#10b981' : '#ef4444'
                      }}>
                        {c.passed ? 'PASSED' : 'FAILED'} (+{c.marks_awarded} marks)
                      </span>
                    </div>

                    <div style={{ display: 'flex', gap: '10px', fontSize: '12px', background: '#f8fafc', padding: '8px', borderRadius: '6px' }}>
                      <div style={{ flex: 1 }}>
                        <span style={{ color: 'var(--text-muted)' }}>Input:</span>
                        <pre style={{ margin: '3px 0 0 0', fontFamily: 'monospace', background: 'white', padding: '4px', borderRadius: '4px', border: '1px solid var(--border-color)' }}>{c.input}</pre>
                      </div>
                      <div style={{ flex: 1 }}>
                        <span style={{ color: 'var(--text-muted)' }}>Expected:</span>
                        <pre style={{ margin: '3px 0 0 0', fontFamily: 'monospace', background: 'white', padding: '4px', borderRadius: '4px', border: '1px solid var(--border-color)' }}>{c.expected}</pre>
                      </div>
                      <div style={{ flex: 1 }}>
                        <span style={{ color: 'var(--text-muted)' }}>Actual Output:</span>
                        <pre style={{
                          margin: '3px 0 0 0', fontFamily: 'monospace', background: 'white', padding: '4px', borderRadius: '4px',
                          border: '1px solid var(--border-color)', color: c.passed ? '#10b981' : '#ef4444'
                        }}>{c.actual_output || '—'}</pre>
                      </div>
                    </div>

                    {c.error_message && (
                      <div style={{ marginTop: '8px', fontSize: '12px', color: '#ef4444', backgroundColor: '#fef2f2', padding: '8px', borderRadius: '6px', fontFamily: 'monospace' }}>
                        <strong>Error output:</strong><br/>
                        {c.error_message}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Modal action */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button
                onClick={() => setShowSubmissionModal(false)}
                style={{ padding: '10px 24px', backgroundColor: 'var(--primary)', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
              >
                Close Submission Window
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
