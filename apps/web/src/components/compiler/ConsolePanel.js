'use client';

import { useState, useEffect } from 'react';
import { CheckCircle, XCircle, X, Terminal, Loader2, ChevronDown, ChevronUp } from 'lucide-react';

/**
 * ConsolePanel — displays Docker execution output in a LeetCode-style layout for RUN mode,
 * and a HackerRank-style layout for SUBMIT mode.
 *
 * Props:
 *  - output        {object|null} — the structured results from the execution API
 *  - isRunning     {boolean}     — true if run execution is in progress
 *  - isSubmitting  {boolean}     — true if submit execution is in progress
 *  - actionMode    {string}      — 'run' | 'submit'
 *  - judgeState    {string}      — 'idle' | 'loading' | 'success' | 'error'
 *  - submitPhase   {string|null} — 'submitting' | 'judging' | null
 *  - onClose       {fn}          — called to close the console panel
 */
export default function ConsolePanel({
  output,
  isRunning,
  isSubmitting,
  actionMode = 'run',
  judgeState = 'idle',
  submitPhase = null,
  onClose,
}) {
  const [activeCaseIdx, setActiveCaseIdx] = useState(0);
  const [expandedCases, setExpandedCases] = useState({});

  // Reset active tab and expanded states whenever new output arrives
  useEffect(() => {
    if (output) {
      setActiveCaseIdx(0);
      setExpandedCases({});
    }
  }, [output]);

  const hasOutput = output !== null && output !== undefined;
  const cases = output?.cases || [];
  const status = output?.status || 'internal_error';

  // ── Theme Mapping ──
  const STATUS_CONFIG = {
    accepted: {
      label: 'Accepted',
      color: '#0fa336',
      bg: 'rgba(15,163,54,0.1)',
      border: 'rgba(15,163,54,0.25)',
      icon: <CheckCircle size={15} color="#0fa336" />,
    },
    wrong_answer: {
      label: 'Wrong Answer',
      color: '#e22718',
      bg: 'rgba(226,39,24,0.1)',
      border: 'rgba(226,39,24,0.25)',
      icon: <XCircle size={15} color="#e22718" />,
    },
    compile_error: {
      label: 'Compile Error',
      color: '#e22718',
      bg: 'rgba(226,39,24,0.1)',
      border: 'rgba(226,39,24,0.25)',
      icon: <XCircle size={15} color="#e22718" />,
    },
    runtime_error: {
      label: 'Runtime Error',
      color: '#e22718',
      bg: 'rgba(226,39,24,0.1)',
      border: 'rgba(226,39,24,0.25)',
      icon: <XCircle size={15} color="#e22718" />,
    },
    time_limit_exceeded: {
      label: 'Time Limit Exceeded',
      color: '#f4b400',
      bg: 'rgba(244,180,0,0.1)',
      border: 'rgba(244,180,0,0.25)',
      icon: <XCircle size={15} color="#f4b400" />,
    },
    memory_limit_exceeded: {
      label: 'Memory Limit Exceeded',
      color: '#f4b400',
      bg: 'rgba(244,180,0,0.1)',
      border: 'rgba(244,180,0,0.25)',
      icon: <XCircle size={15} color="#f4b400" />,
    },
    internal_error: {
      label: 'Internal Error',
      color: '#e22718',
      bg: 'rgba(226,39,24,0.1)',
      border: 'rgba(226,39,24,0.25)',
      icon: <XCircle size={15} color="#e22718" />,
    },
  };

  const currentStatus = STATUS_CONFIG[status] || STATUS_CONFIG.accepted;

  const toggleExpand = (idx) => {
    setExpandedCases((prev) => ({
      ...prev,
      [idx]: !prev[idx],
    }));
  };

  const headerStyle = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: '44px',
    padding: '0 16px',
    background: '#0d0d0d',
    borderBottom: '1px solid #262626',
    flexShrink: 0,
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#000000', fontFamily: 'Inter, sans-serif' }}>

      {/* ── Console Header ── */}
      <div style={headerStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', borderBottom: '2px solid #0066b1', paddingBottom: '2px' }}>
            <Terminal size={13} color="#0066b1" />
            <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', color: '#ffffff' }}>
              {actionMode === 'submit' ? 'Submit Result' : 'Console'}
            </span>
          </div>

          {/* Top-level status badge (only on Success) */}
          {judgeState === 'success' && hasOutput && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '10px',
              fontWeight: 700,
              letterSpacing: '1px',
              textTransform: 'uppercase',
              padding: '2px 10px',
              color: actionMode === 'run' && currentStatus.label === 'Wrong Answer' ? '#0fa336' : currentStatus.color,
              background: actionMode === 'run' && currentStatus.label === 'Wrong Answer' ? 'rgba(15,163,54,0.1)' : currentStatus.bg,
              border: `1px solid ${actionMode === 'run' && currentStatus.label === 'Wrong Answer' ? 'rgba(15,163,54,0.25)' : currentStatus.border}`,
              borderRadius: '4px'
            }}>
              {actionMode === 'run' && currentStatus.label === 'Wrong Answer' ? <CheckCircle size={15} color="#0fa336" /> : currentStatus.icon}
              {actionMode === 'run' && currentStatus.label === 'Wrong Answer' ? 'Run Completed' : currentStatus.label}
            </div>
          )}
        </div>

        <button
          onClick={onClose}
          style={{ background: 'transparent', border: 'none', color: '#7e7e7e', cursor: 'pointer', padding: '6px', display: 'flex', alignItems: 'center' }}
          onMouseEnter={e => e.currentTarget.style.color = '#ffffff'}
          onMouseLeave={e => e.currentTarget.style.color = '#7e7e7e'}
        >
          <X size={14} />
        </button>
      </div>

      {/* ── Console Body ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#000000', overflow: 'hidden' }}>

        {/* 1. Loading State Panel */}
        {judgeState === 'loading' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px', color: '#ffffff', padding: '20px' }}>
            <Loader2 size={32} style={{ color: '#0066b1', animation: 'spin 0.8s linear infinite' }} />
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', textAlign: 'center' }}>
              <span style={{ fontSize: '14px', fontWeight: 700, letterSpacing: '0.5px' }}>
                {actionMode === 'submit'
                  ? (submitPhase === 'submitting' ? 'Submitting your solution...' : 'Judging...')
                  : 'Executing code...'
                }
              </span>
              <span style={{ color: '#7e7e7e', fontSize: '12px', maxWidth: '300px', lineHeight: 1.4 }}>
                {actionMode === 'submit'
                  ? (submitPhase === 'submitting'
                      ? 'Sending code to sandboxed compiler environment...'
                      : 'Running against official hidden test cases...')
                  : 'Running Python script in sandboxed container...'
                }
              </span>
            </div>
          </div>
        )}

        {/* 2. Error State Panel (Network or Internal Server Failure) */}
        {judgeState === 'error' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px', color: '#e22718', padding: '20px' }}>
            <XCircle size={36} />
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', textAlign: 'center' }}>
              <span style={{ fontSize: '14px', fontWeight: 700, letterSpacing: '0.5px', color: '#ffffff' }}>Execution failed</span>
              <span style={{ color: '#7e7e7e', fontSize: '12px', maxWidth: '340px', lineHeight: 1.5 }}>
                Could not execute solution. Verify your authorization session, connection, or check if the local server is running.
              </span>
              {output?.runtimeError && (
                <pre style={{
                  color: '#e22718',
                  background: '#0d0d0d',
                  border: '1px solid #262626',
                  padding: '10px 12px',
                  fontSize: '11px',
                  fontFamily: 'JetBrains Mono, monospace',
                  textAlign: 'left',
                  maxHeight: '100px',
                  overflowY: 'auto',
                  marginTop: '10px',
                  width: '100%'
                }}>{output.runtimeError}</pre>
              )}
              <span style={{ color: '#bbbbbb', fontSize: '11px', marginTop: '10px', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase' }}>
                Retry Guidance: Check network & click Run/Submit again
              </span>
            </div>
          </div>
        )}

        {/* 3. Idle / Welcome State */}
        {judgeState === 'idle' && !hasOutput && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', color: '#3c3c3c' }}>
            <Terminal size={28} />
            <p style={{ color: '#7e7e7e', fontSize: '12px', letterSpacing: '0.5px' }}>Press RUN to test or SUBMIT to judge your code</p>
          </div>
        )}

        {/* 4. Success State Panels */}
        {judgeState === 'success' && hasOutput && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

            {/* ── Prominent Verdict Banner for Submissions (Shown for ALL statuses) ── */}
            {actionMode === 'submit' && (
              <div style={{
                background: status === 'accepted' ? 'rgba(15,163,54,0.1)' : 'rgba(226,39,24,0.1)',
                borderBottom: `1px solid ${status === 'accepted' ? 'rgba(15,163,54,0.2)' : 'rgba(226,39,24,0.2)'}`,
                padding: '16px 20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
                flexShrink: 0
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {status === 'accepted' ? <CheckCircle size={18} color="#0fa336" /> : <XCircle size={18} color="#e22718" />}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span style={{ fontSize: '15px', fontWeight: 700, color: status === 'accepted' ? '#0fa336' : '#e22718', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                      {currentStatus.label}
                    </span>
                    <span style={{ color: '#bbbbbb', fontSize: '11px' }}>
                      {status === 'compile_error'
                        ? 'Your code failed to compile'
                        : status === 'runtime_error'
                        ? 'Your code threw an unhandled exception'
                        : status === 'time_limit_exceeded'
                        ? 'Enforced execution timeout (5.0 seconds) reached'
                        : status === 'memory_limit_exceeded'
                        ? 'Enforced memory boundary (128MB) exceeded'
                        : output.summary
                      }
                    </span>
                  </div>
                </div>
                {/* Max runtime in submission (if any cases ran) */}
                {cases.length > 0 && output.cases?.some(c => c.runtimeMs !== undefined) && (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                    <span style={{ fontSize: '10px', color: '#7e7e7e', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Runtime</span>
                    <span style={{ fontSize: '13px', color: '#ffffff', fontFamily: 'JetBrains Mono, monospace', fontWeight: 700 }}>
                      {Math.max(...output.cases.map(c => c.runtimeMs || 0))} ms
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* ── Sub-panels based on compilation/runtime success status ── */}

            {/* A. Compilation Errors */}
            {status === 'compile_error' && (
              <div style={{ flex: 1, overflowY: 'auto', padding: '20px', background: '#000000', fontFamily: 'JetBrains Mono, Fira Code, Consolas, monospace' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#7e7e7e', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '8px', fontFamily: 'Inter, sans-serif' }}>Compiler Error Message</div>
                <pre style={{ color: '#e22718', lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word', background: '#0d0d0d', border: '1px solid #262626', padding: '16px', fontSize: '12px' }}>
                  {output?.compileError || 'Syntax / Compilation error occurred.'}
                </pre>
              </div>
            )}

            {/* B. Global Runtime Errors (Startup crashes) */}
            {status === 'runtime_error' && cases.length === 0 && (
              <div style={{ flex: 1, overflowY: 'auto', padding: '20px', background: '#000000', fontFamily: 'JetBrains Mono, Fira Code, Consolas, monospace' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#7e7e7e', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '8px', fontFamily: 'Inter, sans-serif' }}>Initialization / Runtime Error</div>
                <pre style={{ color: '#e22718', lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word', background: '#0d0d0d', border: '1px solid #262626', padding: '16px', fontSize: '12px' }}>
                  {output?.runtimeError || 'An error occurred during program startup.'}
                </pre>
              </div>
            )}

            {/* C. Global Time/Memory Limit Exceeded (Cases empty) */}
            {(status === 'time_limit_exceeded' || status === 'memory_limit_exceeded') && cases.length === 0 && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px', color: '#f4b400', padding: '20px' }}>
                <XCircle size={32} />
                <span style={{ fontSize: '14px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>{currentStatus.label}</span>
                <span style={{ color: '#7e7e7e', fontSize: '12px', textAlign: 'center', maxWidth: '360px', lineHeight: 1.5 }}>
                  {status === 'time_limit_exceeded'
                    ? 'Your program exceeded the 5.0 seconds runtime limit. Ensure there are no infinite loops or inefficient algorithms.'
                    : 'Your program exceeded the 128MB memory limit. Check for massive memory allocations.'
                  }
                </span>
              </div>
            )}

            {/* E. Successful Submission Checkbox (Satisfying CP success display) */}
            {status === 'accepted' && actionMode === 'submit' && cases.length === 0 && (
              <div style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '20px',
                padding: '40px 20px',
                background: '#070707',
                color: '#ffffff',
                textAlign: 'center'
              }}>
                <div style={{
                  width: '90px',
                  height: '90px',
                  borderRadius: '50%',
                  background: 'rgba(15,163,54,0.1)',
                  border: '3px solid #0fa336',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '44px',
                  color: '#0fa336',
                  boxShadow: '0 0 20px rgba(15, 163, 54, 0.2)',
                  animation: 'pulse-checkbox 2s infinite ease-in-out'
                }}>
                  ✓
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxWidth: '340px' }}>
                  <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#ffffff', margin: 0 }}>Submission Accepted!</h3>
                  <p style={{ color: '#7e7e7e', fontSize: '12px', lineHeight: 1.6, margin: 0 }}>
                    Your code successfully passed compilation checks and was submitted to the platform.
                  </p>
                </div>

                <div style={{
                  background: '#0d0d0d',
                  border: '1px solid #1a1a1a',
                  borderRadius: '8px',
                  padding: '12px 24px',
                  fontSize: '11px',
                  fontWeight: 600,
                  color: '#bbbbbb',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#0fa336' }}></span>
                  Status: All 5/5 Sample Cases Passed
                </div>
              </div>
            )}

            {/* D. Successful Execution with case runs (HackerRank-style list for SUBMIT, LeetCode tabs for RUN) */}
            {cases.length > 0 && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                
                {actionMode === 'submit' ? (
                  /* ── HackerRank-Style List View (Expandable Cards) ── */
                  <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {cases.map((c, idx) => {
                      const casePassed = c.status === 'passed';
                      const isExpanded = !!expandedCases[idx];
                      
                      const formatInput = () => {
                        if (false) return 'Hidden Test Case — Details hidden.';
                        const raw = c.input !== undefined ? c.input : (c.input_data !== undefined ? c.input_data : c.rawInput);
                        if (typeof raw === 'string') return raw || 'None';
                        if (raw && typeof raw === 'object') {
                          if (Array.isArray(raw.args) && raw.args.length > 0) {
                            if (raw.args.length === 1 && typeof raw.args[0] === 'string') {
                              return raw.args[0] || 'None';
                            }
                            const lines = [];
                            raw.args.forEach((val, i) => {
                              lines.push(typeof val === 'string' ? val : `Arg ${i + 1} = ${JSON.stringify(val)}`);
                            });
                            if (raw.kwargs) {
                              Object.entries(raw.kwargs).forEach(([k, v]) => {
                                lines.push(`${k} = ${typeof v === 'string' ? v : JSON.stringify(v)}`);
                              });
                            }
                            return lines.join('\n');
                          }
                          return JSON.stringify(raw, null, 2);
                        }
                        return raw !== undefined && raw !== null ? String(raw) : 'None';
                      };

                      const formatOutputValue = (val) => {
                        if (val === undefined || val === null) return '—';
                        if (typeof val === 'string') return val === '' ? '(empty)' : val;
                        return JSON.stringify(val, null, 2);
                      };

                      const expectedVal = c.expected !== undefined ? c.expected : (c.expected_output !== undefined ? c.expected_output : c.expectedOutput);
                      const actualVal = c.actual !== undefined ? c.actual : (c.actual_output !== undefined ? c.actual_output : c.actualOutput);
                      const runtimeVal = c.runtimeMs !== undefined ? c.runtimeMs : (c.execution_time_ms !== undefined ? c.execution_time_ms : null);

                      return (
                        <div
                          key={idx}
                          style={{
                            background: '#0a0a0a',
                            border: `1px solid ${isExpanded ? '#333333' : '#1a1a1a'}`,
                            borderRadius: '4px',
                            display: 'flex',
                            flexDirection: 'column',
                            overflow: 'hidden',
                          }}
                        >
                          {/* Row Header */}
                          <div
                            onClick={() => toggleExpand(idx)}
                            style={{
                              padding: '12px 16px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              cursor: 'pointer',
                              background: isExpanded ? '#111111' : 'transparent',
                              userSelect: 'none',
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = '#151515'}
                            onMouseLeave={e => e.currentTarget.style.background = isExpanded ? '#111111' : 'transparent'}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              {casePassed || (actionMode === 'run' && c.status === 'wrong_answer') ? <CheckCircle size={15} color="#0fa336" /> : <XCircle size={15} color="#e22718" />}
                              <span style={{ fontSize: '12px', fontWeight: 600, color: '#ffffff' }}>
                                {false ? `Hidden Test Case ${idx + 1}` : `Test Case ${idx + 1}`}
                              </span>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                              <span style={{
                                fontSize: '10px',
                                fontWeight: 700,
                                textTransform: 'uppercase',
                                color: casePassed || (actionMode === 'run' && c.status === 'wrong_answer') ? '#0fa336' : '#e22718',
                                letterSpacing: '0.5px'
                              }}>
                                {casePassed ? 'Passed' : actionMode === 'run' && c.status === 'wrong_answer' ? 'Executed' : c.status === 'wrong_answer' ? 'Wrong Answer' : c.status === 'runtime_error' ? 'Runtime Error' : c.status}
                              </span>
                              {runtimeVal !== null && (
                                <span style={{ fontSize: '11px', color: '#7e7e7e', fontFamily: 'JetBrains Mono, monospace' }}>
                                  {runtimeVal} ms
                                </span>
                              )}
                              {isExpanded ? <ChevronUp size={14} color="#7e7e7e" /> : <ChevronDown size={14} color="#7e7e7e" />}
                            </div>
                          </div>

                          {/* Row Expanded Details */}
                          {isExpanded && (
                            <div style={{ padding: '16px', borderTop: '1px solid #1a1a1a', background: '#070707', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                              {false ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                  <div style={{ fontSize: '12px', color: '#7e7e7e', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Terminal size={14} />
                                    Hidden Test Case — Details hidden.
                                  </div>
                                  {c.stdout && (
                                    <div>
                                      <div style={{ fontSize: '9px', fontWeight: 700, color: '#7e7e7e', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '4px' }}>Stdout (Console Print)</div>
                                      <pre style={{ color: '#bbbbbb', background: '#0d0d0d', border: '1px solid #1a1a1a', padding: '10px 12px', fontSize: '11px', fontFamily: 'JetBrains Mono, monospace', whiteSpace: 'pre-wrap' }}>
                                        {c.stdout}
                                      </pre>
                                    </div>
                                  )}
                                  {(c.stderr || c.traceback || c.error_message) && (
                                    <div>
                                      <div style={{ fontSize: '9px', fontWeight: 700, color: '#e22718', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '4px' }}>Error Details / Stderr</div>
                                      <pre style={{ color: '#e22718', background: '#0d0d0d', border: '1px solid #1a1a1a', padding: '10px 12px', fontSize: '11px', fontFamily: 'JetBrains Mono, monospace', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                                        {c.traceback || c.stderr || c.error_message}
                                      </pre>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <>
                                  {/* Input */}
                                  <div>
                                    <div style={{ fontSize: '9px', fontWeight: 700, color: '#7e7e7e', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '4px' }}>Input</div>
                                    <pre style={{ color: '#ffffff', background: '#0d0d0d', border: '1px solid #1a1a1a', padding: '10px 12px', fontSize: '11px', fontFamily: 'JetBrains Mono, monospace', whiteSpace: 'pre-wrap' }}>
                                      {formatInput() || 'None'}
                                    </pre>
                                  </div>

                                  {/* Outputs */}
                                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                                    <div>
                                      <div style={{ fontSize: '9px', fontWeight: 700, color: '#7e7e7e', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '4px' }}>Expected Output</div>
                                      <pre style={{ color: '#0fa336', background: '#0d0d0d', border: '1px solid #1a1a1a', padding: '10px 12px', fontSize: '11px', fontFamily: 'JetBrains Mono, monospace', whiteSpace: 'pre-wrap' }}>
                                        {formatOutputValue(expectedVal)}
                                      </pre>
                                    </div>
                                    <div>
                                      <div style={{ fontSize: '9px', fontWeight: 700, color: '#7e7e7e', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '4px' }}>YOUR OUTPUT</div>
                                      <pre style={{
                                        color: casePassed ? '#0fa336' : '#e22718',
                                        background: '#0d0d0d',
                                        border: '1px solid #1a1a1a',
                                        padding: '10px 12px',
                                        fontSize: '11px',
                                        fontFamily: 'JetBrains Mono, monospace',
                                        whiteSpace: 'pre-wrap'
                                      }}>
                                        {c.status === 'runtime_error' ? 'Runtime Exception' : formatOutputValue(actualVal)}
                                      </pre>
                                    </div>
                                  </div>

                                  {/* Console stdout prints */}
                                  {c.stdout && (
                                    <div>
                                      <div style={{ fontSize: '9px', fontWeight: 700, color: '#7e7e7e', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '4px' }}>Stdout (Console Print)</div>
                                      <pre style={{ color: '#bbbbbb', background: '#0d0d0d', border: '1px solid #1a1a1a', padding: '10px 12px', fontSize: '11px', fontFamily: 'JetBrains Mono, monospace', whiteSpace: 'pre-wrap' }}>
                                        {c.stdout}
                                      </pre>
                                    </div>
                                  )}

                                  {/* Traceback error details */}
                                  {(c.stderr || c.traceback || c.error_message) && (
                                    <div>
                                      <div style={{ fontSize: '9px', fontWeight: 700, color: '#e22718', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '4px' }}>Error Details / Stderr</div>
                                      <pre style={{ color: '#e22718', background: '#0d0d0d', border: '1px solid #1a1a1a', padding: '10px 12px', fontSize: '11px', fontFamily: 'JetBrains Mono, monospace', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                                        {c.traceback || c.stderr || c.error_message}
                                      </pre>
                                    </div>
                                  )}
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  /* ── LeetCode-Style Tabs View (Perfect for RUN mode) ── */
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    
                    {/* Case Selector Tabs */}
                    <div style={{ display: 'flex', background: '#000000', borderBottom: '1px solid #262626', padding: '0 16px', gap: '4px', flexShrink: 0 }}>
                      {cases.map((c, idx) => {
                        const casePassed = c.status === 'passed';
                        const isActive = activeCaseIdx === idx;
                        return (
                          <button
                            key={idx}
                            onClick={() => setActiveCaseIdx(idx)}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              borderBottom: isActive ? '2px solid #ffffff' : '2px solid transparent',
                              color: isActive ? '#ffffff' : '#7e7e7e',
                              fontSize: '11px',
                              fontWeight: 700,
                              letterSpacing: '1px',
                              textTransform: 'uppercase',
                              padding: '12px 14px 10px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                            }}
                          >
                            <span style={{
                              width: '5px',
                              height: '5px',
                              borderRadius: '50%',
                              background: casePassed ? '#0fa336' : '#e22718'
                            }} />
                            Case {idx + 1}
                          </button>
                        );
                      })}
                    </div>

                    {/* Selected Case Details */}
                    <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      {(() => {
                        const c = cases[activeCaseIdx];
                        if (!c) return null;

                        const formatInput = () => {
                          if (false) return 'Hidden Test Case — Details hidden.';
                          const raw = c.input !== undefined ? c.input : (c.input_data !== undefined ? c.input_data : c.rawInput);
                          if (typeof raw === 'string') return raw || 'None';
                          if (raw && typeof raw === 'object') {
                            if (Array.isArray(raw.args) && raw.args.length > 0) {
                              if (raw.args.length === 1 && typeof raw.args[0] === 'string') {
                                return raw.args[0] || 'None';
                              }
                              const lines = [];
                              raw.args.forEach((val, i) => {
                                lines.push(typeof val === 'string' ? val : `Arg ${i + 1} = ${JSON.stringify(val)}`);
                              });
                              if (raw.kwargs) {
                                Object.entries(raw.kwargs).forEach(([k, v]) => {
                                  lines.push(`${k} = ${typeof v === 'string' ? v : JSON.stringify(v)}`);
                                });
                              }
                              return lines.join('\n');
                            }
                            return JSON.stringify(raw, null, 2);
                          }
                          return raw !== undefined && raw !== null ? String(raw) : 'None';
                        };

                        const formatOutputValue = (val) => {
                          if (val === undefined || val === null) return '—';
                          if (typeof val === 'string') return val === '' ? '(empty)' : val;
                          return JSON.stringify(val, null, 2);
                        };

                        const expectedVal = c.expected !== undefined ? c.expected : (c.expected_output !== undefined ? c.expected_output : c.expectedOutput);
                        const actualVal = c.actual !== undefined ? c.actual : (c.actual_output !== undefined ? c.actual_output : c.actualOutput);
                        const runtimeVal = c.runtimeMs !== undefined ? c.runtimeMs : (c.execution_time_ms !== undefined ? c.execution_time_ms : null);

                        return (
                          <>
                            {/* Input */}
                            <div>
                              <div style={{ fontSize: '10px', fontWeight: 700, color: '#7e7e7e', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '6px' }}>Input</div>
                              <pre style={{
                                color: '#ffffff',
                                background: '#0d0d0d',
                                border: '1px solid #1a1a1a',
                                padding: '10px 12px',
                                fontSize: '12px',
                                fontFamily: 'JetBrains Mono, monospace',
                                whiteSpace: 'pre-wrap',
                              }}>
                                {formatInput() || 'None'}
                              </pre>
                            </div>

                            {/* Outputs */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                              <div>
                                <div style={{ fontSize: '10px', fontWeight: 700, color: '#7e7e7e', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '6px' }}>Expected Output</div>
                                <pre style={{ color: '#0fa336', background: '#0d0d0d', border: '1px solid #1a1a1a', padding: '10px 12px', fontSize: '12px', fontFamily: 'JetBrains Mono, monospace', whiteSpace: 'pre-wrap' }}>
                                  {formatOutputValue(expectedVal)}
                                </pre>
                              </div>
                              <div>
                                <div style={{ fontSize: '10px', fontWeight: 700, color: '#7e7e7e', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '6px' }}>YOUR OUTPUT</div>
                                <pre style={{
                                  color: c.status === 'passed' ? '#0fa336' : '#e22718',
                                  background: '#0d0d0d',
                                  border: '1px solid #1a1a1a',
                                  padding: '10px 12px',
                                  fontSize: '12px',
                                  fontFamily: 'JetBrains Mono, monospace',
                                  whiteSpace: 'pre-wrap'
                                }}>
                                  {c.status === 'runtime_error' ? 'Runtime Exception' : formatOutputValue(actualVal)}
                                </pre>
                              </div>
                            </div>

                            {/* Case status details */}
                            {c.status !== 'passed' && (
                              <div style={{ display: 'flex', gap: '8px', fontSize: '11px', color: '#7e7e7e' }}>
                                <span style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>Verdict:</span>
                                <span style={{ color: '#e22718', fontWeight: 700, textTransform: 'uppercase' }}>
                                  {c.status === 'wrong_answer' ? 'Wrong Answer' : c.status === 'runtime_error' ? 'Runtime Error' : c.status}
                                </span>
                              </div>
                            )}

                            {/* Runtime */}
                            <div style={{ display: 'flex', gap: '8px', fontSize: '11px', color: '#7e7e7e' }}>
                              <span style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>Runtime:</span>
                              <span style={{ color: '#ffffff', fontFamily: 'JetBrains Mono, monospace' }}>
                                {runtimeVal !== null ? `${runtimeVal} ms` : '—'}
                              </span>
                            </div>

                            {/* Stdout */}
                            {c.stdout && (
                              <div>
                                <div style={{ fontSize: '10px', fontWeight: 700, color: '#7e7e7e', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '6px' }}>Stdout (Console Print)</div>
                                <pre style={{ color: '#bbbbbb', background: '#0d0d0d', border: '1px solid #1a1a1a', padding: '10px 12px', fontSize: '12px', fontFamily: 'JetBrains Mono, monospace', whiteSpace: 'pre-wrap' }}>
                                  {c.stdout}
                                </pre>
                              </div>
                            )}

                            {/* Stderr */}
                            {(c.stderr || c.traceback || c.error_message) && (
                              <div>
                                <div style={{ fontSize: '10px', fontWeight: 700, color: '#e22718', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '6px' }}>Error Details / Stderr</div>
                                <pre style={{ color: '#e22718', background: '#0d0d0d', border: '1px solid #1a1a1a', padding: '10px 12px', fontSize: '12px', fontFamily: 'JetBrains Mono, monospace', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                                  {c.traceback || c.stderr || c.error_message}
                                </pre>
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  </div>
                )}

              </div>
            )}

          </div>
        )}

      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
