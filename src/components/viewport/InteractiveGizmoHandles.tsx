import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { ThreeEvent, useThree } from '@react-three/fiber';
import { Html, Line } from '@react-three/drei';
import { Part, PivotAnchor } from '../../types/woodcraft';
import { useProjectStore } from '../../store/useProjectStore';
import { getStockById } from '../../data/stockLibrary';
import {
  getPartQuaternion,
  getPartWorldBounds,
  getPivotWorldPosition,
  resolvePartLengths,
} from '../../utils/geometryAndEngineering';

interface Props {
  part: Part;
  setOrbitEnabled: (enabled: boolean) => void;
}

type StretchSide = 'length-start' | 'length-end' | 'width-start' | 'width-end';

type DragState =
  | {
      kind: 'translate-axis';
      axis: 'x' | 'y' | 'z';
      startWorldPoint: THREE.Vector3;
      initialPartPos: [number, number, number];
      plane: THREE.Plane;
    }
  | {
      kind: 'stretch';
      side: StretchSide;
      axisVec: THREE.Vector3;
      startWorldPoint: THREE.Vector3;
      initialDim: number;
      plane: THREE.Plane;
    }
  | {
      kind: 'rotate-axis';
      axis: 'x' | 'y' | 'z';
      pivotWorld: THREE.Vector3;
      startAngleRad: number;
      initialRotation: [number, number, number];
      plane: THREE.Plane;
      uVec: THREE.Vector3;
      vVec: THREE.Vector3;
    };

