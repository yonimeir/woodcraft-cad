import React, { useRef, useState } from 'react';
import { useProjectStore } from '../../store/useProjectStore';
import { TemplatesModal } from '../modals/TemplatesModal';
import { ProductGeneratorModal } from '../modals/ProductGeneratorModal';
import {
  Box,
  Download,
  Hammer,
  LayoutTemplate,
  Magnet,
  Redo2,
  Ruler,
  Scissors,
  Undo2,
  Upload,
  Wand2,
} from 'lucide-react';

export const TopHeaderBar: React.FC = () => {
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [generatorOpen, setGeneratorOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const projectName = useProjectStore((s) => s.projectName);
  const setProjectName = useProjectStore((s) => s.setProjectName);
  const activeView = useProjectStore((s) => s.activeView);
  const setActiveView = useProjectStore((s) => s.setActiveView);
  const unitMode = useProjectStore((s) => s.unitMode);
  const setUnitMode = useProjectStore((s) => s.setUnitMode);
  const showLiveDimensions = useProjectStore((s) => s.showLiveDimensions);
  const setShowLiveDimensions = useProjectStore((s) => s.setShowLiveDimensions);
  const snapEnabled = useProjectStore((s) => s.snapEnabled);
  const setSnapEnabled = useProjectStore((s) => s.setSnapEnabled);
  const angleSnapDeg = useProjectStore((s) => s.angleSnapDeg);
  const setAngleSnapDeg = useProjectStore((s) => s.setAngleSnapDeg);

  const past = useProjectStore((s) => s.past);
  const future = useProjectStore((s) => s.future);
  const undo = useProjectStore((s) => s.undo);
  const redo = useProjectStore((s) => s.redo);
  const exportProjectJson = useProjectStore((s) => s.exportProjectJson);
  const importProjectJson = useProjectStore((s) => s.importProjectJson);

  const handleSaveJson = () => {
    const json = exportProjectJson();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${projectName.replace(/\s+/g, '_')}.woodjson`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleLoadJsonFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        importProjectJson(reader.result);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <>
      <header className="h-14 bg-slate-950 border-b border-slate-800 px-4 flex items-center justify-between gap-3 shrink-0 select-none">
        {/* Right Side: Brand & Project Title */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-amber-500/15 border border-amber-500/40 px-2.5 py-1.5 rounded-xl">
            <Hammer className="w-5 h-5 text-amber-400" />
            <div>
              <div className="text-xs font-extrabold text-white leading-none">
                WoodCraft 3D
              </div>
              <div className="text-[10px] text-amber-400 font-mono">
                DIY CAD & Cut-List
              </div>
            </div>
          </div>

          <input
            type="text"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            className="bg-slate-900 border border-slate-800 hover:border-slate-700 focus:border-amber-500 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-100 w-48 focus:outline-none"
            title="שם הפרויקט (נשמר אוטומטית בזיכרון המקומי)"
          />

          <button
            onClick={() => setGeneratorOpen(true)}
            className="bg-gradient-to-l from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 px-3 py-1.5 rounded-lg text-xs font-extrabold flex items-center gap-1.5 shadow-md transition cursor-pointer"
            title="מחולל מוצרים חכם (נדנדה, פרגולה, שולחן פיקניק, זולה, מיטה, אדנית, מלונה ועוד) עם בקרת איכות ויזואלית"
          >
            <Wand2 className="w-4 h-4" />
            ✨ ג'נרט מוצר
          </button>

          <button
            onClick={() => setTemplatesOpen(true)}
            className="bg-slate-900 hover:bg-slate-800 text-amber-300 border border-amber-500/40 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
          >
            <LayoutTemplate className="w-4 h-4" />
            תבניות מוכנות
          </button>
        </div>

        {/* Center: Primary View Switcher (3D CAD vs Workshop Cut Optimizer) */}
        <div className="flex items-center bg-slate-900 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setActiveView('3d')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-extrabold flex items-center gap-1.5 transition cursor-pointer ${
              activeView === '3d'
                ? 'bg-amber-500 text-slate-950 shadow'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <Box className="w-4 h-4" />
            מרחב תכנון תלת-ממדי (3D)
          </button>
          <button
            onClick={() => setActiveView('workshop')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-extrabold flex items-center gap-1.5 transition cursor-pointer ${
              activeView === 'workshop'
                ? 'bg-amber-500 text-slate-950 shadow'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <Scissors className="w-4 h-4" />
            תוכנית עבודה ואופטימיזציית חיתוך (BOM & PDF)
          </button>
        </div>

        {/* Left Side: Snapping, Units, Undo/Redo, Save/Load */}
        <div className="flex items-center gap-1.5">
          {/* Magnetic Snap Toggle */}
          <button
            onClick={() => setSnapEnabled(!snapEnabled)}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 border transition cursor-pointer ${
              snapEnabled
                ? 'bg-emerald-950/70 text-emerald-300 border-emerald-500/50'
                : 'bg-slate-900 text-slate-400 border-slate-800'
            }`}
            title="הצמדה מגנטית חכמה לפאות, פינות ומרכזים"
          >
            <Magnet className="w-3.5 h-3.5" />
            מגנט {snapEnabled ? 'פעיל' : 'כבוי'}
          </button>

          {/* Angle Snap Step */}
          <select
            value={angleSnapDeg}
            onChange={(e) => setAngleSnapDeg(Number(e.target.value))}
            className="bg-slate-900 border border-slate-800 text-slate-200 rounded-lg px-2 py-1.5 text-xs font-mono cursor-pointer"
            title="קפיצות זווית בסיבוב (החזק Shift לסיבוב חופשי 1°)"
          >
            <option value={15}>סיבוב 15°</option>
            <option value={45}>סיבוב 45°</option>
            <option value={90}>סיבוב 90°</option>
            <option value={1}>חופשי 1°</option>
          </select>

          {/* Live Dimensions Toggle */}
          <button
            onClick={() => setShowLiveDimensions(!showLiveDimensions)}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 border transition cursor-pointer ${
              showLiveDimensions
                ? 'bg-sky-950/70 text-sky-300 border-sky-500/50'
                : 'bg-slate-900 text-slate-400 border-slate-800'
            }`}
            title="הצג/הסתר קווי מידה דינמיים ומרחקים פנויים"
          >
            <Ruler className="w-3.5 h-3.5" />
            מידות
          </button>

          {/* Unit Mode mm / cm */}
          <button
            onClick={() => setUnitMode(unitMode === 'mm' ? 'cm' : 'mm')}
            className="bg-slate-900 hover:bg-slate-800 border border-slate-800 text-amber-300 font-mono font-bold px-2.5 py-1.5 rounded-lg text-xs cursor-pointer"
            title="החלף יחידות תצוגה בין מילימטרים לסנטימטרים"
          >
            {unitMode === 'mm' ? 'מ"מ' : 'ס"מ'}
          </button>

          {/* Undo / Redo */}
          <div className="flex items-center border-r border-slate-800 pr-1.5 mr-0.5 gap-1">
            <button
              onClick={undo}
              disabled={past.length === 0}
              className="p-1.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-35 rounded-lg text-slate-200 border border-slate-800 cursor-pointer"
              title="בטל פעולה (Ctrl+Z)"
            >
              <Undo2 className="w-4 h-4" />
            </button>
            <button
              onClick={redo}
              disabled={future.length === 0}
              className="p-1.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-35 rounded-lg text-slate-200 border border-slate-800 cursor-pointer"
              title="בצע שוב (Ctrl+Y)"
            >
              <Redo2 className="w-4 h-4" />
            </button>
          </div>

          {/* Save & Load JSON */}
          <button
            onClick={handleSaveJson}
            className="p-1.5 bg-slate-900 hover:bg-slate-800 rounded-lg text-slate-200 border border-slate-800 cursor-pointer"
            title="שמור קובץ פרויקט למחשב (.woodjson)"
          >
            <Download className="w-4 h-4" />
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-1.5 bg-slate-900 hover:bg-slate-800 rounded-lg text-slate-200 border border-slate-800 cursor-pointer"
            title="טען קובץ פרויקט מהמחשב (.woodjson)"
          >
            <Upload className="w-4 h-4" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".woodjson,.json"
            onChange={handleLoadJsonFile}
            className="hidden"
          />
        </div>
      </header>

      <TemplatesModal
        isOpen={templatesOpen}
        onClose={() => setTemplatesOpen(false)}
      />
      <ProductGeneratorModal
        isOpen={generatorOpen}
        onClose={() => setGeneratorOpen(false)}
      />
    </>
  );
};
