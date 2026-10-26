import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { Canvas, useThree } from '@react-three/fiber';
import {
  GizmoHelper,
  GizmoViewcube,
  Grid,
  OrbitControls,
} from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { useProjectStore } from '../../store/useProjectStore';
import {
  analyzeStructuralLoads,
  detectPartCollisions,
  getPartWorldBounds,
} from '../../utils/geometryAndEngineering';
import { generateCutListGroups } from '../../utils/cutOptimizer';
import { WoodPartMesh } from './WoodPartMesh';
import { InteractiveGizmoHandles } from './InteractiveGizmoHandles';
import { LiveDimensions3D } from './LiveDimensions3D';
import { RoomContextMesh } from './RoomContextMesh';
import { ViewCubeOverlay } from './ViewCubeOverlay';
import {
  AlertTriangle,
  Maximize2,
  Move,
  RotateCw,
  Scissors,
  ShieldAlert,
  X,
} from 'lucide-react';

const CameraPresetController: React.FC<{
  orbitRef: React.RefObject<OrbitControlsImpl | null>;
}> = ({ orbitRef }) => {
  const { camera } = useThree();
  const presetReq = useProjectStore((s) => s.cameraPresetRequest);
  const parts = useProjectStore((s) => s.parts);
  const selectedIds = useProjectStore((s) => s.selectedIds);

  useEffect(() => {
    if (!presetReq) return;
    const dist = 2200;
    const diag = 1650;
    const target = orbitRef.current
      ? orbitRef.current.target.clone()
      : new THREE.Vector3(0, 450, 0);

    switch (presetReq.view) {
      case 'iso':
      case 'top-front-right':
        target.set(0, 450, 0);
        camera.position.set(diag, diag * 0.85, diag);
        break;
      case 'top-front-left':
        target.set(0, 450, 0);
        camera.position.set(-diag, diag * 0.85, diag);
        break;
      case 'top-back-left':
        target.set(0, 450, 0);
        camera.position.set(-diag, diag * 0.85, -diag);
        break;
      case 'top-back-right':
        target.set(0, 450, 0);
        camera.position.set(diag, diag * 0.85, -diag);
        break;
      case 'front-right':
        camera.position.set(diag, target.y + 150, diag);
        break;
      case 'front-left':
        camera.position.set(-diag, target.y + 150, diag);
        break;
      case 'back-right':
        camera.position.set(diag, target.y + 150, -diag);
        break;
      case 'back-left':
        camera.position.set(-diag, target.y + 150, -diag);
        break;
      case 'top':
        camera.position.set(target.x, 2900, target.z + 10);
        break;
      case 'bottom':
        camera.position.set(target.x, -1500, target.z + 10);
        break;
      case 'front':
        camera.position.set(target.x, target.y + 120, dist);
        break;
      case 'back':
        camera.position.set(target.x, target.y + 120, -dist);
        break;
      case 'right':
        camera.position.set(dist, target.y + 120, target.z);
        break;
      case 'left':
        camera.position.set(-dist, target.y + 120, target.z);
        break;
      case 'zoom-in': {
        const dir = camera.position.clone().sub(target);
        if (dir.length() > 350) {
          dir.multiplyScalar(0.78);
          camera.position.copy(target.clone().add(dir));
        }
        break;
      }
      case 'zoom-out': {
        const dir = camera.position.clone().sub(target);
        if (dir.length() < 8000) {
          dir.multiplyScalar(1.28);
          camera.position.copy(target.clone().add(dir));
        }
        break;
      }
      case 'fit': {
        const selPart =
          selectedIds.length > 0
            ? parts.find((p) => p.id === selectedIds[0] && p.visible)
            : undefined;
        if (selPart) {
          const b = getPartWorldBounds(selPart);
          target.set(b.center[0], b.center[1], b.center[2]);
          const maxDim = Math.max(b.size[0], b.size[1], b.size[2], 600);
          camera.position.set(
            b.center[0] + maxDim * 1.15,
            b.center[1] + maxDim * 0.9,
            b.center[2] + maxDim * 1.15
          );
        } else {
          target.set(0, 450, 0);
          camera.position.set(1850, 1450, 1950);
        }
        break;
      }
    }

    if (orbitRef.current) {
      orbitRef.current.target.copy(target);
      orbitRef.current.update();
    }
  }, [presetReq, camera, orbitRef, parts, selectedIds]);

  return null;
};

