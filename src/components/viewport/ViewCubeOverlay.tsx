import React from 'react';
import { CameraViewPreset, useProjectStore } from '../../store/useProjectStore';
import { Compass, Home } from 'lucide-react';

export const ViewCubeOverlay: React.FC = () => {
  const requestCameraView = useProjectStore((s) => s.requestCameraView);

  const views: Array<{ id: CameraViewPreset; label: string; sub: string }> = [
    { id: 'top', label: 'מבט על', sub: 'TOP' },
    { id: 'front', label: 'חזית', sub: 'FRONT' },
    { id: 'right', label: 'ימין', sub: 'RIGHT' },
    { id: 'left', label: 'שמאל', sub: 'LEFT' },
    { id: 'back', label: 'אחור', sub: 'BACK' },
  ];

  return (
    <div
      className="absolute top-3 left-3 z-20 flex flex-col items-center bg-slate-900/90 backdrop-blur-md border border-slate-700/80 rounded-xl p-2 shadow-2xl select-none"
      title="קוביית ניווט מצלמה (בסגנון Tinkercad)"
    >
      <div className="flex items-center justify-between w-full gap-2 mb-1.5 px-1">
        <span className="text-[11px] font-semibold text-amber-400 flex items-center gap-1">
          <Compass className="w-3.5 h-3.5" />
          זווית מבט
        </span>
        <button
          onClick={() => requestCameraView('iso')}
          className="text-[11px] bg-amber-500/20 hover:bg-amber-500/40 text-amber-300 border border-amber-500/40 rounded px-1.5 py-0.5 flex items-center gap-1 transition cursor-pointer"
          title="איפוס למבט תלת-ממדי איזומטרי"
        >
          <Home className="w-3 h-3" />
          3D בית
        </button>
      </div>

      {/* Interactive 3D-styled Cube layout */}
      <div className="grid grid-cols-3 gap-1 w-36">
        <div />
        <button
          onClick={() => requestCameraView('top')}
          className="bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-slate-200 border border-slate-600/80 rounded-md py-1.5 text-center transition shadow-inner cursor-pointer"
        >
          <div className="text-[11px] font-bold leading-none">עליון</div>
          <div className="text-[8px] opacity-70 font-mono">TOP</div>
        </button>
        <div />

        <button
          onClick={() => requestCameraView('left')}
          className="bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-slate-200 border border-slate-600/80 rounded-md py-1.5 text-center transition shadow-inner cursor-pointer"
        >
          <div className="text-[11px] font-bold leading-none">שמאל</div>
          <div className="text-[8px] opacity-70 font-mono">LEFT</div>
        </button>
        <button
          onClick={() => requestCameraView('front')}
          className="bg-slate-700/90 hover:bg-amber-500 hover:text-slate-950 text-amber-200 border border-amber-500/50 rounded-md py-1.5 text-center transition shadow-md cursor-pointer"
        >
          <div className="text-[11px] font-bold leading-none">חזית</div>
          <div className="text-[8px] opacity-75 font-mono">FRONT</div>
        </button>
        <button
          onClick={() => requestCameraView('right')}
          className="bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-slate-200 border border-slate-600/80 rounded-md py-1.5 text-center transition shadow-inner cursor-pointer"
        >
          <div className="text-[11px] font-bold leading-none">ימין</div>
          <div className="text-[8px] opacity-70 font-mono">RIGHT</div>
        </button>

        <div />
        <button
          onClick={() => requestCameraView('back')}
          className="bg-slate-800/80 hover:bg-amber-500 hover:text-slate-950 text-slate-300 border border-slate-600/80 rounded-md py-1 text-center transition cursor-pointer"
        >
          <div className="text-[10px] font-bold leading-none">אחור</div>
          <div className="text-[8px] opacity-65 font-mono">BACK</div>
        </button>
        <div />
      </div>

      {/* Axis legend */}
      <div className="flex items-center justify-center gap-2.5 mt-1.5 pt-1 border-t border-slate-800 w-full text-[10px] font-mono">
        <span className="flex items-center gap-1 text-red-400">
          <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />X רוחב
        </span>
        <span className="flex items-center gap-1 text-emerald-400">
          <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />Y גובה
        </span>
        <span className="flex items-center gap-1 text-sky-400">
          <span className="w-2 h-2 rounded-full bg-sky-500 inline-block" />Z עומק
        </span>
      </div>
      {views.length === 0 && null}
    </div>
  );
};
