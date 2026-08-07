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

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Panel, Group as PanelGroup, Separator as PanelResizeHandle } from 'react-resizable-panels';
import ProblemPanel from './ProblemPanel';
import MonacoEditorPanel from './MonacoEditorPanel';
import ConsolePanel from './ConsolePanel';
import { Play, ChevronRight, Settings, User, List } from 'lucide-react';
import { DEFAULT_LANGUAGE, LANGUAGES } from './LanguageConfig';
import { STATIC_PROBLEMS } from '@/lib/problems';

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

// Module-level in-memory cache to guarantee persistence in all runtimes
const inMemoryCache = {};

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

  // Profile, Settings, and Submissions Modals states
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showSubmissionsModal, setShowSubmissionsModal] = useState(false);
  const [userSubmissions, setUserSubmissions] = useState([]);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);

  // Settings preferences states
  const [editorFontSize, setEditorFontSize] = useState(14);
  const [editorTabSize, setEditorTabSize] = useState(4);

  // Profile forms states
  const [profileForm, setProfileForm] = useState({ name: '', email: '', currentPassword: '', newPassword: '', confirmPassword: '' });
  const [profileMsg, setProfileMsg] = useState({ type: '', text: '' });

  // Initial preferences loading
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedFontSize = localStorage.getItem('pref_font_size');
      if (savedFontSize) setEditorFontSize(parseInt(savedFontSize));

      const savedTabSize = localStorage.getItem('pref_tab_size');
      if (savedTabSize) setEditorTabSize(parseInt(savedTabSize));

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

  useEffect(() => {
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
  }, []);

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

  // Helper to read drafts from in-memory cache fallback or localStorage. Falls back to boilerplate code.
  const getDraft = (pId, lang) => {
    const user = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('user') || 'null') : null;
    const userId = user?.id || 'guest';
    const key = `draft_${userId}_${pId}_${lang}`;

    // 1. Check in-memory cache
    if (inMemoryCache[key] !== undefined) {
      return inMemoryCache[key];
    }

    // 2. Check localStorage
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(`draft_code_${userId}_${pId}_${lang}`);
        if (saved !== null) {
          inMemoryCache[key] = saved;
          return saved;
        }
      } catch (e) {
        console.error('LocalStorage unavailable:', e);
      }
    }

    // 3. Fallback to boilerplate — use practical (stdin/stdout) boilerplate if this is a practical
    const activeProblemConfig = resolvedProblem;

    // Check if the DB provides a starter_code for this language
    if (activeProblemConfig?.isPractical && activeProblemConfig?.starter_code?.[lang]) {
      return activeProblemConfig.starter_code[lang];
    }

    // For practicals, use stdin/stdout style boilerplate
    if (activeProblemConfig?.isPractical && PRACTICAL_BOILERPLATES[lang]) {
      return PRACTICAL_BOILERPLATES[lang];
    }

    // For static problems, use the problem-specific boilerplate or language default
    return activeProblemConfig?.boilerplates?.[lang] || LANGUAGES[lang]?.boilerplate || '';
  };

  // Helper to save drafts to both cache structures
  const saveDraft = (pId, lang, code) => {
    const user = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('user') || 'null') : null;
    const userId = user?.id || 'guest';
    const key = `draft_${userId}_${pId}_${lang}`;

    // 1. Save in-memory
    inMemoryCache[key] = code;

    // 2. Save localStorage
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(`draft_code_${userId}_${pId}_${lang}`, code);
      } catch (e) {
        console.error('LocalStorage save failed:', e);
      }
    }
  };

  const [codeByLang, setCodeByLang] = useState(() => {
    const initialMap = {};
    const langKeys = ['python', 'javascript', 'cpp', 'c', 'java'];
    langKeys.forEach((l) => {
      initialMap[l] = getDraft(resolvedProblem.id, l);
    });
    return initialMap;
  });

  const [isRunning, setIsRunning] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [output, setOutput] = useState(null);

  const [lastRunCode, setLastRunCode] = useState('');
  const [hasSuccessfulRun, setHasSuccessfulRun] = useState(false);

  const [actionMode, setActionMode] = useState('run'); // 'run' | 'submit'
  const [judgeState, setJudgeState] = useState('idle'); // 'idle' | 'loading' | 'success' | 'error'
  const [submitPhase, setSubmitPhase] = useState(null); // 'submitting' | 'judging' | null

  // Keep code state fully synchronized whenever the routed problem changes
  useEffect(() => {
    let currentLang = selectedLang;
    if (resolvedProblem.isPractical && resolvedProblem.allowedLanguages && resolvedProblem.allowedLanguages.length > 0) {
      if (!resolvedProblem.allowedLanguages.includes(selectedLang)) {
        currentLang = resolvedProblem.allowedLanguages[0];
        setSelectedLang(currentLang);
      }
    }

    const updatedMap = {};
    const langKeys = ['python', 'javascript', 'cpp', 'c', 'java'];
    langKeys.forEach((l) => {
      updatedMap[l] = getDraft(resolvedProblem.id, l);
    });
    setCodeByLang(updatedMap);
    setOutput(null);
    setJudgeState('idle');
    setLastRunCode('');
    setHasSuccessfulRun(false);
  }, [resolvedProblem.id, resolvedProblem.allowedLanguages]);

  function handleCodeChange(newCode) {
    setCodeByLang((prev) => ({ ...prev, [selectedLang]: newCode }));
    saveDraft(resolvedProblem.id, selectedLang, newCode);
  }

  function handleLangChange(lang) {
    setSelectedLang(lang);
    setOutput(null);
    setJudgeState('idle');
    setLastRunCode('');
    setHasSuccessfulRun(false);

    // Sync draft mapping on lang switch
    const currentDraft = getDraft(resolvedProblem.id, lang);
    setCodeByLang((prev) => ({ ...prev, [lang]: currentDraft }));
  }

  function handleResetCode() {
    if (window.confirm('Reset code to default template?')) {
      let bp;
      if (resolvedProblem.isPractical && resolvedProblem.starter_code?.[selectedLang]) {
        bp = resolvedProblem.starter_code[selectedLang];
      } else if (resolvedProblem.isPractical && PRACTICAL_BOILERPLATES[selectedLang]) {
        bp = PRACTICAL_BOILERPLATES[selectedLang];
      } else {
        bp = resolvedProblem.boilerplates?.[selectedLang] || LANGUAGES[selectedLang]?.boilerplate || '';
      }
      saveDraft(resolvedProblem.id, selectedLang, bp);
      setCodeByLang((prev) => ({ ...prev, [selectedLang]: bp }));
    }
  }

  async function handleRun() {
    if (!canRun) return;
    const code = codeByLang[selectedLang];
    if (!code?.trim()) return;

    setActionMode('run');
    setJudgeState('loading');
    setIsRunning(true);
    setConsoleOpen(true);
    setOutput(null);

    try {
      const runEndpoint = `/api/${selectedLang}-run`;
      const res = await fetch(runEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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

  async function handleSubmit() {
    if (!canSubmit) return;
    const code = codeByLang[selectedLang];
    if (!code?.trim()) return;

    setActionMode('submit');
    setJudgeState('loading');
    setSubmitPhase('submitting');
    setIsSubmitting(true);
    setConsoleOpen(true);
    setOutput(null);

    const timer = setTimeout(() => {
      setSubmitPhase('judging');
    }, 1200);

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

      clearTimeout(timer);
      setOutput(data);
      setJudgeState('success');
      setSubmitPhase(null);
    } catch (err) {
      clearTimeout(timer);
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
  const canSubmit = isExecutable && !isRunning && !isSubmitting && isCodeUnchanged;

  const getSubmitTooltip = () => {
    if (!isExecutable) return `Language not yet executable`;
    if (!hasSuccessfulRun) return 'Run code before submitting';
    if (currentCode.trim() !== lastRunCode.trim()) return 'Code changed after last run — please run again';
    return null;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100%', overflow: 'hidden', background: '#000000', color: '#ffffff', fontFamily: 'Inter, sans-serif', userSelect: 'none' }}>

      {/* ── Top Navigation Bar — 64px, true black ── */}
      <div style={{ height: '64px', background: '#000000', borderBottom: '1px solid #262626', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', flexShrink: 0 }}>
        {/* Left: Brand + Problem List Dropdown */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          {/* CODERANK wordmark */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '3px', height: '20px', background: 'linear-gradient(to bottom, #0066b1, #1c69d4, #e22718)', flexShrink: 0 }} />
            <span style={{ color: '#ffffff', fontWeight: 700, fontSize: '14px', letterSpacing: '2px', textTransform: 'uppercase' }}>CodeRank</span>
          </div>
          
          {/* Problem List dropdown */}
          <div style={{ position: 'relative' }}>
            <button
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
                  const availableCourses = [...new Set(practicals.map(p => p.course_name).filter(Boolean))];
                  const filteredPracticals = selectedCourse === 'All' 
                    ? practicals 
                    : practicals.filter(p => p.course_name === selectedCourse);

                  return (
                  <>
                    <div style={{ padding: '8px 16px', borderBottom: '1px solid #262626', marginBottom: '6px' }}>
                      <div style={{ fontSize: '9px', color: '#00b8a3', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '8px' }}>
                        Assigned Coding Practicals ({filteredPracticals.length})
                      </div>
                      <select 
                        value={selectedCourse} 
                        onChange={(e) => {
                          e.stopPropagation();
                          setSelectedCourse(e.target.value);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          width: '100%',
                          background: '#1a1a1a',
                          color: '#ffffff',
                          border: '1px solid #3c3c3c',
                          padding: '6px 8px',
                          fontSize: '11px',
                          borderRadius: '4px',
                          outline: 'none',
                          cursor: 'pointer'
                        }}
                      >
                        <option value="All">All Subjects</option>
                        {availableCourses.map(c => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
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
                            setIsListOpen(false);
                            router.push(`/student/code/practical_${p.id}`);
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
          <button
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
            {!isRunning && <span style={{ opacity: 0.5, marginLeft: '4px', fontSize: '10px', textTransform: 'none', fontWeight: 500 }}>Ctrl+'</span>}
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
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
              {isSubmitting ? 'Submitting…' : 'Submit'}
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', position: 'relative' }}>
          <button
            onClick={() => setShowSettingsModal(true)}
            title="Settings"
            style={{ width: '40px', height: '40px', background: '#1a1a1a', border: '1px solid #262626', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7e7e7e', cursor: 'pointer' }}
            onMouseEnter={e => { e.currentTarget.style.color = '#ffffff'; }}
            onMouseLeave={e => { e.currentTarget.style.color = '#7e7e7e'; }}
          >
            <Settings size={16} />
          </button>
          <button
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
              <button
                onClick={() => { setShowProfileModal(true); setIsUserDropdownOpen(false); }}
                style={{ background: 'transparent', border: 'none', color: '#cccccc', textAlign: 'left', padding: '10px 16px', fontSize: '13px', cursor: 'pointer' }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = '#2a2a2a'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                👤 Edit Profile
              </button>
              <button
                onClick={() => { setShowSettingsModal(true); setIsUserDropdownOpen(false); }}
                style={{ background: 'transparent', border: 'none', color: '#cccccc', textAlign: 'left', padding: '10px 16px', fontSize: '13px', cursor: 'pointer' }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = '#2a2a2a'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                ⚙️ Workspace Settings
              </button>
              <div style={{ height: '1px', backgroundColor: '#333333', margin: '4px 0' }} />
              <button
                onClick={handleLogout}
                style={{ background: 'transparent', border: 'none', color: '#ef4444', textAlign: 'left', padding: '10px 16px', fontSize: '13px', cursor: 'pointer', fontWeight: '600' }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = '#2a2a2a'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                🚪 Sign Out
              </button>
            </div>
          )}
        </div>
      </div>

      {/* M-Stripe Divider */}
      <div style={{ height: '3px', background: 'linear-gradient(to right, #0066b1, #1c69d4, #e22718)', flexShrink: 0 }} />

      {/* ── Main Workspace ── */}
      <div style={{ flex: 1, overflow: 'hidden', background: '#000000' }}>
        <PanelGroup direction="horizontal" style={{ height: '100%' }}>

          {/* LEFT: Problem Panel */}
          <Panel defaultSize={40} minSize={25}>
            <div style={{ height: '100%', background: '#0d0d0d', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <ProblemPanel problem={resolvedProblem} />
            </div>
          </Panel>

          {/* Vertical resize handle */}
          <PanelResizeHandle style={{ width: '1px', background: '#262626', cursor: 'col-resize', flexShrink: 0 }} />

          {/* RIGHT: Editor (60%) + Console (40%) */}
          <Panel defaultSize={60} minSize={30}>
            <PanelGroup direction="vertical" style={{ height: '100%' }}>

              {/* Monaco Editor (upper right side covering 60% area by default) */}
              <Panel defaultSize={consoleOpen ? 60 : 100} minSize={25}>
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
                  />
                </div>
              </Panel>

              {consoleOpen && (
                <>
                  <PanelResizeHandle style={{ height: '1px', background: '#262626', cursor: 'row-resize', flexShrink: 0 }} />
                  {/* Console Output Screen (lower right side covering 40% area by default) */}
                  <Panel defaultSize={40} minSize={15}>
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

      {/* ── PROFILE EDIT MODAL ── */}
      {showProfileModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, backdropFilter: 'blur(4px)' }}>
          <div style={{ backgroundColor: '#161616', border: '1px solid #333', borderRadius: '12px', padding: '30px', width: '450px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#ffffff', margin: 0 }}>👤 Student Profile settings</h3>
              <button onClick={() => { setShowProfileModal(false); setProfileMsg({ type: '', text: '' }); }} style={{ border: 'none', background: 'transparent', color: '#888', cursor: 'pointer', fontSize: '18px' }}>×</button>
            </div>
            
            {profileMsg.text && (
              <div style={{ padding: '10px 14px', borderRadius: '6px', fontSize: '13px', backgroundColor: profileMsg.type === 'success' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', color: profileMsg.type === 'success' ? '#10b981' : '#ef4444', border: profileMsg.type === 'success' ? '1px solid rgba(16,185,129,0.2)' : '1px solid rgba(239,68,68,0.2)' }}>
                {profileMsg.text}
              </div>
            )}

            <form onSubmit={handleUpdateProfile} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', color: '#888', fontWeight: 600, textTransform: 'uppercase', marginBottom: '6px' }}>Full Name</label>
                <input
                  type="text"
                  required
                  value={profileForm.name}
                  onChange={e => setProfileForm({ ...profileForm, name: e.target.value })}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '6px', border: '1px solid #333', backgroundColor: '#0d0d0d', color: '#fff', fontSize: '14px', outline: 'none' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', color: '#888', fontWeight: 600, textTransform: 'uppercase', marginBottom: '6px' }}>Email Address</label>
                <input
                  type="email"
                  required
                  value={profileForm.email}
                  onChange={e => setProfileForm({ ...profileForm, email: e.target.value })}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '6px', border: '1px solid #333', backgroundColor: '#0d0d0d', color: '#fff', fontSize: '14px', outline: 'none' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', color: '#888', fontWeight: 600, textTransform: 'uppercase', marginBottom: '6px' }}>Current Password (Required for changes)</label>
                <input
                  type="password"
                  placeholder="Enter current password..."
                  value={profileForm.currentPassword}
                  onChange={e => setProfileForm({ ...profileForm, currentPassword: e.target.value })}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '6px', border: '1px solid #333', backgroundColor: '#0d0d0d', color: '#fff', fontSize: '14px', outline: 'none' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', color: '#888', fontWeight: 600, textTransform: 'uppercase', marginBottom: '6px' }}>New Password</label>
                <input
                  type="password"
                  placeholder="Enter new password..."
                  value={profileForm.newPassword}
                  onChange={e => setProfileForm({ ...profileForm, newPassword: e.target.value })}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '6px', border: '1px solid #333', backgroundColor: '#0d0d0d', color: '#fff', fontSize: '14px', outline: 'none' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', color: '#888', fontWeight: 600, textTransform: 'uppercase', marginBottom: '6px' }}>Confirm New Password</label>
                <input
                  type="password"
                  placeholder="Confirm new password..."
                  value={profileForm.confirmPassword}
                  onChange={e => setProfileForm({ ...profileForm, confirmPassword: e.target.value })}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '6px', border: '1px solid #333', backgroundColor: '#0d0d0d', color: '#fff', fontSize: '14px', outline: 'none' }}
                />
              </div>
              <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
                <button type="submit" style={{ flex: 1, padding: '12px', borderRadius: '6px', border: 'none', backgroundColor: '#4f46e5', color: '#fff', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>
                  Save Changes
                </button>
                <button type="button" onClick={() => { setShowProfileModal(false); setProfileMsg({ type: '', text: '' }); }} style={{ flex: 1, padding: '12px', borderRadius: '6px', border: '1px solid #333', backgroundColor: 'transparent', color: '#ccc', fontSize: '14px', cursor: 'pointer' }}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── SETTINGS MODAL ── */}
      {showSettingsModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, backdropFilter: 'blur(4px)' }}>
          <div style={{ backgroundColor: '#161616', border: '1px solid #333', borderRadius: '12px', padding: '30px', width: '450px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#ffffff', margin: 0 }}>⚙️ Workspace Customization</h3>
              <button onClick={() => setShowSettingsModal(false)} style={{ border: 'none', background: 'transparent', color: '#888', cursor: 'pointer', fontSize: '18px' }}>×</button>
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
              <button onClick={() => setShowSettingsModal(false)} style={{ padding: '10px 24px', borderRadius: '6px', border: 'none', backgroundColor: '#4f46e5', color: '#fff', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>
                Apply Preferences
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