export const Viewport3D: React.FC = () => {
  const parts = useProjectStore((s) => s.parts);
  const selectedIds = useProjectStore((s) => s.selectedIds);
  const selectPart = useProjectStore((s) => s.selectPart);
  const gizmoMode = useProjectStore((s) => s.gizmoMode);
  const setGizmoMode = useProjectStore((s) => s.setGizmoMode);
  const activeNotePartId = useProjectStore((s) => s.activeNotePartId);
  const setActiveNotePartId = useProjectStore((s) => s.setActiveNotePartId);
  const createParametricDado = useProjectStore((s) => s.createParametricDado);
  const rotatePartWithPivot = useProjectStore((s) => s.rotatePartWithPivot);

  const [orbitEnabled, setOrbitEnabled] = useState(true);
  const [pillDismissed, setPillDismissed] = useState(false);
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

  // Details for the currently clicked beam note (`activeNotePartId`)
  const activeNotePart = activeNotePartId
    ? parts.find((p) => p.id === activeNotePartId)
    : undefined;
  const activeNoteLoad = activeNotePartId
    ? loadMap.get(activeNotePartId)
    : undefined;
  const activeNoteCollisions = useMemo(() => {
    if (!activeNotePartId) return [];
    return unresolvedCollisions.filter(
      (c) => c.partAId === activeNotePartId || c.partBId === activeNotePartId
    );
  }, [unresolvedCollisions, activeNotePartId]);

  const totalAlertsCount = warningLoads.length + unresolvedCollisions.length;

  return (
    <div className="relative w-full h-full bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900 overflow-hidden">
      {/* Tinkercad-style Circular Buttons below the 3D ViewCube */}
      <ViewCubeOverlay />

      {/* Top-Center Clean Gizmo Mode Bar (Move/Height vs Stretch vs Rotate) */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 bg-slate-900/95 backdrop-blur-md border border-slate-700/80 px-2.5 py-1.5 rounded-xl shadow-xl select-none">
        <span className="text-[11px] text-slate-400 font-medium pl-1 border-l border-slate-800">
          כלי שליטה ב-3D:
        </span>
        <button
          type="button"
          onClick={() => setGizmoMode('move')}
          className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
            gizmoMode === 'move'
              ? 'bg-emerald-500 text-slate-950 shadow'
              : 'text-slate-300 hover:bg-slate-800'
          }`}
          title="הזזה בצירים X/Z והרמה/הורדה לגובה (ציר Y ירוק או החזקת Shift+גרירה)"
        >
          <Move className="w-3.5 h-3.5" />
          הזזה וגובה (Y↕)
        </button>
        <button
          type="button"
          onClick={() => setGizmoMode('stretch')}
          className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
            gizmoMode === 'stretch'
              ? 'bg-amber-500 text-slate-950 shadow'
              : 'text-slate-300 hover:bg-slate-800'
          }`}
          title="ידיות מתיחה לשינוי אורך/רוחב הקורה"
        >
          <Maximize2 className="w-3.5 h-3.5" />
          מתיחת אורך
        </button>
        <button
          type="button"
          onClick={() => setGizmoMode('rotate')}
          className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
            gizmoMode === 'rotate'
              ? 'bg-pink-500 text-white shadow'
              : 'text-slate-300 hover:bg-slate-800'
          }`}
          title="טבעות סיבוב סביב נקודת העוגן הנבחרת (🎯)"
        >
          <RotateCw className="w-3.5 h-3.5" />
          סיבוב (סביב עוגן 🎯)
        </button>
      </div>

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
        onPointerMissed={() => {
          selectPart(null);
          setActiveNotePartId(null);
        }}
      >
        <CameraPresetController orbitRef={orbitRef} />

        {/* Real 3D Interactive Tinkercad ViewCube in Top-Left (supports Faces, 45° Edges & 45° Corners!) */}
        <GizmoHelper alignment="top-left" margin={[70, 70]}>
          <GizmoViewcube
            faces={['ימין', 'שמאל', 'עליון', 'תחתון', 'חזית', 'אחור']}
            color="#f8fafc"
            textColor="#0f172a"
            strokeColor="#334155"
            hoverColor="#f59e0b"
            opacity={0.95}
          />
        </GizmoHelper>

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

      {/* Small Unobtrusive Corner Pill when no note is open (with X to hide) */}
      {!activeNotePart && totalAlertsCount > 0 && !pillDismissed && (
        <div className="absolute bottom-3 right-3 z-20 flex items-center gap-1.5 bg-slate-900/95 backdrop-blur-md border border-amber-500/50 text-slate-200 px-3 py-1.5 rounded-full shadow-xl text-xs">
          <button
            type="button"
            onClick={() => {
              const firstId =
                warningLoads[0]?.partId || unresolvedCollisions[0]?.partAId;
              if (firstId) {
                selectPart(firstId);
                setActiveNotePartId(firstId);
              }
            }}
            className="flex items-center gap-1.5 hover:text-amber-300 font-semibold cursor-pointer"
          >
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
            <span>
              {totalAlertsCount} הערות הנדסיות (לחץ על הסימון ⚠️ שעל הקורה לפתיחה)
            </span>
          </button>
          <button
            type="button"
            onClick={() => setPillDismissed(true)}
            className="text-slate-400 hover:text-white p-0.5 rounded-full cursor-pointer mr-1"
            title="הסתר הודעה זו"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* On-Demand Note Popover Card (ONLY opens when clicking ⚠️ on a beam, with an X close button!) */}
      {activeNotePart &&
        (activeNoteLoad || activeNoteCollisions.length > 0) && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 max-w-lg w-[92%] bg-slate-900/95 backdrop-blur-md border border-slate-700 rounded-2xl shadow-2xl p-4 space-y-3 text-xs">
            {/* Header with Part Name & X Close Button */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2 font-bold text-sm text-white">
                <span className="bg-amber-500 text-slate-950 font-mono px-2 py-0.5 rounded text-xs">
                  {partIdToLabel[activeNotePart.id] || '?'}
                </span>
                <span>הערות הנדסיות עבור: {activeNotePart.name}</span>
              </div>
              <button
                type="button"
                onClick={() => setActiveNotePartId(null)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white p-1 rounded-lg transition cursor-pointer"
                title="סגור הערה (X)"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* 1. Structural Sag Note (if applicable) */}
            {activeNoteLoad &&
              (activeNoteLoad.severity === 'critical' ||
                activeNoteLoad.severity === 'warning') && (
                <div className="bg-red-950/60 border border-red-500/60 rounded-xl p-3 space-y-2 text-red-100">
                  <div className="flex items-center justify-between">
                    <span className="font-bold flex items-center gap-1.5 text-red-200">
                      <ShieldAlert className="w-4 h-4 text-red-400" />
                      התראת עומסים וכפיפה
                    </span>
                    <span className="bg-red-900/80 px-2 py-0.5 rounded font-mono text-[11px]">
                      שקיעה צפויה: {activeNoteLoad.deflectionMm} מ"מ (מפתח{' '}
                      {Math.round(activeNoteLoad.unsupportedSpanMm / 10)} ס"מ)
                    </span>
                  </div>
                  <p className="leading-relaxed text-red-100/90">
                    {activeNoteLoad.recommendationHe}
                  </p>
                  {activeNoteLoad.isLaidFlat && (
                    <button
                      type="button"
                      onClick={() => {
                        rotatePartWithPivot(activeNotePart.id, [
                          (activeNotePart.rotation[0] + 90) % 360,
                          activeNotePart.rotation[1],
                          activeNotePart.rotation[2],
                        ]);
                        setActiveNotePartId(null);
                      }}
                      className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer"
                    >
                      <RotateCw className="w-3.5 h-3.5" />
                      סובב קורה ב-90° על דופנה (יקטין שקיעה ל-
                      {activeNoteLoad.edgewiseDeflectionMm} מ"מ)
                    </button>
                  )}
                </div>
              )}

            {/* 2. Collision / Half-Lap Dado Note (if applicable) */}
            {activeNoteCollisions.map((col) => {
              const otherId =
                col.partAId === activeNotePart.id ? col.partBId : col.partAId;
              const otherName =
                col.partAId === activeNotePart.id
                  ? col.partBName
                  : col.partAName;
              return (
                <div
                  key={col.id}
                  className="bg-amber-950/50 border border-amber-500/60 rounded-xl p-3 space-y-2 text-amber-100"
                >
                  <div className="flex items-center gap-1.5 font-bold text-amber-300">
                    <AlertTriangle className="w-4 h-4" />
                    <span>חפיפה / מפגש עם הקורה "{otherName}"</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        createParametricDado(
                          activeNotePart.id,
                          otherId,
                          'half'
                        );
                        setActiveNotePartId(null);
                      }}
                      className="flex-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold py-1.5 rounded-lg flex items-center justify-center gap-1 transition cursor-pointer"
                    >
                      <Scissors className="w-3.5 h-3.5" />
                      צור מגרעת חצי-חצי (Half-Lap)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        createParametricDado(
                          activeNotePart.id,
                          otherId,
                          'full'
                        );
                        setActiveNotePartId(null);
                      }}
                      className="flex-1 bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/40 py-1.5 rounded-lg transition cursor-pointer"
                    >
                      מגרעת מלאה (Dado)
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
    </div>
  );
};
