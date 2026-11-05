'use client';
import WorkspaceReturn from '@/components/WorkspaceReturn';
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
import { useCodingWorkspace, PRACTICAL_BOILERPLATES, friendlyError } from '@/features/coding-workspace/hooks/useCodingWorkspace';

export default function WorkspaceLayout({ problem }) {
  const { studentTheme, router, showLogoutModal, setShowLogoutModal, handleLogout, confirmLogout, consoleOpen, setConsoleOpen, selectedLang, setSelectedLang, isListOpen, setIsListOpen, practicalPage, practicals, fetchPracticals, selectedCourse, setSelectedCourse, socket, hasAutoNavigated, isUserDropdownOpen, setIsUserDropdownOpen, userDropdownRef, showProfileModal, setShowProfileModal, showSettingsModal, setShowSettingsModal, showSubmissionsModal, setShowSubmissionsModal, userSubmissions, setUserSubmissions, loadingSubmissions, setLoadingSubmissions, editorFontSize, setEditorFontSize, editorTabSize, setEditorTabSize, editorTheme, setEditorTheme, editorWordWrap, setEditorWordWrap, editorMinimap, setEditorMinimap, profileForm, setProfileForm, profileMsg, setProfileMsg, fetchUserSubmissions, handleUpdateProfile, resolvedProblem, getBoilerplate, codeByLang, setCodeByLang, lifecycle, draftStatus, setDraftStatus, draftVersion, narrow, setNarrow, workspaceTab, setWorkspaceTab, settingsRef, confirmation, setConfirmation, undoDraft, setUndoDraft, handleLoadSubmissionCode, hasUnsavedChanges, setHasUnsavedChanges, isLoadingCode, setIsLoadingCode, saveStatus, setSaveStatus, saveStatusTimerRef, isRunning, setIsRunning, isSubmitting, setIsSubmitting, isSavingCode, setIsSavingCode, output, setOutput, lastRunCode, setLastRunCode, hasSuccessfulRun, setHasSuccessfulRun, actionMode, setActionMode, judgeState, setJudgeState, submitPhase, setSubmitPhase, workspaceNotice, setWorkspaceNotice, noticeTimerRef, showNotice, handleCodeChange, handleLangChange, handleResetCode, autoSaveTimerRef, handleSaveCodeToDB, performAction, handleRun, handleSubmit, currentCode, isCodeUnchanged, isExecutable, canRun, canSubmit, getSubmitTooltip, editorPanel, consolePanel } = useCodingWorkspace({ problem });
return (
    <div className="coding-workspace" style={{ display: 'flex', flexDirection: 'column', height: '100dvh', width: '100%', overflow: 'hidden', background: 'var(--student-code-bg-000000, #000000)', color: 'var(--student-code-text-ffffff, #ffffff)', fontFamily: 'Inter, sans-serif', userSelect: 'none' }}>

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
          color: 'var(--student-code-text-ffffff, #ffffff)',
          fontSize: '13px',
          fontWeight: 600,
          boxShadow: '0 10px 30px rgba(0,0,0,0.8)',
        }}>
          <span>{workspaceNotice.type === 'warning' ? '⚠️' : workspaceNotice.type === 'error' ? '❌' : '✓'}</span>
          <span>{workspaceNotice.text}</span>
          <button
            onClick={() => setWorkspaceNotice(null)}
            style={{ background: 'none', border: 'none', color: 'var(--student-code-text-999999, #999)', cursor: 'pointer', fontSize: '14px', padding: '0 4px', marginLeft: '6px' }}
          >
            ✕
          </button>
        </div>
      )}

      {/* ── Top Navigation Bar — 64px, true black ── */}
      <div style={{ height: '64px', background: 'var(--student-code-bg-000000, #000000)', borderBottom: '1px solid var(--student-code-border-262626, #262626)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', flexShrink: 0 }}>
        {/* Left: Brand + Problem List Dropdown */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          <WorkspaceReturn compact />

          {/* Switch course dropdown has been removed here */}

          {/* Problem List dropdown */}
          <div style={{ position: 'relative' }}>
            <button suppressHydrationWarning
              onClick={() => setIsListOpen(!isListOpen)}
              style={{ background: 'var(--student-code-bg-1a1a1a, #1a1a1a)', border: '1px solid var(--student-code-border-3c3c3c, #3c3c3c)', color: 'var(--student-code-text-bbbbbb, #bbbbbb)', fontSize: '11px', fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', padding: '8px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', outline: 'none' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--student-code-bg-262626, #262626)'; e.currentTarget.style.color = 'var(--student-code-text-ffffff, #ffffff)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'var(--student-code-bg-1a1a1a, #1a1a1a)'; e.currentTarget.style.color = 'var(--student-code-text-bbbbbb, #bbbbbb)'; }}
            >
              <List size={12} />
              Problem List
            </button>

            {isListOpen && (
              <div style={{
                position: 'absolute',
                top: '46px',
                left: 0,
                background: 'var(--student-code-bg-141414, #141414)',
                border: '1px solid var(--student-code-border-262626, #262626)',
                borderRadius: '4px',
                boxShadow: '0 10px 30px rgba(0,0,0,0.7)',
                width: '300px',
                maxHeight: '380px',
                overflowY: 'auto',
                zIndex: 1000,
                padding: '8px 0'
              }}>
                <nav aria-label="Workspace practical pages" style={{ padding: 12 }}>
                  <button disabled={practicalPage.loading || !practicalPage.cursor} onClick={practicalPage.first}>First page</button>{' '}
                  <button disabled={practicalPage.loading || !practicalPage.next} onClick={practicalPage.nextPage}>Next page</button>
                  <p style={{ fontSize: 11 }}>Subject filters apply to this page.</p>
                  {practicalPage.error && <p role="alert">{practicalPage.error}</p>}
                </nav>
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
                    <div style={{ padding: '8px 16px', borderBottom: '1px solid var(--student-code-border-262626, #262626)', marginBottom: '6px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <div style={{ fontSize: '9px', color: '#00b8a3', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase' }}>
                          {selectedCourse !== 'All' ? selectedCourse : 'Assigned Coding Practicals'} ({filteredPracticals.length})
                        </div>
                        <button suppressHydrationWarning
                          onClick={() => router.push('/student')}
                          style={{
                            background: 'transparent', color: 'var(--student-code-text-7e7e7e, #7e7e7e)', border: '1px solid var(--student-code-border-3c3c3c, #3c3c3c)', borderRadius: '4px',
                            padding: '4px 8px', fontSize: '10px', cursor: 'pointer', transition: 'all 0.2s'
                          }}
                          onMouseEnter={e => { e.currentTarget.style.color = 'var(--student-code-text-ffffff, #fff)'; e.currentTarget.style.borderColor = 'var(--student-code-border-555555, #555)'; }}
                          onMouseLeave={e => { e.currentTarget.style.color = 'var(--student-code-text-7e7e7e, #7e7e7e)'; e.currentTarget.style.borderColor = 'var(--student-code-border-3c3c3c, #3c3c3c)'; }}
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
                            background: 'var(--student-code-bg-1a1a1a, #1a1a1a)',
                            color: 'var(--student-code-text-ffffff, #ffffff)',
                            border: '1px solid var(--student-code-border-3c3c3c, #3c3c3c)',
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
                      <div style={{ padding: '16px', fontSize: '11px', color: 'var(--student-code-text-7e7e7e, #7e7e7e)', textAlign: 'center' }}>
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
                            background: isActive ? 'var(--student-code-bg-1e1e1e, #1e1e1e)' : 'transparent',
                            color: isActive ? 'var(--student-code-text-ffffff, #ffffff)' : 'var(--student-code-text-bbbbbb, #bbbbbb)',
                            transition: 'background 0.2s'
                          }}
                          onMouseEnter={e => {
                            e.currentTarget.style.background = isActive ? 'var(--student-code-bg-1e1e1e, #1e1e1e)' : 'var(--student-code-bg-262626, #262626)';
                            e.currentTarget.style.color = 'var(--student-code-text-ffffff, #ffffff)';
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.background = isActive ? 'var(--student-code-bg-1e1e1e, #1e1e1e)' : 'transparent';
                            e.currentTarget.style.color = isActive ? 'var(--student-code-text-ffffff, #ffffff)' : 'var(--student-code-text-bbbbbb, #bbbbbb)';
                          }}
                        >
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontSize: '12px', fontWeight: isActive ? 700 : 500 }}>
                              {p.title}
                            </span>
                            <span style={{ fontSize: '9px', color: 'var(--student-code-text-7e7e7e, #7e7e7e)', marginTop: '2px' }}>
                              {p.course_code} • {p.my_status ? `Grade: ${p.my_marks || 0}/10 (${p.my_status})` : 'Unsolved'}
                            </span>
                          </div>
                          <span style={{ fontSize: '9px', fontWeight: 700, color: diffColor, background: `${diffColor}15`, border: `1px solid ${diffColor}30`, padding: '2px 6px', borderRadius: '10px', textTransform: 'uppercase' }}>
                            {p.difficulty}
                          </span>
                        </div>
                      );
                    })}
                    <div style={{ height: '1px', background: 'var(--student-code-bg-262626, #262626)', margin: '8px 0' }} />
                  </>
                  );
                })()}
                {practicals.length === 0 && (
                  <div style={{ padding: '16px', fontSize: '11px', color: 'var(--student-code-text-7e7e7e, #7e7e7e)', textAlign: 'center' }}>
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
              background: 'var(--student-code-bg-000000, #000000)',
              border: canRun ? '1px solid #ffffff' : '1px solid #3c3c3c',
              color: canRun ? 'var(--student-code-text-ffffff, #ffffff)' : 'var(--student-code-text-3c3c3c, #3c3c3c)',
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
              <span style={{ width: '12px', height: '12px', border: '2px solid var(--student-code-border-ffffff, #ffffff)', borderTopColor: 'transparent', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} />
            ) : (
              <Play size={13} />
            )}
            {isRunning ? 'Running…' : 'Run'}
            {!isRunning && <span style={{ opacity: 0.6, marginLeft: '4px', fontSize: '10px', textTransform: 'none', fontWeight: 500 }}>Ctrl+↵</span>}
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button suppressHydrationWarning
              id="btn-submit-code"
              onClick={handleSubmit}
              disabled={!canSubmit}
              title={getSubmitTooltip() || 'Submit code (Ctrl+Shift+Enter)'}
              style={{
                background: '#0fa336',
                border: 'none',
                color: 'var(--student-code-text-ffffff, #ffffff)',
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
                <span style={{ width: '12px', height: '12px', border: '2px solid var(--student-code-border-ffffff, #ffffff)', borderTopColor: 'transparent', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} />
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
                borderLeft: '2px solid var(--student-code-border-262626, #262626)',
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
          <StudentThemeToggle />
          <button suppressHydrationWarning
            onClick={() => setShowSettingsModal(true)}
            title="Settings"
            style={{ width: '40px', height: '40px', background: 'var(--student-code-bg-1a1a1a, #1a1a1a)', border: '1px solid var(--student-code-border-262626, #262626)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--student-code-text-7e7e7e, #7e7e7e)', cursor: 'pointer' }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--student-code-text-ffffff, #ffffff)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--student-code-text-7e7e7e, #7e7e7e)'; }}
          >
            <Settings size={16} />
          </button>
          <button suppressHydrationWarning
            onClick={() => setIsUserDropdownOpen(!isUserDropdownOpen)}
            title="Profile Menu"
            style={{ width: '40px', height: '40px', background: 'var(--student-code-bg-1a1a1a, #1a1a1a)', border: '1px solid var(--student-code-border-262626, #262626)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--student-code-text-7e7e7e, #7e7e7e)', cursor: 'pointer' }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--student-code-text-ffffff, #ffffff)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--student-code-text-7e7e7e, #7e7e7e)'; }}
          >
            <User size={16} />
          </button>

          {isUserDropdownOpen && (
            <div style={{
              position: 'absolute',
              top: '50px',
              right: '0px',
              backgroundColor: 'var(--student-code-bg-1f1f1f, #1f1f1f)',
              border: '1px solid var(--student-code-border-333333, #333333)',
              borderRadius: '8px',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)',
              minWidth: '180px',
              zIndex: 1000,
              display: 'flex',
              flexDirection: 'column',
              padding: '6px 0'
            }}>
              <div style={{ padding: '8px 16px', borderBottom: '1px solid var(--student-code-border-333333, #333333)', fontSize: '12px', color: 'var(--student-code-text-888888, #888)' }}>
                Signed in as <br />
                <strong style={{ color: 'var(--student-code-text-ffffff, #ffffff)' }}>{profileForm.name || 'Student'}</strong>
              </div>
              <button suppressHydrationWarning
                onClick={() => {
                  const handle = profileForm.email ? profileForm.email.split('@')[0] : '';
                  router.push(`/profile/${handle}`);
                  setIsUserDropdownOpen(false);
                }}
                style={{ background: 'transparent', border: 'none', color: 'var(--student-code-text-cccccc, #cccccc)', textAlign: 'left', padding: '10px 16px', fontSize: '13px', cursor: 'pointer' }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--student-code-bg-2a2a2a, #2a2a2a)'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                👤 Edit Profile
              </button>
              <button suppressHydrationWarning
                onClick={() => { setShowSettingsModal(true); setIsUserDropdownOpen(false); }}
                style={{ background: 'transparent', border: 'none', color: 'var(--student-code-text-cccccc, #cccccc)', textAlign: 'left', padding: '10px 16px', fontSize: '13px', cursor: 'pointer' }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--student-code-bg-2a2a2a, #2a2a2a)'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                 Workspace Settings
              </button>
              <div style={{ height: '1px', backgroundColor: 'var(--student-code-bg-333333, #333333)', margin: '4px 0' }} />
              <button suppressHydrationWarning
                onClick={() => { setShowLogoutModal(true); setIsUserDropdownOpen(false); }}
                style={{ background: 'transparent', border: 'none', color: '#ef4444', textAlign: 'left', padding: '10px 16px', fontSize: '13px', cursor: 'pointer', fontWeight: '600' }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--student-code-bg-2a2a2a, #2a2a2a)'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                 Sign Out
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="student-save-status" role="status" aria-live="polite" style={{ padding: '8px 16px', color: 'var(--student-code-text-cbd5e1, #cbd5e1)', fontSize: '12px' }}>
        {draftStatus}{lifecycle.busy ? `${draftStatus ? ' · ' : ''}Working…` : ''}
        {undoDraft && !lifecycle.busy && <button onClick={() => {
          setSelectedLang(undoDraft.language); setCodeByLang(prev => ({ ...prev, [undoDraft.language]: undoDraft.code }));
          draftVersion.current++; setHasUnsavedChanges(true); setDraftStatus('Draft restored. Save to keep your changes.'); setUndoDraft(null);
        }}>Undo draft replacement</button>}
      </div>
      {lifecycle.busy && <span role="timer" aria-live="off" style={{ padding: '0 16px' }}>{lifecycle.elapsed}s elapsed</span>}
      {/* M-Stripe Divider */}
      <div style={{ height: '3px', background: 'linear-gradient(to right, #0066b1, #1c69d4, #e22718)', flexShrink: 0 }} />

      {/* ── Main Workspace ── */}
      <div style={{ flex: 1, overflow: 'hidden', background: 'var(--student-code-bg-000000, #000000)', width: '100%', height: '100%' }}>
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
        <PanelGroup orientation="horizontal" direction="horizontal" style={{ height: '100%', width: '100%' }}>

          {/* LEFT: Problem Panel */}
          <Panel defaultSize={40} minSize={20}>
            <div style={{ height: '100%', background: 'var(--student-code-bg-0d0d0d, #0d0d0d)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <ProblemPanel problem={resolvedProblem} onLoadSubmissionCode={handleLoadSubmissionCode} />
            </div>
          </Panel>

          {/* Vertical resize handle */}
          <PanelResizeHandle style={{ width: '2px', background: 'var(--student-code-bg-262626, #262626)', cursor: 'col-resize', flexShrink: 0 }} />

          {/* RIGHT: Editor (60%) + Console (40%) */}
          <Panel defaultSize={60} minSize={30}>
            <PanelGroup orientation="vertical" direction="vertical" style={{ height: '100%', width: '100%' }}>

              {/* Monaco Editor (upper right side covering 60% area by default) */}
              <Panel defaultSize={consoleOpen ? 60 : 100} minSize={25}>
                <div style={{ height: '100%', background: 'var(--student-code-bg-000000, #000000)', borderLeft: '1px solid var(--student-code-border-262626, #262626)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                  {editorPanel}
                </div>
              </Panel>

              {consoleOpen && (
                <>
                  <PanelResizeHandle style={{ height: '2px', background: 'var(--student-code-bg-262626, #262626)', cursor: 'row-resize', flexShrink: 0 }} />
                  {/* Console Output Screen (lower right side covering 40% area by default) */}
                  <Panel defaultSize={40} minSize={15}>
                    <div style={{ height: '100%', background: 'var(--student-code-bg-000000, #000000)', borderLeft: '1px solid var(--student-code-border-262626, #262626)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
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
          <div style={{ backgroundColor: 'var(--student-code-bg-161616, #161616)', border: '1px solid var(--student-code-border-333333, #333)', borderRadius: '12px', padding: '30px', width: 'min(450px, calc(100vw - 24px))', maxHeight: '90dvh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 id="settings-title" style={{ fontSize: '18px', fontWeight: 700, color: 'var(--student-code-text-ffffff, #ffffff)', margin: 0 }}> Workspace Customization</h3>
              <button suppressHydrationWarning aria-label="Close settings" onClick={() => setShowSettingsModal(false)} style={{ border: 'none', background: 'transparent', color: 'var(--student-code-text-888888, #888)', cursor: 'pointer', fontSize: '18px' }}>×</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', color: 'var(--student-code-text-888888, #888)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '8px' }}>Editor Font Size</label>
                <select
                  value={editorFontSize}
                  onChange={e => {
                    const size = parseInt(e.target.value);
                    setEditorFontSize(size);
                    localStorage.setItem('pref_font_size', size.toString());
                  }}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '6px', border: '1px solid var(--student-code-border-333333, #333)', backgroundColor: 'var(--student-code-bg-0d0d0d, #0d0d0d)', color: 'var(--student-code-text-ffffff, #fff)', fontSize: '14px', outline: 'none', cursor: 'pointer' }}
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
                <label style={{ display: 'block', fontSize: '11px', color: 'var(--student-code-text-888888, #888)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '8px' }}>Tab Spaces (Indentation)</label>
                <select
                  value={editorTabSize}
                  onChange={e => {
                    const size = parseInt(e.target.value);
                    setEditorTabSize(size);
                    localStorage.setItem('pref_tab_size', size.toString());
                  }}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '6px', border: '1px solid var(--student-code-border-333333, #333)', backgroundColor: 'var(--student-code-bg-0d0d0d, #0d0d0d)', color: 'var(--student-code-text-ffffff, #fff)', fontSize: '14px', outline: 'none', cursor: 'pointer' }}
                >
                  <option value="2">2 Spaces</option>
                  <option value="4">4 Spaces</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', color: 'var(--student-code-text-888888, #888)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '8px' }}>Editor Theme</label>
                <select
                  value={studentTheme?.theme === 'light' ? 'light' : editorTheme === 'hc-black' ? 'hc-black' : 'vs-dark'}
                  onChange={e => {
                    const theme = e.target.value;
                    setEditorTheme(theme);
                    studentTheme?.setTheme(theme === 'light' ? 'light' : 'dark');
                    localStorage.setItem('pref_theme', theme);
                  }}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '6px', border: '1px solid var(--student-code-border-333333, #333)', backgroundColor: 'var(--student-code-bg-0d0d0d, #0d0d0d)', color: 'var(--student-code-text-ffffff, #fff)', fontSize: '14px', outline: 'none', cursor: 'pointer' }}
                >
                  <option value="vs-dark">Dark Theme (Default)</option>
                  <option value="light">Light Theme</option>
                  <option value="hc-black">High Contrast (Dark)</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', color: 'var(--student-code-text-888888, #888)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '8px' }}>Word Wrap</label>
                <select
                  value={editorWordWrap}
                  onChange={e => {
                    const wrap = e.target.value;
                    setEditorWordWrap(wrap);
                    localStorage.setItem('pref_word_wrap', wrap);
                  }}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '6px', border: '1px solid var(--student-code-border-333333, #333)', backgroundColor: 'var(--student-code-bg-0d0d0d, #0d0d0d)', color: 'var(--student-code-text-ffffff, #fff)', fontSize: '14px', outline: 'none', cursor: 'pointer' }}
                >
                  <option value="on">On (Wrap to view)</option>
                  <option value="off">Off (Scroll horizontally)</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', color: 'var(--student-code-text-888888, #888)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '8px' }}>Code Minimap</label>
                <select
                  value={editorMinimap.toString()}
                  onChange={e => {
                    const isMinimap = e.target.value === 'true';
                    setEditorMinimap(isMinimap);
                    localStorage.setItem('pref_minimap', isMinimap.toString());
                  }}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '6px', border: '1px solid var(--student-code-border-333333, #333)', backgroundColor: 'var(--student-code-bg-0d0d0d, #0d0d0d)', color: 'var(--student-code-text-ffffff, #fff)', fontSize: '14px', outline: 'none', cursor: 'pointer' }}
                >
                  <option value="false">Hidden (Cleaner view)</option>
                  <option value="true">Visible</option>
                </select>
              </div>

              <div style={{ border: '1px solid var(--student-code-border-333333, #333)', borderRadius: '8px', padding: '15px', backgroundColor: 'var(--student-code-bg-0d0d0d, #0d0d0d)' }}>
                <h4 style={{ fontSize: '12px', fontWeight: 700, color: 'var(--student-code-text-ffffff, #fff)', margin: '0 0 10px 0', textTransform: 'uppercase' }}>⌨️ Keyboard Shortcuts</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px', color: 'var(--student-code-text-cccccc, #ccc)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Run current code:</span>
                    <kbd style={{ backgroundColor: 'var(--student-code-bg-222222, #222)', border: '1px solid var(--student-code-border-444444, #444)', padding: '2px 6px', borderRadius: '4px', fontSize: '10px' }}>Ctrl + '</kbd>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Submit solution:</span>
                    <kbd style={{ backgroundColor: 'var(--student-code-bg-222222, #222)', border: '1px solid var(--student-code-border-444444, #444)', padding: '2px 6px', borderRadius: '4px', fontSize: '10px' }}>Ctrl + Enter</kbd>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
              <button suppressHydrationWarning onClick={() => setShowSettingsModal(false)} style={{ padding: '10px 24px', borderRadius: '6px', border: 'none', backgroundColor: '#4f46e5', color: 'var(--student-code-text-ffffff, #fff)', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>
                Apply Preferences
              </button>
            </div>
          </div>
        </dialog>
      )}

      {/* ── Logout Confirmation Modal ── */}
      {showLogoutModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999, backdropFilter: 'blur(4px)' }}>
          <div style={{ background: 'var(--student-code-bg-161616, #161616)', border: '1px solid var(--student-code-border-333333, #333)', borderRadius: '12px', padding: '28px 32px', width: '360px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--student-code-text-ffffff, #ffffff)' }}>Sign out?</h3>
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--student-code-text-aaaaaa, #aaa)', lineHeight: 1.6 }}>
              You will be signed out of your workspace. Any unsaved code changes have already been auto-saved.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '4px' }}>
              <button
                onClick={() => setShowLogoutModal(false)}
                style={{ padding: '8px 20px', borderRadius: '6px', border: '1px solid var(--student-code-border-3c3c3c, #3c3c3c)', background: 'transparent', color: 'var(--student-code-text-aaaaaa, #aaa)', fontSize: '13px', cursor: 'pointer', fontWeight: 600 }}
                onMouseEnter={e => e.currentTarget.style.color = 'var(--student-code-text-ffffff, #fff)'}
                onMouseLeave={e => e.currentTarget.style.color = 'var(--student-code-text-aaaaaa, #aaa)'}
              >
                Cancel
              </button>
              <button
                onClick={confirmLogout}
                style={{ padding: '8px 20px', borderRadius: '6px', border: 'none', background: '#ef4444', color: 'var(--student-code-text-ffffff, #ffffff)', fontSize: '13px', cursor: 'pointer', fontWeight: 700 }}
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
