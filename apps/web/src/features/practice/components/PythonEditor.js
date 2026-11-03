'use client';

import { useRef, useCallback, useState } from 'react';
import Editor from '@monaco-editor/react';
import { Play, RotateCcw } from 'lucide-react';

const THEME_NAME = 'coderank-dark';

const THEME_DEF = {
  base: 'vs-dark',
  inherit: true,
  rules: [
    { token: 'keyword',          foreground: 'cc7832', fontStyle: 'bold' },
    { token: 'keyword.control',  foreground: 'cf8e6d', fontStyle: 'bold' },
    { token: 'string',           foreground: '6aab73' },
    { token: 'string.escape',    foreground: 'cc7832' },
    { token: 'comment',          foreground: '808080', fontStyle: 'italic' },
    { token: 'number',           foreground: '2aacb8' },
    { token: 'delimiter',        foreground: 'a9b7c6' },
    { token: 'identifier',       foreground: 'a9b7c6' },
    { token: 'type.identifier',  foreground: 'ffc66d' },
  ],
  colors: {
    'editor.background':           '#1e1e1e',
    'editor.foreground':           '#d4d4d4',
    'editor.lineHighlightBackground': '#2a2a2a',
    'editor.selectionBackground':  '#264f78',
    'editorCursor.foreground':     '#aeafad',
    'editorLineNumber.foreground': '#4e4e4e',
    'editorLineNumber.activeForeground': '#c6c6c6',
    'editorIndentGuide.background1': '#2d2d2d',
    'editorIndentGuide.activeBackground1': '#3e3e42',
    'editor.inactiveSelectionBackground': '#3a3d41',
    'editorWidget.background':     '#252526',
    'editorSuggestWidget.background': '#252526',
    'editorSuggestWidget.border':  '#454545',
    'editorSuggestWidget.selectedBackground': '#062f4a',
  },
};

const PYTHON_COMPLETIONS = [
  {
    label: 'def', kind: 27,
    insertText: 'def ${1:function_name}(${2:args}):\n\t${0:pass}',
    insertTextRules: 4,
    documentation: 'Define a Python function',
  },
  {
    label: 'class', kind: 27,
    insertText: 'class ${1:ClassName}(${2:object}):\n\tdef __init__(self${3:, args}):\n\t\t${0:pass}',
    insertTextRules: 4,
    documentation: 'Define a Python class',
  },
  {
    label: 'for', kind: 27,
    insertText: 'for ${1:item} in ${2:iterable}:\n\t${0:pass}',
    insertTextRules: 4,
    documentation: 'For loop',
  },
  {
    label: 'if', kind: 27,
    insertText: 'if ${1:condition}:\n\t${0:pass}',
    insertTextRules: 4,
    documentation: 'If statement',
  },
  {
    label: 'try', kind: 27,
    insertText: 'try:\n\t${1:pass}\nexcept ${2:Exception} as ${3:e}:\n\t${0:pass}',
    insertTextRules: 4,
    documentation: 'Try/except block',
  },
  {
    label: 'with', kind: 27,
    insertText: 'with ${1:expression} as ${2:var}:\n\t${0:pass}',
    insertTextRules: 4,
    documentation: 'Context manager',
  },
  {
    label: 'list', kind: 6,
    insertText: 'list(${1:iterable})',
    insertTextRules: 4,
    documentation: 'Create a list',
  },
  {
    label: 'range', kind: 6,
    insertText: 'range(${1:start}, ${2:stop}, ${3:step})',
    insertTextRules: 4,
    documentation: 'range(start, stop[, step])',
  },
  {
    label: 'print', kind: 6,
    insertText: 'print(${1:value})',
    insertTextRules: 4,
    documentation: 'Print to stdout',
  },
  {
    label: 'input', kind: 6,
    insertText: 'input(${1:"prompt: "})',
    insertTextRules: 4,
    documentation: 'Read from stdin',
  },
  {
    label: 'len', kind: 6,
    insertText: 'len(${1:obj})',
    insertTextRules: 4,
    documentation: 'Return the length of an object',
  },
  {
    label: 'int', kind: 6,
    insertText: 'int(${1:x})',
    insertTextRules: 4,
    documentation: 'Convert to integer',
  },
  {
    label: 'str', kind: 6,
    insertText: 'str(${1:x})',
    insertTextRules: 4,
    documentation: 'Convert to string',
  },
  {
    label: 'enumerate', kind: 6,
    insertText: 'enumerate(${1:iterable}, start=${2:0})',
    insertTextRules: 4,
    documentation: 'Return an enumerate object',
  },
  {
    label: 'zip', kind: 6,
    insertText: 'zip(${1:*iterables})',
    insertTextRules: 4,
    documentation: 'Zip multiple iterables together',
  },
  {
    label: 'sys.stdin.read', kind: 6,
    insertText: 'sys.stdin.read().strip()',
    insertTextRules: 4,
    documentation: 'Read all of stdin and strip whitespace',
  },
];