export const InteractiveGizmoHandles: React.FC<Props> = ({
  part,
  setOrbitEnabled,
}) => {
  const { camera, gl } = useThree();
  const gizmoMode = useProjectStore((s) => s.gizmoMode);
  const movePartWithSnap = useProjectStore((s) => s.movePartWithSnap);
  const stretchPartSide = useProjectStore((s) => s.stretchPartSide);
  const rotatePartWithPivot = useProjectStore((s) => s.rotatePartWithPivot);
  const setPartPivot = useProjectStore((s) => s.setPartPivot);
  const dropSelectedToFloor = useProjectStore((s) => s.dropSelectedToFloor);
  const pushHistory = useProjectStore((s) => s.pushHistory);
  const setActiveSnapLines = useProjectStore((s) => s.setActiveSnapLines);
  const angleSnapDeg = useProjectStore((s) => s.angleSnapDeg);
  const unitMode = useProjectStore((s) => s.unitMode);

  const [dragState, setDragState] = useState<DragState | null>(null);
  const [liveBadge, setLiveBadge] = useState<string | null>(null);
  const [showAnchorNodes, setShowAnchorNodes] = useState<boolean>(false);
  const [hoveredStretchSide, setHoveredStretchSide] =
    useState<StretchSide | null>(null);
  const [activeStretchSide, setActiveStretchSide] =
    useState<StretchSide>('length-end');

  // Tinkercad-style inline editable dimension states
  const [editingDim, setEditingDim] = useState<'length' | 'width' | null>(null);
  const [dimInputVal, setDimInputVal] = useState<string>('');

  const partRef = useRef(part);
  partRef.current = part;

  const stock = getStockById(part.stockId);
  const { outerLength } = resolvePartLengths(part);
  const halfL = outerLength / 2;
  const halfT = part.dimensions.thickness / 2;
  const halfW = part.dimensions.width / 2;

  const quat = getPartQuaternion(part.rotation);
  const pivotWorldPos = getPivotWorldPosition(part);
  const bounds = getPartWorldBounds(part);

  const fmtLen = (mm: number) =>
    unitMode === 'cm'
      ? `${(mm / 10).toFixed(1)} ס"מ`
      : `${Math.round(mm)} מ"מ`;

  // Convert any screen (clientX, clientY) into a 3D plane intersection
  const intersectPlaneAtClientXY = (
    plane: THREE.Plane,
    clientX: number,
    clientY: number
  ): THREE.Vector3 | null => {
    const rect = gl.domElement.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    const ndcX = ((clientX - rect.left) / rect.width) * 2 - 1;
    const ndcY = -((clientY - rect.top) / rect.height) * 2 + 1;
    const rc = new THREE.Raycaster();
    rc.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera);
    const out = new THREE.Vector3();
    return rc.ray.intersectPlane(plane, out);
  };

  // Global window pointermove / pointerup listener while dragging any handle!
  // This ensures dragging NEVER drops or gets blocked by other beams.
  useEffect(() => {
    if (!dragState) return;

    const onWindowPointerMove = (ev: PointerEvent) => {
      const currentPart = partRef.current;
      const hit = intersectPlaneAtClientXY(
        dragState.plane,
        ev.clientX,
        ev.clientY
      );
      if (!hit) return;

      if (dragState.kind === 'translate-axis') {
        const diff = hit.clone().sub(dragState.startWorldPoint);
        const nextPos: [number, number, number] = [...dragState.initialPartPos];
        if (dragState.axis === 'x') nextPos[0] += diff.x;
        if (dragState.axis === 'y') nextPos[1] += diff.y;
        if (dragState.axis === 'z') nextPos[2] += diff.z;

        movePartWithSnap(currentPart.id, nextPos, false);
        const updatedBounds = getPartWorldBounds({
          ...currentPart,
          position: nextPos,
        });
        if (dragState.axis === 'y') {
          setLiveBadge(
            `▲ גובה מהרצפה: ${fmtLen(Math.max(0, updatedBounds.min[1]))}`
          );
        } else {
          setLiveBadge(
            `הזזה בציר ${dragState.axis.toUpperCase()}: ${fmtLen(
              nextPos[dragState.axis === 'x' ? 0 : 2]
            )}`
          );
        }
      } else if (dragState.kind === 'stretch') {
        const diff = hit.clone().sub(dragState.startWorldPoint);
        const projectedDelta = diff.dot(dragState.axisVec);
        const rawNewDim = dragState.initialDim + projectedDelta;
        const step = ev.shiftKey ? 1 : 5;
        const snappedDim = Math.max(50, Math.round(rawNewDim / step) * step);

        stretchPartSide(currentPart.id, dragState.side, snappedDim, false);
        setLiveBadge(
          `■ ${
            dragState.side.startsWith('length') ? 'אורך קורה' : 'רוחב לוח'
          }: ${fmtLen(snappedDim)}`
        );
      } else if (dragState.kind === 'rotate-axis') {
        const rel = hit.clone().sub(dragState.pivotWorld);
        const curAngleRad = Math.atan2(
          rel.dot(dragState.vVec),
          rel.dot(dragState.uVec)
        );
        let deltaDeg =
          ((curAngleRad - dragState.startAngleRad) * 180) / Math.PI;

        const snapStep = ev.shiftKey ? 1 : angleSnapDeg;
        if (snapStep > 1) {
          deltaDeg = Math.round(deltaDeg / snapStep) * snapStep;
        }

        const axisIdx =
          dragState.axis === 'x' ? 0 : dragState.axis === 'y' ? 1 : 2;
        const nextRot: [number, number, number] = [
          ...dragState.initialRotation,
        ];
        nextRot[axisIdx] =
          (((dragState.initialRotation[axisIdx] + deltaDeg) % 360) + 360) % 360;

        rotatePartWithPivot(currentPart.id, nextRot, false);
        setLiveBadge(
          `↻ סיבוב ${dragState.axis.toUpperCase()} (סביב עוגן 🎯): ${Math.round(
            nextRot[axisIdx]
          )}°`
        );
      }
    };

    const onWindowPointerUp = () => {
      setDragState(null);
      setLiveBadge(null);
      setActiveSnapLines([]);
      setOrbitEnabled(true);
    };

    window.addEventListener('pointermove', onWindowPointerMove);
    window.addEventListener('pointerup', onWindowPointerUp);
    return () => {
      window.removeEventListener('pointermove', onWindowPointerMove);
      window.removeEventListener('pointerup', onWindowPointerUp);
    };
  }, [
    dragState,
    camera,
    gl,
    angleSnapDeg,
    unitMode,
    movePartWithSnap,
    stretchPartSide,
    rotatePartWithPivot,
    setActiveSnapLines,
    setOrbitEnabled,
  ]);

  if (part.locked || !part.visible) return null;

  // Start translating along X, Y (Up/Down), or Z world axis (works from 3D mesh OR HTML overlay button)
  const startAxisTranslateClient = (
    axis: 'x' | 'y' | 'z',
    clientX: number,
    clientY: number,
    stopEvt?: { stopPropagation: () => void }
  ) => {
    stopEvt?.stopPropagation();
    setOrbitEnabled(false);
    pushHistory();

    const axisDir =
      axis === 'x'
        ? new THREE.Vector3(1, 0, 0)
        : axis === 'y'
        ? new THREE.Vector3(0, 1, 0)
        : new THREE.Vector3(0, 0, 1);

    const camDir = new THREE.Vector3();
    camera.getWorldDirection(camDir);
    const sideVec = new THREE.Vector3()
      .crossVectors(axisDir, camDir)
      .normalize();
    const planeNormal = new THREE.Vector3()
      .crossVectors(axisDir, sideVec)
      .normalize();
    if (planeNormal.lengthSq() < 0.01) {
      planeNormal.set(0, 0, 1);
    }

    const origin = new THREE.Vector3(...part.position);
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(
      planeNormal,
      origin
    );
    const hit =
      intersectPlaneAtClientXY(plane, clientX, clientY) || origin.clone();

    setDragState({
      kind: 'translate-axis',
      axis,
      startWorldPoint: hit,
      initialPartPos: [...part.position],
      plane,
    });
  };

  // Start stretching an end face (works from 3D mesh OR Tinkercad HTML square handle!)
  const startStretchClient = (
    side: StretchSide,
    clientX: number,
    clientY: number,
    stopEvt?: { stopPropagation: () => void }
  ) => {
    stopEvt?.stopPropagation();
    setActiveStretchSide(side);
    setEditingDim(null);
    setOrbitEnabled(false);
    pushHistory();

    const isLen = side === 'length-start' || side === 'length-end';
    const dirSign = side === 'length-end' || side === 'width-end' ? 1 : -1;
    const axisVec = (
      isLen ? bounds.axisX.clone() : bounds.axisZ.clone()
    ).multiplyScalar(dirSign);

    const camDir = new THREE.Vector3();
    camera.getWorldDirection(camDir);
    const sideVec = new THREE.Vector3()
      .crossVectors(axisVec, camDir)
      .normalize();
    const planeNormal = new THREE.Vector3()
      .crossVectors(axisVec, sideVec)
      .normalize();
    if (planeNormal.lengthSq() < 0.01) planeNormal.set(0, 1, 0);

    const origin = new THREE.Vector3(...part.position);
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(
      planeNormal,
      origin
    );
    const hit =
      intersectPlaneAtClientXY(plane, clientX, clientY) || origin.clone();

    setDragState({
      kind: 'stretch',
      side,
      axisVec,
      startWorldPoint: hit,
      initialDim: isLen ? part.dimensions.length : part.dimensions.width,
      plane,
    });
  };

  // Start rotating around X, Y, or Z at the selected Anchor / Pivot Point
  const startRotateAxis = (
    axis: 'x' | 'y' | 'z',
    e: ThreeEvent<PointerEvent>
  ) => {
    e.stopPropagation();
    setOrbitEnabled(false);
    pushHistory();

    const normal =
      axis === 'x'
        ? new THREE.Vector3(1, 0, 0)
        : axis === 'y'
        ? new THREE.Vector3(0, 1, 0)
        : new THREE.Vector3(0, 0, 1);

    const uVec =
      axis === 'x'
        ? new THREE.Vector3(0, 1, 0)
        : axis === 'y'
        ? new THREE.Vector3(0, 0, 1)
        : new THREE.Vector3(1, 0, 0);
    const vVec = new THREE.Vector3().crossVectors(normal, uVec).normalize();

    const pivotVec = new THREE.Vector3(...pivotWorldPos);
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(
      normal,
      pivotVec
    );
    const hit =
      intersectPlaneAtClientXY(plane, e.clientX, e.clientY) ||
      pivotVec.clone().add(uVec);
    const rel = hit.clone().sub(pivotVec);
    const startAngleRad = Math.atan2(rel.dot(vVec), rel.dot(uVec));

    setDragState({
      kind: 'rotate-axis',
      axis,
      pivotWorld: pivotVec,
      startAngleRad,
      initialRotation: [...part.rotation],
      plane,
      uVec,
      vVec,
    });
  };

  // Commit Tinkercad direct typed dimension input
  const commitTypedDimension = (dimType: 'length' | 'width') => {
    const parsed = parseFloat(dimInputVal);
    if (!Number.isNaN(parsed) && parsed > 0) {
      const targetMm = unitMode === 'cm' ? parsed * 10 : parsed;
      const side: StretchSide =
        dimType === 'length'
          ? activeStretchSide.startsWith('length')
            ? activeStretchSide
            : 'length-end'
          : activeStretchSide.startsWith('width')
          ? activeStretchSide
          : 'width-end';
      stretchPartSide(part.id, side, targetMm, true);
    }
    setEditingDim(null);
  };

  // Visibility flags: 'tinkercad' mode shows the unified Tinkercad cage all at once!
  const showMoveAndElevation =
    gizmoMode === 'tinkercad' || gizmoMode === 'move';
  const showStretchHandles =
    (gizmoMode === 'tinkercad' || gizmoMode === 'stretch') &&
    stock.category !== 'hardware';
  const showRotationHandles =
    gizmoMode === 'tinkercad' || gizmoMode === 'rotate';

  // Compute handle distances strictly OUTSIDE the part's world bounding box
  const xTipOffset = bounds.size[0] / 2 + 85;
  const yTopOffset = bounds.size[1] / 2 + 80;
  const zTipOffset = bounds.size[2] / 2 + 85;

  const ringRadius = Math.max(
    115,
    Math.min(230, Math.max(outerLength, part.dimensions.width) * 0.25)
  );

  const anchorCandidates: Array<{ label: string; pivot: PivotAnchor }> = [
    { label: 'מרכז החלק', pivot: { x: 0, y: 0, z: 0 } },
    { label: 'קצה שמאל (מרכז)', pivot: { x: -1, y: 0, z: 0 } },
    { label: 'קצה ימין (מרכז)', pivot: { x: 1, y: 0, z: 0 } },
    { label: 'קצה שמאל-תחתון-אחורי', pivot: { x: -1, y: -1, z: -1 } },
    { label: 'קצה שמאל-תחתון-קדמי', pivot: { x: -1, y: -1, z: 1 } },
    { label: 'קצה ימין-תחתון-אחורי', pivot: { x: 1, y: -1, z: -1 } },
    { label: 'קצה ימין-תחתון-קדמי', pivot: { x: 1, y: -1, z: 1 } },
    { label: 'קצה שמאל-עליון', pivot: { x: -1, y: 1, z: 0 } },
    { label: 'קצה ימין-עליון', pivot: { x: 1, y: 1, z: 0 } },
  ];

  const heightFromFloorMm = Math.max(0, Math.round(bounds.min[1]));

  return (
    <group userData={{ isGizmoHandle: true }}>
      {/* =====================================================================
          1. TINKERCAD ELEVATION CONE (▲) & X/Z MOVE ARROWS
         ===================================================================== */}
      {showMoveAndElevation && (
        <group position={part.position} userData={{ isGizmoHandle: true }}>
          {/* Vertical dashed guide line to floor when lifted above Y=0 */}
          {heightFromFloorMm > 2 && (
            <Line
              points={[
                [0, -bounds.size[1] / 2, 0],
                [0, -part.position[1], 0],
              ]}
              color="#22c55e"
              lineWidth={2}
              dashed
              dashSize={18}
              gapSize={12}
              depthTest={false}
              renderOrder={998}
            />
          )}

          {/* Y Axis Up/Down Tinkercad Cone Handle (Always above the top of the part) */}
          <group
            userData={{ isGizmoHandle: true }}
            onPointerDown={(e) =>
              startAxisTranslateClient('y', e.clientX, e.clientY, e)
            }
          >
            <Line
              points={[
                [0, bounds.size[1] / 2, 0],
                [0, yTopOffset, 0],
              ]}
              color="#22c55e"
              lineWidth={3.5}
              depthTest={false}
              renderOrder={999}
            />
            {/* Top Up-Cone (3D mesh with raycast priority) */}
            <mesh
              position={[0, yTopOffset, 0]}
              renderOrder={999}
              userData={{ isGizmoHandle: true }}
            >
              <coneGeometry args={[22, 52, 20]} />
              <meshBasicMaterial color="#22c55e" depthTest={false} />
            </mesh>
            {/* Generous Invisible Hit Cylinder */}
            <mesh
              position={[0, yTopOffset - 25, 0]}
              renderOrder={999}
              userData={{ isGizmoHandle: true }}
            >
              <cylinderGeometry args={[34, 34, 85, 12]} />
              <meshBasicMaterial transparent opacity={0} depthTest={false} />
            </mesh>

            {/* Screen-Space Interactive Tinkercad Elevation Cone Button + Drop to Floor (D) */}
            <Html
              position={[0, yTopOffset + 32, 0]}
              center
              zIndexRange={[30, 0]}
            >
              <div className="flex items-center gap-1 select-none">
                <button
                  type="button"
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    startAxisTranslateClient('y', e.clientX, e.clientY);
                  }}
                  className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-[11px] px-2 py-0.5 rounded-md shadow-lg border border-white flex items-center gap-1 cursor-ns-resize transition"
                  title="גרור למעלה/למטה לשינוי גובה מהרצפה (כמו החרוט בטינקרקאד)"
                >
                  <span>▲</span>
                  <span className="font-mono">{fmtLen(heightFromFloorMm)}</span>
                </button>
                {heightFromFloorMm > 2 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      dropSelectedToFloor();
                    }}
                    className="bg-slate-900/95 hover:bg-amber-500 text-amber-300 hover:text-slate-950 font-bold text-[10px] px-1.5 py-0.5 rounded-md shadow-lg border border-amber-500/60 cursor-pointer transition whitespace-nowrap"
                    title="הנח צמוד לרצפה Y=0 (קיצור מקלדת: D)"
                  >
                    ⬇ רצפה (D)
                  </button>
                )}
              </div>
            </Html>
          </group>

          {/* X Axis Left/Right Handle (Red) */}
          <group
            userData={{ isGizmoHandle: true }}
            onPointerDown={(e) =>
              startAxisTranslateClient('x', e.clientX, e.clientY, e)
            }
          >
            <Line
              points={[
                [bounds.size[0] / 2, 0, 0],
                [xTipOffset, 0, 0],
              ]}
              color="#ef4444"
              lineWidth={3.5}
              depthTest={false}
              renderOrder={999}
            />
            <mesh
              position={[xTipOffset, 0, 0]}
              rotation={[0, 0, -Math.PI / 2]}
              renderOrder={999}
              userData={{ isGizmoHandle: true }}
            >
              <coneGeometry args={[17, 44, 16]} />
              <meshBasicMaterial color="#ef4444" depthTest={false} />
            </mesh>
            <mesh
              position={[(bounds.size[0] / 2 + xTipOffset) / 2, 0, 0]}
              rotation={[0, 0, -Math.PI / 2]}
              renderOrder={999}
              userData={{ isGizmoHandle: true }}
            >
              <cylinderGeometry
                args={[28, 28, Math.max(40, xTipOffset - bounds.size[0] / 2), 12]}
              />
              <meshBasicMaterial transparent opacity={0} depthTest={false} />
            </mesh>
          </group>

          {/* Z Axis Front/Back Handle (Blue) */}
          <group
            userData={{ isGizmoHandle: true }}
            onPointerDown={(e) =>
              startAxisTranslateClient('z', e.clientX, e.clientY, e)
            }
          >
            <Line
              points={[
                [0, 0, bounds.size[2] / 2],
                [0, 0, zTipOffset],
              ]}
              color="#38bdf8"
              lineWidth={3.5}
              depthTest={false}
              renderOrder={999}
            />
            <mesh
              position={[0, 0, zTipOffset]}
              rotation={[Math.PI / 2, 0, 0]}
              renderOrder={999}
              userData={{ isGizmoHandle: true }}
            >
              <coneGeometry args={[17, 44, 16]} />
              <meshBasicMaterial color="#38bdf8" depthTest={false} />
            </mesh>
            <mesh
              position={[0, 0, (bounds.size[2] / 2 + zTipOffset) / 2]}
              rotation={[Math.PI / 2, 0, 0]}
              renderOrder={999}
              userData={{ isGizmoHandle: true }}
            >
              <cylinderGeometry
                args={[28, 28, Math.max(40, zTipOffset - bounds.size[2] / 2), 12]}
              />
              <meshBasicMaterial transparent opacity={0} depthTest={false} />
            </mesh>
          </group>
        </group>
      )}

      {/* =====================================================================
          2. TINKERCAD STRETCH SQUARES (■) + LIVE EDITABLE DIMENSION RULER BOX
         ===================================================================== */}
      {showStretchHandles && (
        <group
          position={part.position}
          quaternion={quat}
          userData={{ isGizmoHandle: true }}
        >
          {/* End +X Stretch Handle (3D Mesh + Unblockable DOM Tinkercad Square ■) */}
          <mesh
            position={[halfL + 16, 0, 0]}
            userData={{ isGizmoHandle: true }}
            onPointerOver={(e) => {
              e.stopPropagation();
              setHoveredStretchSide('length-end');
            }}
            onPointerOut={() => setHoveredStretchSide(null)}
            onPointerDown={(e) =>
              startStretchClient('length-end', e.clientX, e.clientY, e)
            }
            renderOrder={999}
          >
            <boxGeometry
              args={[28, Math.max(32, halfT * 1.15), Math.max(36, halfW * 0.8)]}
            />
            <meshBasicMaterial
              color={
                hoveredStretchSide === 'length-end' ? '#ef4444' : '#f59e0b'
              }
              depthTest={false}
            />
          </mesh>

          <Html position={[halfL + 20, 0, 0]} center zIndexRange={[35, 0]}>
            <button
              type="button"
              onPointerEnter={() => setHoveredStretchSide('length-end')}
              onPointerLeave={() => setHoveredStretchSide(null)}
              onPointerDown={(e) => {
                e.stopPropagation();
                startStretchClient('length-end', e.clientX, e.clientY);
              }}
              className={`w-6 h-6 rounded shadow-xl border-2 flex items-center justify-center font-extrabold text-[11px] cursor-ew-resize select-none transition ${
                hoveredStretchSide === 'length-end' ||
                (dragState?.kind === 'stretch' &&
                  dragState.side === 'length-end')
                  ? 'bg-amber-400 text-slate-950 border-white scale-125'
                  : 'bg-white text-slate-950 border-slate-900 hover:bg-amber-300'
              }`}
              title="גרור להארכת/קיצור קצה הקורה (או לחץ על המידה להקלדת אורך מדויק)"
            >
              ↔
            </button>
          </Html>

          {/* Start -X Stretch Handle (3D Mesh + Unblockable DOM Tinkercad Square ■) */}
          <mesh
            position={[-halfL - 16, 0, 0]}
            userData={{ isGizmoHandle: true }}
            onPointerOver={(e) => {
              e.stopPropagation();
              setHoveredStretchSide('length-start');
            }}
            onPointerOut={() => setHoveredStretchSide(null)}
            onPointerDown={(e) =>
              startStretchClient('length-start', e.clientX, e.clientY, e)
            }
            renderOrder={999}
          >
            <boxGeometry
              args={[28, Math.max(32, halfT * 1.15), Math.max(36, halfW * 0.8)]}
            />
            <meshBasicMaterial
              color={
                hoveredStretchSide === 'length-start' ? '#ef4444' : '#f59e0b'
              }
              depthTest={false}
            />
          </mesh>

          <Html position={[-halfL - 20, 0, 0]} center zIndexRange={[35, 0]}>
            <button
              type="button"
              onPointerEnter={() => setHoveredStretchSide('length-start')}
              onPointerLeave={() => setHoveredStretchSide(null)}
              onPointerDown={(e) => {
                e.stopPropagation();
                startStretchClient('length-start', e.clientX, e.clientY);
              }}
              className={`w-6 h-6 rounded shadow-xl border-2 flex items-center justify-center font-extrabold text-[11px] cursor-ew-resize select-none transition ${
                hoveredStretchSide === 'length-start' ||
                (dragState?.kind === 'stretch' &&
                  dragState.side === 'length-start')
                  ? 'bg-amber-400 text-slate-950 border-white scale-125'
                  : 'bg-white text-slate-950 border-slate-900 hover:bg-amber-300'
              }`}
              title="גרור להארכת/קיצור קצה הקורה (או לחץ על המידה להקלדת אורך מדויק)"
            >
              ↔
            </button>
          </Html>

          {/* Tinkercad Dimension Extension Line & Click-to-Type Length Box */}
          <Line
            points={[
              [-halfL, -halfT - 14, halfW + 28],
              [halfL, -halfT - 14, halfW + 28],
            ]}
            color="#f59e0b"
            lineWidth={2}
            depthTest={false}
            renderOrder={998}
          />
          <Html
            position={[0, -halfT - 18, halfW + 34]}
            center
            zIndexRange={[35, 0]}
          >
            {editingDim === 'length' ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  commitTypedDimension('length');
                }}
                onPointerDown={(e) => e.stopPropagation()}
                className="flex items-center gap-1 bg-white text-slate-950 px-1.5 py-0.5 rounded-md shadow-2xl border-2 border-amber-500"
              >
                <input
                  type="number"
                  step="any"
                  autoFocus
                  value={dimInputVal}
                  onChange={(e) => setDimInputVal(e.target.value)}
                  onBlur={() => commitTypedDimension('length')}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') setEditingDim(null);
                  }}
                  className="w-16 text-xs font-mono font-extrabold text-center bg-transparent outline-none"
                />
                <span className="text-[10px] font-bold text-slate-600">
                  {unitMode === 'cm' ? 'ס"מ' : 'מ"מ'}
                </span>
              </form>
            ) : (
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  setDimInputVal(
                    unitMode === 'cm'
                      ? (part.dimensions.length / 10).toFixed(1)
                      : String(Math.round(part.dimensions.length))
                  );
                  setEditingDim('length');
                }}
                className="bg-white hover:bg-amber-100 text-slate-950 font-mono font-extrabold text-[11px] px-2 py-0.5 rounded shadow-xl border-2 border-slate-900 hover:border-amber-500 whitespace-nowrap cursor-pointer transition select-none"
                title="לחץ להקלדת אורך מדויק (בדיוק כמו בטינקרקאד!)"
              >
                {fmtLen(part.dimensions.length)} ✎
              </button>
            )}
          </Html>

          {/* Sheet Goods also have Width (+Z / -Z) Tinkercad Stretch Squares & Editable Width Box */}
          {stock.category === 'sheet' && (
            <>
              <mesh
                position={[0, 0, halfW + 16]}
                userData={{ isGizmoHandle: true }}
                onPointerDown={(e) =>
                  startStretchClient('width-end', e.clientX, e.clientY, e)
                }
                renderOrder={999}
              >
                <boxGeometry
                  args={[
                    Math.max(44, halfL * 0.4),
                    Math.max(28, halfT * 1.15),
                    26,
                  ]}
                />
                <meshBasicMaterial color="#fb923c" depthTest={false} />
              </mesh>
              <Html position={[0, 0, halfW + 20]} center zIndexRange={[35, 0]}>
                <button
                  type="button"
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    startStretchClient('width-end', e.clientX, e.clientY);
                  }}
                  className="w-6 h-6 rounded shadow-xl border-2 bg-white hover:bg-amber-300 text-slate-950 border-slate-900 flex items-center justify-center font-extrabold text-[11px] cursor-ns-resize select-none"
                  title="גרור לשינוי רוחב הלוח"
                >
                  ↕
                </button>
              </Html>

              <mesh
                position={[0, 0, -halfW - 16]}
                userData={{ isGizmoHandle: true }}
                onPointerDown={(e) =>
                  startStretchClient('width-start', e.clientX, e.clientY, e)
                }
                renderOrder={999}
              >
                <boxGeometry
                  args={[
                    Math.max(44, halfL * 0.4),
                    Math.max(28, halfT * 1.15),
                    26,
                  ]}
                />
                <meshBasicMaterial color="#fb923c" depthTest={false} />
              </mesh>
              <Html position={[0, 0, -halfW - 20]} center zIndexRange={[35, 0]}>
                <button
                  type="button"
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    startStretchClient('width-start', e.clientX, e.clientY);
                  }}
                  className="w-6 h-6 rounded shadow-xl border-2 bg-white hover:bg-amber-300 text-slate-950 border-slate-900 flex items-center justify-center font-extrabold text-[11px] cursor-ns-resize select-none"
                  title="גרור לשינוי רוחב הלוח"
                >
                  ↕
                </button>
              </Html>

              {/* Editable Width Box for Sheet Goods */}
              <Html
                position={[halfL + 34, -halfT - 18, 0]}
                center
                zIndexRange={[35, 0]}
              >
                {editingDim === 'width' ? (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      commitTypedDimension('width');
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
                    className="flex items-center gap-1 bg-white text-slate-950 px-1.5 py-0.5 rounded-md shadow-2xl border-2 border-amber-500"
                  >
                    <input
                      type="number"
                      step="any"
                      autoFocus
                      value={dimInputVal}
                      onChange={(e) => setDimInputVal(e.target.value)}
                      onBlur={() => commitTypedDimension('width')}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') setEditingDim(null);
                      }}
                      className="w-16 text-xs font-mono font-extrabold text-center bg-transparent outline-none"
                    />
                    <span className="text-[10px] font-bold text-slate-600">
                      {unitMode === 'cm' ? 'ס"מ' : 'מ"מ'}
                    </span>
                  </form>
                ) : (
                  <button
                    type="button"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      setDimInputVal(
                        unitMode === 'cm'
                          ? (part.dimensions.width / 10).toFixed(1)
                          : String(Math.round(part.dimensions.width))
                      );
                      setEditingDim('width');
                    }}
                    className="bg-white hover:bg-amber-100 text-slate-950 font-mono font-extrabold text-[11px] px-2 py-0.5 rounded shadow-xl border-2 border-slate-900 hover:border-amber-500 whitespace-nowrap cursor-pointer transition select-none"
                    title="לחץ להקלדת רוחב לוח מדויק"
                  >
                    רוחב: {fmtLen(part.dimensions.width)} ✎
                  </button>
                )}
              </Html>
            </>
          )}
        </group>
      )}

      {/* =====================================================================
          3. ROTATION PROTRACTOR RINGS & WOODWORKING PIVOT ANCHOR (🎯)
         ===================================================================== */}
      {showRotationHandles && (
        <>
          {showAnchorNodes && (
            <group
              position={part.position}
              quaternion={quat}
              userData={{ isGizmoHandle: true }}
            >
              {anchorCandidates.map((cand, idx) => {
                const isCurrent =
                  cand.pivot.x === part.pivot.x &&
                  cand.pivot.y === part.pivot.y &&
                  cand.pivot.z === part.pivot.z;
                return (
                  <mesh
                    key={idx}
                    userData={{ isGizmoHandle: true }}
                    position={[
                      cand.pivot.x * halfL,
                      cand.pivot.y * halfT,
                      cand.pivot.z * halfW,
                    ]}
                    onClick={(e) => {
                      e.stopPropagation();
                      setPartPivot(part.id, cand.pivot);
                    }}
                    renderOrder={999}
                  >
                    <sphereGeometry args={[isCurrent ? 20 : 14, 16, 16]} />
                    <meshBasicMaterial
                      color={isCurrent ? '#ec4899' : '#fde047'}
                      depthTest={false}
                    />
                  </mesh>
                );
              })}
            </group>
          )}

          <group position={pivotWorldPos} userData={{ isGizmoHandle: true }}>
            <mesh
              userData={{ isGizmoHandle: true }}
              onClick={(e) => {
                e.stopPropagation();
                setShowAnchorNodes((v) => !v);
              }}
              renderOrder={999}
            >
              <sphereGeometry args={[15, 20, 20]} />
              <meshBasicMaterial color="#ec4899" depthTest={false} />
            </mesh>

            {/* X Axis Rotation Ring (Red) */}
            <mesh
              userData={{ isGizmoHandle: true }}
              rotation={[0, Math.PI / 2, 0]}
              onPointerDown={(e) => startRotateAxis('x', e)}
              renderOrder={999}
            >
              <torusGeometry args={[ringRadius, 6.5, 12, 48]} />
              <meshBasicMaterial
                color="#ef4444"
                transparent
                opacity={gizmoMode === 'rotate' ? 0.92 : 0.65}
                depthTest={false}
              />
            </mesh>

            {/* Y Axis Rotation Ring (Green) */}
            <mesh
              userData={{ isGizmoHandle: true }}
              rotation={[Math.PI / 2, 0, 0]}
              onPointerDown={(e) => startRotateAxis('y', e)}
              renderOrder={999}
            >
              <torusGeometry args={[ringRadius * 1.1, 6.5, 12, 48]} />
              <meshBasicMaterial
                color="#22c55e"
                transparent
                opacity={gizmoMode === 'rotate' ? 0.92 : 0.65}
                depthTest={false}
              />
            </mesh>

            {/* Z Axis Rotation Ring (Blue) */}
            <mesh
              userData={{ isGizmoHandle: true }}
              rotation={[0, 0, 0]}
              onPointerDown={(e) => startRotateAxis('z', e)}
              renderOrder={999}
            >
              <torusGeometry args={[ringRadius * 0.9, 6.5, 12, 48]} />
              <meshBasicMaterial
                color="#38bdf8"
                transparent
                opacity={gizmoMode === 'rotate' ? 0.92 : 0.65}
                depthTest={false}
              />
            </mesh>

            <Html position={[0, -34, 0]} center zIndexRange={[25, 0]}>
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  setShowAnchorNodes((v) => !v);
                }}
                className="bg-pink-950/90 hover:bg-pink-800 text-pink-200 border border-pink-500/60 px-2 py-0.5 rounded-full text-[10px] font-medium whitespace-nowrap shadow cursor-pointer select-none"
              >
                🎯 עוגן סיבוב {showAnchorNodes ? '(בחר נקודה צהובה)' : '(שנה)'}
              </button>
            </Html>
          </group>
        </>
      )}

      {/* Clean Compact Drag Readout Tooltip */}
      {liveBadge && (
        <Html
          position={[part.position[0], bounds.max[1] + 115, part.position[2]]}
          center
          zIndexRange={[40, 0]}
        >
          <div className="bg-amber-400 text-slate-950 font-extrabold font-mono text-xs px-3 py-1 rounded-lg shadow-2xl border-2 border-slate-950 whitespace-nowrap pointer-events-none">
            {liveBadge}
          </div>
        </Html>
      )}
    </group>
  );
};
