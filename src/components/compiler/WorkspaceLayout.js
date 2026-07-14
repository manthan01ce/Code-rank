'use client';

import { useState } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import ProblemPanel from './ProblemPanel';
import MonacoEditorPanel from './MonacoEditorPanel';
import TestCasePanel from './TestCasePanel';
import OutputConsole from './OutputConsole';
import { Play, Check } from 'lucide-react';

export default function WorkspaceLayout() {
  const [consoleOpen, setConsoleOpen] = useState(false);

  return (
    <div className="flex flex-col h-screen bg-[#1e1e1e] overflow-hidden selection:bg-emerald-500/30">
      {/* Top Navbar */}
      <div className="h-14 bg-[#252526] border-b border-[#3c3c3c] flex items-center justify-between px-6 shrink-0">
        <div className="text-white font-bold text-lg tracking-tight">CodeRank</div>
        <div className="flex items-center gap-3">
          <button 
            className="flex items-center gap-2 px-4 py-1.5 bg-[#3c3c3c] hover:bg-[#4a4a4a] text-gray-200 rounded-md text-sm font-medium transition-colors"
            onClick={() => setConsoleOpen(true)}
          >
            <Play size={16} /> Run
          </button>
          <button className="flex items-center gap-2 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-md text-sm font-medium transition-colors opacity-50 cursor-not-allowed" disabled>
            <Check size={16} /> Submit
          </button>
        </div>
        <div className="w-8 h-8 bg-gradient-to-tr from-emerald-400 to-cyan-400 rounded-full cursor-pointer opacity-80 hover:opacity-100 transition-opacity"></div>
      </div>

      {/* Main Workspace */}
      <div className="flex-1 overflow-hidden">
        <PanelGroup direction="horizontal" className="h-full">
          {/* Problem Panel (Left) */}
          <Panel defaultSize={40} minSize={30}>
            <ProblemPanel />
          </Panel>

          {/* Resize Handle */}
          <PanelResizeHandle className="w-1.5 bg-[#1e1e1e] hover:bg-emerald-500/50 transition-colors cursor-col-resize flex items-center justify-center">
            <div className="h-8 w-0.5 bg-[#3c3c3c] rounded-full"></div>
          </PanelResizeHandle>

          {/* Editor & Execution Panel (Right) */}
          <Panel minSize={30}>
            <PanelGroup direction="vertical">
              <Panel defaultSize={consoleOpen ? 60 : 100} minSize={20}>
                <MonacoEditorPanel />
              </Panel>

              {consoleOpen && (
                <>
                  <PanelResizeHandle className="h-1.5 bg-[#1e1e1e] hover:bg-emerald-500/50 transition-colors cursor-row-resize flex items-center justify-center">
                    <div className="w-8 h-0.5 bg-[#3c3c3c] rounded-full"></div>
                  </PanelResizeHandle>
                  <Panel defaultSize={40} minSize={20}>
                    <PanelGroup direction="horizontal">
                      <Panel defaultSize={50} minSize={30}>
                        <TestCasePanel />
                      </Panel>
                      <PanelResizeHandle className="w-1.5 bg-[#1e1e1e] hover:bg-emerald-500/50 transition-colors cursor-col-resize flex items-center justify-center">
                        <div className="h-8 w-0.5 bg-[#3c3c3c] rounded-full"></div>
                      </PanelResizeHandle>
                      <Panel defaultSize={50} minSize={30}>
                        <OutputConsole />
                      </Panel>
                    </PanelGroup>
                  </Panel>
                </>
              )}
            </PanelGroup>
          </Panel>
        </PanelGroup>
      </div>
    </div>
  );
}
