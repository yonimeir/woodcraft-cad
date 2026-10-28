import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { Canvas, useThree } from '@react-three/fiber';
import {
  GizmoHelper,
  GizmoViewcube,
  Grid,
  Line,
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
import { LeftInspectorPanel } from '../panels/LeftInspectorPanel';
import {
  AlertTriangle,
  Plus,
  RotateCw,
  Scissors,
  ShieldAlert,
  X,
} from 'lucide-react';
import {
  IconAiBlueprint,
  IconTemplatesGrid,
} from '../icons/WoodCraftIcons';

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
  const activeNotePartId = useProjectStore((s) => s.activeNotePartId);
  const setActiveNotePartId = useProjectStore((s) => s.setActiveNotePartId);
  const createParametricDado = useProjectStore((s) => s.createParametricDado);
  const rotatePartWithPivot = useProjectStore((s) => s.rotatePartWithPivot);
  const addPartFromStock = useProjectStore((s) => s.addPartFromStock);
  const gridSnapStepMm = useProjectStore((s) => s.gridSnapStepMm);
  const setGridSnapStepMm = useProjectStore((s) => s.setGridSnapStepMm);

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
    <div className="relative w-full h-full bg-gradient-to-b from-[#f8fafc] via-[#f4f7fb] to-[#eaeff5] overflow-hidden">
      {/* Tinkercad-style White Circular Camera Controls on Left */}
      <ViewCubeOverlay />

      {/* Floating Tool Popover & Compact Shape Inspector Card */}
      <LeftInspectorPanel />

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

        {/* Real 3D Interactive Tinkercad ViewCube in Top-Left */}
        <GizmoHelper alignment="top-left" margin={[62, 62]}>
          <GizmoViewcube
            faces={['ימין', 'שמאל', 'עליון', 'תחתון', 'חזית', 'אחור']}
            color="#ffffff"
            textColor="#334155"
            strokeColor="#cbd5e1"
            hoverColor="#38bdf8"
            opacity={0.98}
          />
        </GizmoHelper>

        <ambientLight intensity={0.88} />
        <directionalLight
          position={[1800, 3200, 1600]}
          intensity={1.1}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
        />
        <directionalLight position={[-1600, 1400, -1400]} intensity={0.45} />

        {/* Tinkercad-Style Light-Blue Workplane Surface & Grid */}
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, -0.5, 0]}
          receiveShadow
        >
          <planeGeometry args={[3000, 3000]} />
          <meshStandardMaterial
            color="#f0f9ff"
            roughness={0.95}
            metalness={0}
          />
        </mesh>

        <Grid
          position={[0, 0, 0]}
          args={[3000, 3000]}
          cellSize={100}
          cellThickness={0.7}
          cellColor="#bae6fd"
          sectionSize={500}
          sectionThickness={1.25}
          sectionColor="#38bdf8"
          fadeDistance={4200}
          fadeStrength={0.6}
        />

        {/* Crisp Tinkercad Workplane Outer Border */}
        <Line
          points={[
            [-1500, 1, -1500],
            [1500, 1, -1500],
            [1500, 1, 1500],
            [-1500, 1, 1500],
            [-1500, 1, -1500],
          ]}
          color="#0284c7"
          lineWidth={2}
        />

        {/* Room Environment */}
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

        {/* Clean Shape-Driven Tinkercad Handles (Single-Click Move/Pivot vs Double-Click Dimensions) */}
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

      {/* Tinkercad Bottom-Left Snap Grid Selector */}
      <div className="absolute bottom-3 left-3 z-20 flex items-center gap-2 bg-white/95 backdrop-blur-md border border-slate-200 px-2.5 py-1 rounded-lg shadow-sm text-xs text-slate-700 select-none">
        <span className="text-[11px] font-medium text-slate-500">
          רשת הצמדה:
        </span>
        <select
          value={gridSnapStepMm}
          onChange={(e) => setGridSnapStepMm(Number(e.target.value))}
          className="bg-transparent font-mono font-bold text-slate-800 outline-none cursor-pointer"
        >
          <option value={1}>1.0 מ"מ</option>
          <option value={5}>5.0 מ"מ</option>
          <option value={10}>10.0 מ"מ</option>
          <option value={25}>25.0 מ"מ</option>
        </select>
      </div>

      {/* Minimal Empty-State Launcher Pill when Workspace has 0 parts */}
      {parts.length === 0 && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 pointer-events-none z-10">
          <div className="pointer-events-auto bg-white/95 backdrop-blur-md border border-slate-200 rounded-2xl px-4 py-2.5 shadow-lg flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                window.dispatchEvent(
                  new CustomEvent('woodcraft:open-modal', {
                    detail: 'generator',
                  })
                )
              }
              className="bg-amber-500 hover:bg-amber-600 text-white font-bold py-1.5 px-3 rounded-lg text-xs flex items-center gap-1.5 transition cursor-pointer"
            >
              <IconAiBlueprint size={15} />
              <span>מחולל מוצרים</span>
            </button>

            <button
              type="button"
              onClick={() =>
                window.dispatchEvent(
                  new CustomEvent('woodcraft:open-modal', {
                    detail: 'templates',
                  })
                )
              }
              className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold py-1.5 px-3 rounded-lg text-xs flex items-center gap-1.5 transition cursor-pointer"
            >
              <IconTemplatesGrid size={15} />
              <span>תבניות מוכנות</span>
            </button>

            <button
              type="button"
              onClick={() => addPartFromStock('pine-5x10')}
              className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-semibold py-1.5 px-3 rounded-lg text-xs flex items-center gap-1 transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 text-amber-600" />
              <span>קורת עץ חדשה</span>
            </button>
          </div>
        </div>
      )}

      {/* Small Unobtrusive Corner Alert Pill */}
      {!activeNotePart && totalAlertsCount > 0 && !pillDismissed && (
        <div className="absolute bottom-3 right-3 z-20 flex items-center gap-1.5 bg-white/95 backdrop-blur-md border border-amber-300 text-slate-800 px-3 py-1.5 rounded-full shadow-md text-xs">
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
            className="flex items-center gap-1.5 hover:text-amber-600 font-bold cursor-pointer"
          >
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
            <span>{totalAlertsCount} התראות הנדסיות</span>
          </button>
          <button
            type="button"
            onClick={() => setPillDismissed(true)}
            className="text-slate-400 hover:text-slate-700 p-0.5 rounded-full cursor-pointer mr-1"
            title="הסתר"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* On-Demand Note Popover Card */}
      {activeNotePart &&
        (activeNoteLoad || activeNoteCollisions.length > 0) && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 max-w-md w-[92%] bg-white border border-slate-200 rounded-2xl shadow-2xl p-4 space-y-3 text-xs text-slate-800">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div className="flex items-center gap-2 font-bold text-sm text-slate-900">
                <span className="bg-amber-500 text-white font-mono px-2 py-0.5 rounded text-xs">
                  {partIdToLabel[activeNotePart.id] || '?'}
                </span>
                <span>{activeNotePart.name}</span>
              </div>
              <button
                type="button"
                onClick={() => setActiveNotePartId(null)}
                className="bg-slate-100 hover:bg-slate-200 text-slate-600 p-1 rounded-lg transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {activeNoteLoad &&
              (activeNoteLoad.severity === 'critical' ||
                activeNoteLoad.severity === 'warning') && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 space-y-2 text-red-900">
                  <div className="flex items-center justify-between">
                    <span className="font-bold flex items-center gap-1.5 text-red-700">
                      <ShieldAlert className="w-4 h-4 text-red-600" />
                      התראת עומסים וכפיפה
                    </span>
                    <span className="bg-white border border-red-200 px-2 py-0.5 rounded font-mono text-[11px]">
                      שקיעה: {activeNoteLoad.deflectionMm} מ"מ
                    </span>
                  </div>
                  <p className="leading-relaxed text-red-800">
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
                      className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer"
                    >
                      <RotateCw className="w-3.5 h-3.5" />
                      סובב קורה ב-90° על דופנה
                    </button>
                  )}
                </div>
              )}

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
                  className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-2 text-amber-950"
                >
                  <div className="flex items-center gap-1.5 font-bold text-amber-800">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    <span>מפגש עם הקורה "{otherName}"</span>
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
                      className="flex-1 bg-amber-500 hover:bg-amber-600 text-white font-bold py-1.5 rounded-lg flex items-center justify-center gap-1 transition cursor-pointer"
                    >
                      <Scissors className="w-3.5 h-3.5" />
                      מגרעת חצי-חצי (Half-Lap)
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
                      className="flex-1 bg-white hover:bg-slate-50 text-slate-800 border border-amber-300 font-bold py-1.5 rounded-lg transition cursor-pointer"
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
