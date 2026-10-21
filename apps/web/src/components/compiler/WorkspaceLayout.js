'use client';

/**
 * PURPOSE OF THIS FILE:
 * Main layout container for the student coding playground & workspace.
 * It integrates:
 * - Left Panel: Problem details (ProblemPanel) and inline submission history logs.
 * - Right Upper Panel: Monaco Code Editor (MonacoEditorPanel) with language restrictions, customizable font size, and tab spacing settings.
 * - Right Lower Panel: Stdin/Stdout execution output console (ConsolePanel).
 * - Settings & Account menu: A User profile dropdown managing profile updates, password changes, preferences, and logout.
 */

import { fetchCollection } from '@/lib/fetch-collection';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Panel, Group as PanelGroup, Separator as PanelResizeHandle } from 'react-resizable-panels';
import ProblemPanel from './ProblemPanel';
import MonacoEditorPanel from './MonacoEditorPanel';
import ConsolePanel from './ConsolePanel';
import { Play, ChevronRight, Settings, User, List, Save } from 'lucide-react';
import { DEFAULT_LANGUAGE, LANGUAGES } from './LanguageConfig';
import { STATIC_PROBLEMS } from '@/lib/problems';
import { waitForJob } from '@/lib/wait-for-job';
import { useSocket } from '@/hooks/useSocket';

// ── Stdin/Stdout boilerplates for practicals (main() style) ──────────────────
// Practicals use stdin/stdout execution, NOT the class-based function runner.
// Students must use main() / input() patterns — NOT class Solution.
const PRACTICAL_BOILERPLATES = {
  python: `# Read input using input() or sys.stdin
# Print output using print()
import sys

def main():
    # Write your Python solution here
    # Example: n = int(input())
    pass

if __name__ == '__main__':
    main()
`,
  cpp: `#include <iostream>
#include <vector>
#include <string>
#include <algorithm>
#include <sstream>
#include <cmath>
using namespace std;

int main() {
    // Read input using cin
    // Print output using cout
    // Example: int n; cin >> n;
    
    return 0;
}
`,
  c: `#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>

int main() {
    // Read input using scanf
    // Print output using printf
    // Example: int n; scanf("%d", &n);
    
    return 0;
}
`,
  java: `import java.util.*;
import java.io.*;

public class Solution {
    public static void main(String[] args) throws IOException {
        Scanner sc = new Scanner(System.in);
        // Read input using sc.nextInt(), sc.nextLine(), etc.
        // Print output using System.out.println()
    }
}
`,
  javascript: `const readline = require('readline');
const rl = readline.createInterface({ input: process.stdin });
const lines = [];
rl.on('line', line => lines.push(line.trim()));
rl.on('close', () => {
    // Process input from 'lines' array
    // Example: const n = parseInt(lines[0]);
    // Print output using console.log()
});
`,
};

// Module-level cache removed per binary save implementation

// ── Friendly error message mapper ─────────────────────────────────────────────
function friendlyError(err, fallback = 'Something went wrong. Please try again.') {
  if (!err) return fallback;
  const msg = (typeof err === 'string' ? err : err.message || '').toLowerCase();
  if (msg.includes('unexpected end of json') || msg.includes('failed to parse')) {
    return 'Received an unexpected response from the server. Please refresh and try again.';
  }
  if (msg.includes('fetch failed') || msg.includes('networkerror') || msg.includes('network error') || msg.includes('failed to fetch')) {
    return 'Unable to reach the server. Check your internet connection and try again.';
  }
  if (msg.includes('unauthorized') || msg.includes('401')) {
    return 'Your session has expired. Please log in again.';
  }
  if (msg.includes('429') || msg.includes('too many requests')) {
    return 'Too many requests — please wait a moment and try again.';
  }
  if (msg.includes('500') || msg.includes('internal server')) {
    return 'A server error occurred. Please try again shortly.';
  }
  // If short and human-looking, surface it; otherwise use fallback
  const raw = typeof err === 'string' ? err : err.message || '';
  return raw && raw.length < 120 ? raw : fallback;
}

