import React from 'react';
import { CameraViewPreset, useProjectStore } from '../../store/useProjectStore';
import { Box, Home, Maximize2, Minus, Plus } from 'lucide-react';

export const ViewCubeOverlay: React.FC = () => {
  const requestCameraView = useProjectStore((s) => s.requestCameraView);

  const cycle45Views: CameraViewPreset[] = [
    'top-front-right',
    'top-front-left',
    'top-back-left',
    'top-back-right',
  ];
  const [cornerIdx, setCornerIdx] = React.useState(0);

  return (
    <div
      className="absolute top-36 left-5 z-20 flex flex-col items-center gap-2 select-none"
      title="כלי ניווט מצלמה (בסגנון Tinkercad)"
    >
      {/* 1. Home View (איפוס מבט בית איזומטרי) */}
      <button
        type="button"
        onClick={() => requestCameraView('iso')}
        className="w-10 h-10 rounded-full bg-slate-900/90 hover:bg-amber-500 text-slate-100 hover:text-slate-950 border-2 border-slate-600/80 hover:border-amber-300 shadow-xl flex items-center justify-center transition cursor-pointer"
        title="מבט בית תלת-ממדי (Home View)"
      >
        <Home className="w-4.5 h-4.5" />
      </button>

      {/* 2. Fit to View (מיקוד בחלק הנבחר / התאמה למסך) */}
      <button
        type="button"
        onClick={() => requestCameraView('fit')}
        className="w-10 h-10 rounded-full bg-slate-900/90 hover:bg-amber-500 text-slate-100 hover:text-slate-950 border-2 border-slate-600/80 hover:border-amber-300 shadow-xl flex items-center justify-center transition cursor-pointer"
        title="מרכז והתאם מבט לחלק הנבחר (Fit View)"
      >
        <Maximize2 className="w-4.5 h-4.5" />
      </button>

      {/* 3. Zoom In (+) */}
      <button
        type="button"
        onClick={() => requestCameraView('zoom-in')}
        className="w-10 h-10 rounded-full bg-slate-900/90 hover:bg-amber-500 text-slate-100 hover:text-slate-950 border-2 border-slate-600/80 hover:border-amber-300 shadow-xl flex items-center justify-center transition cursor-pointer"
        title="התקרב (Zoom In)"
      >
        <Plus className="w-5 h-5" />
      </button>

      {/* 4. Zoom Out (-) */}
      <button
        type="button"
        onClick={() => requestCameraView('zoom-out')}
        className="w-10 h-10 rounded-full bg-slate-900/90 hover:bg-amber-500 text-slate-100 hover:text-slate-950 border-2 border-slate-600/80 hover:border-amber-300 shadow-xl flex items-center justify-center transition cursor-pointer"
        title="התרחק (Zoom Out)"
      >
        <Minus className="w-5 h-5" />
      </button>

      {/* 5. Rotate 45° Corner Isometric View */}
      <button
        type="button"
        onClick={() => {
          const next = (cornerIdx + 1) % cycle45Views.length;
          setCornerIdx(next);
          requestCameraView(cycle45Views[next]);
        }}
        className="w-10 h-10 rounded-full bg-slate-900/90 hover:bg-amber-500 text-amber-300 hover:text-slate-950 border-2 border-slate-600/80 hover:border-amber-300 shadow-xl flex flex-col items-center justify-center transition cursor-pointer"
        title="סובב בין פינות מבט של 45° (ניתן גם ללחוץ ישירות על פינות וצלעות הקובייה למעלה)"
      >
        <Box className="w-4 h-4" />
        <span className="text-[8px] font-mono font-bold leading-none mt-0.5">
          45°
        </span>
      </button>
    </div>
  );
};
