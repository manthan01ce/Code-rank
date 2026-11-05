'use client';
import { createRequestScope } from '@/lib/http-client';
import WorkspaceReturn from '@/components/layout/WorkspaceReturn';
import styles from '@/features/dashboard/components/overview.module.css';
import { StudentThemeToggle, useStudentTheme } from '@/components/layout/StudentTheme';
import { usePracticalPage } from '@/features/practicals/hooks/usePracticalPage';
import { fetchCollection } from '@/lib/fetch-collection';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Editor from '@monaco-editor/react';
import ChangePasswordModal from '@/features/auth/components/ChangePasswordModal';
import { useSocket } from '@/hooks/useSocket';
import { usePolling } from '@/hooks/usePolling';

export function useStudentPracticals() {
  const router = useRouter();
  const studentTheme = useStudentTheme();
  const socket = useSocket();
  const [user, setUser] = useState(null);
  const [courses, setCourses] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState('');
  const practicalPage = usePracticalPage(selectedCourse, Boolean(selectedCourse));
  const { rows: practicals, loading, refresh: fetchPracticals } = practicalPage;
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);

  // Solving mode states
  const [workspaceRequests] = useState(createRequestScope);
  const [historyRequests] = useState(createRequestScope);
  const [activePractical, setActivePracticalState] = useState(null);
  const setActivePractical = (value) => {
    workspaceRequests.cancel(); historyRequests.cancel();
    setActivePracticalState(value);
  };
  useEffect(() => {
    setActivePracticalState(null);
    return () => { workspaceRequests.cancel(); historyRequests.cancel(); };
  }, [selectedCourse, workspaceRequests, historyRequests]);
  const [code, setCode] = useState('');
  const [language, setLanguage] = useState('python');
  const [submissionHistory, setSubmissionHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [viewingHistorySub, setViewingHistorySub] = useState(null);

  // Execution states
  const [executing, setExecuting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [execResult, setExecResult] = useState(null);
  const [execError, setExecError] = useState(null);

  const token = () => localStorage.getItem('token');

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (userData) {
      const parsed = JSON.parse(userData);
      setUser(parsed);
      const sem = parsed.extra_info?.semester;
      if (sem) {
        fetchStudentCourses(sem);
      }
    } else {
      router.push('/');
    }
  }, []);

  useEffect(() => {
    const handleCopyCutPaste = (e) => {
      e.preventDefault();
      alert('Copying, cutting, or pasting code is disabled on this dashboard.');
    };

    const handleKeyDown = (e) => {
      if (e.key === 'PrintScreen') {
        navigator.clipboard.writeText('');
        alert('Screenshots are discouraged on this platform.');
      }
      if ((e.ctrlKey || e.metaKey) && ['c', 'v', 'x'].includes(e.key.toLowerCase())) {
        e.preventDefault();
        alert('Copy, cut, and paste shortcuts are disabled.');
      }
    };

    document.addEventListener('copy', handleCopyCutPaste);
    document.addEventListener('cut', handleCopyCutPaste);
    document.addEventListener('paste', handleCopyCutPaste);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('copy', handleCopyCutPaste);
      document.removeEventListener('cut', handleCopyCutPaste);
      document.removeEventListener('paste', handleCopyCutPaste);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const fetchStudentCourses = async (sem) => {
    try {
      const rows = await fetchCollection(`/api/courses?semester=${sem}`, {
        headers: { Authorization: `Bearer ${token()}` }
      });
      setCourses(rows);
    } catch (e) {
      console.error('Error fetching courses:', e);
    }
  };

  useEffect(() => {
    if (selectedCourse) {
      fetchPracticals();
      if (socket) {
        socket.emit('join_course_room', selectedCourse);

        const handlePracticalAdded = () => fetchPracticals();

        socket.on('practical_added', handlePracticalAdded);

        return () => {
          socket.emit('leave_course_room', selectedCourse);
          socket.off('practical_added', handlePracticalAdded);
        };
      }
    }
  }, [selectedCourse, socket]);

  // Auto-refresh practicals list every 15 seconds
  usePolling(fetchPracticals, 15_000, Boolean(selectedCourse && !activePractical));

  const getBoilerplate = (lang, p = activePractical) => {
    if (p && p.starter_code && p.starter_code[lang]) {
      return p.starter_code[lang];
    }
    if (lang === 'python') {
      return `import sys

def main():
    # Read from stdin, write to stdout
    # line = sys.stdin.readline()
    pass

if __name__ == '__main__':
    main()
`;
    } else {
      return `#include <iostream>
using namespace std;

int main() {
    // Read from stdin, write to stdout
    return 0;
}
`;
    }
  };

  const handleStartSolve = async (p) => {
    setActivePractical(p);
    const request = workspaceRequests.begin();
    const allowed = p.starter_code?.allowed_languages || ['python', 'cpp'];
    const defaultLang = allowed.includes('python') ? 'python' : (allowed[0] || 'python');
    setLanguage(defaultLang);

    // Load from database if exists
    try {
      const res = await fetch(`/api/student/workspaces/load?practical_id=${p.id}&language=${defaultLang}`, {
        headers: { Authorization: `Bearer ${token()}` }, signal: request.signal
      });
      if (res.ok) {
        const data = await res.json();
        if (!request.isCurrent()) return;
        if (data.latest_code) {
          setCode(data.latest_code);
        } else {
          if (request.isCurrent()) setCode(getBoilerplate(defaultLang, p));
        }
      } else {
        if (request.isCurrent()) setCode(getBoilerplate(defaultLang, p));
      }
    } catch {
      if (request.isCurrent()) setCode(getBoilerplate(defaultLang, p));
    }

    if (!request.isCurrent()) return;
    setExecResult(null);
    setExecError(null);
    setViewingHistorySub(null);
    fetchSubmissionHistory(p.id);
  };

  const fetchSubmissionHistory = async (practicalId) => {
    const request = historyRequests.begin();
    setLoadingHistory(true);
    try {
      // Get student submissions for this practical
      const res = await fetch(`/api/student/practicals/${practicalId}/submissions`, {
        headers: { Authorization: `Bearer ${token()}` }, signal: request.signal
      });
      if (res.ok) {
        const rows = await res.json();
        if (request.isCurrent()) setSubmissionHistory(rows);
      }
    } catch (e) {
      console.error(e);
    } finally {
      if (request.isCurrent()) setLoadingHistory(false);
    }
  };

  const handleLanguageChange = async (lang) => {
    const request = workspaceRequests.begin();
    setLanguage(lang);
    if (activePractical) {
      try {
        const res = await fetch(`/api/student/workspaces/load?practical_id=${activePractical.id}&language=${lang}`, {
          headers: { Authorization: `Bearer ${token()}` }, signal: request.signal
        });
        if (res.ok) {
          const data = await res.json();
          if (!request.isCurrent()) return;
        if (!request.isCurrent()) return;
          if (data.latest_code) {
            setCode(data.latest_code);
            return;
          }
        }
      } catch (e) {
        console.error(e);
      }
      if (request.isCurrent()) setCode(getBoilerplate(lang, activePractical));
    }
  };

  const handleSaveWorkspace = async () => {
    if (!activePractical || saving) return;
    setSaving(true);
    try {
      const res = await fetch('/api/student/workspaces/save', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          practical_id: activePractical.id,
          language,
          code
        })
      });
      if (res.ok) {
        alert('Draft code saved to server successfully.');
      } else {
        alert('Failed to save draft code.');
      }
    } catch (e) {
      alert('Network error saving code draft.');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    if (!window.confirm("Are you sure you want to log out?")) return;

    localStorage.removeItem('token');
    localStorage.removeItem('user');
    router.push('/');
  };

  const handleCodeReset = () => {
    if (activePractical && confirm('Are you sure you want to reset your code to the starter template?')) {
      setCode(getBoilerplate(language));
    }
  };

  const handleRunSubmit = async () => {
    if (!code.trim() || executing) return;
    setExecuting(true);
    setExecResult(null);
    setExecError(null);

    try {
      const res = await fetch(`/api/student/practicals/${activePractical.id}/submit`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ code, language })
      });

      const data = await res.json();
      if (res.ok) {
        setExecResult(data);
        fetchSubmissionHistory(activePractical.id);
        fetchPracticals(); // update status in list
      } else {
        setExecError(data.error || 'Execution failed.');
      }
    } catch (e) {
      setExecError('Network/Connection error.');
    } finally {
      setExecuting(false);
    }
  };

  const handleViewHistoryDetail = async (subId) => {
    setLoadingHistory(true);
    try {
      const res = await fetch(`/api/faculty/submissions/${subId}`, {
        headers: { Authorization: `Bearer ${token()}` }
      });
      if (res.ok) {
        setViewingHistorySub(await res.json());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingHistory(false);
    }
  };


  return { router, studentTheme, socket, user, setUser, courses, setCourses, selectedCourse, setSelectedCourse, practicalPage, practicals, loading, fetchPracticals, isChangePasswordOpen, setIsChangePasswordOpen, activePractical, setActivePractical, code, setCode, language, setLanguage, submissionHistory, setSubmissionHistory, loadingHistory, setLoadingHistory, viewingHistorySub, setViewingHistorySub, executing, setExecuting, saving, setSaving, execResult, setExecResult, execError, setExecError, token, fetchStudentCourses, getBoilerplate, handleStartSolve, fetchSubmissionHistory, handleLanguageChange, handleSaveWorkspace, handleLogout, handleCodeReset, handleRunSubmit, handleViewHistoryDetail };
}
