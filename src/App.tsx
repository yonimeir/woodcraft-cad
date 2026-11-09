import React, { useEffect } from 'react';
import { useProjectStore } from './store/useProjectStore';
import { TopHeaderBar } from './components/layout/TopHeaderBar';
import { RightSidebar } from './components/panels/RightSidebar';
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
  const copySelected = useProjectStore((s) => s.copySelected);
  const cutSelected = useProjectStore((s) => s.cutSelected);
  const pasteClipboard = useProjectStore((s) => s.pasteClipboard);
  const deleteSelected = useProjectStore((s) => s.deleteSelected);
  const createGroupFromSelected = useProjectStore(
    (s) => s.createGroupFromSelected
  );
  const moveSelectedDelta = useProjectStore((s) => s.moveSelectedDelta);
  const rotateSelectedByWorldAxis = useProjectStore(
    (s) => s.rotateSelectedByWorldAxis
  );
  const stretchSelectedLengthDelta = useProjectStore(
    (s) => s.stretchSelectedLengthDelta
  );
  const cycleSelectPart = useProjectStore((s) => s.cycleSelectPart);
  const dropSelectedToFloor = useProjectStore((s) => s.dropSelectedToFloor);
  const selectAll = useProjectStore((s) => s.selectAll);
  const selectPart = useProjectStore((s) => s.selectPart);
  const requestCameraView = useProjectStore((s) => s.requestCameraView);
  const gridSnapStepMm = useProjectStore((s) => s.gridSnapStepMm);
  const partEditMode = useProjectStore((s) => s.partEditMode);
  const setPartEditMode = useProjectStore((s) => s.setPartEditMode);
  const activeToolPopover = useProjectStore((s) => s.activeToolPopover);
  const setActiveToolPopover = useProjectStore((s) => s.setActiveToolPopover);
  const snapEnabled = useProjectStore((s) => s.snapEnabled);
  const setSnapEnabled = useProjectStore((s) => s.setSnapEnabled);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'SELECT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }

      const keyLower = e.key.toLowerCase();
      const isZ = e.code === 'KeyZ' || keyLower === 'z' || e.key === 'ז';
      const isY = e.code === 'KeyY' || keyLower === 'y' || e.key === 'ט';
      const isC = e.code === 'KeyC' || keyLower === 'c' || e.key === 'ב';
      const isX = e.code === 'KeyX' || keyLower === 'x' || e.key === 'ס';
      const isV = e.code === 'KeyV' || keyLower === 'v' || e.key === 'ה';
      const isD = e.code === 'KeyD' || keyLower === 'd' || e.key === 'ג';
      const isG = e.code === 'KeyG' || keyLower === 'g' || e.key === 'ע';
      const isA = e.code === 'KeyA' || keyLower === 'a' || e.key === 'ש';
      const isF = e.code === 'KeyF' || keyLower === 'f' || e.key === 'כ';
      const isR = e.code === 'KeyR' || keyLower === 'r' || e.key === 'ר';
      const isL = e.code === 'KeyL' || keyLower === 'l' || e.key === 'ך';
      const isP = e.code === 'KeyP' || keyLower === 'p' || e.key === 'פ';
      const isM = e.code === 'KeyM' || keyLower === 'm' || e.key === 'צ';
      const isK = e.code === 'KeyK' || keyLower === 'k' || e.key === 'ל';
      const isS = e.code === 'KeyS' || keyLower === 's' || e.key === 'ד';

      if ((e.ctrlKey || e.metaKey) && isZ) {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if ((e.ctrlKey || e.metaKey) && isY) {
        e.preventDefault();
        redo();
      } else if ((e.ctrlKey || e.metaKey) && isC) {
        e.preventDefault();
        copySelected();
      } else if ((e.ctrlKey || e.metaKey) && isX) {
        e.preventDefault();
        cutSelected();
      } else if ((e.ctrlKey || e.metaKey) && isV) {
        e.preventDefault();
        pasteClipboard();
      } else if ((e.ctrlKey || e.metaKey) && isD) {
        e.preventDefault();
        duplicateSelected();
      } else if ((e.ctrlKey || e.metaKey) && isG) {
        e.preventDefault();
        createGroupFromSelected();
      } else if ((e.ctrlKey || e.metaKey) && isA) {
        e.preventDefault();
        selectAll();
      } else if (!e.ctrlKey && !e.metaKey && isX) {
        // Rotate around World X (Blue axis): Alt = ±1° fine, normal = ±90° (or ±angleSnapDeg)
        e.preventDefault();
        const deg = e.altKey ? (e.shiftKey ? -1 : 1) : e.shiftKey ? -90 : 90;
        rotateSelectedByWorldAxis('x', deg);
      } else if (!e.ctrlKey && !e.metaKey && (isY || isR)) {
        // Rotate around World Y (Black axis - horizontal spin): Alt = ±1° fine, normal = ±90°
        e.preventDefault();
        const deg = e.altKey ? (e.shiftKey ? -1 : 1) : e.shiftKey ? -90 : 90;
        rotateSelectedByWorldAxis('y', deg);
      } else if (!e.ctrlKey && !e.metaKey && isZ) {
        // Rotate around World Z (Red axis): Alt = ±1° fine, normal = ±90°
        e.preventDefault();
        const deg = e.altKey ? (e.shiftKey ? -1 : 1) : e.shiftKey ? -90 : 90;
        rotateSelectedByWorldAxis('z', deg);
      } else if (!e.ctrlKey && !e.metaKey && !e.altKey && isD) {
        e.preventDefault();
        dropSelectedToFloor();
      } else if (!e.ctrlKey && !e.metaKey && !e.altKey && isF) {
        e.preventDefault();
        requestCameraView('fit');
      } else if (!e.ctrlKey && !e.metaKey && !e.altKey && isL) {
        e.preventDefault();
        setActiveToolPopover(activeToolPopover === 'align' ? 'none' : 'align');
      } else if (!e.ctrlKey && !e.metaKey && !e.altKey && isP) {
        e.preventDefault();
        setActiveToolPopover(activeToolPopover === 'pivot' ? 'none' : 'pivot');
      } else if (!e.ctrlKey && !e.metaKey && !e.altKey && isM) {
        e.preventDefault();
        setActiveToolPopover(activeToolPopover === 'miter' ? 'none' : 'miter');
      } else if (!e.ctrlKey && !e.metaKey && !e.altKey && isK) {
        e.preventDefault();
        setActiveToolPopover(
          activeToolPopover === 'pocket' ? 'none' : 'pocket'
        );
      } else if (!e.ctrlKey && !e.metaKey && !e.altKey && isS) {
        e.preventDefault();
        setSnapEnabled(!snapEnabled);
      } else if (!e.ctrlKey && !e.metaKey && !e.altKey && e.code === 'Digit1') {
        e.preventDefault();
        requestCameraView('front');
      } else if (!e.ctrlKey && !e.metaKey && !e.altKey && e.code === 'Digit2') {
        e.preventDefault();
        requestCameraView('top');
      } else if (!e.ctrlKey && !e.metaKey && !e.altKey && e.code === 'Digit3') {
        e.preventDefault();
        requestCameraView('right');
      } else if (!e.ctrlKey && !e.metaKey && !e.altKey && e.code === 'Digit4') {
        e.preventDefault();
        requestCameraView('iso');
      } else if (!e.ctrlKey && !e.metaKey && !e.altKey && e.code === 'Digit0') {
        e.preventDefault();
        requestCameraView('fit');
      } else if (
        !e.ctrlKey &&
        !e.metaKey &&
        (e.code === 'Equal' ||
          e.code === 'BracketRight' ||
          e.key === '+' ||
          e.key === '=')
      ) {
        e.preventDefault();
        const baseStep = Math.max(5, gridSnapStepMm);
        stretchSelectedLengthDelta(e.shiftKey ? baseStep * 10 : baseStep);
      } else if (
        !e.ctrlKey &&
        !e.metaKey &&
        (e.code === 'Minus' || e.code === 'BracketLeft' || e.key === '-')
      ) {
        e.preventDefault();
        const baseStep = Math.max(5, gridSnapStepMm);
        stretchSelectedLengthDelta(e.shiftKey ? -baseStep * 10 : -baseStep);
      } else if (e.key === 'Tab') {
        e.preventDefault();
        cycleSelectPart(e.shiftKey ? -1 : 1);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        setPartEditMode(partEditMode === 'move' ? 'dimensions' : 'move');
      } else if (e.key === '?' || e.code === 'Slash') {
        e.preventDefault();
        window.dispatchEvent(
          new CustomEvent('woodcraft:open-modal', { detail: 'shortcuts' })
        );
      } else if (e.key === 'Escape') {
        if (activeToolPopover !== 'none') {
          setActiveToolPopover('none');
        } else {
          selectPart(null);
        }
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        deleteSelected();
      } else if (e.key === 'PageUp' || e.key === 'PageDown') {
        e.preventDefault();
        const baseStep = Math.max(1, gridSnapStepMm);
        const step = e.shiftKey ? baseStep * 10 : baseStep;
        moveSelectedDelta([0, e.key === 'PageUp' ? step : -step, 0]);
      } else if (
        ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)
      ) {
        e.preventDefault();
        // Shift = 1mm fine control, normal = gridSnapStepMm (default 5mm)
        const baseStep = Math.max(1, gridSnapStepMm);
        const step = e.shiftKey ? 1 : baseStep;

        if (e.key === 'ArrowUp') {
          // Up = +Y axis
          moveSelectedDelta([0, step, 0]);
        } else if (e.key === 'ArrowDown') {
          // Down = -Y axis
          moveSelectedDelta([0, -step, 0]);
        } else if (e.key === 'ArrowRight') {
          // Alt + Right = +Z axis, Right = +X axis
          moveSelectedDelta(e.altKey ? [0, 0, step] : [step, 0, 0]);
        } else if (e.key === 'ArrowLeft') {
          // Alt + Left = -Z axis, Left = -X axis
          moveSelectedDelta(e.altKey ? [0, 0, -step] : [-step, 0, 0]);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    undo,
    redo,
    copySelected,
    cutSelected,
    pasteClipboard,
    duplicateSelected,
    deleteSelected,
    createGroupFromSelected,
    moveSelectedDelta,
    rotateSelectedByWorldAxis,
    stretchSelectedLengthDelta,
    cycleSelectPart,
    dropSelectedToFloor,
    selectAll,
    selectPart,
    requestCameraView,
    gridSnapStepMm,
    partEditMode,
    setPartEditMode,
    activeToolPopover,
    setActiveToolPopover,
    snapEnabled,
    setSnapEnabled,
  ]);

  return (
    <div className="flex flex-col w-screen h-screen bg-slate-50 text-slate-900 overflow-hidden">
      <TopHeaderBar />

      {activeView === '3d' ? (
        <main className="flex-1 flex overflow-hidden relative">
          {/* Collapsible Right Drawer in RTL: Wood Shapes & Layers */}
          <RightSidebar />

          {/* Maximized 3D Viewport (with floating Tinkercad Shape Card & Tool Popovers) */}
          <div className="flex-1 h-full relative overflow-hidden">
            <Viewport3D />
          </div>
        </main>
      ) : (
        <main className="flex-1 flex overflow-hidden relative">
          <WorkshopCutOptimizerView />
        </main>
      )}

      {/* Toast Notification Popups */}
      <div className="fixed top-24 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 pointer-events-none max-w-md w-full px-4">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-center justify-between gap-3 px-3.5 py-2 rounded-xl border shadow-lg text-xs font-bold backdrop-blur-md transition ${
              t.type === 'warning'
                ? 'bg-amber-50/95 border-amber-300 text-amber-900'
                : t.type === 'success'
                ? 'bg-emerald-50/95 border-emerald-300 text-emerald-900'
                : 'bg-white/95 border-slate-200 text-slate-800'
            }`}
          >
            <div className="flex items-center gap-2">
              {t.type === 'warning' ? (
                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
              ) : t.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <Info className="w-4 h-4 text-sky-600 shrink-0" />
              )}
              <span>{t.message}</span>
            </div>
            <button
              onClick={() => dismissToast(t.id)}
              className="text-slate-400 hover:text-slate-700 cursor-pointer"
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