export default function WorkspaceLayout({ problem }) {
  const router = useRouter();
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const handleLogout = () => setShowLogoutModal(true);
  const confirmLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    router.push('/');
  };
  const [consoleOpen, setConsoleOpen] = useState(true);
  const [selectedLang, setSelectedLang] = useState(DEFAULT_LANGUAGE);
  const [isListOpen, setIsListOpen] = useState(false);
  const [practicals, setPracticals] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState('All');
  const socket = useSocket();
  const hasAutoNavigated = useRef(false);

  // Profile, Settings, and Submissions Modals states
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  const userDropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (userDropdownRef.current && !userDropdownRef.current.contains(event.target)) {
        setIsUserDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showSubmissionsModal, setShowSubmissionsModal] = useState(false);
  const [userSubmissions, setUserSubmissions] = useState([]);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);

  // Settings preferences states
  const [editorFontSize, setEditorFontSize] = useState(14);
  const [editorTabSize, setEditorTabSize] = useState(4);
  const [editorTheme, setEditorTheme] = useState('vs-dark');
  const [editorWordWrap, setEditorWordWrap] = useState('on');
  const [editorMinimap, setEditorMinimap] = useState(false);

  // Profile forms states
  const [profileForm, setProfileForm] = useState({ name: '', email: '', currentPassword: '', newPassword: '', confirmPassword: '' });
  const [profileMsg, setProfileMsg] = useState({ type: '', text: '' });

  // Initial preferences loading
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const subject = urlParams.get('subject');
      if (subject) setSelectedCourse(subject);

      const savedFontSize = localStorage.getItem('pref_font_size');
      if (savedFontSize) setEditorFontSize(parseInt(savedFontSize));

      const savedTabSize = localStorage.getItem('pref_tab_size');
      if (savedTabSize) setEditorTabSize(parseInt(savedTabSize));

      const savedTheme = localStorage.getItem('pref_theme');
      if (savedTheme) setEditorTheme(savedTheme);

      const savedWordWrap = localStorage.getItem('pref_word_wrap');
      if (savedWordWrap) setEditorWordWrap(savedWordWrap);

      const savedMinimap = localStorage.getItem('pref_minimap');
      if (savedMinimap !== null) setEditorMinimap(savedMinimap === 'true');

      const userData = localStorage.getItem('user');
      if (userData) {
        const parsed = JSON.parse(userData);
        setProfileForm({ name: parsed.name || '', email: parsed.email || '', currentPassword: '', newPassword: '', confirmPassword: '' });
      }
    }
  }, []);

  const fetchUserSubmissions = async () => {
    setLoadingSubmissions(true);
    try {
      const token = localStorage.getItem('token');
      const data = await fetchCollection('/api/student/submissions', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUserSubmissions(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingSubmissions(false);
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setProfileMsg({ type: '', text: '' });

    if (profileForm.newPassword) {
      if (profileForm.newPassword !== profileForm.confirmPassword) {
        setProfileMsg({ type: 'error', text: 'New passwords do not match.' });
        return;
      }
      if (!profileForm.currentPassword) {
        setProfileMsg({ type: 'error', text: 'Current password is required to change password.' });
        return;
      }
    }

    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: profileForm.name,
          email: profileForm.email,
          currentPassword: profileForm.currentPassword,
          newPassword: profileForm.newPassword
        })
      });
      let data = {};
      try {
        const text = await res.text();
        data = text ? JSON.parse(text) : {};
      } catch {
        data = {};
      }

      if (res.ok) {
        if (data.token) {
          localStorage.setItem('token', data.token);
          if (socket) {
            socket.disconnect().connect();
          }
        }
        setProfileMsg({ type: 'success', text: 'Profile updated successfully!' });
        // Update user in localStorage
        try {
          const userData = JSON.parse(localStorage.getItem('user') || '{}');
          if (userData && typeof userData === 'object') {
            userData.name = profileForm.name;
            userData.email = profileForm.email;
            localStorage.setItem('user', JSON.stringify(userData));
          }
        } catch {}
        // Clear password fields
        setProfileForm(prev => ({ ...prev, currentPassword: '', newPassword: '', confirmPassword: '' }));
      } else {
        setProfileMsg({ type: 'error', text: data.error || `Failed to update profile (${res.status}).` });
      }
    } catch (err) {
      setProfileMsg({ type: 'error', text: friendlyError(err) });
    }
  };

  const fetchPracticals = () => {
    const token = localStorage.getItem('token');
    if (!token) return;
    fetch('/api/student/practicals', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setPracticals(data);
        }
      })
      .catch(err => console.error('Error fetching student practicals:', err));
  };

  useEffect(() => {
    fetchPracticals();
  }, []);

  useEffect(() => {
    if (!socket) return;
    socket.on('practical_added', fetchPracticals);
    socket.on('practical_updated', fetchPracticals);
    socket.on('practical_deleted', fetchPracticals);
    return () => {
      socket.off('practical_added', fetchPracticals);
      socket.off('practical_updated', fetchPracticals);
      socket.off('practical_deleted', fetchPracticals);
    };
  }, [socket]);

  // Defensive fallback to avoid undefined crashes during Next.js build-time pre-render or hydration
  const resolvedProblem = problem || {
    id: '',
    title: 'Select a Practical',
    description: '<p>Please open the <strong>Problem List</strong> dropdown at the top to choose an assigned coding practical to solve.</p>',
    isPractical: true,
    difficulty: 'Easy',
    inputFormat: 'Select a practical from the list.',
    outputFormat: 'Select a practical from the list.',
    sampleInput: '-',
    sampleOutput: '-',
    constraints: '-'
  };

  // If student entered with empty problem ID (e.g. /student/code/1?subject=...), auto-route to first available practical
  useEffect(() => {
    if (!resolvedProblem?.id && practicals.length > 0 && !hasAutoNavigated.current) {
      const match = selectedCourse === 'All'
        ? practicals[0]
        : (practicals.find(p => 
            p.course_code === selectedCourse || 
            p.course_name === selectedCourse || 
            String(p.course_id) === String(selectedCourse)
          ) || practicals[0]);
      if (match) {
        hasAutoNavigated.current = true;
        const targetCourse = selectedCourse !== 'All' ? selectedCourse : (match.course_code || '');
        router.replace(`/student/code/practical_${match.id}${targetCourse ? `?subject=${encodeURIComponent(targetCourse)}` : ''}`);
      }
    }
  }, [practicals, selectedCourse, resolvedProblem?.id, router]);

  const getBoilerplate = (pId, lang) => {
    const activeProblemConfig = resolvedProblem;
    if (activeProblemConfig?.isPractical && activeProblemConfig?.starter_code?.[lang]) {
      return activeProblemConfig.starter_code[lang];
    }
    if (activeProblemConfig?.isPractical && PRACTICAL_BOILERPLATES[lang]) {
      return PRACTICAL_BOILERPLATES[lang];
    }
    return activeProblemConfig?.boilerplates?.[lang] || LANGUAGES[lang]?.boilerplate || '';
  };

  const [codeByLang, setCodeByLang] = useState({});

  const handleLoadSubmissionCode = (code, language) => {
    if (confirm("Are you sure you want to load this past submission? Your current editor code will be replaced.")) {
        setSelectedLang(language || 'txt');
        setCodeByLang(prev => ({ ...prev, [language || 'txt']: code }));
        setHasUnsavedChanges(true);
    }
  };

  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isLoadingCode, setIsLoadingCode] = useState(false);
  // 'idle' | 'saving' | 'saved' | 'error'
  const [saveStatus, setSaveStatus] = useState('idle');
  const saveStatusTimerRef = useRef(null);

  const [isRunning, setIsRunning] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSavingCode, setIsSavingCode] = useState(false);
  const [output, setOutput] = useState(null);

  const [lastRunCode, setLastRunCode] = useState('');
  const [hasSuccessfulRun, setHasSuccessfulRun] = useState(false);

  const [actionMode, setActionMode] = useState('run'); // 'run' | 'submit'
  const [judgeState, setJudgeState] = useState('idle'); // 'idle' | 'loading' | 'success' | 'error'
  const [submitPhase, setSubmitPhase] = useState(null); // 'submitting' | 'judging' | null

  // Non-blocking toast notification (replaces disruptive window.alert)
  const [workspaceNotice, setWorkspaceNotice] = useState(null);
  const noticeTimerRef = useRef(null);
  const showNotice = (text, type = 'warning') => {
    setWorkspaceNotice({ text, type });
    if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = setTimeout(() => setWorkspaceNotice(null), 4500);
  };

  // Keep code state fully synchronized whenever the routed problem changes
  useEffect(() => {
    if (!resolvedProblem?.id) return;
    
    let currentLang = localStorage.getItem(`coderank_selected_lang_${resolvedProblem.id}`) || selectedLang;
    if (resolvedProblem.isPractical && resolvedProblem.allowedLanguages && resolvedProblem.allowedLanguages.length > 0) {
      if (!resolvedProblem.allowedLanguages.includes(currentLang)) {
        currentLang = resolvedProblem.allowedLanguages[0];
      }
    }
    setSelectedLang(currentLang);

    const fetchCodeFromDB = async () => {
      setIsLoadingCode(true);
      const token = localStorage.getItem('token');
      const langKeys = ['python', 'javascript', 'cpp', 'c', 'java'];
      const initialMap = {};
      
      for (const lang of langKeys) {
        initialMap[lang] = getBoilerplate(resolvedProblem.id, lang);
      }

      if (token) {
        try {
          const res = await fetch(`/api/student/workspaces/load?practical_id=${resolvedProblem.id}&language=${currentLang}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (res.ok) {
            const data = await res.json();
            if (data.latest_code) {
              initialMap[currentLang] = data.latest_code;
            }
          } else {
            // Fallback to localStorage
            throw new Error('DB load failed, trying cache');
          }
        } catch (err) {
          console.error('Failed to load code from DB:', err);
          // Try localStorage as fallback
          try {
            const cacheKey = `workspace_${resolvedProblem.id}_${currentLang}`;
            const cachedCode = localStorage.getItem(cacheKey);
            if (cachedCode) {
              initialMap[currentLang] = cachedCode;
              console.log('Loaded code from browser cache');
            }
          } catch (localErr) {
            console.error('Failed to load from cache:', localErr);
          }
        }
      }
      
      setCodeByLang(initialMap);
      setHasUnsavedChanges(false);
      setIsLoadingCode(false);
    };

    fetchCodeFromDB();
    setOutput(null);
    setJudgeState('idle');
    setLastRunCode('');
    setHasSuccessfulRun(false);
  }, [resolvedProblem.id, resolvedProblem.allowedLanguages]);

  function handleCodeChange(newCode) {
    setCodeByLang((prev) => ({ ...prev, [selectedLang]: newCode }));
    setHasUnsavedChanges(true);
    setSaveStatus('idle');
  }

  async function handleLangChange(lang) {
    if (hasUnsavedChanges) {
      // Auto-save before switching language to prevent losing work
      await handleSaveCodeToDB();
    }
    setSelectedLang(lang);
    localStorage.setItem(`coderank_selected_lang_${resolvedProblem.id}`, lang);
    setOutput(null);
    setJudgeState('idle');
    setLastRunCode('');
    setHasSuccessfulRun(false);

    setIsLoadingCode(true);
    const token = localStorage.getItem('token');
    let loadedCode = getBoilerplate(resolvedProblem.id, lang);
    if (token) {
      try {
        const res = await fetch(`/api/student/workspaces/load?practical_id=${resolvedProblem.id}&language=${lang}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          if (data.latest_code) {
            loadedCode = data.latest_code;
          }
        }
      } catch (err) {
        console.error(err);
      }
    }
    setCodeByLang((prev) => ({ ...prev, [lang]: loadedCode }));
    setIsLoadingCode(false);
  }

  function handleResetCode() {
    if (window.confirm('Reset code to default template?')) {
      const bp = getBoilerplate(resolvedProblem.id, selectedLang);
      setCodeByLang((prev) => ({ ...prev, [selectedLang]: bp }));
      setHasUnsavedChanges(true);
    }
  }

  async function handleRun() {
    if (!canRun) return;

    if (resolvedProblem.startTime && new Date() < new Date(resolvedProblem.startTime)) {
      showNotice(`This practical has not started yet. Scheduled start time: ${new Date(resolvedProblem.startTime).toLocaleString()}`, 'warning');
      return;
    }

    const code = codeByLang[selectedLang];
    if (!code?.trim()) return;

    // Auto-save code before running
    await handleSaveCodeToDB();

    setActionMode('run');
    setJudgeState('loading');
    setIsRunning(true);
    setConsoleOpen(true);
    setOutput(null);

    try {
      const runEndpoint = `/api/${selectedLang}-run`;
      const token = localStorage.getItem('token');
      const runHeaders = { 'Content-Type': 'application/json' };
      if (token) runHeaders['Authorization'] = `Bearer ${token}`;

      const res = await fetch(runEndpoint, {
        method: 'POST',
        headers: runHeaders,
        body: JSON.stringify({
          code,
          problemId: resolvedProblem.id,
          language: selectedLang,
        }),
      });
      
      const contentType = res.headers.get('content-type') || '';
      let data;
      if (contentType.includes('application/json')) {
        data = await res.json();
      } else {
        const text = await res.text();
        throw new Error(`Server response error (${res.status}): ${text.slice(0, 150)}`);
      }

      if (!res.ok) {
        throw new Error(data.error || 'Server error occurred during execution.');
      }

      // If it's a background job, wait for completion
      if (data.jobId) {
        data = await waitForJob({ jobId: data.jobId, socket, token: localStorage.getItem('token') });
      }

      setOutput(data);
      setJudgeState('success');
      setLastRunCode(code);
      setHasSuccessfulRun(true);
    } catch (err) {
      setOutput({
        status: 'internal_error',
        summary: 'Execution Error',
        exitCode: 1,
        compileError: null,
        runtimeError: err.message,
        cases: [],
      });
      setJudgeState('error');
    } finally {
      setIsRunning(false);
    }
  }

  async function handleSaveCodeToDB() {
    if (!resolvedProblem || !resolvedProblem.id) return;
    const code = codeByLang[selectedLang];
    if (!code?.trim()) return;

    setIsSavingCode(true);
    setSaveStatus('saving');
    if (saveStatusTimerRef.current) clearTimeout(saveStatusTimerRef.current);

    const token = localStorage.getItem('token');
    
    try {
      // Try saving to database
      const res = await fetch('/api/student/workspaces/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          practical_id: resolvedProblem.id,
          language: selectedLang,
          code
        }),
      });

      if (!res.ok) {
        let errData = {};
        try { errData = await res.json(); } catch {}
        throw new Error(errData.error || `Save failed (${res.status})`);
      }
      setHasUnsavedChanges(false);
      setSaveStatus('saved');
      saveStatusTimerRef.current = setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (err) {
      console.error('Failed to save to database:', err);
      // Fallback: save to localStorage
      try {
        const cacheKey = `workspace_${resolvedProblem.id}_${selectedLang}`;
        localStorage.setItem(cacheKey, code);
        localStorage.setItem(`${cacheKey}_timestamp`, new Date().toISOString());
        setHasUnsavedChanges(false);
        setSaveStatus('saved');
        saveStatusTimerRef.current = setTimeout(() => setSaveStatus('idle'), 3000);
        console.warn('Code saved to browser cache (database unavailable)');
      } catch (localErr) {
        console.error('Failed to save to localStorage:', localErr);
        setSaveStatus('error');
        saveStatusTimerRef.current = setTimeout(() => setSaveStatus('idle'), 5000);
      }
    } finally {
      setIsSavingCode(false);
    }
  }

  async function handleSubmit() {
    if (!canSubmit) return;

    if (resolvedProblem.startTime && new Date() < new Date(resolvedProblem.startTime)) {
      showNotice(`This practical has not started yet. Scheduled start time: ${new Date(resolvedProblem.startTime).toLocaleString()}`, 'warning');
      return;
    }

    const code = codeByLang[selectedLang];
    if (!code?.trim()) return;

    // Auto-save code before submitting
    await handleSaveCodeToDB();

    setActionMode('submit');
    setJudgeState('loading');
    setSubmitPhase('submitting');
    setIsSubmitting(true);
    setConsoleOpen(true);
    setOutput(null);

    const token = localStorage.getItem('token');

    try {
      const res = await fetch('/api/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          problemId: resolvedProblem.id,
          language: selectedLang,
          code
        }),
      });

      const contentType = res.headers.get('content-type') || '';
      let data;
      if (contentType.includes('application/json')) {
        data = await res.json();
      } else {
        const text = await res.text();
        throw new Error(`Server response error (${res.status}): ${text.slice(0, 150)}`);
      }

      if (!res.ok) {
        throw new Error(data.error || 'Server error occurred during submission.');
      }

      setSubmitPhase('judging');

      // Wait for job completion
      if (data.jobId) {
        data = await waitForJob({ jobId: data.jobId, socket, token: localStorage.getItem('token') });
      }

      setOutput(data);
      setJudgeState('success');
      setSubmitPhase(null);
    } catch (err) {
      setOutput({
        status: 'internal_error',
        summary: 'Network Error',
        exitCode: 1,
        compileError: null,
        runtimeError: `Network error: ${err.message}`,
        cases: [],
      });
      setJudgeState('error');
      setSubmitPhase(null);
    } finally {
      setIsSubmitting(false);
    }
  }

  const currentCode = codeByLang[selectedLang] || '';
  const isCodeUnchanged = hasSuccessfulRun && currentCode.trim() === lastRunCode.trim();

  const isExecutable = LANGUAGES[selectedLang]?.executableInPhase1;
  const canRun = isExecutable && !isRunning && !isSubmitting;
  const canSubmit = isExecutable && !isRunning && !isSubmitting;

  const getSubmitTooltip = () => {
    if (!isExecutable) return 'Selected language does not support running/submitting';
    if (isRunning) return 'Execution in progress...';
    if (isSubmitting) return 'Submission in progress...';
    if (resolvedProblem?.startTime && new Date() < new Date(resolvedProblem.startTime)) {
      return `Practical starts at ${new Date(resolvedProblem.startTime).toLocaleTimeString()}`;
    }
    if (resolvedProblem?.endTime && new Date() > new Date(resolvedProblem.endTime)) {
      return 'Practical submission deadline has passed';
    }
    return '';
  };

  // Universal Keyboard Shortcuts: Ctrl+Enter (Run), Ctrl+Shift+Enter (Submit), Ctrl+S (Save)
  useEffect(() => {
    const handleKeyDown = (e) => {
      const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
      const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;
      if (!cmdOrCtrl) return;

      if (e.key === 'Enter') {
        e.preventDefault();
        if (e.shiftKey) {
          if (canSubmit) handleSubmit();
        } else {
          if (canRun) handleRun();
        }
      } else if (e.key === 's' || e.key === 'S') {
        e.preventDefault();
        handleSaveCodeToDB();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [canRun, canSubmit, selectedLang, codeByLang, resolvedProblem]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100%', overflow: 'hidden', background: '#000000', color: '#ffffff', fontFamily: 'Inter, sans-serif', userSelect: 'none' }}>

      {/* Floating Non-Blocking Toast Notification */}
      {workspaceNotice && (
        <div style={{
          position: 'fixed',
          top: '72px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '10px 20px',
          borderRadius: '8px',
          background: workspaceNotice.type === 'warning' ? '#291800' : workspaceNotice.type === 'error' ? '#290505' : '#052912',
          border: `1px solid ${workspaceNotice.type === 'warning' ? '#f59e0b' : workspaceNotice.type === 'error' ? '#ef4444' : '#10b981'}`,
          color: '#ffffff',
          fontSize: '13px',
          fontWeight: 600,
          boxShadow: '0 10px 30px rgba(0,0,0,0.8)',
        }}>
          <span>{workspaceNotice.type === 'warning' ? '⚠️' : workspaceNotice.type === 'error' ? '❌' : '✓'}</span>
          <span>{workspaceNotice.text}</span>
          <button 
            onClick={() => setWorkspaceNotice(null)}
            style={{ background: 'none', border: 'none', color: '#999', cursor: 'pointer', fontSize: '14px', padding: '0 4px', marginLeft: '6px' }}
          >
            ✕
          </button>
        </div>
      )}

      {/* ── Top Navigation Bar — 64px, true black ── */}
      <div style={{ height: '64px', background: '#000000', borderBottom: '1px solid #262626', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', flexShrink: 0 }}>
        {/* Left: Brand + Problem List Dropdown */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          {/* Logo and Wordmark */}
          <div 
            onClick={() => router.push('/student')}
            style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}
            title="Go to Student Dashboard"
          >
            <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#ffffff', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <img src="/coderank-logo.jpg" alt="CodeRank Logo" onError={(e) => { e.target.style.display = 'none'; }} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
            <span style={{ color: '#ffffff', fontWeight: 700, fontSize: '16px', letterSpacing: '1px', textTransform: 'uppercase' }}>CodeRank</span>
          </div>
          
          {/* Switch course dropdown has been removed here */}

          {/* Problem List dropdown */}
          <div style={{ position: 'relative' }}>
            <button suppressHydrationWarning
              onClick={() => setIsListOpen(!isListOpen)}
              style={{ background: '#1a1a1a', border: '1px solid #3c3c3c', color: '#bbbbbb', fontSize: '11px', fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', padding: '8px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', outline: 'none' }}
              onMouseEnter={e => { e.currentTarget.style.background = '#262626'; e.currentTarget.style.color = '#ffffff'; }}
              onMouseLeave={e => { e.currentTarget.style.background = '#1a1a1a'; e.currentTarget.style.color = '#bbbbbb'; }}
            >
              <List size={12} />
              Problem List
            </button>

            {isListOpen && (
              <div style={{
                position: 'absolute',
                top: '46px',
                left: 0,
                background: '#141414',
                border: '1px solid #262626',
                borderRadius: '4px',
                boxShadow: '0 10px 30px rgba(0,0,0,0.7)',
                width: '300px',
                maxHeight: '380px',
                overflowY: 'auto',
                zIndex: 1000,
                padding: '8px 0'
              }}>
                {practicals.length > 0 && (() => {
                  const courseMap = new Map();
                  practicals.forEach(p => {
                    const key = p.course_code || p.course_name;
                    if (key && !courseMap.has(key)) {
                      courseMap.set(key, { code: p.course_code, name: p.course_name, id: p.course_id });
                    }
                  });
                  const availableCourses = Array.from(courseMap.values());

                  const filteredPracticals = selectedCourse === 'All' 
                    ? practicals 
                    : practicals.filter(p => 
                        p.course_code === selectedCourse || 
                        p.course_name === selectedCourse || 
                        String(p.course_id) === String(selectedCourse)
                      );

                  return (
                  <>
                    <div style={{ padding: '8px 16px', borderBottom: '1px solid #262626', marginBottom: '6px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <div style={{ fontSize: '9px', color: '#00b8a3', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase' }}>
                          {selectedCourse !== 'All' ? selectedCourse : 'Assigned Coding Practicals'} ({filteredPracticals.length})
                        </div>
                        <button suppressHydrationWarning 
                          onClick={() => router.push('/student')}
                          style={{
                            background: 'transparent', color: '#7e7e7e', border: '1px solid #3c3c3c', borderRadius: '4px',
                            padding: '4px 8px', fontSize: '10px', cursor: 'pointer', transition: 'all 0.2s'
                          }}
                          onMouseEnter={e => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = '#555'; }}
                          onMouseLeave={e => { e.currentTarget.style.color = '#7e7e7e'; e.currentTarget.style.borderColor = '#3c3c3c'; }}
                        >
                          ← Back
                        </button>
                      </div>

                      {/* Course Switcher in Dropdown */}
                      {availableCourses.length > 1 && (
                        <select
                          value={selectedCourse}
                          onChange={(e) => setSelectedCourse(e.target.value)}
                          style={{
                            width: '100%',
                            background: '#1a1a1a',
                            color: '#ffffff',
                            border: '1px solid #3c3c3c',
                            borderRadius: '4px',
                            padding: '4px 8px',
                            fontSize: '11px',
                            outline: 'none',
                            cursor: 'pointer',
                            marginBottom: '4px'
                          }}
                        >
                          <option value="All">All Subjects ({practicals.length})</option>
                          {availableCourses.map((c) => {
                            const count = practicals.filter(p => 
                              p.course_code === c.code || 
                              p.course_name === c.name || 
                              String(p.course_id) === String(c.id)
                            ).length;
                            return (
                              <option key={c.code || c.name} value={c.code || c.name}>
                                {c.code ? `${c.code} - ${c.name}` : c.name} ({count})
                              </option>
                            );
                          })}
                        </select>
                      )}
                    </div>
                    {filteredPracticals.length === 0 && (
                      <div style={{ padding: '16px', fontSize: '11px', color: '#7e7e7e', textAlign: 'center' }}>
                        No practicals found for {selectedCourse}.
                      </div>
                    )}
                    {filteredPracticals.map((p) => {
                      const isActive = `practical_${p.id}` === resolvedProblem.id;
                      const diffColor = p.difficulty === 'Easy' ? '#00b8a3' : p.difficulty === 'Medium' ? '#ffb01f' : '#ff375f';
                      return (
                        <div
                          key={`practical_${p.id}`}
                          onClick={async () => {
                            if (hasUnsavedChanges) {
                              await handleSaveCodeToDB();
                            }
                            setIsListOpen(false);
                            const targetSubject = selectedCourse !== 'All' ? selectedCourse : (p.course_code || '');
                            router.push(`/student/code/practical_${p.id}${targetSubject ? `?subject=${encodeURIComponent(targetSubject)}` : ''}`);
                          }}
                          style={{
                            padding: '10px 16px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            cursor: 'pointer',
                            background: isActive ? '#1e1e1e' : 'transparent',
                            color: isActive ? '#ffffff' : '#bbbbbb',
                            transition: 'background 0.2s'
                          }}
                          onMouseEnter={e => {
                            e.currentTarget.style.background = isActive ? '#1e1e1e' : '#262626';
                            e.currentTarget.style.color = '#ffffff';
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.background = isActive ? '#1e1e1e' : 'transparent';
                            e.currentTarget.style.color = isActive ? '#ffffff' : '#bbbbbb';
                          }}
                        >
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontSize: '12px', fontWeight: isActive ? 700 : 500 }}>
                              {p.title}
                            </span>
                            <span style={{ fontSize: '9px', color: '#7e7e7e', marginTop: '2px' }}>
                              {p.course_code} • {p.my_status ? `Grade: ${p.my_marks || 0}/10 (${p.my_status})` : 'Unsolved'}
                            </span>
                          </div>
                          <span style={{ fontSize: '9px', fontWeight: 700, color: diffColor, background: `${diffColor}15`, border: `1px solid ${diffColor}30`, padding: '2px 6px', borderRadius: '10px', textTransform: 'uppercase' }}>
                            {p.difficulty}
                          </span>
                        </div>
                      );
                    })}
                    <div style={{ height: '1px', background: '#262626', margin: '8px 0' }} />
                  </>
                  );
                })()}
                {practicals.length === 0 && (
                  <div style={{ padding: '16px', fontSize: '11px', color: '#7e7e7e', textAlign: 'center' }}>
                    No practicals assigned currently.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Center: Run + Submit */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button suppressHydrationWarning
            id="btn-run-code"
            onClick={handleRun}
            disabled={!canRun}
            title={!isExecutable ? 'Language not executable' : isRunning ? 'Executing…' : 'Run code'}
            style={{
              background: '#000000',
              border: canRun ? '1px solid #ffffff' : '1px solid #3c3c3c',
              color: canRun ? '#ffffff' : '#3c3c3c',
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '1.5px',
              textTransform: 'uppercase',
              padding: '0 24px',
              height: '40px',
              cursor: canRun ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            {isRunning ? (
              <span style={{ width: '12px', height: '12px', border: '2px solid #0066b1', borderTopColor: 'transparent', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} />
            ) : (
              <Play size={13} />
            )}
            {isRunning ? 'Running…' : 'Run'}
            {!isRunning && <span style={{ opacity: 0.6, marginLeft: '4px', fontSize: '10px', textTransform: 'none', fontWeight: 500 }}>Ctrl+↵</span>}
          </button>

          <button suppressHydrationWarning
            id="btn-save-code"
            onClick={handleSaveCodeToDB}
            disabled={isSavingCode || isRunning || isSubmitting}
            title="Save code to database (Ctrl+S)"
            style={{
              background: 'transparent',
              border: `1px solid ${saveStatus === 'error' ? '#ef4444' : saveStatus === 'saved' ? '#22c55e' : '#3c3c3c'}`,
              color: saveStatus === 'error' ? '#ef4444' : saveStatus === 'saved' ? '#22c55e' : '#ffffff',
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '1.5px',
              textTransform: 'uppercase',
              padding: '0 24px',
              height: '40px',
              cursor: (isSavingCode || isRunning || isSubmitting) ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'border-color 0.3s, color 0.3s',
            }}
            onMouseEnter={e => { if(!isSavingCode && !isRunning && !isSubmitting) e.currentTarget.style.background = '#1a1a1a' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
          >
            {isSavingCode ? (
              <span style={{ width: '12px', height: '12px', border: '2px solid #7e7e7e', borderTopColor: 'transparent', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} />
            ) : (
              <Save size={13} />
            )}
            {isSavingCode ? 'Saving…' : 'Save'}
          </button>
          {/* Save status pill */}
          {saveStatus !== 'idle' && !isSavingCode && (
            <span style={{
              fontSize: '10px',
              fontWeight: 600,
              padding: '3px 10px',
              borderRadius: '12px',
              background: saveStatus === 'saved' ? 'rgba(34,197,94,0.12)' : saveStatus === 'error' ? 'rgba(239,68,68,0.12)' : 'rgba(255,255,255,0.06)',
              color: saveStatus === 'saved' ? '#22c55e' : saveStatus === 'error' ? '#ef4444' : '#aaa',
              border: `1px solid ${saveStatus === 'saved' ? 'rgba(34,197,94,0.3)' : saveStatus === 'error' ? 'rgba(239,68,68,0.3)' : 'rgba(255,255,255,0.1)'}`,
              whiteSpace: 'nowrap',
              letterSpacing: '0.3px',
              transition: 'opacity 0.3s',
            }}>
              {saveStatus === 'saved' ? '✓ All changes saved' : saveStatus === 'error' ? '✕ Save failed' : 'Saving…'}
            </span>
          )}
          {hasUnsavedChanges && saveStatus === 'idle' && (
            <span style={{
              fontSize: '10px',
              fontWeight: 600,
              padding: '3px 10px',
              borderRadius: '12px',
              background: 'rgba(251,191,36,0.1)',
              color: '#fbbf24',
              border: '1px solid rgba(251,191,36,0.25)',
              whiteSpace: 'nowrap',
            }}>
              ● Unsaved
            </span>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button suppressHydrationWarning
              id="btn-submit-code"
              onClick={handleSubmit}
              disabled={!canSubmit}
              title={getSubmitTooltip() || 'Submit code (Ctrl+Shift+Enter)'}
              style={{
                background: '#0fa336',
                border: 'none',
                color: '#ffffff',
                fontSize: '11px',
                fontWeight: 700,
                letterSpacing: '1.5px',
                textTransform: 'uppercase',
                padding: '0 24px',
                height: '40px',
                cursor: canSubmit ? 'pointer' : 'not-allowed',
                opacity: canSubmit ? 1 : 0.35,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              {isSubmitting ? (
                <span style={{ width: '12px', height: '12px', border: '2px solid #ffffff', borderTopColor: 'transparent', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} />
              ) : null}
              {isSubmitting ? 'Submitting…' : 'Submit'}
              {!isSubmitting && <span style={{ opacity: 0.7, marginLeft: '4px', fontSize: '10px', textTransform: 'none', fontWeight: 500 }}>Ctrl+⇧+↵</span>}
            </button>

            {getSubmitTooltip() && (
              <span style={{
                fontSize: '10px',
                color: '#ffc107',
                letterSpacing: '0.5px',
                maxWidth: '220px',
                lineHeight: 1.3,
                fontFamily: 'Inter, sans-serif',
                borderLeft: '2px solid #262626',
                paddingLeft: '10px',
                display: 'inline-block'
              }}>
                {getSubmitTooltip()}
              </span>
            )}
          </div>
        </div>

        {/* Right: Settings + User */}
        <div ref={userDropdownRef} style={{ display: 'flex', alignItems: 'center', gap: '8px', position: 'relative' }}>
          <button suppressHydrationWarning
            onClick={() => setShowSettingsModal(true)}
            title="Settings"
            style={{ width: '40px', height: '40px', background: '#1a1a1a', border: '1px solid #262626', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7e7e7e', cursor: 'pointer' }}
            onMouseEnter={e => { e.currentTarget.style.color = '#ffffff'; }}
            onMouseLeave={e => { e.currentTarget.style.color = '#7e7e7e'; }}
          >
            <Settings size={16} />
          </button>
          <button suppressHydrationWarning
            onClick={() => setIsUserDropdownOpen(!isUserDropdownOpen)}
            title="Profile Menu"
            style={{ width: '40px', height: '40px', background: '#1a1a1a', border: '1px solid #262626', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7e7e7e', cursor: 'pointer' }}
            onMouseEnter={e => { e.currentTarget.style.color = '#ffffff'; }}
            onMouseLeave={e => { e.currentTarget.style.color = '#7e7e7e'; }}
          >
            <User size={16} />
          </button>

          {isUserDropdownOpen && (
            <div style={{
              position: 'absolute',
              top: '50px',
              right: '0px',
              backgroundColor: '#1f1f1f',
              border: '1px solid #333333',
              borderRadius: '8px',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)',
              minWidth: '180px',
              zIndex: 1000,
              display: 'flex',
              flexDirection: 'column',
              padding: '6px 0'
            }}>
              <div style={{ padding: '8px 16px', borderBottom: '1px solid #333333', fontSize: '12px', color: '#888' }}>
                Signed in as <br />
                <strong style={{ color: '#ffffff' }}>{profileForm.name || 'Student'}</strong>
              </div>
              <button suppressHydrationWarning
                onClick={() => {
                  const handle = profileForm.email ? profileForm.email.split('@')[0] : '';
                  router.push(`/profile/${handle}`);
                  setIsUserDropdownOpen(false);
                }}
                style={{ background: 'transparent', border: 'none', color: '#cccccc', textAlign: 'left', padding: '10px 16px', fontSize: '13px', cursor: 'pointer' }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = '#2a2a2a'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                👤 Edit Profile
              </button>
              <button suppressHydrationWarning
                onClick={() => { setShowSettingsModal(true); setIsUserDropdownOpen(false); }}
                style={{ background: 'transparent', border: 'none', color: '#cccccc', textAlign: 'left', padding: '10px 16px', fontSize: '13px', cursor: 'pointer' }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = '#2a2a2a'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                 Workspace Settings
              </button>
              <div style={{ height: '1px', backgroundColor: '#333333', margin: '4px 0' }} />
              <button suppressHydrationWarning
                onClick={() => { setShowLogoutModal(true); setIsUserDropdownOpen(false); }}
                style={{ background: 'transparent', border: 'none', color: '#ef4444', textAlign: 'left', padding: '10px 16px', fontSize: '13px', cursor: 'pointer', fontWeight: '600' }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = '#2a2a2a'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                 Sign Out
              </button>
            </div>
          )}
        </div>
      </div>

      {/* M-Stripe Divider */}
      <div style={{ height: '3px', background: 'linear-gradient(to right, #0066b1, #1c69d4, #e22718)', flexShrink: 0 }} />

      {/* ── Main Workspace ── */}
      <div style={{ flex: 1, overflow: 'hidden', background: '#000000', width: '100%', height: '100%' }}>
        <PanelGroup orientation="horizontal" direction="horizontal" style={{ height: '100%', width: '100%' }}>

          {/* LEFT: Problem Panel */}
          <Panel defaultSize="40%" minSize="20%">
            <div style={{ height: '100%', background: '#0d0d0d', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <ProblemPanel problem={resolvedProblem} onLoadSubmissionCode={handleLoadSubmissionCode} />
            </div>
          </Panel>

          {/* Vertical resize handle */}
          <PanelResizeHandle style={{ width: '2px', background: '#262626', cursor: 'col-resize', flexShrink: 0 }} />

          {/* RIGHT: Editor (60%) + Console (40%) */}
          <Panel defaultSize="60%" minSize="30%">
            <PanelGroup orientation="vertical" direction="vertical" style={{ height: '100%', width: '100%' }}>

              {/* Monaco Editor (upper right side covering 60% area by default) */}
              <Panel defaultSize={consoleOpen ? "60%" : "100%"} minSize="25%">
                <div style={{ height: '100%', background: '#000000', borderLeft: '1px solid #262626', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                  <MonacoEditorPanel
                    selectedLang={selectedLang}
                    onLangChange={handleLangChange}
                    code={codeByLang[selectedLang] || ''}
                    onCodeChange={handleCodeChange}
                    onReset={handleResetCode}
                    isRunning={isRunning || isSubmitting}
                    activeProblem={resolvedProblem}
                    onRun={handleRun}
                    onSubmit={handleSubmit}
                    fontSize={editorFontSize}
                    tabSize={editorTabSize}
                    theme={editorTheme}
                    wordWrap={editorWordWrap}
                    minimap={editorMinimap}
                  />
                </div>
              </Panel>

              {consoleOpen && (
                <>
                  <PanelResizeHandle style={{ height: '2px', background: '#262626', cursor: 'row-resize', flexShrink: 0 }} />
                  {/* Console Output Screen (lower right side covering 40% area by default) */}
                  <Panel defaultSize="40%" minSize="15%">
                    <div style={{ height: '100%', background: '#000000', borderLeft: '1px solid #262626', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                      <ConsolePanel
                        output={output}
                        isRunning={isRunning}
                        isSubmitting={isSubmitting}
                        actionMode={actionMode}
                        judgeState={judgeState}
                        submitPhase={submitPhase}
                        onClose={() => setConsoleOpen(false)}
                      />
                    </div>
                  </Panel>
                </>
              )}
            </PanelGroup>
          </Panel>

        </PanelGroup>
      </div>

      {/* ── SETTINGS MODAL ── */}
      {showSettingsModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, backdropFilter: 'blur(4px)' }}>
          <div style={{ backgroundColor: '#161616', border: '1px solid #333', borderRadius: '12px', padding: '30px', width: '450px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#ffffff', margin: 0 }}> Workspace Customization</h3>
              <button suppressHydrationWarning onClick={() => setShowSettingsModal(false)} style={{ border: 'none', background: 'transparent', color: '#888', cursor: 'pointer', fontSize: '18px' }}>×</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', color: '#888', fontWeight: 600, textTransform: 'uppercase', marginBottom: '8px' }}>Editor Font Size</label>
                <select
                  value={editorFontSize}
                  onChange={e => {
                    const size = parseInt(e.target.value);
                    setEditorFontSize(size);
                    localStorage.setItem('pref_font_size', size.toString());
                  }}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '6px', border: '1px solid #333', backgroundColor: '#0d0d0d', color: '#fff', fontSize: '14px', outline: 'none', cursor: 'pointer' }}
                >
                  <option value="12">12px (Small)</option>
                  <option value="13">13px</option>
                  <option value="14">14px (Medium)</option>
                  <option value="15">15px</option>
                  <option value="16">16px (Large)</option>
                  <option value="18">18px</option>
                  <option value="20">20px (Extra Large)</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', color: '#888', fontWeight: 600, textTransform: 'uppercase', marginBottom: '8px' }}>Tab Spaces (Indentation)</label>
                <select
                  value={editorTabSize}
                  onChange={e => {
                    const size = parseInt(e.target.value);
                    setEditorTabSize(size);
                    localStorage.setItem('pref_tab_size', size.toString());
                  }}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '6px', border: '1px solid #333', backgroundColor: '#0d0d0d', color: '#fff', fontSize: '14px', outline: 'none', cursor: 'pointer' }}
                >
                  <option value="2">2 Spaces</option>
                  <option value="4">4 Spaces</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', color: '#888', fontWeight: 600, textTransform: 'uppercase', marginBottom: '8px' }}>Editor Theme</label>
                <select
                  value={editorTheme}
                  onChange={e => {
                    const theme = e.target.value;
                    setEditorTheme(theme);
                    localStorage.setItem('pref_theme', theme);
                  }}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '6px', border: '1px solid #333', backgroundColor: '#0d0d0d', color: '#fff', fontSize: '14px', outline: 'none', cursor: 'pointer' }}
                >
                  <option value="vs-dark">Dark Theme (Default)</option>
                  <option value="light">Light Theme</option>
                  <option value="hc-black">High Contrast (Dark)</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', color: '#888', fontWeight: 600, textTransform: 'uppercase', marginBottom: '8px' }}>Word Wrap</label>
                <select
                  value={editorWordWrap}
                  onChange={e => {
                    const wrap = e.target.value;
                    setEditorWordWrap(wrap);
                    localStorage.setItem('pref_word_wrap', wrap);
                  }}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '6px', border: '1px solid #333', backgroundColor: '#0d0d0d', color: '#fff', fontSize: '14px', outline: 'none', cursor: 'pointer' }}
                >
                  <option value="on">On (Wrap to view)</option>
                  <option value="off">Off (Scroll horizontally)</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', color: '#888', fontWeight: 600, textTransform: 'uppercase', marginBottom: '8px' }}>Code Minimap</label>
                <select
                  value={editorMinimap.toString()}
                  onChange={e => {
                    const isMinimap = e.target.value === 'true';
                    setEditorMinimap(isMinimap);
                    localStorage.setItem('pref_minimap', isMinimap.toString());
                  }}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '6px', border: '1px solid #333', backgroundColor: '#0d0d0d', color: '#fff', fontSize: '14px', outline: 'none', cursor: 'pointer' }}
                >
                  <option value="false">Hidden (Cleaner view)</option>
                  <option value="true">Visible</option>
                </select>
              </div>

              <div style={{ border: '1px solid #333', borderRadius: '8px', padding: '15px', backgroundColor: '#0d0d0d' }}>
                <h4 style={{ fontSize: '12px', fontWeight: 700, color: '#fff', margin: '0 0 10px 0', textTransform: 'uppercase' }}>⌨️ Keyboard Shortcuts</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px', color: '#ccc' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Run current code:</span>
                    <kbd style={{ backgroundColor: '#222', border: '1px solid #444', padding: '2px 6px', borderRadius: '4px', fontSize: '10px' }}>Ctrl + '</kbd>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Submit solution:</span>
                    <kbd style={{ backgroundColor: '#222', border: '1px solid #444', padding: '2px 6px', borderRadius: '4px', fontSize: '10px' }}>Ctrl + Enter</kbd>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
              <button suppressHydrationWarning onClick={() => setShowSettingsModal(false)} style={{ padding: '10px 24px', borderRadius: '6px', border: 'none', backgroundColor: '#4f46e5', color: '#fff', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>
                Apply Preferences
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Logout Confirmation Modal ── */}
      {showLogoutModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999, backdropFilter: 'blur(4px)' }}>
          <div style={{ background: '#161616', border: '1px solid #333', borderRadius: '12px', padding: '28px 32px', width: '360px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#ffffff' }}>Sign out?</h3>
            <p style={{ margin: 0, fontSize: '13px', color: '#aaa', lineHeight: 1.6 }}>
              You will be signed out of your workspace. Any unsaved code changes have already been auto-saved.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '4px' }}>
              <button
                onClick={() => setShowLogoutModal(false)}
                style={{ padding: '8px 20px', borderRadius: '6px', border: '1px solid #3c3c3c', background: 'transparent', color: '#aaa', fontSize: '13px', cursor: 'pointer', fontWeight: 600 }}
                onMouseEnter={e => e.currentTarget.style.color = '#fff'}
                onMouseLeave={e => e.currentTarget.style.color = '#aaa'}
              >
                Cancel
              </button>
              <button
                onClick={confirmLogout}
                style={{ padding: '8px 20px', borderRadius: '6px', border: 'none', background: '#ef4444', color: '#ffffff', fontSize: '13px', cursor: 'pointer', fontWeight: 700 }}
                onMouseEnter={e => e.currentTarget.style.background = '#dc2626'}
                onMouseLeave={e => e.currentTarget.style.background = '#ef4444'}
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse-checkbox {
          0% { transform: scale(1); box-shadow: 0 0 20px rgba(15, 163, 54, 0.2); }
          50% { transform: scale(1.05); box-shadow: 0 0 35px rgba(15, 163, 54, 0.4); }
          100% { transform: scale(1); box-shadow: 0 0 20px rgba(15, 163, 54, 0.2); }
        }
      `}</style>
    </div>
  );
}
