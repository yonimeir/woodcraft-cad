import React, { useEffect } from 'react';
import { useProjectStore } from './store/useProjectStore';
import { TopHeaderBar } from './components/layout/TopHeaderBar';
import { RightSidebar } from './components/panels/RightSidebar';
import { LeftInspectorPanel } from './components/panels/LeftInspectorPanel';
import { Viewport3D } from './components/viewport/Viewport3D';
import { WorkshopCutOptimizerView } from './components/workshop/WorkshopCutOptimizerView';
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';

export const App: React.FC = () => {
  const activeView = useProjectStore((s) => s.activeView);
  const toasts = useProjectStore((s) => s.toasts);
  const dismissToast = useProjectStore((s) => s.dismissToast);
  const undo = useProjectStore((s) => s.undo);
  const redo = useProjectStore((s) => s.redo);
  const duplicateSelected = useProjectStore((s) => s.duplicateSelected);
  const deleteSelected = useProjectStore((s) => s.deleteSelected);
  const createGroupFromSelected = useProjectStore(
    (s) => s.createGroupFromSelected
  );
  const moveSelectedDelta = useProjectStore((s) => s.moveSelectedDelta);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'SELECT' ||
          target.tagName === 'TEXTAREA')
      ) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        duplicateSelected();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'g') {
        e.preventDefault();
        createGroupFromSelected();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        deleteSelected();
      } else if (
        ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)
      ) {
        e.preventDefault();
        const step = e.shiftKey ? 2 : 15;
        if (e.key === 'ArrowLeft') moveSelectedDelta([-step, 0, 0]);
        if (e.key === 'ArrowRight') moveSelectedDelta([step, 0, 0]);
        if (e.key === 'ArrowUp')
          moveSelectedDelta(e.altKey ? [0, step, 0] : [0, 0, -step]);
        if (e.key === 'ArrowDown')
          moveSelectedDelta(e.altKey ? [0, -step, 0] : [0, 0, step]);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    undo,
    redo,
    duplicateSelected,
    deleteSelected,
    createGroupFromSelected,
    moveSelectedDelta,
  ]);

  return (
    <div className="flex flex-col w-screen h-screen bg-slate-950 text-slate-100 overflow-hidden">
      <TopHeaderBar />

      {activeView === '3d' ? (
        <main className="flex-1 flex overflow-hidden relative">
          {/* Right Sidebar in RTL: Layers/Groups & Stock Library */}
          <RightSidebar />

          {/* Center 3D Viewport */}
          <div className="flex-1 h-full relative overflow-hidden">
            <Viewport3D />
          </div>

          {/* Left Inspector Panel in RTL: Properties, Anchor Point, Joinery, Auto-Spacer, Room */}
          <LeftInspectorPanel />
        </main>
      ) : (
        <main className="flex-1 flex overflow-hidden relative">
          <WorkshopCutOptimizerView />
        </main>
      )}

      {/* Toast Notification Popups (e.g., when a parametric Dado is deleted or created) */}
      <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 pointer-events-none max-w-md w-full px-4">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl border shadow-2xl text-xs font-semibold backdrop-blur-md transition ${
              t.type === 'warning'
                ? 'bg-amber-950/95 border-amber-500 text-amber-100'
                : t.type === 'success'
                ? 'bg-emerald-950/95 border-emerald-500 text-emerald-100'
                : 'bg-slate-900/95 border-slate-700 text-slate-100'
            }`}
          >
            <div className="flex items-center gap-2">
              {t.type === 'warning' ? (
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              ) : t.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <Info className="w-4 h-4 text-sky-400 shrink-0" />
              )}
              <span>{t.message}</span>
            </div>
            <button
              onClick={() => dismissToast(t.id)}
              className="text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default App;
