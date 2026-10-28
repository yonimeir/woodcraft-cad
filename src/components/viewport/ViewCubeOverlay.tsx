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

  const circleBtn =
    'w-9 h-9 rounded-full bg-white hover:bg-slate-50 text-slate-700 hover:text-amber-600 border border-slate-200/90 shadow-md flex items-center justify-center transition cursor-pointer';

  return (
    <div
      className="absolute top-36 left-4 z-20 flex flex-col items-center gap-2 select-none"
      title="כלי ניווט מצלמה"
    >
      {/* 1. Home View */}
      <button
        type="button"
        onClick={() => requestCameraView('iso')}
        className={circleBtn}
        title="מבט בית תלת-ממדי"
      >
        <Home className="w-4 h-4" />
      </button>

      {/* 2. Fit to View */}
      <button
        type="button"
        onClick={() => requestCameraView('fit')}
        className={circleBtn}
        title="מרכז והתאם מבט לחלק הנבחר (F)"
      >
        <Maximize2 className="w-4 h-4" />
      </button>

      {/* 3. Zoom In (+) */}
      <button
        type="button"
        onClick={() => requestCameraView('zoom-in')}
        className={circleBtn}
        title="התקרב (+)"
      >
        <Plus className="w-4.5 h-4.5" />
      </button>

      {/* 4. Zoom Out (-) */}
      <button
        type="button"
        onClick={() => requestCameraView('zoom-out')}
        className={circleBtn}
        title="התרחק (-)"
      >
        <Minus className="w-4.5 h-4.5" />
      </button>

      {/* 5. Rotate 45° Corner Isometric View */}
      <button
        type="button"
        onClick={() => {
          const next = (cornerIdx + 1) % cycle45Views.length;
          setCornerIdx(next);
          requestCameraView(cycle45Views[next]);
        }}
        className={circleBtn}
        title="סובב בין פינות מבט של 45°"
      >
        <Box className="w-4 h-4" />
      </button>
    </div>
  );
};
