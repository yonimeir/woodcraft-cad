import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { Grid, OrbitControls } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { useProjectStore } from '../../store/useProjectStore';
import {
  analyzeStructuralLoads,
  detectPartCollisions,
} from '../../utils/geometryAndEngineering';
import { generateCutListGroups } from '../../utils/cutOptimizer';
import { WoodPartMesh } from './WoodPartMesh';
import { InteractiveGizmoHandles } from './InteractiveGizmoHandles';
import { LiveDimensions3D } from './LiveDimensions3D';
import { RoomContextMesh } from './RoomContextMesh';
import { ViewCubeOverlay } from './ViewCubeOverlay';
import { AlertTriangle, Scissors, ShieldAlert } from 'lucide-react';

const CameraPresetController: React.FC<{
  orbitRef: React.RefObject<OrbitControlsImpl | null>;
}> = ({ orbitRef }) => {
  const { camera } = useThree();
  const presetReq = useProjectStore((s) => s.cameraPresetRequest);

  useEffect(() => {
    if (!presetReq) return;
    const dist = 2400;
    const targetY = 450;

    switch (presetReq.view) {
      case 'iso':
        camera.position.set(1850, 1450, 1950);
        break;
      case 'top':
        camera.position.set(0, 2900, 10);
        break;
      case 'front':
        camera.position.set(0, targetY + 150, dist);
        break;
      case 'back':
        camera.position.set(0, targetY + 150, -dist);
        break;
      case 'right':
        camera.position.set(dist, targetY + 150, 0);
        break;
      case 'left':
        camera.position.set(-dist, targetY + 150, 0);
        break;
    }

    if (orbitRef.current) {
      orbitRef.current.target.set(0, targetY, 0);
      orbitRef.current.update();
    }
  }, [presetReq, camera, orbitRef]);

  return null;
};

