'use client';
import { useState, useRef, useEffect } from 'react';
import { createRequestScope } from '@/lib/client/http-client';
import { fetchMarksPage } from '../api/reports-api';
import { usePolling } from '@/hooks/usePolling';

export function useMarksOverview({ selectedCourse, activeTab, token, socket, showToast }) {
  // Marks Overview state
  const [statsStudentCursor, setStatsStudentCursor] = useState(null);
  const [statsPracticalCursor, setStatsPracticalCursor] = useState(null);
  const [requests] = useState(createRequestScope);
  const statsRefresh = useRef(null);
  const [statsData, setStatsData] = useState(null);
  const [loadingStats, setLoadingStats] = useState(false);

  const [selectedDepartmentFilter, setSelectedDepartmentFilter] = useState('all');
  // Load stats
  useEffect(() => {
    setStatsData(null);
    setStatsStudentCursor(null);
    setStatsPracticalCursor(null);
    setLoadingStats(false);
    const scope = requests;
    if (selectedCourse && activeTab === 'marks') {
      fetchStats(true, null, null);
    }

    if (!socket || !selectedCourse || activeTab !== 'marks') return () => scope.cancel();

    const handleNewSubmissionMarks = () => {
      statsRefresh.current?.();
    };

    socket.on('new_submission_marks', handleNewSubmissionMarks);

    return () => {
      scope.cancel();
      socket.off('new_submission_marks', handleNewSubmissionMarks);
    };
  }, [selectedCourse, activeTab, socket, selectedDepartmentFilter]);

  const fetchStats = async (showLoading = true, studentCursor = statsStudentCursor, practicalCursor = statsPracticalCursor) => {
    if (!selectedCourse || activeTab !== 'marks') return;
    const request = requests.begin();
    if (showLoading) setLoadingStats(true);
    try {
      const { data } = await fetchMarksPage(selectedCourse, token(), {
        studentCursor, practicalCursor, department: selectedDepartmentFilter,
      }, request.signal);
      if (request.isCurrent()) {
        setStatsData(data); setStatsStudentCursor(studentCursor); setStatsPracticalCursor(practicalCursor);
      }
    } catch (e) { if (request.isCurrent()) showToast('error', e.message); }
    finally { if (request.isCurrent()) setLoadingStats(false); }
  };

  useEffect(() => { statsRefresh.current = () => fetchStats(false); });

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

    const marks = new Map(statsData.submissions.map(s => [`${s.student_id}:${s.practical_id}`, s]));
    const rows = studentsToExport.map(s => {
      const row = [s.roll_number || '—', s.name, s.email, s.department || '—', s.division || '—'];
      statsData.practicals.forEach(p => {
        const sub = marks.get(`${s.id}:${p.id}`);
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
    link.setAttribute('download', `${courseCodeStr.replace(/\s+/g, '_')}_${deptSuffix}_grades_matrix_page.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };


  usePolling(() => fetchStats(false), 30_000, Boolean(selectedCourse && activeTab === 'marks'));
  return { statsData, selectedDepartmentFilter, setSelectedDepartmentFilter, handleExportCSV, loadingStats, statsStudentCursor, statsPracticalCursor, fetchStats };
}
