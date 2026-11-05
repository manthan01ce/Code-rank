'use client';
import { workspaceRequest } from '../api/coding-workspace-api';
import WorkspaceReturn from '@/components/WorkspaceReturn';

/**
 * PURPOSE OF THIS FILE:
 * Main layout container for the student coding playground & workspace.
 * It integrates:
 * - Left Panel: Problem details (ProblemPanel) and inline submission history logs.
 * - Right Upper Panel: Monaco Code Editor (MonacoEditorPanel) with language restrictions, customizable font size, and tab spacing settings.
 * - Right Lower Panel: Stdin/Stdout execution output console (ConsolePanel).
 * - Settings & Account menu: A User profile dropdown managing profile updates, password changes, preferences, and logout.
 */

import { notifyProgressChanged } from '@/lib/progress-updates';
import { StudentThemeToggle, useStudentTheme } from '@/components/student/StudentTheme';
import { usePracticalPage } from '@/features/practicals/hooks/usePracticalPage';
import { fetchCollection } from '@/lib/fetch-collection';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Panel, Group as PanelGroup, Separator as PanelResizeHandle } from 'react-resizable-panels';
import ProblemPanel from '@/features/coding-workspace/components/ProblemPanel';
import MonacoEditorPanel from '@/features/coding-workspace/components/MonacoEditorPanel';
import ConsolePanel from '@/features/coding-workspace/components/ConsolePanel';
import ConfirmAction from '@/features/coding-workspace/components/ConfirmAction';
import { Play, ChevronRight, Settings, User, List } from 'lucide-react';
import { DEFAULT_LANGUAGE, LANGUAGES } from '@/features/coding-workspace/components/LanguageConfig';
import { STATIC_PROBLEMS } from '@/features/practice/problems';
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
  if (/sql|postgres|redis|docker|stack trace|econn|localhost|connection refused|relation .*does not exist|\bat .*\.(?:js|ts):/i.test(msg)) return fallback;
  // If short and human-looking, surface it; otherwise use fallback
  const raw = typeof err === 'string' ? err : err.message || '';
  return raw && raw.length < 120 ? raw : fallback;
}