function handleBeforeMount(monaco) {
  monaco.editor.defineTheme(THEME_NAME, THEME_DEF);

  monaco.languages.registerCompletionItemProvider('python', {
    provideCompletionItems: (model, position) => {
      const word = model.getWordUntilPosition(position);
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber:   position.lineNumber,
        startColumn:     word.startColumn,
        endColumn:       word.endColumn,
      };
      return {
        suggestions: PYTHON_COMPLETIONS.map((item) => ({ ...item, range })),
      };
    },
  });
}

export default function PythonEditor({
  defaultCode,
  onCodeChange,
  onRun,
  isRunning,
  onRegisterReset,
}) {
  const editorRef = useRef(null);
  const [cursorPos, setCursorPos] = useState({ line: 1, col: 1 });
  const [codeLength, setCodeLength] = useState(defaultCode?.length ?? 0);
  const [isEditorReady, setIsEditorReady] = useState(false);

  const handleEditorMount = useCallback((editor, monaco) => {
    editorRef.current = editor;
    setIsEditorReady(true);

    // Keyboard shortcut: Ctrl+Enter → Run
    editor.addCommand(
      monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter,
      () => { if (!isRunning) onRun?.(); }
    );

    // Ctrl+S → prevent browser save dialog, autocommit
    editor.addCommand(
      monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS,
      () => {}
    );

    editor.onDidChangeCursorPosition((e) => {
      setCursorPos({ line: e.position.lineNumber, col: e.position.column });
    });

    editor.onDidChangeModelContent(() => {
      setCodeLength(editor.getValue().length);
    });

    if (onRegisterReset) {
      onRegisterReset(() => {
        editor.setValue(defaultCode);
        editor.setPosition({ lineNumber: 1, column: 1 });
        editor.focus();
        if (onCodeChange) onCodeChange(defaultCode);
      });
    }

    monaco.editor.setTheme(THEME_NAME);
    editor.focus();
  }, [defaultCode, onRegisterReset, onCodeChange, onRun, isRunning]);

  return (
    <div className="h-full flex flex-col bg-[#1e1e1e] border border-[#3e3e42] rounded-lg overflow-hidden font-sans">
      {/* Editor Header Toolbar */}
      <div className="h-10 bg-[#2d2d2d] border-b border-[#3e3e42] flex items-center justify-between px-4 shrink-0 select-none">
        {/* Language Details */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-[#3e3e42] text-gray-300 font-mono text-xs px-2.5 py-1 rounded-md select-none">
            <span className="w-2 h-2 rounded-full bg-[#3dc68d] inline-block"></span>
            Python 3
            <span className="text-gray-500 text-[10px] ml-1">3.12-slim</span>
          </div>
        </div>

        {/* Toolbar actions */}
        <div className="flex items-center gap-2">
          <button
            title="Reset to template"
            disabled={isRunning}
            onClick={() => {
              if (editorRef.current) {
                editorRef.current.setValue(defaultCode);
                editorRef.current.setPosition({ lineNumber: 1, column: 1 });
                editorRef.current.focus();
                if (onCodeChange) onCodeChange(defaultCode);
              }
            }}
            className="flex items-center justify-center p-1.5 text-gray-500 hover:text-gray-200 hover:bg-[#3e3e42] rounded transition-colors disabled:opacity-40"
          >
            <RotateCcw size={13} />
          </button>

          <div className="w-px h-4 bg-[#4a4a4f]"></div>

          <button
            title="Run Code (Ctrl+Enter)"
            onClick={onRun}
            disabled={isRunning}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-xs font-semibold transition-all select-none ${
              isRunning
                ? 'bg-[#3e3e42] text-gray-500 cursor-not-allowed opacity-60'
                : 'bg-[#007acc] hover:bg-[#0062a3] text-white hover:text-white shadow-sm'
            }`}
          >
            {isRunning ? (
              <span className="animate-spin rounded-full h-3 w-3 border-2 border-gray-400 border-t-transparent" />
            ) : (
              <Play size={11} className="fill-white text-white" />
            )}
            Run Code
          </button>
        </div>
      </div>

      {/* Monaco Container */}
      <div className="flex-1 min-h-0 relative">
        {!isEditorReady && (
          <div className="absolute inset-0 bg-[#1e1e1e] flex items-start pt-4 px-14 gap-3 z-10 pointer-events-none">
            <div className="flex flex-col gap-3 w-full opacity-30">
              {[70, 90, 55, 80, 65, 45, 75].map((w, i) => (
                <div
                  key={i}
                  className="h-3.5 rounded bg-[#3e3e42] animate-pulse"
                  style={{ width: `${w}%`, animationDelay: `${i * 80}ms` }}
                />
              ))}
            </div>
          </div>
        )}

        <Editor
          height="100%"
          defaultLanguage="python"
          theme={THEME_NAME}
          defaultValue={defaultCode}
          beforeMount={handleBeforeMount}
          onMount={handleEditorMount}
          onChange={(val) => {
            const newVal = val ?? '';
            if (onCodeChange) onCodeChange(newVal);
          }}
          loading={null}
          options={{
            readOnly: isRunning,
            domReadOnly: isRunning,
            minimap: { enabled: false },
            fontSize: 14,
            fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
            fontLigatures: true,
            lineHeight: 24,
            padding: { top: 14, bottom: 14 },
            scrollBeyondLastLine: false,
            smoothScrolling: true,
            cursorBlinking: 'smooth',
            cursorSmoothCaretAnimation: 'on',
            formatOnPaste: true,
            automaticLayout: true,
            renderLineHighlight: 'all',
            wordWrap: 'on',
            tabSize: 4,
            insertSpaces: true,
            bracketPairColorization: { enabled: true },
            guides: { bracketPairs: true, indentation: true },
            suggest: { showKeywords: true, showSnippets: true, showFunctions: true },
            quickSuggestions: { other: true, comments: false, strings: false },
            parameterHints: { enabled: true },
            hover: { enabled: true, delay: 300 },
            folding: true,
            foldingHighlight: true,
            showFoldingControls: 'mouseover',
            matchBrackets: 'always',
            occurrencesHighlight: 'singleFile',
            selectionHighlight: true,
            renderWhitespace: 'selection',
            codeLens: false,
            lineNumbers: 'on',
            scrollbar: {
              vertical: 'auto',
              horizontal: 'auto',
              useShadows: false,
              verticalScrollbarSize: 6,
              horizontalScrollbarSize: 6,
            },
          }}
        />
      </div>

      {/* Editor Status Bar */}
      <div className="h-6 bg-[#007acc] flex items-center justify-between px-3 shrink-0 select-none">
        <div className="flex items-center gap-3 text-[11px] text-white/90 font-mono">
          <span>Python 3</span>
          <span className="opacity-50">|</span>
          <span>UTF-8</span>
          <span className="opacity-50">|</span>
          <span>Spaces: 4</span>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-white/90 font-mono">
          {isEditorReady && (
            <>
              <span>{codeLength} chars</span>
              <span className="opacity-50">|</span>
              <span>Ln {cursorPos.line}, Col {cursorPos.col}</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
