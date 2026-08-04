'use client';

import Editor from '@monaco-editor/react';
import { useRef } from 'react';
import { Code2, RotateCcw, Maximize2 } from 'lucide-react';
import { LANGUAGES } from './LanguageConfig';

export default function MonacoEditorPanel({
  selectedLang,
  onLangChange,
  code,
  onCodeChange,
  onReset,
  isRunning,
  activeProblem,
  onRun,
  onSubmit,
  fontSize,
  tabSize,
}) {
  const langConfig = LANGUAGES[selectedLang];
  const onRunRef = useRef(onRun);
  const onSubmitRef = useRef(onSubmit);

  // Keep refs updated to avoid stale closures in Monaco actions
  onRunRef.current = onRun;
  onSubmitRef.current = onSubmit;

  function handleEditorDidMount(editor, monaco) {
    editor.addAction({
      id: 'run-code',
      label: 'Run Code',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Quote],
      run: () => {
        if (onRunRef.current) onRunRef.current();
      }
    });

    editor.addAction({
      id: 'submit-code',
      label: 'Submit Code',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter],
      run: () => {
        if (onSubmitRef.current) onSubmitRef.current();
      }
    });
  }

  function handleReset() {
    if (onReset) {
      onReset();
    } else {
      onCodeChange('');
    }
  }

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

  const selectStyle = {
    background: '#1a1a1a',
    color: '#ffffff',
    border: '1px solid #3c3c3c',
    fontSize: '11px',
    fontWeight: 700,
    letterSpacing: '1px',
    textTransform: 'uppercase',
    padding: '4px 10px',
    cursor: 'pointer',
    outline: 'none',
    fontFamily: 'Inter, sans-serif',
  };

  const iconBtnStyle = {
    background: 'transparent',
    border: 'none',
    color: '#7e7e7e',
    cursor: 'pointer',
    padding: '6px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#1e1e1e' }}>

      {/* Header */}
      <div style={headerStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Code2 size={14} color="#0066b1" />
          <select
            id="language-selector"
            style={selectStyle}
            value={selectedLang}
            onChange={(e) => onLangChange(e.target.value)}
            disabled={isRunning}
          >
            {Object.entries(LANGUAGES)
              .filter(([key]) => {
                if (activeProblem?.isPractical && activeProblem?.allowedLanguages) {
                  return activeProblem.allowedLanguages.includes(key);
                }
                return true;
              })
              .map(([key, cfg]) => (
                <option key={key} value={key}>{cfg.label}</option>
              ))}
          </select>
          {!langConfig.executableInPhase1 && (
            <span style={{ fontSize: '10px', fontWeight: 700, color: '#f4b400', background: 'rgba(244,180,0,0.1)', border: '1px solid rgba(244,180,0,0.25)', padding: '2px 8px', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
              Phase 2
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <button style={iconBtnStyle} title="Reset to Boilerplate" onClick={handleReset} disabled={isRunning}
            onMouseEnter={e => e.currentTarget.style.color = '#ffffff'}
            onMouseLeave={e => e.currentTarget.style.color = '#7e7e7e'}
          >
            <RotateCcw size={13} />
          </button>
          <button style={iconBtnStyle} title="Fullscreen"
            onMouseEnter={e => e.currentTarget.style.color = '#ffffff'}
            onMouseLeave={e => e.currentTarget.style.color = '#7e7e7e'}
          >
            <Maximize2 size={13} />
          </button>
        </div>
      </div>

      {/* Monaco Editor */}
      <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
        <Editor
          height="100%"
          language={langConfig.monacoLang}
          theme="vs-dark"
          value={code}
          onChange={(value) => onCodeChange(value ?? '')}
          onMount={handleEditorDidMount}
          loading={
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1e1e1e', color: '#7e7e7e', fontSize: '13px', fontFamily: 'Inter, sans-serif' }}>
              Loading editor…
            </div>
          }
          options={{
            minimap: { enabled: false },
            fontSize: fontSize || 14,
            tabSize: tabSize || 4,
            fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
            lineHeight: 22,
            padding: { top: 12, bottom: 12 },
            scrollBeyondLastLine: false,
            smoothScrolling: true,
            cursorBlinking: 'smooth',
            cursorSmoothCaretAnimation: 'on',
            formatOnPaste: true,
            readOnly: isRunning,
            wordWrap: 'on',
            automaticLayout: true,
            scrollbar: {
              vertical: 'auto',
              horizontal: 'auto',
              verticalScrollbarSize: 6,
              horizontalScrollbarSize: 6,
            },
          }}
        />
      </div>
    </div>
  );
}
