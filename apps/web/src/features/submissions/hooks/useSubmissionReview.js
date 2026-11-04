'use client';
import { useState, useEffect } from 'react';
import { createRequestScope } from '@/lib/http-client';
import { fetchSubmissionPage, fetchSubmission, deleteSubmission } from '../api/submissions-api';
import { usePolling } from '@/hooks/usePolling';

export function useSubmissionReview({ selectedCourse, selectedPracticalId, activeTab, token, socket, showToast, fetchPracticals, fetchStats }) {
  const [reviewProcessing, setProcessing] = useState(false);
  const [submissionCursor, setSubmissionCursor] = useState(null);
  const [nextSubmissionCursor, setNextSubmissionCursor] = useState(null);
  const [requests] = useState(createRequestScope);
  const [details] = useState(createRequestScope);
  const [submissions, setSubmissions] = useState([]);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');
  const [submissionStatusFilter, setSubmissionStatusFilter] = useState('in-time');
  const [submissionSortBy, setSubmissionSortBy] = useState('submission_time');
  const [submissionSortOrder, setSubmissionSortOrder] = useState('DESC');
  const [viewingSubmission, setViewingSubmission] = useState(null);
  const [showSubmissionModal, setShowSubmissionModal] = useState(false);
  const [copyCodeSuccess, setCopyCodeSuccess] = useState(false);

  const [submissionDivisionFilter, setSubmissionDivisionFilter] = useState('all');
  const fetchSubmissions = async (showLoading = true, cursor = submissionCursor) => {
    if (!selectedPracticalId || activeTab !== 'submissions') return;
    const request = requests.begin();
    if (showLoading) setLoadingSubmissions(true);
    try {
      const { data, nextCursor } = await fetchSubmissionPage(selectedPracticalId, token(), {
        studentSearch, status: submissionStatusFilter, sortBy: submissionSortBy,
        sortOrder: submissionSortOrder, division: submissionDivisionFilter, cursor,
      }, request.signal);
      if (!request.isCurrent()) return;
      setSubmissions(data);
      setSubmissionCursor(cursor);
      setNextSubmissionCursor(nextCursor);
    } catch (e) {
      if (request.isCurrent()) showToast('error', e.message);
    } finally {
      if (request.isCurrent()) setLoadingSubmissions(false);
    }
  };

  useEffect(() => {
    setSubmissions([]);
    setSubmissionCursor(null);
    setNextSubmissionCursor(null);
    setLoadingSubmissions(false);
    if (selectedPracticalId && activeTab === 'submissions') fetchSubmissions(true, null);
    const scope = requests;
    return () => scope.cancel();
  }, [selectedCourse, selectedPracticalId, activeTab, studentSearch, submissionStatusFilter, submissionSortBy, submissionSortOrder, submissionDivisionFilter]);

  // Socket: Submissions room for active practical
  useEffect(() => {
    if (!socket || !selectedPracticalId || activeTab !== 'submissions') return;

    const join = () => socket.emit('join_practical_room', selectedPracticalId);
    join();
    socket.on('connect', join);

    // A new row can change sorting, filters and cursor boundaries.
    const handleNewSubmission = () => { fetchSubmissions(false); };

    socket.on('new_submission', handleNewSubmission);

    return () => {
      socket.off('connect', join);
      socket.off('new_submission', handleNewSubmission);
      socket.emit('leave_practical_room', selectedPracticalId);
    };
  }, [socket, activeTab, selectedPracticalId, submissionCursor, studentSearch, submissionStatusFilter, submissionSortBy, submissionSortOrder, submissionDivisionFilter]);

  const handleViewSubmission = async (s) => {
    const request = details.begin();
    setProcessing(true);
    try {
      const { data } = await fetchSubmission(s.id, token(), request.signal);
      if (request.isCurrent()) {
        let code = data.code || '';
        if (typeof code === 'string' && code.trim().length > 20 && code.trim().length % 4 === 0 && /^[A-Za-z0-9+/]+={0,2}$/.test(code.trim())) {
          try {
            const decoded = atob(code.trim());
            if (btoa(decoded) === code.trim()) code = decoded;
          } catch {}
        }
        setViewingSubmission({ ...data, code });
        setShowSubmissionModal(true);
      }
    } catch (e) {
      if (request.isCurrent()) showToast('error', 'Could not fetch submission details.');
    } finally {
      if (request.isCurrent()) setProcessing(false);
    }
  };

  const handleDeleteSubmission = async (s) => {
    if (!confirm(`Are you sure you want to delete the submission for student "${s.student_name || 'Student'}" (Score: ${s.normalized_marks}/10)? This cannot be undone.`)) {
      return;
    }

    const request = details.begin();
    setProcessing(true);
    try {
      await deleteSubmission(s.id, token());
      if (request.isCurrent()) {
        showToast('success', 'Submission deleted successfully.');
        setShowSubmissionModal(false);
        setViewingSubmission(null);
        fetchSubmissions();
        fetchPracticals();
        if (selectedCourse && activeTab === 'marks') fetchStats();
      }
    } catch (e) {
      if (request.isCurrent()) showToast('error', e.message || 'Network error deleting submission.');
    } finally {
      if (request.isCurrent()) setProcessing(false);
    }
  };


  useEffect(() => {
    setShowSubmissionModal(false);
    setViewingSubmission(null);
    setCopyCodeSuccess(false);
    const scope = details;
    return () => { scope.cancel(); setProcessing(false); };
  }, [selectedCourse, selectedPracticalId, activeTab]);
  usePolling(() => fetchSubmissions(false), 30_000, Boolean(selectedPracticalId && activeTab === 'submissions'));
  return { reviewProcessing, studentSearch, setStudentSearch, submissionDivisionFilter, setSubmissionDivisionFilter, submissionStatusFilter, setSubmissionStatusFilter, submissionSortBy, setSubmissionSortBy, submissionSortOrder, setSubmissionSortOrder, loadingSubmissions, submissions, handleViewSubmission, handleDeleteSubmission, submissionCursor, nextSubmissionCursor, fetchSubmissions, viewingSubmission, showSubmissionModal, copyCodeSuccess, setCopyCodeSuccess, setShowSubmissionModal };
}
