'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Panel, Group as PanelGroup, Separator as PanelResizeHandle } from 'react-resizable-panels';
import ProblemPanel from './ProblemPanel';
import MonacoEditorPanel from './MonacoEditorPanel';
import ConsolePanel from './ConsolePanel';
import { Play, ChevronRight, Settings, User, List } from 'lucide-react';
import { DEFAULT_LANGUAGE } from './LanguageConfig';
import { STATIC_PROBLEMS } from '@/lib/problems';

// Module-level in-memory cache to guarantee persistence in all runtimes
const inMemoryCache = {};

export default function WorkspaceLayout({ problem }) {
  const router = useRouter();
  const [consoleOpen, setConsoleOpen] = useState(true);
  const [selectedLang, setSelectedLang] = useState(DEFAULT_LANGUAGE);
  const [isListOpen, setIsListOpen] = useState(false);

  // Defensive fallback to avoid undefined crashes during Next.js build-time pre-render or hydration
  const resolvedProblem = problem || STATIC_PROBLEMS['1'] || Object.values(STATIC_PROBLEMS)[0];

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

    // 3. Fallback to default boilerplate code for this question/language
    const activeProblemConfig = STATIC_PROBLEMS[pId] || Object.values(STATIC_PROBLEMS).find(p => p.id === Number(pId));
    return activeProblemConfig?.boilerplates?.[lang] || '';
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
    const langKeys = ['python', 'javascript', 'cpp', 'java', 'go'];
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
    const updatedMap = {};
    const langKeys = ['python', 'javascript', 'cpp', 'java', 'go'];
    langKeys.forEach((l) => {
      updatedMap[l] = getDraft(resolvedProblem.id, l);
    });
    setCodeByLang(updatedMap);
    setOutput(null);
    setJudgeState('idle');
    setLastRunCode('');
    setHasSuccessfulRun(false);
  }, [resolvedProblem.id]);

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
      const bp = resolvedProblem.boilerplates?.[selectedLang] || '';
      saveDraft(resolvedProblem.id, selectedLang, bp);
      setCodeByLang((prev) => ({ ...prev, [selectedLang]: bp }));
    }
  }

  async function handleRun() {
    const code = codeByLang[selectedLang];
    if (!code?.trim()) return;

    setActionMode('run');
    setJudgeState('loading');
    setIsRunning(true);
    setConsoleOpen(true);
    setOutput(null);

    try {
      const res = await fetch('/api/python-run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          problemId: resolvedProblem.id,
        }),
      });
      const data = await res.json();
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
        summary: 'Network Error',
        exitCode: 1,
        compileError: null,
        runtimeError: `Network error: ${err.message}`,
        cases: [],
      });
      setJudgeState('error');
    } finally {
      setIsRunning(false);
    }
  }

  async function handleSubmit() {
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
      const data = await res.json();
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

  const canRun = selectedLang === 'python' && !isRunning && !isSubmitting;
  const canSubmit = selectedLang === 'python' && !isRunning && !isSubmitting && isCodeUnchanged;

  const getSubmitTooltip = () => {
    if (selectedLang !== 'python') return 'Only Python is executable in Phase 1';
    if (!hasSuccessfulRun) return 'Run code before submitting';
    if (currentCode.trim() !== lastRunCode.trim()) return 'Code changed after last run — please run again';
    return null;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100%', overflow: 'hidden', background: '#000000', color: '#ffffff', fontFamily: 'Inter, sans-serif' }}>

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
                <div style={{ padding: '8px 16px', fontSize: '9px', color: '#7e7e7e', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', borderBottom: '1px solid #262626', marginBottom: '6px' }}>
                  Select Problem (10 Available)
                </div>
                {Object.values(STATIC_PROBLEMS).map((p) => {
                  const isActive = p.id === resolvedProblem.id;
                  const diffColor = p.difficulty === 'Easy' ? '#00b8a3' : p.difficulty === 'Medium' ? '#ffb01f' : '#ff375f';
                  return (
                    <div
                      key={p.id}
                      onClick={() => {
                        setIsListOpen(false);
                        router.push(`/student/code/${p.id}`);
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
                      <span style={{ fontSize: '12px', fontWeight: isActive ? 700 : 500 }}>
                        {p.title}
                      </span>
                      <span style={{ fontSize: '9px', fontWeight: 700, color: diffColor, background: `${diffColor}15`, border: `1px solid ${diffColor}30`, padding: '2px 6px', borderRadius: '10px', textTransform: 'uppercase' }}>
                        {p.difficulty}
                      </span>
                    </div>
                  );
                })}
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
            title={selectedLang !== 'python' ? 'Only Python is executable in Phase 1' : isRunning ? 'Executing…' : 'Run code'}
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            style={{ width: '40px', height: '40px', background: '#1a1a1a', border: '1px solid #262626', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7e7e7e', cursor: 'pointer' }}
            onMouseEnter={e => { e.currentTarget.style.color = '#ffffff'; }}
            onMouseLeave={e => { e.currentTarget.style.color = '#7e7e7e'; }}
          >
            <Settings size={16} />
          </button>
          <button
            style={{ width: '40px', height: '40px', background: '#1a1a1a', border: '1px solid #262626', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7e7e7e', cursor: 'pointer' }}
            onMouseEnter={e => { e.currentTarget.style.color = '#ffffff'; }}
            onMouseLeave={e => { e.currentTarget.style.color = '#7e7e7e'; }}
          >
            <User size={16} />
          </button>
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
                    isRunning={isRunning}
                    activeProblem={resolvedProblem}
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