export const Viewport3D: React.FC = () => {
  const parts = useProjectStore((s) => s.parts);
  const selectedIds = useProjectStore((s) => s.selectedIds);
  const selectPart = useProjectStore((s) => s.selectPart);
  const createParametricDado = useProjectStore((s) => s.createParametricDado);

  const [orbitEnabled, setOrbitEnabled] = useState(true);
  const orbitRef = useRef<OrbitControlsImpl | null>(null);

  const { partIdToLabel } = useMemo(
    () => generateCutListGroups(parts),
    [parts]
  );

  const collisions = useMemo(() => detectPartCollisions(parts), [parts]);
  const unresolvedCollisions = useMemo(
    () => collisions.filter((c) => !c.hasDadoAlready),
    [collisions]
  );

  const loadResults = useMemo(() => analyzeStructuralLoads(parts), [parts]);
  const loadMap = useMemo(() => {
    const m = new Map<string, (typeof loadResults)[number]>();
    for (const r of loadResults) m.set(r.partId, r);
    return m;
  }, [loadResults]);

  const warningLoads = useMemo(
    () =>
      loadResults.filter(
        (r) => r.severity === 'critical' || r.severity === 'warning'
      ),
    [loadResults]
  );

  const collisionPartIds = useMemo(() => {
    const s = new Set<string>();
    for (const c of unresolvedCollisions) {
      s.add(c.partAId);
      s.add(c.partBId);
    }
    return s;
  }, [unresolvedCollisions]);

  const primarySelectedPart =
    selectedIds.length > 0
      ? parts.find((p) => p.id === selectedIds[0])
      : undefined;

  return (
    <div className="relative w-full h-full bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900 overflow-hidden">
      {/* Tinkercad-style ViewCube in Top-Left corner */}
      <ViewCubeOverlay />

      {/* Three.js Canvas */}
      <Canvas
        id="woodcraft-3d-canvas"
        shadows
        gl={{ preserveDrawingBuffer: true, antialias: true }}
        camera={{
          position: [1850, 1450, 1950],
          fov: 42,
          near: 10,
          far: 25000,
        }}
        onPointerMissed={() => selectPart(null)}
      >
        <CameraPresetController orbitRef={orbitRef} />

        <ambientLight intensity={0.72} />
        <directionalLight
          position={[1800, 3200, 1600]}
          intensity={1.15}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
        />
        <directionalLight position={[-1600, 1400, -1400]} intensity={0.45} />

        {/* Calibrated Floor Grid (100mm cells, 1000mm sections) */}
        <Grid
          position={[0, 0, 0]}
          args={[10000, 10000]}
          cellSize={100}
          cellThickness={0.6}
          cellColor="#334155"
          sectionSize={1000}
          sectionThickness={1.2}
          sectionColor="#475569"
          fadeDistance={7500}
          fadeStrength={1.2}
        />

        {/* IKEA-style Room Environment */}
        <RoomContextMesh />

        {/* Render all Parts */}
        {parts.map((part) => (
          <WoodPartMesh
            key={part.id}
            part={part}
            allParts={parts}
            isSelected={selectedIds.includes(part.id)}
            hasCollision={collisionPartIds.has(part.id)}
            cutLabel={partIdToLabel[part.id] || '?'}
            loadWarning={loadMap.get(part.id)}
            setOrbitEnabled={setOrbitEnabled}
          />
        ))}

        {/* Interactive Gizmo (Move Arrows, Stretch Handles, Pivot Pin 🎯 & Axis Rotation Rings) */}
        {primarySelectedPart && (
          <InteractiveGizmoHandles
            part={primarySelectedPart}
            setOrbitEnabled={setOrbitEnabled}
          />
        )}

        {/* Live Dimensions & Magnetic Snap Guide Lines */}
        <LiveDimensions3D />

        <OrbitControls
          ref={orbitRef}
          enabled={orbitEnabled}
          makeDefault
          target={[0, 450, 0]}
          maxPolarAngle={Math.PI / 2 - 0.02}
          minDistance={250}
          maxDistance={9000}
        />
      </Canvas>

      {/* Floating Bottom Alerts Bar: Collisions (Auto Half-Lap) & Structural Load Warnings */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex flex-col gap-2 max-w-2xl w-[92%] pointer-events-none">
        {/* 1. Structural Sag Warnings (Non-blocking engineering advisor) */}
        {warningLoads.map((warn) => (
          <div
            key={warn.partId}
            className="pointer-events-auto bg-red-950/95 backdrop-blur-md border border-red-500/70 text-red-100 px-3.5 py-2 rounded-xl shadow-2xl flex items-start justify-between gap-3 text-xs"
          >
            <div className="flex items-start gap-2.5">
              <ShieldAlert className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div>
                <div className="font-bold text-red-200 flex items-center gap-2">
                  <span>התראת עומסים וכפיפה: {warn.partName}</span>
                  <span className="bg-red-800/80 text-red-100 px-1.5 py-0.5 rounded font-mono text-[11px]">
                    שקיעה: {warn.deflectionMm} מ"מ (מפתח {Math.round(warn.unsupportedSpanMm / 10)} ס"מ)
                  </span>
                </div>
                <p className="text-red-200/90 mt-0.5 leading-relaxed">
                  {warn.recommendationHe}
                </p>
              </div>
            </div>
            <button
              onClick={() => selectPart(warn.partId)}
              className="shrink-0 bg-red-800 hover:bg-red-700 text-white px-2.5 py-1 rounded-lg font-medium transition cursor-pointer"
            >
              בחר קורה
            </button>
          </div>
        ))}

        {/* 2. Collision Detection -> One-Click Parametric Half-Lap / Dado Joint */}
        {unresolvedCollisions.slice(0, 2).map((col) => (
          <div
            key={col.id}
            className="pointer-events-auto bg-amber-950/95 backdrop-blur-md border border-amber-500/70 text-amber-100 px-3.5 py-2 rounded-xl shadow-2xl flex items-center justify-between gap-3 text-xs"
          >
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                זוהתה חפיפה בין <strong>"{col.partAName}"</strong> לבין{' '}
                <strong>"{col.partBName}"</strong>
              </span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() =>
                  createParametricDado(col.partAId, col.partBId, 'half')
                }
                className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-2.5 py-1 rounded-lg flex items-center gap-1 transition cursor-pointer"
              >
                <Scissors className="w-3.5 h-3.5" />
                צור מגרעת חצי-חצי (Half-Lap)
              </button>
              <button
                onClick={() =>
                  createParametricDado(col.partAId, col.partBId, 'full')
                }
                className="bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/40 px-2 py-1 rounded-lg transition cursor-pointer"
              >
                מגרעת מלאה (Dado)
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
