'use client';

import Editor from '@monaco-editor/react';
import { useRef, useEffect } from 'react';
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
  theme,
  minimap,
  wordWrap,
}) {
  const langConfig = LANGUAGES[selectedLang];
  const clipboardRestricted = activeProblem?.clipboardRestricted === true;
  const onRunRef = useRef(onRun);
  const onSubmitRef = useRef(onSubmit);
  const editorContainerRef = useRef(null);

  // Keep refs updated to avoid stale closures in Monaco actions
  useEffect(() => { onRunRef.current = onRun; onSubmitRef.current = onSubmit; }, [onRun, onSubmit]);

  function handleEditorDidMount(editor, monaco) {
    // ── Run & Submit keyboard shortcuts ──
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

    if (clipboardRestricted) {
    // ── Copy-Paste restrictions ──
    // Block Ctrl+V / Cmd+V inside Monaco
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyV, () => {
      // no-op: paste is disabled
    });

    // Block Ctrl+C / Cmd+C (optional — prevents copying out as well)
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyC, () => {
      // no-op: copy is disabled
    });
    
    // Block Ctrl+X / Cmd+X
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyX, () => {
      // no-op: cut is disabled
    });

    // Block browser-level paste, copy, and cut events on the editor DOM element
    const domNode = editor.getDomNode();
    if (domNode) {
      domNode.addEventListener('paste', (e) => {
        e.preventDefault();
        e.stopPropagation();
      }, true);
      domNode.addEventListener('copy', (e) => {
        e.preventDefault();
        e.stopPropagation();
      }, true);
      domNode.addEventListener('cut', (e) => {
        e.preventDefault();
        e.stopPropagation();
      }, true);
    }
    }
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
    <div ref={editorContainerRef} style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#1e1e1e' }}>

      {/* Header */}
      <div style={headerStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Code2 size={14} color="#0066b1" />
          <select aria-label="Programming language"
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
          <button style={iconBtnStyle} aria-label="Reset to boilerplate" title="Reset to Boilerplate" onClick={handleReset} disabled={isRunning}
            onMouseEnter={e => e.currentTarget.style.color = '#ffffff'}
            onMouseLeave={e => e.currentTarget.style.color = '#7e7e7e'}
          >
            <RotateCcw size={13} />
          </button>
          <button style={iconBtnStyle} aria-label="Toggle editor fullscreen" title="Fullscreen" onClick={() => { const node = editorContainerRef.current; if (document.fullscreenElement) document.exitFullscreen(); else node?.requestFullscreen(); }}
            onMouseEnter={e => e.currentTarget.style.color = '#ffffff'}
            onMouseLeave={e => e.currentTarget.style.color = '#7e7e7e'}
          >
            <Maximize2 size={13} />
          </button>
        </div>
      </div>

      {clipboardRestricted && <p role="note" style={{ margin: 8 }}>Exam policy: clipboard operations are disabled.</p>}
      {/* Monaco Editor */}
      <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
        <Editor key={`${activeProblem?.id}:${clipboardRestricted}`}
          height="100%"
          language={langConfig.monacoLang}
          theme={theme || "vs-dark"}
          value={code}
          onChange={(value) => onCodeChange(value ?? '')}
          onMount={handleEditorDidMount}
          loading={
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1e1e1e', color: '#7e7e7e', fontSize: '13px', fontFamily: 'Inter, sans-serif' }}>
              Loading editor...
            </div>
          }
          options={{
            minimap: { enabled: minimap !== undefined ? minimap : false },
            fontSize: fontSize || 14,
            tabSize: tabSize || 4,
            wordWrap: wordWrap || "off",
            fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
            formatOnPaste: true,
            padding: { top: 12, bottom: 12 },
            scrollBeyondLastLine: false,
            smoothScrolling: true,
            cursorBlinking: 'smooth',
            cursorSmoothCaretAnimation: 'on',
            readOnly: isRunning,
            automaticLayout: true,
            contextmenu: !clipboardRestricted,
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
