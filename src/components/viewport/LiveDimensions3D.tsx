import React from 'react';
import { Html, Line } from '@react-three/drei';
import { useProjectStore } from '../../store/useProjectStore';
import { getPartWorldBounds } from '../../utils/geometryAndEngineering';

export const LiveDimensions3D: React.FC = () => {
  const parts = useProjectStore((s) => s.parts);
  const selectedIds = useProjectStore((s) => s.selectedIds);
  const showLiveDimensions = useProjectStore((s) => s.showLiveDimensions);
  const unitMode = useProjectStore((s) => s.unitMode);
  const activeSnapLines = useProjectStore((s) => s.activeSnapLines);

  if (!showLiveDimensions && activeSnapLines.length === 0) return null;

  const selectedPart =
    selectedIds.length > 0
      ? parts.find((p) => p.id === selectedIds[0] && p.visible)
      : undefined;

  const fmt = (mm: number) =>
    unitMode === 'cm'
      ? `${(mm / 10).toFixed(1)} ס"מ`
      : `${Math.round(mm)} מ"מ`;

  const clearanceLines: Array<{
    id: string;
    start: [number, number, number];
    end: [number, number, number];
    mid: [number, number, number];
    distMm: number;
    axisLabel: string;
    color: string;
  }> = [];

  if (selectedPart && showLiveDimensions) {
    const sb = getPartWorldBounds(selectedPart);

    // Height from floor (if elevated > 10mm)
    if (sb.min[1] > 10) {
      clearanceLines.push({
        id: 'clr-floor',
        start: [sb.center[0], 0, sb.center[2]],
        end: [sb.center[0], sb.min[1], sb.center[2]],
        mid: [sb.center[0], sb.min[1] / 2, sb.center[2]],
        distMm: sb.min[1],
        axisLabel: 'גובה',
        color: '#4ade80',
      });
    }
  }

  return (
    <group name="live-dimensions-overlay">
      {/* 1. Active Magnetic Snap Guide Lines (only while actively dragging) */}
      {activeSnapLines.map((line) => (
        <Line
          key={line.id}
          points={[line.start, line.end]}
          color={line.color}
          lineWidth={2.5}
        />
      ))}

      {/* 2. Subtle Floor Height Line when "מידות" is toggled on */}
      {clearanceLines.map((cl) => (
        <group key={cl.id}>
          <Line
            points={[cl.start, cl.end]}
            color={cl.color}
            lineWidth={1.8}
            dashed
            dashScale={0.08}
          />
          <Html position={cl.mid} center>
            <div className="bg-slate-900/90 text-emerald-300 border border-emerald-500/50 px-1.5 py-0.5 rounded text-[10px] font-mono whitespace-nowrap pointer-events-none">
              {cl.axisLabel}: {fmt(cl.distMm)}
            </div>
          </Html>
        </group>
      ))}
    </group>
  );
};
