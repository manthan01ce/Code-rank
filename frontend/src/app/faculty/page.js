'use client';
import Editor from '@monaco-editor/react';

import { useState, useEffect } from 'react';
import LoadingOverlay from '@/components/LoadingOverlay';
import { useSocket } from '@/hooks/useSocket';

export default function FacultyDashboard() {
  const socket = useSocket();
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
  const [pracTopics, setPracTopics] = useState('');
  const [pracStartTime, setPracStartTime] = useState('');
  const [pracEndTime, setPracEndTime] = useState('');
  const [pracInst, setPracInst] = useState('');
  const [pracDiff, setPracDiff] = useState('Easy');
  const [pracIsChallenge, setPracIsChallenge] = useState(false);
  const [pracInputFormat, setPracInputFormat] = useState('');
  const [pracOutputFormat, setPracOutputFormat] = useState('');
  const [pracConstraints, setPracConstraints] = useState('');
  const [sampleTestCases, setSampleTestCases] = useState([{ input: '', expected: '' }]);
  const [allowedLanguages, setAllowedLanguages] = useState(['python', 'cpp']);
  
  // Starter code templates
  const [pyTemplate, setPyTemplate] = useState('# Write your Python code here\n# Read inputs using input() or sys.stdin\n');
  const [cppTemplate, setCppTemplate] = useState('#include <iostream>\nusing namespace std;\n\nint main() {\n    // Write your C++ code here\n    // Read from cin and write to cout\n    return 0;\n}');
  
  // Test cases state
  const [testCases, setTestCases] = useState([{ input: '', expected: '', marks: '5', is_hidden: false, label: '' }]);
  const [hasSubmissions, setHasSubmissions] = useState(false);

  // Submissions state
  const [selectedPracticalId, setSelectedPracticalId] = useState('');
  const [submissions, setSubmissions] = useState([]);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');
  const [submissionStatusFilter, setSubmissionStatusFilter] = useState('in-time');
  const [submissionSortBy, setSubmissionSortBy] = useState('submission_time');
  const [submissionSortOrder, setSubmissionSortOrder] = useState('DESC');
  const [viewingSubmission, setViewingSubmission] = useState(null);
  const [showSubmissionModal, setShowSubmissionModal] = useState(false);
  const [extraTimePractical, setExtraTimePractical] = useState(null);
  const [extraMinutesInput, setExtraMinutesInput] = useState(15);
  const [customEndTimeInput, setCustomEndTimeInput] = useState('');
  const [copyCodeSuccess, setCopyCodeSuccess] = useState(false);

  // Live timer tick for real-time countdown
  const [currentTime, setCurrentTime] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Department & Division filter state
  const [selectedDepartmentFilter, setSelectedDepartmentFilter] = useState('all');
  const [submissionDivisionFilter, setSubmissionDivisionFilter] = useState('all');

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

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get('tab');
      if (tab === 'submissions') {
        setActiveTab('submissions');
      } else if (tab === 'marks') {
        setActiveTab('marks');
      } else {
        setActiveTab('practicals');
        setSelectedCourse('');
      }
    }
  }, [typeof window !== 'undefined' ? window.location.search : '']);

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
        setSelectedCourse('');
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
  }, [selectedPracticalId, activeTab, studentSearch, submissionStatusFilter, submissionSortBy, submissionSortOrder, submissionDivisionFilter]);

  const fetchSubmissions = async () => {
    setLoadingSubmissions(true);
    try {
      let url = `/api/faculty/practicals/${selectedPracticalId}/submissions?studentSearch=${encodeURIComponent(studentSearch)}&status=${submissionStatusFilter}&sortBy=${submissionSortBy}&sortOrder=${submissionSortOrder}`;
      if (submissionDivisionFilter && submissionDivisionFilter !== 'all') {
        url += `&division=${encodeURIComponent(submissionDivisionFilter)}`;
      }
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

  useEffect(() => {
    if (!socket || !selectedPracticalId) return;
    
    socket.emit('join_practical_room', selectedPracticalId);
    
    const handleNewSubmission = (newSub) => {
      setSubmissions(prev => {
        if (prev.find(s => s.id === newSub.id)) return prev;
        return [newSub, ...prev];
      });
    };
    
    socket.on('new_submission', handleNewSubmission);
    
    return () => {
      socket.off('new_submission', handleNewSubmission);
      socket.emit('leave_practical_room', selectedPracticalId);
    };
  }, [socket, selectedPracticalId]);

  // Load stats
  useEffect(() => {
    if (selectedCourse && activeTab === 'marks') {
      fetchStats();
    }
    
    if (!socket || !selectedCourse || activeTab !== 'marks') return;
    
    socket.emit('join_course_room', selectedCourse);
    
    const handleNewSubmissionMarks = () => {
      // Refresh stats on new submission
      fetchStats();
    };
    
    socket.on('new_submission_marks', handleNewSubmissionMarks);
    
    return () => {
      socket.off('new_submission_marks', handleNewSubmissionMarks);
      socket.emit('leave_course_room', selectedCourse);
    };
  }, [selectedCourse, activeTab, socket]);

  const fetchStats = async () => {
    setLoadingStats(true);
    try {
      const res = await fetch(`/api/faculty/courses/${selectedCourse}/stats`, {
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
    setPracTopics('');
    setPracInst('');
    setPracDiff('Easy');
    setPracIsChallenge(true);
    setPracInputFormat('');
    setPracOutputFormat('');
    setPracConstraints('');
    setSampleTestCases([{ input: '', expected: '' }]);
    setPracStartTime('');
    setPracEndTime('');
    setAllowedLanguages(['python', 'cpp']);
    setPyTemplate('# Write your Python code here\n# Read inputs using input() or sys.stdin\n');
    setCppTemplate('#include <iostream>\nusing namespace std;\n\nint main() {\n    // Write your C++ code here\n    // Read from cin and write to cout\n    return 0;\n}');
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
        setPracTopics(data.topics || '');
        setPracInst(data.instructions || '');
        setPracDiff(data.difficulty || 'Easy');
        setPracIsChallenge(data.is_challenge || false);
        setPracInputFormat(data.input_format || '');
        setPracOutputFormat(data.output_format || '');
        setPracConstraints(data.constraints || '');
        try {
          const parsed = JSON.parse(data.sample_input);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setSampleTestCases(parsed);
          } else {
            setSampleTestCases([{ input: data.sample_input || '', expected: data.sample_output || '' }]);
          }
        } catch {
          setSampleTestCases([{ input: data.sample_input || '', expected: data.sample_output || '' }]);
        }
        
        // Helper to format ISO string to datetime-local value (YYYY-MM-DDTHH:MM)
        const formatLocalTime = (iso) => {
          if (!iso) return '';
          const d = new Date(iso);
          const pad = (n) => n.toString().padStart(2, '0');
          return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
        };
        setPracStartTime(formatLocalTime(data.start_time));
        setPracEndTime(formatLocalTime(data.end_time));

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
      topics: pracTopics,
      instructions: pracInst,
      difficulty: pracDiff,
      is_challenge: true,
      start_time: pracStartTime || null,
      end_time: pracEndTime || null,
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
      sample_input: JSON.stringify(sampleTestCases),
      sample_output: '', // Unused now but kept for DB compatibility
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

  const handleApplyExtraTime = async (minutes, customDate) => {
    if (!extraTimePractical) return;
    setProcessing(true);
    try {
      const payload = customDate 
        ? { newEndTime: customDate } 
        : { extraMinutes: minutes !== undefined ? minutes : extraMinutesInput };

      const res = await fetch(`/api/faculty/practicals/${extraTimePractical.id}/extra-time`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (res.ok) {
        showToast('success', data.message || 'Extra time granted successfully!');
        setExtraTimePractical(null);
        setCustomEndTimeInput('');
        fetchPracticals();
      } else {
        showToast('error', data.error || 'Failed to grant extra time.');
      }
    } catch (err) {
      showToast('error', 'Network error.');
    } finally {
      setProcessing(false);
    }
  };

  const renderTimelineBadge = (startTime, endTime) => {
    if (!startTime && !endTime) {
      return <span style={{ color: '#94a3b8', fontSize: '11px', fontStyle: 'italic' }}>No time limit</span>;
    }

    const start = startTime ? new Date(startTime).getTime() : null;
    const end = endTime ? new Date(endTime).getTime() : null;

    if (start && currentTime < start) {
      const diffSecs = Math.max(0, Math.floor((start - currentTime) / 1000));
      const hours = Math.floor(diffSecs / 3600);
      const mins = Math.floor((diffSecs % 3600) / 60);
      const secs = diffSecs % 60;
      const startsInStr = hours > 0
        ? `${hours}h ${mins}m ${secs}s`
        : mins > 0
          ? `${mins}m ${secs}s`
          : `${secs}s`;

      return (
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: '4px',
          padding: '3px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 600,
          backgroundColor: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe'
        }}>
          ⏳ Starts in {startsInStr} ({new Date(start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})
        </span>
      );
    }

    if (end) {
      if (currentTime > end) {
        return (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '4px',
            padding: '3px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 600,
            backgroundColor: '#fef2f2', color: '#ef4444', border: '1px solid #fecaca'
          }}>
            ⛔ Expired ({new Date(end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})
          </span>
        );
      } else {
        const diffSecs = Math.max(0, Math.floor((end - currentTime) / 1000));
        const hours = Math.floor(diffSecs / 3600);
        const mins = Math.floor((diffSecs % 3600) / 60);
        const secs = diffSecs % 60;
        const remainingStr = hours > 0
          ? `${hours}h ${mins}m ${secs}s left`
          : mins > 0
            ? `${mins}m ${secs}s left`
            : `${secs}s left`;

        return (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '4px',
            padding: '3px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 600,
            backgroundColor: '#ecfdf5', color: '#059669', border: '1px solid #a7f3d0'
          }}>
            ⏱️ Active ({remainingStr})
          </span>
        );
      }
    }

    return <span style={{ color: '#94a3b8', fontSize: '11px' }}>Active</span>;
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

  const handleDeleteSubmission = async (s) => {
    if (!confirm(`Are you sure you want to delete the submission for student "${s.student_name || 'Student'}" (Score: ${s.normalized_marks}/10)? This cannot be undone.`)) {
      return;
    }

    setProcessing(true);
    try {
      const res = await fetch(`/api/faculty/submissions/${s.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token()}` }
      });
      const data = await res.json();
      if (res.ok) {
        showToast('success', 'Submission deleted successfully.');
        setShowSubmissionModal(false);
        setViewingSubmission(null);
        fetchSubmissions();
        fetchPracticals();
        if (selectedCourse && activeTab === 'marks') fetchStats();
      } else {
        showToast('error', data.error || 'Failed to delete submission.');
      }
    } catch (e) {
      showToast('error', 'Network error deleting submission.');
    } finally {
      setProcessing(false);
    }
  };

  const handleExportCSV = () => {
    if (!statsData || !statsData.students || !statsData.practicals) {
      showToast('error', 'No data to export.');
      return;
    }

    const studentsToExport = selectedDepartmentFilter === 'all'
      ? statsData.students
      : statsData.students.filter(s => (s.department || '').toUpperCase() === selectedDepartmentFilter.toUpperCase());

    if (studentsToExport.length === 0) {
      showToast('error', 'No students found for the selected department.');
      return;
    }

    const headers = [
      'Roll Number', 'Student Name', 'Email', 'Department', 'Division',
      ...statsData.practicals.map((p, i) => `Practical ${i + 1} (${p.title})`)
    ];

    const rows = studentsToExport.map(s => {
      const row = [s.roll_number || '—', s.name, s.email, s.department || '—', s.division || '—'];
      statsData.practicals.forEach(p => {
        const sub = statsData.submissions.find(sub => sub.student_id === s.id && sub.practical_id === p.id);
        if (sub) {
          const lateSuffix = sub.is_late ? ' (Late)' : '';
          row.push(`${sub.normalized_marks}${lateSuffix}`);
        } else {
          row.push('Not Submitted');
        }
      });
      return row;
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(r => r.map(val => `"${val}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    const courseCodeStr = statsData.course?.course_code || 'course';
    const deptSuffix = selectedDepartmentFilter === 'all' ? 'All_Departments' : selectedDepartmentFilter.replace(/\s+/g, '_');
    link.setAttribute('download', `${courseCodeStr.replace(/\s+/g, '_')}_${deptSuffix}_grades_matrix.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!selectedCourse) {
    return (
      <div style={{ position: 'relative', minHeight: '80vh', padding: '20px' }}>
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

        <div>
          <h2 style={{ fontSize: '24px', fontWeight: '700', color: 'var(--text-main)', marginBottom: '8px' }}>Select Allocated Subject</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '14.5px', marginBottom: '30px' }}>Choose a course below to manage its assignments, view student grades, and download spreadsheets.</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
          {courses.map(c => (
            <div 
              key={c.id} 
              onClick={() => setSelectedCourse(c.id.toString())}
              style={{
                background: 'white', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '24px',
                cursor: 'pointer', transition: 'transform 0.2s, box-shadow 0.2s',
                boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
                display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '160px'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-4px)';
                e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1)';
                e.currentTarget.style.borderColor = 'var(--primary)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0,0,0,0.05)';
                e.currentTarget.style.borderColor = 'var(--border-color)';
              }}
            >
              <div>
                <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', tracking: 'wide' }}>{c.course_code}</span>
                <h3 style={{ fontSize: '18px', fontWeight: 600, marginTop: '8px', color: '#1e293b' }}>{c.name}</h3>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px', color: '#64748b' }}>
                <span>Semester {c.semester}</span>
                <span style={{ fontWeight: 600, color: 'var(--primary)' }}>Manage &rarr;</span>
              </div>
            </div>
          ))}
          {courses.length === 0 && (
            <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
              No allocated courses found for your faculty account.
            </div>
          )}
        </div>
      </div>
    );
  }

  const activeCourse = courses.find(c => c.id.toString() === selectedCourse);

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
          <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase' }}>
            {activeCourse?.course_code}
          </span>
          <h2 style={{ fontSize: '24px', fontWeight: '700', color: 'var(--text-main)', marginTop: '4px' }}>
            {activeCourse?.name}
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '6px' }}>
            {activeCourse?.is_co_coordinator ? (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: '5px',
                backgroundColor: '#fefce8', border: '1px solid #fde68a',
                color: '#92400e', fontSize: '12px', fontWeight: 700,
                padding: '4px 10px', borderRadius: '20px'
              }}>
                👑 Co-coordinator &nbsp;·&nbsp; Can add / edit / delete practicals
              </span>
            ) : (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: '5px',
                backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1',
                color: '#64748b', fontSize: '12px', fontWeight: 600,
                padding: '4px 10px', borderRadius: '20px'
              }}>
                👁️ View-only Access &nbsp;·&nbsp; Contact admin to assign co-coordinator rights
              </span>
            )}
          </div>
        </div>
        
        <div>
          <button 
            onClick={() => setSelectedCourse('')}
            style={{
              padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--border-color)',
              backgroundColor: 'white', cursor: 'pointer', fontWeight: 600, fontSize: '13px'
            }}
          >
            🔄 Switch Subject
          </button>
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
            {activeCourse?.is_co_coordinator && (
              <button className="btn-primary" style={{ width: 'auto', padding: '10px 20px', margin: 0 }} onClick={handleOpenAddPractical}>
                + Add Practical
              </button>
            )}
          </div>

          <div className="table-container" style={{ marginTop: '15px' }}>
            {loadingPracticals ? <p>Loading practicals...</p> : (
              <table>
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Difficulty</th>
                    <th>Type</th>
                    <th>Timeline</th>
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
                      <td>{renderTimelineBadge(p.start_time, p.end_time)}</td>
                      <td>{p.total_marks} Marks</td>
                      <td>{p.test_cases_count} cases</td>
                      <td>{p.submissions_count} attempts</td>
                      <td>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <button
                            onClick={() => setExtraTimePractical(p)}
                            style={{
                              padding: '6px 12px', borderRadius: '6px', border: '1px solid #cbd5e1',
                              backgroundColor: '#f8fafc', color: '#1e293b', cursor: 'pointer',
                              fontWeight: 600, fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px'
                            }}
                            title="Add extra time for solving this practical"
                          >
                            ⏰ + Time
                          </button>

                          {activeCourse?.is_co_coordinator ? (
                            <>
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
                            </>
                          ) : (
                            <span style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: '12px' }}>View-only</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {practicals.length === 0 && (
                    <tr><td colSpan="8" style={{ textAlign: 'center', color: '#888', padding: '40px' }}>No practicals found. Create one to get started.</td></tr>
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

              {selectedPracticalId && (
                <button
                  type="button"
                  onClick={() => {
                    const found = practicals.find(p => p.id === parseInt(selectedPracticalId));
                    if (found) setExtraTimePractical(found);
                  }}
                  style={{
                    padding: '8px 14px', borderRadius: '6px', border: '1px solid #bfdbfe',
                    backgroundColor: '#eff6ff', color: '#1d4ed8', cursor: 'pointer',
                    fontWeight: 600, fontSize: '12px', display: 'flex', alignItems: 'center', gap: '5px', whiteSpace: 'nowrap'
                  }}
                  title="Add extra time for this practical"
                >
                  ⏰ Grant Extra Time
                </button>
              )}

              <input
                type="text"
                placeholder="Search Student, Roll No, Division..."
                className="input-field"
                value={studentSearch}
                onChange={e => setStudentSearch(e.target.value)}
                style={{ maxWidth: '260px', padding: '8px 12px' }}
              />

              <select
                value={submissionDivisionFilter}
                onChange={e => setSubmissionDivisionFilter(e.target.value)}
                style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'white', fontSize: '13px' }}
              >
                <option value="all">All Divisions</option>
                {Array.from(new Set(submissions.map(s => s.division).filter(Boolean))).sort().map(div => (
                  <option key={div} value={div}>Div: {div}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <select
                value={submissionStatusFilter}
                onChange={e => setSubmissionStatusFilter(e.target.value)}
                style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'white' }}
              >
                <option value="in-time">In-Time Submission</option>
                <option value="late">Late Submission</option>
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
                    <th>Division</th>
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
                      <td>
                        <span style={{ fontSize: '12px', fontWeight: 600, backgroundColor: '#eff6ff', color: '#1d4ed8', padding: '2px 8px', borderRadius: '4px' }}>
                          {s.division || '—'}
                        </span>
                      </td>
                      <td>{new Date(s.submitted_at).toLocaleString()}</td>
                      <td>{s.language.toUpperCase()}</td>
                      <td>
                        <span style={{
                          padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 600,
                          backgroundColor: s.is_late ? '#fef2f2' : '#ecfdf5',
                          color: s.is_late ? '#ef4444' : '#10b981'
                        }}>
                          {s.is_late ? 'Late' : 'In-Time'}
                        </span>
                      </td>
                      <td>{s.raw_marks} Marks</td>
                      <td style={{ fontWeight: 700, color: 'var(--primary)' }}>{s.normalized_marks} / 10</td>
                      <td>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <button
                            onClick={() => handleViewSubmission(s)}
                            style={{ padding: '6px 12px', borderRadius: '6px', border: 'none', backgroundColor: '#475569', color: 'white', cursor: 'pointer', fontWeight: 600, fontSize: '12px' }}
                          >
                            👁️ View Details
                          </button>
                          <button
                            onClick={() => handleDeleteSubmission(s)}
                            style={{ padding: '6px 10px', borderRadius: '6px', border: 'none', backgroundColor: '#ef4444', color: 'white', cursor: 'pointer', fontWeight: 600, fontSize: '12px' }}
                            title="Delete this student submission"
                          >
                            🗑️ Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {submissions.length === 0 && (
                    <tr><td colSpan="9" style={{ textAlign: 'center', color: '#888', padding: '40px' }}>No student submissions found.</td></tr>
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
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '15px', mb: '20px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div>
              <h3 style={{ fontSize: '18px', fontWeight: 600 }}>Grades Matrix (Pivot View)</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Grid layout showing each student's score across all active course practicals.</p>
            </div>

            {statsData && (
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Department:</label>
                  <select
                    value={selectedDepartmentFilter}
                    onChange={e => setSelectedDepartmentFilter(e.target.value)}
                    style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'white', fontSize: '13px', fontWeight: 600 }}
                  >
                    <option value="all">All Departments ({statsData.students?.length || 0})</option>
                    {Array.from(new Set((statsData?.students || []).map(s => s.department).filter(Boolean))).sort().map(dept => (
                      <option key={dept} value={dept}>
                        {dept} ({(statsData.students || []).filter(s => s.department === dept).length})
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  className="btn-primary"
                  style={{ width: 'auto', padding: '10px 18px', backgroundColor: '#10b981', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}
                  onClick={handleExportCSV}
                >
                  ⬆ {selectedDepartmentFilter === 'all' ? 'Export All Marks (CSV)' : `Export ${selectedDepartmentFilter} Marks (CSV)`}
                </button>
              </div>
            )}
          </div>

          {loadingStats ? <p>Loading marks matrix...</p> : statsData && statsData.practicals && (() => {
            const filteredStatsStudents = (statsData.students || []).filter(s => {
              if (selectedDepartmentFilter === 'all') return true;
              return (s.department || '').toUpperCase() === selectedDepartmentFilter.toUpperCase();
            });

            return (
              <div>
                <div className="table-container" style={{ overflowX: 'auto', marginTop: '15px' }}>
                  <table>
                    <thead>
                      <tr>
                        <th style={{ minWidth: '120px' }}>Roll Number</th>
                        <th style={{ minWidth: '170px' }}>Student Name</th>
                        <th style={{ minWidth: '110px' }}>Department</th>
                        <th style={{ minWidth: '90px' }}>Division</th>
                        {statsData.practicals.map((p, idx) => (
                          <th key={p.id} style={{ textAlign: 'center', minWidth: '120px' }}>
                            Prac {idx + 1}
                            <div style={{ fontSize: '11px', fontWeight: 'normal', color: 'var(--text-muted)', marginTop: '4px' }}>
                              {p.title.length > 20 ? p.title.substring(0, 18) + '..' : p.title}
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredStatsStudents.map(s => (
                        <tr key={s.id}>
                          <td style={{ fontWeight: 600, color: 'var(--primary)' }}>{s.roll_number || '—'}</td>
                          <td style={{ fontWeight: 500 }}>{s.name}</td>
                          <td>
                            <span style={{ fontSize: '12px', fontWeight: 600, backgroundColor: '#f1f5f9', padding: '2px 8px', borderRadius: '4px' }}>
                              {s.department || '—'}
                            </span>
                          </td>
                          <td>
                            <span style={{ fontSize: '12px', fontWeight: 600, backgroundColor: '#eff6ff', color: '#1d4ed8', padding: '2px 8px', borderRadius: '4px' }}>
                              {s.division || '—'}
                            </span>
                          </td>
                          {statsData.practicals.map(p => {
                            const sub = statsData.submissions.find(sub => sub.student_id === s.id && sub.practical_id === p.id);
                            return (
                              <td key={p.id} style={{ textAlign: 'center' }}>
                                {sub ? (
                                  <div>
                                    <span style={{ fontWeight: 700, color: 'var(--primary)' }}>{sub.normalized_marks} / 10</span>
                                    {sub.is_late && (
                                      <span style={{
                                        display: 'block', fontSize: '9px', fontWeight: 'bold', color: '#ef4444', marginTop: '2px'
                                      }}>
                                        LATE
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <span style={{ color: '#94a3b8', fontSize: '12px', fontStyle: 'italic' }}>Not Submitted</span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                      {filteredStatsStudents.length === 0 && (
                        <tr>
                          <td colSpan={statsData.practicals.length + 4} style={{ textAlign: 'center', color: '#888', padding: '40px' }}>
                            No students found for department "{selectedDepartmentFilter}".
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })()}
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

              <div style={{ display: 'flex', gap: '15px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Start Time (Optional)</label>
                  <input
                    type="datetime-local"
                    className="input-field"
                    value={pracStartTime}
                    onChange={e => setPracStartTime(e.target.value)}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>End Time (Optional)</label>
                  <input
                    type="datetime-local"
                    className="input-field"
                    value={pracEndTime}
                    onChange={e => setPracEndTime(e.target.value)}
                  />
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
                  onChange={e => setPracDesc(e.target.value)} required style={{ fontFamily: 'monospace' }} /> </div> <div style={{ marginTop: '15px' }}> <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Topics (comma separated)</label> <input type="text" className="input-field" placeholder="e.g. Arrays, Sorting, Dynamic Programming" value={pracTopics} onChange={e => setPracTopics(e.target.value)} /> </div>

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
                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                  <p style={{ fontWeight: 'bold', marginBottom: '8px', fontSize: '13px', color: '#1e293b' }}>Sample Test Cases (Shown to students)</p>
                  {sampleTestCases.map((tc, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: '10px', alignItems: 'center', borderBottom: '1px solid #f1f5f9', pb: '10px', marginBottom: '10px' }}>
                      <div style={{ flex: 1 }}>
                        <textarea
                          className="input-field"
                          rows={2}
                          placeholder={`Sample Input ${idx + 1}`}
                          value={tc.input}
                          onChange={e => {
                            const updated = [...sampleTestCases];
                            updated[idx].input = e.target.value;
                            setSampleTestCases(updated);
                          }}
                          required
                          style={{ padding: '6px', fontFamily: 'monospace', resize: 'vertical' }}
                        />
                      </div>
                      <div style={{ flex: 1 }}>
                        <textarea
                          className="input-field"
                          rows={2}
                          placeholder={`Sample Output ${idx + 1}`}
                          value={tc.expected}
                          onChange={e => {
                            const updated = [...sampleTestCases];
                            updated[idx].expected = e.target.value;
                            setSampleTestCases(updated);
                          }}
                          required
                          style={{ padding: '6px', fontFamily: 'monospace', resize: 'vertical' }}
                        />
                      </div>
                      <button type="button" style={{ border: 'none', background: 'none', color: '#ef4444', fontWeight: 'bold', cursor: 'pointer', fontSize: '18px', padding: '0 5px' }} onClick={() => {
                        if (sampleTestCases.length <= 1) {
                          alert('At least 1 sample test case must remain.');
                          return;
                        }
                        setSampleTestCases(sampleTestCases.filter((_, i) => i !== idx));
                      }}>
                        ×
                      </button>
                    </div>
                  ))}
                  <button type="button" onClick={() => setSampleTestCases([...sampleTestCases, { input: '', expected: '' }])} style={{ background: '#f8fafc', color: '#0066b1', border: '1px dashed #cbd5e1', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
                    + Add Sample Test Case
                  </button>
                </div>
              </div>

              {/* Test Cases configuration */}
              <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '15px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <h4 style={{ fontSize: '14px', fontWeight: 600 }}>Test Cases Config ({testCases.length} / 20)</h4>
                  {true && (
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
                          
                          style={{ padding: '6px', fontFamily: 'monospace', resize: 'vertical' }}
                        />
                      </div>
                      <div style={{ width: '80px' }}>
                        <select
                          className="input-field"
                          value={tc.marks}
                          onChange={e => handleTestCaseChange(idx, 'marks', e.target.value)}
                          required
                          
                          style={{ padding: '6px' }}
                        >
                          {[...Array(11).keys()].map(n => (
                            <option key={n} value={n}>{n}</option>
                          ))}
                        </select>
                      </div>
                      {true && (
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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h4 style={{ fontSize: '14px', fontWeight: 600, margin: 0 }}>Submitted Raw Code:</h4>
                  <span style={{ fontSize: '11px', fontWeight: 700, backgroundColor: '#e2e8f0', color: '#334155', padding: '2px 8px', borderRadius: '4px', textTransform: 'uppercase' }}>
                    {viewingSubmission.language}
                  </span>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    ({viewingSubmission.code ? viewingSubmission.code.split('\n').length : 0} lines)
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => {
                      if (viewingSubmission?.code) {
                        navigator.clipboard.writeText(viewingSubmission.code);
                        setCopyCodeSuccess(true);
                        setTimeout(() => setCopyCodeSuccess(false), 2500);
                      }
                    }}
                    style={{
                      padding: '5px 12px', borderRadius: '6px', border: '1px solid #cbd5e1',
                      backgroundColor: copyCodeSuccess ? '#ecfdf5' : '#ffffff',
                      color: copyCodeSuccess ? '#059669' : '#1e293b',
                      fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: '5px'
                    }}
                  >
                    {copyCodeSuccess ? '✓ Copied!' : '📋 Copy Raw Code'}
                  </button>
                </div>
              </div>
              <div style={{ height: '380px', borderRadius: '8px', overflow: 'hidden', border: '1px solid #1e293b' }}><Editor height="100%" language={viewingSubmission.language === 'c' || viewingSubmission.language === 'cpp' ? 'cpp' : viewingSubmission.language} theme="vs-dark" value={viewingSubmission.code} options={{ readOnly: true, minimap: { enabled: false }, scrollBeyondLastLine: false, fontSize: 13, fontFamily: 'JetBrains Mono, Fira Code, Consolas, monospace' }} /></div>
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px' }}>
              <button
                type="button"
                onClick={() => handleDeleteSubmission(viewingSubmission)}
                style={{ padding: '10px 18px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }}
              >
                🗑️ Delete Submission
              </button>
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

      {/* MODAL: GRANT EXTRA TIME */}
      {extraTimePractical && (
        <div style={{
          position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: '20px'
        }}>
          <div style={{
            background: 'white', borderRadius: '16px', padding: '28px',
            width: '100%', maxWidth: '520px', boxShadow: '0 20px 60px rgba(0,0,0,0.25)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div>
                <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Extend Timeline
                </span>
                <h3 style={{ fontSize: '19px', fontWeight: 700, color: 'var(--text-main)', marginTop: '2px' }}>
                  Grant Extra Time
                </h3>
              </div>
              <button
                onClick={() => setExtraTimePractical(null)}
                style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#94a3b8' }}
              >
                ×
              </button>
            </div>

            <p style={{ fontSize: '13.5px', color: 'var(--text-muted)', marginBottom: '16px' }}>
              Practical: <strong style={{ color: 'var(--text-main)' }}>{extraTimePractical.title}</strong>
            </p>

            <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px', marginBottom: '20px' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Current Status:</div>
              <div style={{ marginTop: '4px' }}>
                {renderTimelineBadge(extraTimePractical.start_time, extraTimePractical.end_time)}
              </div>
              {extraTimePractical.end_time && (
                <div style={{ fontSize: '12px', color: '#64748b', marginTop: '6px' }}>
                  Deadline: <strong>{new Date(extraTimePractical.end_time).toLocaleString()}</strong>
                </div>
              )}
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--text-main)', display: 'block', marginBottom: '8px' }}>
                ⚡ Quick Add Presets:
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                {[10, 15, 30, 60].map(mins => (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => handleApplyExtraTime(mins)}
                    disabled={processing}
                    style={{
                      padding: '10px 8px', borderRadius: '8px', border: '1px solid #cbd5e1',
                      backgroundColor: '#ffffff', color: '#1e293b', fontWeight: 600, fontSize: '13px',
                      cursor: 'pointer', transition: 'all 0.15s', textAlign: 'center'
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.color = 'var(--primary)'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = '#cbd5e1'; e.currentTarget.style.color = '#1e293b'; }}
                  >
                    +{mins >= 60 ? `${mins / 60}h` : `${mins}m`}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--text-main)', display: 'block', marginBottom: '8px' }}>
                Or Add Custom Minutes:
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="number"
                  min="1"
                  max="1440"
                  className="input-field"
                  placeholder="e.g. 45"
                  value={extraMinutesInput}
                  onChange={e => setExtraMinutesInput(e.target.value)}
                  style={{ flex: 1, padding: '8px 12px' }}
                />
                <button
                  type="button"
                  onClick={() => handleApplyExtraTime(parseInt(extraMinutesInput))}
                  disabled={processing || !extraMinutesInput}
                  className="btn-primary"
                  style={{ width: 'auto', padding: '8px 18px', margin: 0, fontSize: '13px' }}
                >
                  Apply
                </button>
              </div>
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--text-main)', display: 'block', marginBottom: '8px' }}>
                Or Pick Exact New End Time:
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="datetime-local"
                  className="input-field"
                  value={customEndTimeInput}
                  onChange={e => setCustomEndTimeInput(e.target.value)}
                  style={{ flex: 1, padding: '8px 12px' }}
                />
                <button
                  type="button"
                  onClick={() => handleApplyExtraTime(null, customEndTimeInput)}
                  disabled={processing || !customEndTimeInput}
                  style={{
                    padding: '8px 18px', borderRadius: '6px', border: '1px solid var(--primary)',
                    backgroundColor: 'var(--primary)', color: 'white', fontWeight: 600, fontSize: '13px',
                    cursor: 'pointer'
                  }}
                >
                  Set
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid #f1f5f9', paddingTop: '16px' }}>
              <button
                type="button"
                onClick={() => setExtraTimePractical(null)}
                style={{ padding: '8px 20px', border: '1px solid #cbd5e1', borderRadius: '6px', background: 'transparent', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
