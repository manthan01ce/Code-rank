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

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Panel, Group as PanelGroup, Separator as PanelResizeHandle } from 'react-resizable-panels';
import ProblemPanel from './ProblemPanel';
import MonacoEditorPanel from './MonacoEditorPanel';
import ConsolePanel from './ConsolePanel';
import ConfirmAction from './ConfirmAction';
import { Play, ChevronRight, Settings, User, List, Save } from 'lucide-react';
import { DEFAULT_LANGUAGE, LANGUAGES } from './LanguageConfig';
import { STATIC_PROBLEMS } from '@/lib/problems';
import { useSocket } from '@/hooks/useSocket';
import { useExecutionLifecycle } from '@/hooks/useExecutionLifecycle';
import { boundedFetch, responseError, waitForJob } from '@/lib/job-lifecycle';

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

export default function WorkspaceLayout({ problem }) {
  const router = useRouter();
  const handleLogout = () => {
    if (confirm('Are you sure you want to log out?')) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      router.push('/');
    }
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
      const res = await fetch('/api/student/submissions', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setUserSubmissions(await res.json());
      }
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
      if (res.ok) {
        setProfileMsg({ type: 'success', text: 'Profile updated successfully!' });
        // Update user in localStorage
        const userData = JSON.parse(localStorage.getItem('user'));
        userData.name = profileForm.name;
        userData.email = profileForm.email;
        localStorage.setItem('user', JSON.stringify(userData));
        // Clear password fields
        setProfileForm(prev => ({ ...prev, currentPassword: '', newPassword: '', confirmPassword: '' }));
      } else {
        const data = await res.json();
        setProfileMsg({ type: 'error', text: data.error || 'Failed to update profile.' });
      }
    } catch (err) {
      setProfileMsg({ type: 'error', text: err.message });
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

  const lifecycle = useExecutionLifecycle(resolvedProblem.id);
  const [draftStatus, setDraftStatus] = useState('Not synced');
  const draftVersion = useRef(0);
  const [narrow, setNarrow] = useState(false);
  const [workspaceTab, setWorkspaceTab] = useState('editor');
  const settingsRef = useRef(null);
  const [confirmation, setConfirmation] = useState(null);
  const [undoDraft, setUndoDraft] = useState(null);
  const handleLoadSubmissionCode = (code, language) => {
    if (lifecycle.busy) return;
    setConfirmation({ title: 'Load past submission?', message: 'Your current draft will be available with Undo.', confirm: () => {
      setUndoDraft({ code: codeByLang[selectedLang], language: selectedLang });
      setSelectedLang(language || selectedLang);
      setCodeByLang(prev => ({ ...prev, [language || selectedLang]: code }));
      draftVersion.current++; setHasUnsavedChanges(true); setDraftStatus('Unsynced changes');
    } });
  };

  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isLoadingCode, setIsLoadingCode] = useState(false);

  const [isRunning, setIsRunning] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSavingCode, setIsSavingCode] = useState(false);
  const [output, setOutput] = useState(null);

  const [lastRunCode, setLastRunCode] = useState('');
  const [hasSuccessfulRun, setHasSuccessfulRun] = useState(false);

  const [actionMode, setActionMode] = useState('run'); // 'run' | 'submit'
  const [judgeState, setJudgeState] = useState('idle'); // 'idle' | 'loading' | 'success' | 'error'
  const [submitPhase, setSubmitPhase] = useState(null); // 'submitting' | 'judging' | null

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

    const controller = new AbortController();
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
          const res = await boundedFetch(`/api/student/workspaces/load?practical_id=${resolvedProblem.id}&language=${currentLang}`, {
            signal: controller.signal,
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
          if (controller.signal.aborted) return;
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
      
      if (controller.signal.aborted) return;
      const pendingKey = `workspace_${resolvedProblem.id}_${currentLang}`;
      if (localStorage.getItem(`${pendingKey}_pending`) === 'true') {
        const pending = localStorage.getItem(pendingKey);
        if (pending !== null) initialMap[currentLang] = pending;
        setDraftStatus('Restored device draft · use Save to sync');
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
    return () => controller.abort();
  }, [resolvedProblem.id, resolvedProblem.allowedLanguages]);

  function handleCodeChange(newCode) {
    setCodeByLang((prev) => ({ ...prev, [selectedLang]: newCode }));
    draftVersion.current++;
    setDraftStatus('Unsynced changes');
    setHasUnsavedChanges(true);
  }

  async function handleLangChange(lang) {
    if (lifecycle.busy || isSavingCode) return;
    await handleSaveCodeToDB();
    setSelectedLang(lang);
    localStorage.setItem(`coderank_selected_lang_${resolvedProblem.id}`, lang);
    setOutput(null);
    setJudgeState('idle');
    setLastRunCode('');
    setHasSuccessfulRun(false);

    setIsLoadingCode(true);
    const token = localStorage.getItem('token');
    let loadedCode = codeByLang[lang] ?? getBoilerplate(resolvedProblem.id, lang);
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
    const key = `workspace_${resolvedProblem.id}_${lang}`;
    if (localStorage.getItem(`${key}_pending`) === 'true') loadedCode = localStorage.getItem(key) ?? loadedCode;
    setCodeByLang((prev) => ({ ...prev, [lang]: loadedCode }));
    setIsLoadingCode(false);
  }

  function handleResetCode() {
    if (lifecycle.busy) return;
    setConfirmation({ title: 'Reset this draft?', message: 'Your current code will be available with Undo.', confirm: () => {
      setUndoDraft({ code: codeByLang[selectedLang], language: selectedLang });
      setCodeByLang(prev => ({ ...prev, [selectedLang]: getBoilerplate(resolvedProblem.id, selectedLang) }));
      draftVersion.current++; setHasUnsavedChanges(true); setDraftStatus('Unsynced changes');
    } });
  }

  useEffect(() => {
    const media = window.matchMedia('(max-width: 767px)');
    const update = () => setNarrow(media.matches);
    update(); media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    setIsRunning(false); setIsSubmitting(false); setIsSavingCode(false);
    setConfirmation(null); setUndoDraft(null); draftVersion.current++;
  }, [resolvedProblem.id]);
  useEffect(() => {
    if (!showSettingsModal) return;
    const previous = document.activeElement;
    settingsRef.current?.showModal();
    return () => previous?.focus();
  }, [showSettingsModal]);
  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const save = () => {
      try {
        const key = `workspace_${resolvedProblem.id}_${selectedLang}`;
        localStorage.setItem(key, codeByLang[selectedLang] || '');
        localStorage.setItem(`${key}_pending`, 'true');
      } catch { /* Explicit Save reports storage errors. */ }
    };
    save();
    window.addEventListener('pagehide', save);
    return () => { window.removeEventListener('pagehide', save); };
  }, [codeByLang, selectedLang, resolvedProblem.id, hasUnsavedChanges]);

  async function handleSaveCodeToDB(snapshot, signal) {
    // Button events are not snapshots.
    const draft = snapshot?.code !== undefined ? snapshot : {
      code: codeByLang[selectedLang], language: selectedLang,
      problemId: resolvedProblem.id, version: draftVersion.current,
    };
    if (!draft.code?.trim()) return;
    setIsSavingCode(true);
    const cacheKey = `workspace_${draft.problemId}_${draft.language}`;
    let localSaved = false;
    try {
      localStorage.setItem(cacheKey, draft.code);
      localStorage.setItem(`${cacheKey}_timestamp`, new Date().toISOString());
      localStorage.setItem(`${cacheKey}_pending`, 'true');
      localSaved = true;
      setDraftStatus('Saved on this device · syncing…');
    } catch { setDraftStatus('Device storage unavailable · syncing…'); }
    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('Sign in to sync your draft');
      const res = await boundedFetch('/api/student/workspaces/save', {
        method: 'POST', signal,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ practical_id: draft.problemId, language: draft.language, code: draft.code }),
      }, 8000);
      if (!res.ok) throw new Error(responseError(res, await res.json()));
      if (signal?.aborted) return;
      if (draft.version === draftVersion.current) {
        localStorage.removeItem(`${cacheKey}_pending`);
        setHasUnsavedChanges(false);
        setDraftStatus(`Synced at ${new Date().toLocaleTimeString()}`);
      }
    } catch (error) {
      if (signal?.aborted) return;
      setDraftStatus(localSaved ? 'Saved on this device · sync failed; use Save to retry' : `Save failed: ${error.message}`);
      if (!localSaved) throw error;
    } finally { if (!signal?.aborted) setIsSavingCode(false); }
  }

  async function performAction(mode) {
    if (!(mode === 'run' ? canRun : canSubmit)) return;
    if (resolvedProblem.startTime && new Date() < new Date(resolvedProblem.startTime)) {
      setDraftStatus(`This practical starts at ${new Date(resolvedProblem.startTime).toLocaleString()}`);
      return;
    }
    const snapshot = Object.freeze({ code: codeByLang[selectedLang], language: selectedLang,
      problemId: resolvedProblem.id, version: draftVersion.current });
    if (!snapshot.code?.trim()) return;
    const action = lifecycle.begin(); // Synchronous lock covers repeated keyboard/click events.
    if (!action) return;
    const signal = action.controller.signal;
    setActionMode(mode); setWorkspaceTab('results'); setJudgeState('loading'); setConsoleOpen(true); setOutput(null);
    setIsRunning(mode === 'run'); setIsSubmitting(mode === 'submit');
    try {
      await handleSaveCodeToDB(snapshot, signal);
      if (signal.aborted) return;
      lifecycle.update(action, 'Sending');
      const token = localStorage.getItem('token');
      const res = await boundedFetch(mode === 'run' ? `/api/${snapshot.language}-run` : '/api/submit', {
        method: 'POST', signal,
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(snapshot),
      });
      let data;
      try { data = await res.json(); } catch { throw new Error(`Invalid server response (${res.status}). Your draft is preserved.`); }
      if (!res.ok) throw new Error(responseError(res, data));
      if (data.jobId) {
        lifecycle.update(action, 'Queued');
        setSubmitPhase(mode === 'submit' ? 'judging' : null);
        data = await waitForJob(data.jobId, { token, signal,
          onPhase: phase => lifecycle.update(action, phase) });
      }
      if (signal.aborted) return;
      setOutput(data); setJudgeState('success');
      if (mode === 'run') { setLastRunCode(snapshot.code); setHasSuccessfulRun(true); }
      lifecycle.finish(action, 'Done');
    } catch (error) {
      if (signal.aborted) return;
      setOutput({ status: 'internal_error', summary: 'Action could not finish', runtimeError: error.message, cases: [] });
      setJudgeState('error'); lifecycle.finish(action, 'Needs attention');
    } finally {
      if (!signal.aborted) { setIsRunning(false); setIsSubmitting(false); setSubmitPhase(null); }
    }
  }
  const handleRun = () => performAction('run');
  const handleSubmit = () => performAction('submit');

  const currentCode = codeByLang[selectedLang] || '';
  const isCodeUnchanged = hasSuccessfulRun && currentCode.trim() === lastRunCode.trim();

  const isExecutable = LANGUAGES[selectedLang]?.executableInPhase1;
  const canRun = isExecutable && !isRunning && !isSubmitting && !isSavingCode && !isLoadingCode && !lifecycle.busy;
  const canSubmit = isExecutable && !isRunning && !isSubmitting && !isSavingCode && !isLoadingCode && !lifecycle.busy;

  const getSubmitTooltip = () => {
    if (!isExecutable) return `Language not yet executable`;
    return null;
  };

  const editorPanel = (<MonacoEditorPanel
                    selectedLang={selectedLang}
                    onLangChange={handleLangChange}
                    code={codeByLang[selectedLang] || ''}
                    onCodeChange={handleCodeChange}
                    onReset={handleResetCode}
                    isRunning={isRunning || isSubmitting || isSavingCode}
                    activeProblem={resolvedProblem}
                    onRun={handleRun}
                    onSubmit={handleSubmit}
                    fontSize={editorFontSize}
                    tabSize={editorTabSize}
                    theme={editorTheme}
                    wordWrap={editorWordWrap}
                    minimap={editorMinimap}
                  />);
  const consolePanel = (<ConsolePanel
                        output={output}
                        isRunning={isRunning}
                        isSubmitting={isSubmitting}
                        actionMode={actionMode}
                        judgeState={judgeState}
                        submitPhase={submitPhase}
                        onClose={() => setConsoleOpen(false)}
                      />);

  return (
    <div className="coding-workspace" style={{ display: 'flex', flexDirection: 'column', height: '100dvh', width: '100%', overflow: 'hidden', background: '#000000', color: '#ffffff', fontFamily: 'Inter, sans-serif', userSelect: 'none' }}>

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
                          onClick={() => {
                            if (hasUnsavedChanges) {
                              alert('You have unsaved changes. Please save your code before switching problems.');
                              return;
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
            {isRunning ? `${lifecycle.phase}…` : 'Run samples'}
            {!isRunning && <span style={{ opacity: 0.5, marginLeft: '4px', fontSize: '10px', textTransform: 'none', fontWeight: 500 }}>Ctrl+'</span>}
          </button>

          <button suppressHydrationWarning
            id="btn-save-code"
            onClick={() => handleSaveCodeToDB().catch(error => setDraftStatus(error.message))}
            disabled={isSavingCode || isRunning || isSubmitting}
            title="Save code to database"
            style={{
              background: 'transparent',
              border: '1px solid #3c3c3c',
              color: '#ffffff',
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

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button suppressHydrationWarning
              id="btn-submit-code"
              onClick={handleSubmit}
              disabled={!canSubmit}
              title={getSubmitTooltip() || 'Submit code'}
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
              {isSubmitting ? `${lifecycle.phase}…` : 'Submit for grading'}
              {!isSubmitting && <span style={{ opacity: 0.6, marginLeft: '4px', fontSize: '10px', textTransform: 'none', fontWeight: 500 }}>Ctrl+Enter</span>}
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
                onClick={handleLogout}
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

      <div role="status" aria-live="polite" style={{ padding: '8px 16px', color: '#cbd5e1', fontSize: '12px' }}>
        {draftStatus} · {lifecycle.phase}{!lifecycle.busy && output?.summary ? ` · ${output.summary}` : ''}
        {undoDraft && !lifecycle.busy && <button onClick={() => {
          setSelectedLang(undoDraft.language); setCodeByLang(prev => ({ ...prev, [undoDraft.language]: undoDraft.code }));
          draftVersion.current++; setHasUnsavedChanges(true); setDraftStatus('Draft restored · unsynced'); setUndoDraft(null);
        }}>Undo draft replacement</button>}
      </div>
      {lifecycle.busy && <span role="timer" aria-live="off" style={{ padding: '0 16px' }}>{lifecycle.elapsed}s elapsed</span>}
      {/* M-Stripe Divider */}
      <div style={{ height: '3px', background: 'linear-gradient(to right, #0066b1, #1c69d4, #e22718)', flexShrink: 0 }} />

      {/* ── Main Workspace ── */}
      <div style={{ flex: 1, overflow: 'hidden', background: '#000000' }}>
        {narrow ? <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          <div role="group" aria-label="Workspace view" style={{ display: 'flex', gap: 8, padding: 8 }}>
            {['problem', 'editor', 'results'].map(tab => <button key={tab} aria-pressed={workspaceTab === tab} onClick={() => setWorkspaceTab(tab)}>{tab}</button>)}
          </div>
          <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
            {workspaceTab === 'problem' && <ProblemPanel problem={resolvedProblem} onLoadSubmissionCode={handleLoadSubmissionCode} />}
            <div style={{ height: '100%', display: workspaceTab === 'editor' ? 'block' : 'none' }}>{editorPanel}</div>
            {workspaceTab === 'results' && consolePanel}
          </div>
        </div> : (
        <PanelGroup orientation="horizontal" style={{ height: '100%' }}>

          {/* LEFT: Problem Panel */}
          <Panel defaultSize={40} minSize={25}>
            <div style={{ height: '100%', background: '#0d0d0d', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <ProblemPanel problem={resolvedProblem} onLoadSubmissionCode={handleLoadSubmissionCode} />
            </div>
          </Panel>

          {/* Vertical resize handle */}
          <PanelResizeHandle style={{ width: '1px', background: '#262626', cursor: 'col-resize', flexShrink: 0 }} />

          {/* RIGHT: Editor (60%) + Console (40%) */}
          <Panel defaultSize={60} minSize={30}>
            <PanelGroup orientation="vertical" style={{ height: '100%' }}>

              {/* Monaco Editor (upper right side covering 60% area by default) */}
              <Panel defaultSize={consoleOpen ? 60 : 100} minSize={25}>
                <div style={{ height: '100%', background: '#000000', borderLeft: '1px solid #262626', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                  {editorPanel}
                </div>
              </Panel>

              {consoleOpen && (
                <>
                  <PanelResizeHandle style={{ height: '1px', background: '#262626', cursor: 'row-resize', flexShrink: 0 }} />
                  {/* Console Output Screen (lower right side covering 40% area by default) */}
                  <Panel defaultSize={40} minSize={15}>
                    <div style={{ height: '100%', background: '#000000', borderLeft: '1px solid #262626', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                      {consolePanel}
                    </div>
                  </Panel>
                </>
              )}
            </PanelGroup>
          </Panel>

        </PanelGroup>
        )}
      </div>

      {confirmation && <ConfirmAction action={confirmation} onClose={() => setConfirmation(null)} />}
      {/* ── SETTINGS MODAL ── */}
      {showSettingsModal && (
        <dialog ref={settingsRef} aria-labelledby="settings-title" onCancel={() => setShowSettingsModal(false)} style={{ padding: 0, border: 0, background: 'transparent' }}>
          <div style={{ backgroundColor: '#161616', border: '1px solid #333', borderRadius: '12px', padding: '30px', width: 'min(450px, calc(100vw - 24px))', maxHeight: '90dvh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 id="settings-title" style={{ fontSize: '18px', fontWeight: 700, color: '#ffffff', margin: 0 }}> Workspace Customization</h3>
              <button suppressHydrationWarning aria-label="Close settings" onClick={() => setShowSettingsModal(false)} style={{ border: 'none', background: 'transparent', color: '#888', cursor: 'pointer', fontSize: '18px' }}>×</button>
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
        </dialog>
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