export function useCodingWorkspace({ problem }) {
  const studentTheme = useStudentTheme();
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
  const practicalPage = usePracticalPage();
  const { rows: practicals, refresh: fetchPracticals } = practicalPage;
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
            window.dispatchEvent(new Event('coderank:account'));
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
  const [draftStatus, setDraftStatus] = useState('');
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
      draftVersion.current++; setHasUnsavedChanges(true); setDraftStatus('Changes not saved');
    } });
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
        setDraftStatus('Draft restored from this device. Save to keep it online.');
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
    setDraftStatus('Changes not saved');
    setHasUnsavedChanges(true);
    setSaveStatus('idle');
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
        const res = await workspaceRequest(resolvedProblem.id, lang, {
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
      draftVersion.current++; setHasUnsavedChanges(true); setDraftStatus('Changes not saved');
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

  // Autosave after user pauses typing (debounced by 2000ms - non-intrusive)
  const autoSaveTimerRef = useRef(null);
  useEffect(() => {
    if (!hasUnsavedChanges || isSavingCode) return;
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      handleSaveCodeToDB();
    }, 2000);
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [codeByLang, selectedLang, hasUnsavedChanges, isSavingCode]);

  async function handleSaveCodeToDB(snapshot, signal) {
    // Button events are not snapshots.
    const draft = snapshot?.code !== undefined ? snapshot : {
      code: codeByLang[selectedLang], language: selectedLang,
      problemId: resolvedProblem.id, version: draftVersion.current,
    };
    if (!draft.code?.trim()) return;
    setIsSavingCode(true);
    setSaveStatus('saving');
    const cacheKey = `workspace_${draft.problemId}_${draft.language}`;
    let localSaved = false;
    try {
      localStorage.setItem(cacheKey, draft.code);
      localStorage.setItem(`${cacheKey}_timestamp`, new Date().toISOString());
      localStorage.setItem(`${cacheKey}_pending`, 'true');
      localSaved = true;
      setDraftStatus('Saved on this device · saving online…');
    } catch { setDraftStatus('Saving online…'); }
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
        setSaveStatus('saved');
        setDraftStatus(`Saved at ${new Date().toLocaleTimeString()}`);
        if (saveStatusTimerRef.current) clearTimeout(saveStatusTimerRef.current);
        saveStatusTimerRef.current = setTimeout(() => setSaveStatus('idle'), 3000);
      }
    } catch (error) {
      if (signal?.aborted) return;
      setSaveStatus('error');
      setDraftStatus(localSaved ? 'Saved on this device. Online save failed; please try Save again.' : 'Your changes could not be saved. Please try Save again.');
      if (!localSaved && !snapshot) throw error;
    } finally { if (!signal?.aborted) setIsSavingCode(false); }
  }

  async function performAction(mode) {
    if (!(mode === 'run' ? canRun : canSubmit)) return;
    if (resolvedProblem.startTime && new Date() < new Date(resolvedProblem.startTime)) {
      showNotice(`This practical has not started yet. Scheduled start time: ${new Date(resolvedProblem.startTime).toLocaleString()}`, 'warning');
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
      // Immediately cache locally and trigger background DB save without blocking or flashing "Saving"
      try {
        const cacheKey = `workspace_${snapshot.problemId}_${snapshot.language}`;
        localStorage.setItem(cacheKey, snapshot.code);
        localStorage.setItem(`${cacheKey}_timestamp`, new Date().toISOString());
      } catch {}
      handleSaveCodeToDB(snapshot).catch(() => {});

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
        setSubmitPhase(mode === 'submit' ? 'judging' : null);
        data = await waitForJob(data.jobId, { token, signal,
          onPhase: phase => lifecycle.update(action, phase) });
      }
      if (signal.aborted) return;
      setOutput(data); setJudgeState('success');
      if (mode === 'submit' && data.submissionId) { notifyProgressChanged(); fetchPracticals(); }
      if (mode === 'run') { setLastRunCode(snapshot.code); setHasSuccessfulRun(true); }
      lifecycle.finish(action, 'Done');
    } catch (error) {
      if (signal.aborted) return;
      setOutput({ status: 'internal_error', summary: 'Action could not finish', runtimeError: 'Unable to finish this action. Please try again.', cases: [] });
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

  const editorPanel = (<MonacoEditorPanel
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
                    theme={studentTheme ? (studentTheme.theme === 'light' ? 'light' : editorTheme === 'hc-black' ? 'hc-black' : 'vs-dark') : editorTheme}
                    wordWrap={editorWordWrap}
                    minimap={editorMinimap}
                    saveStatus={saveStatus}
                    isSaving={isSavingCode}
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


  return { studentTheme, router, showLogoutModal, setShowLogoutModal, handleLogout, confirmLogout, consoleOpen, setConsoleOpen, selectedLang, setSelectedLang, isListOpen, setIsListOpen, practicalPage, practicals, fetchPracticals, selectedCourse, setSelectedCourse, socket, hasAutoNavigated, isUserDropdownOpen, setIsUserDropdownOpen, userDropdownRef, showProfileModal, setShowProfileModal, showSettingsModal, setShowSettingsModal, showSubmissionsModal, setShowSubmissionsModal, userSubmissions, setUserSubmissions, loadingSubmissions, setLoadingSubmissions, editorFontSize, setEditorFontSize, editorTabSize, setEditorTabSize, editorTheme, setEditorTheme, editorWordWrap, setEditorWordWrap, editorMinimap, setEditorMinimap, profileForm, setProfileForm, profileMsg, setProfileMsg, fetchUserSubmissions, handleUpdateProfile, resolvedProblem, getBoilerplate, codeByLang, setCodeByLang, lifecycle, draftStatus, setDraftStatus, draftVersion, narrow, setNarrow, workspaceTab, setWorkspaceTab, settingsRef, confirmation, setConfirmation, undoDraft, setUndoDraft, handleLoadSubmissionCode, hasUnsavedChanges, setHasUnsavedChanges, isLoadingCode, setIsLoadingCode, saveStatus, setSaveStatus, saveStatusTimerRef, isRunning, setIsRunning, isSubmitting, setIsSubmitting, isSavingCode, setIsSavingCode, output, setOutput, lastRunCode, setLastRunCode, hasSuccessfulRun, setHasSuccessfulRun, actionMode, setActionMode, judgeState, setJudgeState, submitPhase, setSubmitPhase, workspaceNotice, setWorkspaceNotice, noticeTimerRef, showNotice, handleCodeChange, handleLangChange, handleResetCode, autoSaveTimerRef, handleSaveCodeToDB, performAction, handleRun, handleSubmit, currentCode, isCodeUnchanged, isExecutable, canRun, canSubmit, getSubmitTooltip, editorPanel, consolePanel };
}

export { PRACTICAL_BOILERPLATES, friendlyError };
