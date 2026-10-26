import React from 'react';
import { Html, Line } from '@react-three/drei';
import { useProjectStore } from '../../store/useProjectStore';
import {
  getPartWorldBounds,
  resolvePartLengths,
} from '../../utils/geometryAndEngineering';

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

  // Compute nearest neighbor clear distances along X, Y, Z
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
    const otherVisible = parts.filter(
      (p) => p.visible && p.id !== selectedPart.id
    );

    // Nearest clear distance along X (left & right)
    let bestLeftGap = Infinity;
    let bestLeftX = 0;
    let bestRightGap = Infinity;
    let bestRightX = 0;

    // Nearest clear distance along Z (front & back)
    let bestFrontGap = Infinity;
    let bestFrontZ = 0;
    let bestBackGap = Infinity;
    let bestBackZ = 0;

    for (const other of otherVisible) {
      const ob = getPartWorldBounds(other);
      const overlapY =
        Math.min(sb.max[1], ob.max[1]) - Math.max(sb.min[1], ob.min[1]);
      const overlapZ =
        Math.min(sb.max[2], ob.max[2]) - Math.max(sb.min[2], ob.min[2]);
      const overlapX =
        Math.min(sb.max[0], ob.max[0]) - Math.max(sb.min[0], ob.min[0]);

      // X neighbor check
      if (overlapY > -400 && overlapZ > -400) {
        if (ob.max[0] <= sb.min[0] - 2) {
          const gap = sb.min[0] - ob.max[0];
          if (gap < bestLeftGap) {
            bestLeftGap = gap;
            bestLeftX = ob.max[0];
          }
        }
        if (ob.min[0] >= sb.max[0] + 2) {
          const gap = ob.min[0] - sb.max[0];
          if (gap < bestRightGap) {
            bestRightGap = gap;
            bestRightX = ob.min[0];
          }
        }
      }

      // Z neighbor check
      if (overlapY > -400 && overlapX > -400) {
        if (ob.max[2] <= sb.min[2] - 2) {
          const gap = sb.min[2] - ob.max[2];
          if (gap < bestBackGap) {
            bestBackGap = gap;
            bestBackZ = ob.max[2];
          }
        }
        if (ob.min[2] >= sb.max[2] + 2) {
          const gap = ob.min[2] - sb.max[2];
          if (gap < bestFrontGap) {
            bestFrontGap = gap;
            bestFrontZ = ob.min[2];
          }
        }
      }
    }

    if (bestLeftGap < 2500) {
      clearanceLines.push({
        id: 'clr-left',
        start: [bestLeftX, sb.center[1], sb.center[2]],
        end: [sb.min[0], sb.center[1], sb.center[2]],
        mid: [(bestLeftX + sb.min[0]) / 2, sb.center[1] + 20, sb.center[2]],
        distMm: bestLeftGap,
        axisLabel: 'מרווח X',
        color: '#22d3ee',
      });
    }
    if (bestRightGap < 2500) {
      clearanceLines.push({
        id: 'clr-right',
        start: [sb.max[0], sb.center[1], sb.center[2]],
        end: [bestRightX, sb.center[1], sb.center[2]],
        mid: [(sb.max[0] + bestRightX) / 2, sb.center[1] + 20, sb.center[2]],
        distMm: bestRightGap,
        axisLabel: 'מרווח X',
        color: '#22d3ee',
      });
    }
    if (bestBackGap < 2500) {
      clearanceLines.push({
        id: 'clr-back',
        start: [sb.center[0], sb.center[1], bestBackZ],
        end: [sb.center[0], sb.center[1], sb.min[2]],
        mid: [sb.center[0], sb.center[1] + 20, (bestBackZ + sb.min[2]) / 2],
        distMm: bestBackGap,
        axisLabel: 'מרווח Z',
        color: '#a78bfa',
      });
    }
    if (bestFrontGap < 2500) {
      clearanceLines.push({
        id: 'clr-front',
        start: [sb.center[0], sb.center[1], sb.max[2]],
        end: [sb.center[0], sb.center[1], bestFrontZ],
        mid: [sb.center[0], sb.center[1] + 20, (sb.max[2] + bestFrontZ) / 2],
        distMm: bestFrontGap,
        axisLabel: 'מרווח Z',
        color: '#a78bfa',
      });
    }

    // Height from floor (if elevated > 10mm)
    if (sb.min[1] > 10) {
      clearanceLines.push({
        id: 'clr-floor',
        start: [sb.min[0], 0, sb.max[2]],
        end: [sb.min[0], sb.min[1], sb.max[2]],
        mid: [sb.min[0] - 25, sb.min[1] / 2, sb.max[2]],
        distMm: sb.min[1],
        axisLabel: 'גובה מהרצפה',
        color: '#4ade80',
      });
    }
  }

  const selectedBounds = selectedPart ? getPartWorldBounds(selectedPart) : null;
  const selectedLengths = selectedPart ? resolvePartLengths(selectedPart) : null;

  return (
    <group name="live-dimensions-overlay">
      {/* 1. Active Magnetic Snap Guide Lines */}
      {activeSnapLines.map((line) => (
        <group key={line.id}>
          <Line points={[line.start, line.end]} color={line.color} lineWidth={2.5} />
          {line.label && (
            <Html
              position={[
                (line.start[0] + line.end[0]) / 2,
                (line.start[1] + line.end[1]) / 2 + 30,
                (line.start[2] + line.end[2]) / 2,
              ]}
              center
            >
              <div className="bg-emerald-950/90 text-emerald-300 border border-emerald-500/60 px-2 py-0.5 rounded text-[10px] font-semibold whitespace-nowrap">
                🧲 {line.label}
              </div>
            </Html>
          )}
        </group>
      ))}

      {/* 2. Selected Part Dimension Line & Readout */}
      {selectedPart && selectedBounds && selectedLengths && showLiveDimensions && (
        <group>
          <Line
            points={[
              [
                selectedBounds.min[0],
                selectedBounds.max[1] + 35,
                selectedBounds.max[2],
              ],
              [
                selectedBounds.max[0],
                selectedBounds.max[1] + 35,
                selectedBounds.max[2],
              ],
            ]}
            color="#fbbf24"
            lineWidth={2}
          />
          <Html
            position={[
              selectedBounds.center[0],
              selectedBounds.max[1] + 55,
              selectedBounds.max[2],
            ]}
            center
            distanceFactor={2000}
          >
            <div className="bg-slate-950/95 text-amber-300 border border-amber-500/70 px-2.5 py-0.5 rounded-md text-xs font-mono font-semibold whitespace-nowrap shadow-lg">
              אורך: {fmt(selectedLengths.outerLength)}
              {selectedLengths.innerLength !== selectedLengths.outerLength &&
                ` (פנימי: ${fmt(selectedLengths.innerLength)})`}{' '}
              | חתך: {selectedPart.dimensions.width}×{selectedPart.dimensions.thickness} מ"מ
            </div>
          </Html>
        </group>
      )}

      {/* 3. Clear Distances to Nearest Neighboring Parts */}
      {clearanceLines.map((cl) => (
        <group key={cl.id}>
          <Line
            points={[cl.start, cl.end]}
            color={cl.color}
            lineWidth={1.8}
            dashed
            dashScale={0.08}
          />
          <Html position={cl.mid} center distanceFactor={2100}>
            <div className="bg-slate-900/95 text-cyan-200 border border-cyan-500/50 px-2 py-0.5 rounded text-[11px] font-mono whitespace-nowrap shadow">
              {cl.axisLabel}: {fmt(cl.distMm)}
            </div>
          </Html>
        </group>
      ))}
    </group>
  );
};
