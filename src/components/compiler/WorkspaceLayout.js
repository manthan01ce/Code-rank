'use client';

import { useState } from 'react';
import { Panel, Group as PanelGroup, Separator as PanelResizeHandle } from 'react-resizable-panels';
import ProblemPanel from './ProblemPanel';
import MonacoEditorPanel from './MonacoEditorPanel';
import ConsolePanel from './ConsolePanel';
import { Play, Check, Settings, User, Cloud } from 'lucide-react';

export default function WorkspaceLayout() {
  const [consoleOpen, setConsoleOpen] = useState(true);

  return (
    <div className="flex flex-col h-screen bg-[#0a0a0a] text-gray-300 font-sans overflow-hidden selection:bg-emerald-500/30">
      {/* Top Navigation Bar */}
      <div className="h-12 bg-[#1a1a1a] border-b border-[#2d2d2d] flex items-center justify-between px-4 shrink-0">
        {/* Left: Logo & Problem List */}
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-gradient-to-tr from-emerald-400 to-cyan-400 rounded-md"></div>
            <span className="text-white font-bold tracking-tight">CodeRank</span>
          </div>
          <button className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors bg-[#2d2d2d] px-3 py-1 rounded-md">
            <span>Problem List</span>
          </button>
        </div>

        {/* Center: Action Buttons */}
        <div className="flex items-center gap-2">
          <button 
            className="flex items-center gap-1.5 px-4 py-1.5 bg-[#2d2d2d] hover:bg-[#3c3c3c] text-gray-200 rounded-md text-sm font-medium transition-colors"
            onClick={() => setConsoleOpen(true)}
          >
            <Play size={14} className="text-emerald-400" /> Run
          </button>
          <button className="flex items-center gap-1.5 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-md text-sm font-medium transition-colors opacity-50 cursor-not-allowed" disabled>
            <Cloud size={14} /> Submit
          </button>
        </div>

        {/* Right: User Settings */}
        <div className="flex items-center gap-4">
          <button className="text-gray-400 hover:text-white transition-colors"><Settings size={18} /></button>
          <button className="w-7 h-7 bg-[#2d2d2d] rounded-full flex items-center justify-center text-gray-400 hover:text-white transition-colors">
            <User size={16} />
          </button>
        </div>
      </div>

      {/* Main Workspace Split View */}
      <div className="flex-1 p-2 overflow-hidden">
        <PanelGroup direction="horizontal" className="h-full">
          {/* Left Panel: Problem Statement */}
          <Panel defaultSize={50} minSize={30}>
            <div className="h-full bg-[#1e1e1e] rounded-lg border border-[#2d2d2d] overflow-hidden flex flex-col shadow-sm">
              <ProblemPanel />
            </div>
          </Panel>

          {/* Vertical Gutter */}
          <PanelResizeHandle className="w-2 hover:bg-emerald-500/20 transition-colors cursor-col-resize flex items-center justify-center mx-1 group">
            <div className="h-10 w-1 bg-[#3c3c3c] rounded-full group-hover:bg-emerald-500 transition-colors"></div>
          </PanelResizeHandle>

          {/* Right Panel: Editor & Console */}
          <Panel minSize={30}>
            <PanelGroup direction="vertical">
              {/* Top Right: Code Editor */}
              <Panel defaultSize={consoleOpen ? 65 : 100} minSize={20}>
                <div className="h-full bg-[#1e1e1e] rounded-lg border border-[#2d2d2d] overflow-hidden flex flex-col shadow-sm">
                  <MonacoEditorPanel />
                </div>
              </Panel>

              {consoleOpen && (
                <>
                  {/* Horizontal Gutter */}
                  <PanelResizeHandle className="h-2 hover:bg-emerald-500/20 transition-colors cursor-row-resize flex items-center justify-center my-1 group">
                    <div className="w-10 h-1 bg-[#3c3c3c] rounded-full group-hover:bg-emerald-500 transition-colors"></div>
                  </PanelResizeHandle>
                  
                  {/* Bottom Right: Console */}
                  <Panel defaultSize={35} minSize={15}>
                    <div className="h-full bg-[#1e1e1e] rounded-lg border border-[#2d2d2d] overflow-hidden flex flex-col shadow-sm">
                      <ConsolePanel onClose={() => setConsoleOpen(false)} />
                    </div>
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
