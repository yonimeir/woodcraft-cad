import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { Html, Line } from '@react-three/drei';
import { Part } from '../../types/woodcraft';
import { useProjectStore } from '../../store/useProjectStore';
import { getStockById } from '../../data/stockLibrary';
import {
  getPartQuaternion,
  getPartWorldBounds,
  getPivotWorldPosition,
  resolvePartLengths,
} from '../../utils/geometryAndEngineering';
import { IconPivotTarget } from '../icons/WoodCraftIcons';

interface Props {
  part: Part;
  setOrbitEnabled: (enabled: boolean) => void;
}

type StretchSide = 'length-start' | 'length-end' | 'width-start' | 'width-end';

type DragState =
  | {
      kind: 'translate-y';
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
    }
  | {
      kind: 'drag-pivot';
      plane: THREE.Plane;
    };

/** Crisp SVG Double-Headed Curved Rotation Arrow Icon */
const CurvedRotateSvg: React.FC = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.3"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M4 15C4 9.5 8.5 5 14 5H19" />
    <path d="M16 2L19.5 5L16 8" />
    <path d="M1 12L4 15.5L7 12" />
  </svg>
);

export const InteractiveGizmoHandles: React.FC<Props> = ({
  part,
  setOrbitEnabled,
}) => {
  const { camera, gl } = useThree();
  const partEditMode = useProjectStore((s) => s.partEditMode);
  const movePartWithSnap = useProjectStore((s) => s.movePartWithSnap);
  const stretchPartSide = useProjectStore((s) => s.stretchPartSide);
  const rotatePartWithPivot = useProjectStore((s) => s.rotatePartWithPivot);
  const setPartPivot = useProjectStore((s) => s.setPartPivot);
  const pushHistory = useProjectStore((s) => s.pushHistory);
  const setActiveSnapLines = useProjectStore((s) => s.setActiveSnapLines);
  const angleSnapDeg = useProjectStore((s) => s.angleSnapDeg);
  const unitMode = useProjectStore((s) => s.unitMode);

  const [dragState, setDragState] = useState<DragState | null>(null);
  const [liveBadge, setLiveBadge] = useState<string | null>(null);
  const [coneHovered, setConeHovered] = useState(false);
  const [hoveredStretchSide, setHoveredStretchSide] =
    useState<StretchSide | null>(null);
  const [activeStretchSide, setActiveStretchSide] =
    useState<StretchSide>('length-end');
  const [hoveredArc, setHoveredArc] = useState<'x' | 'y' | 'z' | null>(null);

  // Inline dimension typing (Tinkercad style)
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

  const fmtVal = (mm: number) =>
    unitMode === 'cm' ? (mm / 10).toFixed(1) : `${Math.round(mm)}`;
  const unitSuffix = unitMode === 'cm' ? 'ס"מ' : 'מ"מ';

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

  // Window-level drag tracking
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

      if (dragState.kind === 'translate-y') {
        const diffY = hit.y - dragState.startWorldPoint.y;
        const nextPos: [number, number, number] = [
          dragState.initialPartPos[0],
          dragState.initialPartPos[1] + diffY,
          dragState.initialPartPos[2],
        ];
        movePartWithSnap(currentPart.id, nextPos, false);
        const updatedBounds = getPartWorldBounds({
          ...currentPart,
          position: nextPos,
        });
        setLiveBadge(
          `Y: ${fmtVal(Math.max(0, updatedBounds.min[1]))} ${unitSuffix}`
        );
      } else if (dragState.kind === 'stretch') {
        const diff = hit.clone().sub(dragState.startWorldPoint);
        const projectedDelta = diff.dot(dragState.axisVec);
        const rawNewDim = dragState.initialDim + projectedDelta;
        const step = ev.shiftKey ? 1 : 5;
        const snappedDim = Math.max(50, Math.round(rawNewDim / step) * step);

        stretchPartSide(currentPart.id, dragState.side, snappedDim, false);
        setLiveBadge(`${fmtVal(snappedDim)} ${unitSuffix}`);
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
          `${dragState.axis.toUpperCase()}: ${Math.round(nextRot[axisIdx])}°`
        );
      } else if (dragState.kind === 'drag-pivot') {
        const invQuat = getPartQuaternion(currentPart.rotation)
          .clone()
          .invert();
        const localVec = hit
          .clone()
          .sub(new THREE.Vector3(...currentPart.position))
          .applyQuaternion(invQuat);

        const curLen = resolvePartLengths(currentPart).outerLength;
        const hL = Math.max(1, curLen / 2);
        const hT = Math.max(1, currentPart.dimensions.thickness / 2);
        const hW = Math.max(1, currentPart.dimensions.width / 2);

        const snapCoord = (val: number) => {
          const clamped = Math.max(-1, Math.min(1, val));
          if (!ev.shiftKey) {
            if (Math.abs(clamped - -1) < 0.22) return -1;
            if (Math.abs(clamped) < 0.22) return 0;
            if (Math.abs(clamped - 1) < 0.22) return 1;
          }
          return Math.round(clamped * 20) / 20;
        };

        const nx = snapCoord(localVec.x / hL);
        const ny = snapCoord(localVec.y / hT);
        const nz = snapCoord(localVec.z / hW);
        setPartPivot(currentPart.id, { x: nx, y: ny, z: nz });
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
    setPartPivot,
    setActiveSnapLines,
    setOrbitEnabled,
  ]);

  // Build smooth curved arc points outside the beam's bounding box for X (Blue), Y (Black), Z (Red)
  const rotationArcs = useMemo(() => {
    const r = 68;
    const steps = 20;
    const aStart = -Math.PI * 0.28;
    const aEnd = Math.PI * 0.28;

    // 1. X-Axis Arc (BLUE #2563eb): positioned outside +X end, curving in YZ plane
    const xBase = bounds.size[0] / 2 + 40;
    const xPts: Array<[number, number, number]> = [];
    for (let i = 0; i <= steps; i++) {
      const a = aStart + ((aEnd - aStart) * i) / steps;
      xPts.push([xBase, Math.sin(a) * r, Math.cos(a) * r]);
    }
    const xMid: [number, number, number] = [xBase, 0, r];

    // 2. Y-Axis Arc (BLACK #0f172a): positioned outside +X/+Z corner on horizontal plane, curving in XZ plane
    const yBase = -bounds.size[1] / 2 + 4;
    const cornerX = bounds.size[0] / 2 + 12;
    const cornerZ = bounds.size[2] / 2 + 12;
    const yPts: Array<[number, number, number]> = [];
    for (let i = 0; i <= steps; i++) {
      const a = 0.12 + ((Math.PI / 2 - 0.24) * i) / steps;
      yPts.push([
        cornerX + Math.cos(a) * r,
        yBase,
        cornerZ + Math.sin(a) * r,
      ]);
    }
    const yMid: [number, number, number] = [
      cornerX + Math.cos(Math.PI / 4) * r,
      yBase,
      cornerZ + Math.sin(Math.PI / 4) * r,
    ];

    // 3. Z-Axis Arc (RED #dc2626): positioned outside +Z front face, curving in XY plane
    const zBase = bounds.size[2] / 2 + 40;
    const zPts: Array<[number, number, number]> = [];
    for (let i = 0; i <= steps; i++) {
      const a = aStart + ((aEnd - aStart) * i) / steps;
      zPts.push([Math.cos(a) * r, Math.sin(a) * r, zBase]);
    }
    const zMid: [number, number, number] = [r, 0, zBase];

    return {
      x: { points: xPts, mid: xMid, color: '#2563eb', label: 'X' },
      y: { points: yPts, mid: yMid, color: '#0f172a', label: 'Y' },
      z: { points: zPts, mid: zMid, color: '#dc2626', label: 'Z' },
    };
  }, [bounds.size]);

  if (part.locked || !part.visible) return null;

  // Start Y-Elevation drag from the Tinkercad top cone (Black = Y Axis)
  const startElevateY = (
    clientX: number,
    clientY: number,
    stopEvt?: { stopPropagation: () => void }
  ) => {
    stopEvt?.stopPropagation();
    setOrbitEnabled(false);
    pushHistory();

    const axisDir = new THREE.Vector3(0, 1, 0);
    const camDir = new THREE.Vector3();
    camera.getWorldDirection(camDir);
    const sideVec = new THREE.Vector3()
      .crossVectors(axisDir, camDir)
      .normalize();
    const planeNormal = new THREE.Vector3()
      .crossVectors(axisDir, sideVec)
      .normalize();
    if (planeNormal.lengthSq() < 0.01) planeNormal.set(0, 0, 1);

    const origin = new THREE.Vector3(...part.position);
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(
      planeNormal,
      origin
    );
    const hit =
      intersectPlaneAtClientXY(plane, clientX, clientY) || origin.clone();

    setDragState({
      kind: 'translate-y',
      startWorldPoint: hit,
      initialPartPos: [...part.position],
      plane,
    });
  };

  // Start stretching an end/side via Tinkercad square handle
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

  // Start rotating around X (Blue), Y (Black), or Z (Red) at the selected Anchor / Pivot Point
  const startRotateAxisClient = (
    axis: 'x' | 'y' | 'z',
    clientX: number,
    clientY: number,
    stopEvt?: { stopPropagation: () => void }
  ) => {
    stopEvt?.stopPropagation();
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
      intersectPlaneAtClientXY(plane, clientX, clientY) ||
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

  // Start dragging the Photoshop/Illustrator Pivot Reticle directly in 3D space
  const startDragPivot = (e: React.PointerEvent) => {
    e.stopPropagation();
    setOrbitEnabled(false);

    const camDir = new THREE.Vector3();
    camera.getWorldDirection(camDir);
    const pivotVec = new THREE.Vector3(...pivotWorldPos);
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(
      camDir,
      pivotVec
    );
    setDragState({ kind: 'drag-pivot', plane });
  };

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

  const yConeOffset = bounds.size[1] / 2 + 56;
  const heightFromFloorMm = Math.max(0, Math.round(bounds.min[1]));

  return (
    <group userData={{ isGizmoHandle: true }}>
      {/* =====================================================================
          STAGE 1: SINGLE-CLICK MODE ('move')
          - Black Y-Elevation Cone above part
          - 3 Well-Separated Color-Coded Curved Rotation Arrows:
            * X Axis = Blue (#2563eb)
            * Y Axis = Black (#0f172a)
            * Z Axis = Red (#dc2626)
          - Draggable Photoshop/Illustrator Pivot Reticle
         ===================================================================== */}
      {partEditMode === 'move' && (
        <>
          <group position={part.position} userData={{ isGizmoHandle: true }}>
            {/* Subtle vertical dashed line to floor when elevated (Black for Y-axis) */}
            {(heightFromFloorMm > 2 || dragState?.kind === 'translate-y') && (
              <Line
                points={[
                  [0, -bounds.size[1] / 2, 0],
                  [0, -part.position[1], 0],
                ]}
                color="#0f172a"
                lineWidth={1.6}
                dashed
                dashSize={12}
                gapSize={10}
                depthTest={false}
                renderOrder={998}
              />
            )}

            {/* Tinkercad Top Elevation Cone (Black #0f172a for Y-Axis) */}
            <group
              userData={{ isGizmoHandle: true }}
              onPointerOver={(e) => {
                e.stopPropagation();
                setConeHovered(true);
              }}
              onPointerOut={() => setConeHovered(false)}
              onPointerDown={(e) => startElevateY(e.clientX, e.clientY, e)}
            >
              <Line
                points={[
                  [0, bounds.size[1] / 2 + 6, 0],
                  [0, yConeOffset - 14, 0],
                ]}
                color={
                  coneHovered || dragState?.kind === 'translate-y'
                    ? '#f59e0b'
                    : '#0f172a'
                }
                lineWidth={2.2}
                depthTest={false}
                renderOrder={999}
              />
              <mesh
                position={[0, yConeOffset, 0]}
                renderOrder={999}
                userData={{ isGizmoHandle: true }}
              >
                <coneGeometry args={[13, 30, 20]} />
                <meshBasicMaterial
                  color={
                    coneHovered || dragState?.kind === 'translate-y'
                      ? '#f59e0b'
                      : '#0f172a'
                  }
                  depthTest={false}
                />
              </mesh>
              <mesh
                position={[0, yConeOffset - 12, 0]}
                renderOrder={999}
                userData={{ isGizmoHandle: true }}
              >
                <cylinderGeometry args={[24, 24, 54, 12]} />
                <meshBasicMaterial transparent opacity={0} depthTest={false} />
              </mesh>
            </group>

            {/* 3 Color-Coded Curved Rotation Arrows Outside the Bounding Box:
                X = Blue (#2563eb), Y = Black (#0f172a), Z = Red (#dc2626) */}
            {(['x', 'y', 'z'] as const).map((axis) => {
              const arc = rotationArcs[axis];
              const isActive =
                hoveredArc === axis ||
                (dragState?.kind === 'rotate-axis' && dragState.axis === axis);
              const startPt = arc.points[0];
              const endPt = arc.points[arc.points.length - 1];

              return (
                <group key={axis} userData={{ isGizmoHandle: true }}>
                  {/* Crisp 3D Curved Arc Line */}
                  <Line
                    points={arc.points}
                    color={arc.color}
                    lineWidth={isActive ? 3.8 : 2.6}
                    depthTest={false}
                    renderOrder={999}
                  />
                  {/* End Tip Dots */}
                  <mesh
                    position={startPt}
                    renderOrder={999}
                    userData={{ isGizmoHandle: true }}
                  >
                    <sphereGeometry args={[4, 10, 10]} />
                    <meshBasicMaterial color={arc.color} depthTest={false} />
                  </mesh>
                  <mesh
                    position={endPt}
                    renderOrder={999}
                    userData={{ isGizmoHandle: true }}
                  >
                    <sphereGeometry args={[4, 10, 10]} />
                    <meshBasicMaterial color={arc.color} depthTest={false} />
                  </mesh>

                  {/* Interactive Screen-Space Curved Rotation Handle Badge at Arc Midpoint */}
                  <Html position={arc.mid} center zIndexRange={[32, 0]}>
                    <button
                      type="button"
                      onPointerEnter={() => setHoveredArc(axis)}
                      onPointerLeave={() => setHoveredArc(null)}
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        startRotateAxisClient(axis, e.clientX, e.clientY);
                      }}
                      style={{ backgroundColor: arc.color }}
                      className={`w-6 h-6 rounded-full text-white border-2 border-white shadow-md flex items-center justify-center cursor-grab active:cursor-grabbing transition select-none ${
                        isActive ? 'scale-125 ring-2 ring-amber-400' : 'hover:scale-110'
                      }`}
                      title={`גרור לסיבוב בציר ${arc.label} (${
                        axis === 'x'
                          ? 'כחול'
                          : axis === 'y'
                          ? 'שחור - אופקי'
                          : 'אדום'
                      })`}
                    >
                      <CurvedRotateSvg />
                    </button>
                  </Html>
                </group>
              );
            })}
          </group>

          {/* Photoshop / Illustrator Draggable Pivot Reference Point Reticle */}
          <group position={pivotWorldPos} userData={{ isGizmoHandle: true }}>
            <Html position={[0, 0, 0]} center zIndexRange={[30, 0]}>
              <div
                onPointerDown={startDragPivot}
                className="w-6 h-6 rounded-full bg-white hover:bg-amber-50 text-slate-900 hover:text-amber-600 border-2 border-slate-800 shadow-md flex items-center justify-center cursor-move transition select-none"
                title="נקודת עוגן לסיבוב (גרור למיקום הרצוי על הקורה)"
              >
                <IconPivotTarget size={14} />
              </div>
            </Html>
          </group>
        </>
      )}

      {/* =====================================================================
          STAGE 2: DOUBLE-CLICK MODE ('dimensions')
          Pure Tinkercad White/Black Stretch Squares (■) & Live Clickable Ruler
         ===================================================================== */}
      {partEditMode === 'dimensions' && stock.category !== 'hardware' && (
        <group
          position={part.position}
          quaternion={quat}
          userData={{ isGizmoHandle: true }}
        >
          {/* Dashed Tinkercad Footprint Selection Box */}
          <Line
            points={[
              [-halfL, -halfT, -halfW],
              [halfL, -halfT, -halfW],
              [halfL, -halfT, halfW],
              [-halfL, -halfT, halfW],
              [-halfL, -halfT, -halfW],
            ]}
            color="#2563eb"
            lineWidth={1.6}
            dashed
            dashSize={10}
            gapSize={8}
            depthTest={false}
            renderOrder={998}
          />

          {/* End +X Pure Geometric Stretch Square (■) */}
          <Html position={[halfL, 0, 0]} center zIndexRange={[35, 0]}>
            <button
              type="button"
              onPointerEnter={() => setHoveredStretchSide('length-end')}
              onPointerLeave={() => setHoveredStretchSide(null)}
              onPointerDown={(e) => {
                e.stopPropagation();
                startStretchClient('length-end', e.clientX, e.clientY);
              }}
              className={`w-3.5 h-3.5 border-[1.5px] shadow-sm cursor-ew-resize transition ${
                hoveredStretchSide === 'length-end' ||
                (dragState?.kind === 'stretch' &&
                  dragState.side === 'length-end')
                  ? 'bg-blue-600 border-white scale-125'
                  : 'bg-white border-slate-900 hover:bg-blue-600 hover:border-white'
              }`}
              title="גרור לשינוי אורך הקורה"
            />
          </Html>

          {/* Start -X Pure Geometric Stretch Square (■) */}
          <Html position={[-halfL, 0, 0]} center zIndexRange={[35, 0]}>
            <button
              type="button"
              onPointerEnter={() => setHoveredStretchSide('length-start')}
              onPointerLeave={() => setHoveredStretchSide(null)}
              onPointerDown={(e) => {
                e.stopPropagation();
                startStretchClient('length-start', e.clientX, e.clientY);
              }}
              className={`w-3.5 h-3.5 border-[1.5px] shadow-sm cursor-ew-resize transition ${
                hoveredStretchSide === 'length-start' ||
                (dragState?.kind === 'stretch' &&
                  dragState.side === 'length-start')
                  ? 'bg-blue-600 border-white scale-125'
                  : 'bg-white border-slate-900 hover:bg-blue-600 hover:border-white'
              }`}
              title="גרור לשינוי אורך הקורה"
            />
          </Html>

          {/* Tinkercad Clean Architectural Extension Line & Clickable Dimension Box */}
          <Line
            points={[
              [-halfL, -halfT, halfW + 32],
              [halfL, -halfT, halfW + 32],
            ]}
            color="#2563eb"
            lineWidth={1.6}
            depthTest={false}
            renderOrder={998}
          />
          <Line
            points={[
              [-halfL, -halfT, halfW],
              [-halfL, -halfT, halfW + 38],
            ]}
            color="#64748b"
            lineWidth={1}
            depthTest={false}
            renderOrder={998}
          />
          <Line
            points={[
              [halfL, -halfT, halfW],
              [halfL, -halfT, halfW + 38],
            ]}
            color="#64748b"
            lineWidth={1}
            depthTest={false}
            renderOrder={998}
          />

          <Html
            position={[0, -halfT, halfW + 32]}
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
                className="flex items-center gap-1 bg-white text-slate-900 px-1.5 py-0.5 rounded shadow-lg border-2 border-blue-600"
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
                  className="w-14 text-xs font-mono font-bold text-center bg-transparent outline-none"
                />
              </form>
            ) : (
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  setDimInputVal(fmtVal(part.dimensions.length));
                  setEditingDim('length');
                }}
                className="bg-white hover:bg-blue-50 text-slate-900 font-mono font-bold text-xs px-2 py-0.5 rounded shadow-md border border-blue-600 whitespace-nowrap cursor-pointer transition select-none"
                title="לחץ להקלדת מידה מדויקת"
              >
                {fmtVal(part.dimensions.length)}
              </button>
            )}
          </Html>

          {/* Sheet Goods also have Width (+Z / -Z) Tinkercad Squares & Editable Width Box (Red for Z) */}
          {stock.category === 'sheet' && (
            <>
              <Html position={[0, 0, halfW]} center zIndexRange={[35, 0]}>
                <button
                  type="button"
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    startStretchClient('width-end', e.clientX, e.clientY);
                  }}
                  className="w-3.5 h-3.5 bg-white hover:bg-red-600 border-[1.5px] border-slate-900 hover:border-white shadow-sm cursor-ns-resize transition"
                  title="גרור לשינוי רוחב הלוח"
                />
              </Html>
              <Html position={[0, 0, -halfW]} center zIndexRange={[35, 0]}>
                <button
                  type="button"
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    startStretchClient('width-start', e.clientX, e.clientY);
                  }}
                  className="w-3.5 h-3.5 bg-white hover:bg-red-600 border-[1.5px] border-slate-900 hover:border-white shadow-sm cursor-ns-resize transition"
                  title="גרור לשינוי רוחב הלוח"
                />
              </Html>

              <Line
                points={[
                  [halfL + 32, -halfT, -halfW],
                  [halfL + 32, -halfT, halfW],
                ]}
                color="#dc2626"
                lineWidth={1.6}
                depthTest={false}
                renderOrder={998}
              />

              <Html
                position={[halfL + 32, -halfT, 0]}
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
                    className="flex items-center gap-1 bg-white text-slate-900 px-1.5 py-0.5 rounded shadow-lg border-2 border-red-600"
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
                      className="w-14 text-xs font-mono font-bold text-center bg-transparent outline-none"
                    />
                  </form>
                ) : (
                  <button
                    type="button"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      setDimInputVal(fmtVal(part.dimensions.width));
                      setEditingDim('width');
                    }}
                    className="bg-white hover:bg-red-50 text-slate-900 font-mono font-bold text-xs px-2 py-0.5 rounded shadow-md border border-red-600 whitespace-nowrap cursor-pointer transition select-none"
                    title="לחץ להקלדת רוחב מדויק"
                  >
                    {fmtVal(part.dimensions.width)}
                  </button>
                )}
              </Html>
            </>
          )}
        </group>
      )}

      {/* Minimal Live Readout ONLY while actively dragging */}
      {liveBadge && (
        <Html
          position={[part.position[0], bounds.max[1] + 85, part.position[2]]}
          center
          zIndexRange={[40, 0]}
        >
          <div className="bg-slate-900 text-white font-bold font-mono text-xs px-2.5 py-1 rounded shadow-lg whitespace-nowrap pointer-events-none">
            {liveBadge}
          </div>
        </Html>
      )}
    </group>
  );
};
