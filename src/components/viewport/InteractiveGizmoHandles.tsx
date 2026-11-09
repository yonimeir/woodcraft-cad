import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { ThreeEvent, useThree } from '@react-three/fiber';
import { Edges, Html, Line } from '@react-three/drei';
import { Part } from '../../types/woodcraft';
import { useProjectStore } from '../../store/useProjectStore';
import { getStockById } from '../../data/stockLibrary';
import {
  computeWorldAxisRotation,
  degToRad,
  getPartQuaternion,
  getPartWorldBounds,
  getPivotWorldPosition,
  resolvePartLengths,
  rotateAssemblyAroundWorldPoint,
} from '../../utils/geometryAndEngineering';
import { IconPivotTarget } from '../icons/WoodCraftIcons';

interface Props {
  part: Part;
  setOrbitEnabled: (enabled: boolean) => void;
}

type StretchSide = 'length-start' | 'length-end' | 'width-start' | 'width-end';

type DragState =
  | {
      kind: 'translate-axis';
      axis: 'x' | 'y' | 'z';
      axisVec: THREE.Vector3;
      startWorldPoint: THREE.Vector3;
      initialPartPos: [number, number, number];
      initialAssemblyParts: Part[];
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
      initialAssemblyParts: Part[];
      plane: THREE.Plane;
      uVec: THREE.Vector3;
      vVec: THREE.Vector3;
    }
  | {
      kind: 'drag-pivot';
      plane: THREE.Plane;
    };

/**
 * Builds a Tinkercad-style 3D flat double-headed curved arrow geometry in the XY plane,
 * centered around angle = 0 (from -halfSpan to +halfSpan with pointed arrowheads at both ends).
 */
function createCurvedDoubleArrowGeometry(
  radius: number,
  bandThickness: number,
  halfSpanRad = 0.46,
  headLengthRad = 0.22,
  headWidthMultiplier = 2.35
): THREE.ShapeGeometry {
  const rIn = radius - bandThickness / 2;
  const rOut = radius + bandThickness / 2;
  const rHeadIn = radius - (bandThickness * headWidthMultiplier) / 2;
  const rHeadOut = radius + (bandThickness * headWidthMultiplier) / 2;
  const tipAngle = halfSpanRad + headLengthRad;
  const segs = 24;

  const shape = new THREE.Shape();

  // 1. Start at +tipAngle arrowhead point
  shape.moveTo(Math.cos(tipAngle) * radius, Math.sin(tipAngle) * radius);

  // 2. Outer shoulder of +arrowhead -> outer arc start
  shape.lineTo(
    Math.cos(halfSpanRad) * rHeadOut,
    Math.sin(halfSpanRad) * rHeadOut
  );
  shape.lineTo(Math.cos(halfSpanRad) * rOut, Math.sin(halfSpanRad) * rOut);

  // 3. Trace outer arc from +halfSpanRad down to -halfSpanRad
  for (let i = 1; i <= segs; i++) {
    const a = halfSpanRad - (2 * halfSpanRad * i) / segs;
    shape.lineTo(Math.cos(a) * rOut, Math.sin(a) * rOut);
  }

  // 4. Outer shoulder of -arrowhead -> -tipAngle point -> inner shoulder
  shape.lineTo(
    Math.cos(-halfSpanRad) * rHeadOut,
    Math.sin(-halfSpanRad) * rHeadOut
  );
  shape.lineTo(Math.cos(-tipAngle) * radius, Math.sin(-tipAngle) * radius);
  shape.lineTo(
    Math.cos(-halfSpanRad) * rHeadIn,
    Math.sin(-halfSpanRad) * rHeadIn
  );
  shape.lineTo(Math.cos(-halfSpanRad) * rIn, Math.sin(-halfSpanRad) * rIn);

  // 5. Trace inner arc from -halfSpanRad back up to +halfSpanRad
  for (let i = 1; i <= segs; i++) {
    const a = -halfSpanRad + (2 * halfSpanRad * i) / segs;
    shape.lineTo(Math.cos(a) * rIn, Math.sin(a) * rIn);
  }

  // 6. Inner shoulder of +arrowhead -> close at +tipAngle
  shape.lineTo(
    Math.cos(halfSpanRad) * rHeadIn,
    Math.sin(halfSpanRad) * rHeadIn
  );
  shape.closePath();

  return new THREE.ShapeGeometry(shape, 12);
}

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
  const [hoveredMoveAxis, setHoveredMoveAxis] = useState<'x' | 'y' | 'z' | null>(
    null
  );
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

  // Tinkercad-style 3D Double-Headed Curved Arrow Geometries (Visual + Wide Hit Area)
  const arrowGeometries = useMemo(() => {
    const visual = createCurvedDoubleArrowGeometry(62, 6.5, 0.46, 0.24, 2.4);
    const hit = createCurvedDoubleArrowGeometry(62, 22, 0.55, 0.28, 1.5);
    return { visual, hit };
  }, []);

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

      if (dragState.kind === 'translate-axis') {
        const diff = hit.clone().sub(dragState.startWorldPoint);
        const rawDelta = diff.dot(dragState.axisVec);
        const step = ev.shiftKey ? 0.5 : 1;
        const snappedDelta = Math.round(rawDelta / step) * step;

        const nextPos: [number, number, number] = [
          dragState.initialPartPos[0] + dragState.axisVec.x * snappedDelta,
          dragState.initialPartPos[1] + dragState.axisVec.y * snappedDelta,
          dragState.initialPartPos[2] + dragState.axisVec.z * snappedDelta,
        ];

        if (ev.shiftKey) {
          // Ultra-fine movement bypassing magnetic snap jumps — moves the entire selected group/assembly together!
          const deltaVec = [
            dragState.axisVec.x * snappedDelta,
            dragState.axisVec.y * snappedDelta,
            dragState.axisVec.z * snappedDelta,
          ];
          const initMap = new Map(
            dragState.initialAssemblyParts.map((ap) => [ap.id, ap.position])
          );
          const storeState = useProjectStore.getState();
          const nextParts = storeState.parts.map((p) => {
            const initPos = initMap.get(p.id);
            if (!initPos || p.locked) return p;
            return {
              ...p,
              position: [
                Math.round((initPos[0] + deltaVec[0]) * 10) / 10,
                Math.max(5, Math.round((initPos[1] + deltaVec[1]) * 10) / 10),
                Math.round((initPos[2] + deltaVec[2]) * 10) / 10,
              ] as [number, number, number],
            };
          });
          useProjectStore.setState({ parts: nextParts, activeSnapLines: [] });
        } else {
          movePartWithSnap(currentPart.id, nextPos, false);
        }

        const sign = snappedDelta > 0 ? '+' : '';
        setLiveBadge(
          `ציר ${dragState.axis.toUpperCase()}: ${sign}${fmtVal(snappedDelta)} ${unitSuffix}`
        );
      } else if (dragState.kind === 'stretch') {
        const diff = hit.clone().sub(dragState.startWorldPoint);
        const projectedDelta = diff.dot(dragState.axisVec);
        const rawNewDim = dragState.initialDim + projectedDelta;
        const step = ev.shiftKey ? 0.5 : 1;
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

        // Shift = 0.1° ultra-fine, Alt = 15° snap, default = angleSnapDeg (1°)
        const snapStep = ev.shiftKey ? 0.1 : ev.altKey ? 15 : angleSnapDeg;
        if (snapStep > 0) {
          deltaDeg = Math.round(deltaDeg / snapStep) * snapStep;
        }

        if (dragState.initialAssemblyParts.length > 1) {
          // Rotate the entire selected group/assembly as one rigid 3D body around `dragState.pivotWorld`
          const axisVec =
            dragState.axis === 'x'
              ? new THREE.Vector3(1, 0, 0)
              : dragState.axis === 'y'
              ? new THREE.Vector3(0, 1, 0)
              : new THREE.Vector3(0, 0, 1);
          const qDelta = new THREE.Quaternion().setFromAxisAngle(
            axisVec,
            degToRad(deltaDeg)
          );
          const updatesMap = rotateAssemblyAroundWorldPoint(
            dragState.initialAssemblyParts,
            [
              dragState.pivotWorld.x,
              dragState.pivotWorld.y,
              dragState.pivotWorld.z,
            ],
            qDelta
          );
          const storeState = useProjectStore.getState();
          const nextParts = storeState.parts.map((p) =>
            updatesMap.has(p.id) ? { ...p, ...updatesMap.get(p.id)! } : p
          );
          useProjectStore.setState({ parts: nextParts });
        } else {
          const nextRot = computeWorldAxisRotation(
            dragState.initialRotation,
            dragState.axis,
            deltaDeg
          );
          rotatePartWithPivot(currentPart.id, nextRot, false);
        }

        const sign = deltaDeg > 0 ? '+' : '';
        const formattedDeg =
          snapStep < 1 ? deltaDeg.toFixed(1) : `${Math.round(deltaDeg * 10) / 10}`;
        setLiveBadge(
          `ציר ${dragState.axis.toUpperCase()}: ${sign}${formattedDeg}°`
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

  if (part.locked || !part.visible) return null;

  // Start single-axis translation along X (Blue), Y (Black), or Z (Red)
  const startTranslateAxis = (
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
      planeNormal.set(axis === 'y' ? 0 : 0, axis === 'y' ? 0 : 1, axis === 'y' ? 1 : 0);
    }

    const origin = new THREE.Vector3(...pivotWorldPos);
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(
      planeNormal,
      origin
    );
    const hit =
      intersectPlaneAtClientXY(plane, clientX, clientY) || origin.clone();

    const storeState = useProjectStore.getState();
    const movingIds = storeState.selectedIds.includes(part.id)
      ? storeState.selectedIds
      : [part.id];
    const initialAssemblyParts = storeState.parts
      .filter((p) => movingIds.includes(p.id) && !p.locked)
      .map((p) => ({
        ...p,
        position: [...p.position] as [number, number, number],
        rotation: [...p.rotation] as [number, number, number],
      }));

    setDragState({
      kind: 'translate-axis',
      axis,
      axisVec: axisDir,
      startWorldPoint: hit,
      initialPartPos: [...part.position],
      initialAssemblyParts,
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

    const storeState = useProjectStore.getState();
    const movingIds = storeState.selectedIds.includes(part.id)
      ? storeState.selectedIds
      : [part.id];
    const initialAssemblyParts = storeState.parts
      .filter((p) => movingIds.includes(p.id) && !p.locked)
      .map((p) => ({
        ...p,
        position: [...p.position] as [number, number, number],
        rotation: [...p.rotation] as [number, number, number],
      }));

    setDragState({
      kind: 'rotate-axis',
      axis,
      pivotWorld: pivotVec,
      startAngleRad,
      initialRotation: [...part.rotation],
      initialAssemblyParts,
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

  const heightFromFloorMm = Math.max(0, Math.round(bounds.min[1]));

  return (
    <group userData={{ isGizmoHandle: true }}>
      {/* =====================================================================
          STAGE 1: SINGLE-CLICK MODE ('move')
          Unified, Compact 3-Axis CAD Gizmo anchored directly at `pivotWorldPos`
          (the beam's center / pivot point — never scattered across empty space!):
          1. 3 Orthogonal Translation Arrows:
             - X Axis = Blue (#2563eb) along +X
             - Y Axis = Black (#0f172a) along +Y
             - Z Axis = Red (#dc2626) along +Z
          2. 3 Concentric Curved Double-Headed Rotation Arcs around the same center:
             - X Rotation Arc (Blue #2563eb) in YZ quadrant
             - Y Rotation Arc (Black #0f172a) in XZ horizontal quadrant
             - Z Rotation Arc (Red #dc2626) in XY vertical quadrant
          3. Draggable Photoshop/Illustrator Pivot Reticle right at the center
         ===================================================================== */}
      {partEditMode === 'move' && (
        <group position={pivotWorldPos} userData={{ isGizmoHandle: true }}>
          {/* Subtle vertical dashed line to floor when elevated */}
          {(heightFromFloorMm > 2 ||
            (dragState?.kind === 'translate-axis' &&
              dragState.axis === 'y')) && (
            <Line
              points={[
                [0, 0, 0],
                [0, -pivotWorldPos[1], 0],
              ]}
              color="#0f172a"
              lineWidth={1.5}
              dashed
              dashSize={12}
              gapSize={10}
              depthTest={false}
              renderOrder={998}
            />
          )}

          {/* -----------------------------------------------------------------
              A. 3 ORTHOGONAL TRANSLATION ARROWS (X Blue, Y Black, Z Red)
             ----------------------------------------------------------------- */}
          {/* 1. X-Axis Move Arrow (BLUE #2563eb — points along +X) */}
          <group
            userData={{ isGizmoHandle: true }}
            onPointerOver={(e) => {
              e.stopPropagation();
              setHoveredMoveAxis('x');
            }}
            onPointerOut={() => setHoveredMoveAxis(null)}
            onPointerDown={(e) =>
              startTranslateAxis('x', e.clientX, e.clientY, e)
            }
          >
            <Line
              points={[
                [18, 0, 0],
                [86, 0, 0],
              ]}
              color={
                hoveredMoveAxis === 'x' ||
                (dragState?.kind === 'translate-axis' && dragState.axis === 'x')
                  ? '#f59e0b'
                  : '#2563eb'
              }
              lineWidth={3}
              depthTest={false}
              renderOrder={999}
            />
            <mesh
              position={[94, 0, 0]}
              rotation={[0, 0, -Math.PI / 2]}
              renderOrder={999}
              userData={{ isGizmoHandle: true }}
            >
              <coneGeometry args={[9, 22, 18]} />
              <meshBasicMaterial
                color={
                  hoveredMoveAxis === 'x' ||
                  (dragState?.kind === 'translate-axis' &&
                    dragState.axis === 'x')
                    ? '#f59e0b'
                    : '#2563eb'
                }
                depthTest={false}
              />
            </mesh>
            <mesh
              position={[60, 0, 0]}
              rotation={[0, 0, -Math.PI / 2]}
              renderOrder={999}
              userData={{ isGizmoHandle: true }}
            >
              <cylinderGeometry args={[16, 16, 84, 10]} />
              <meshBasicMaterial transparent opacity={0} depthTest={false} />
            </mesh>
          </group>

          {/* 2. Y-Axis Move Arrow (BLACK #0f172a — points straight UP along +Y) */}
          <group
            userData={{ isGizmoHandle: true }}
            onPointerOver={(e) => {
              e.stopPropagation();
              setHoveredMoveAxis('y');
            }}
            onPointerOut={() => setHoveredMoveAxis(null)}
            onPointerDown={(e) =>
              startTranslateAxis('y', e.clientX, e.clientY, e)
            }
          >
            <Line
              points={[
                [0, 18, 0],
                [0, 86, 0],
              ]}
              color={
                hoveredMoveAxis === 'y' ||
                (dragState?.kind === 'translate-axis' && dragState.axis === 'y')
                  ? '#f59e0b'
                  : '#0f172a'
              }
              lineWidth={3}
              depthTest={false}
              renderOrder={999}
            />
            <mesh
              position={[0, 94, 0]}
              renderOrder={999}
              userData={{ isGizmoHandle: true }}
            >
              <coneGeometry args={[9, 22, 18]} />
              <meshBasicMaterial
                color={
                  hoveredMoveAxis === 'y' ||
                  (dragState?.kind === 'translate-axis' &&
                    dragState.axis === 'y')
                    ? '#f59e0b'
                    : '#0f172a'
                }
                depthTest={false}
              />
            </mesh>
            <mesh
              position={[0, 60, 0]}
              renderOrder={999}
              userData={{ isGizmoHandle: true }}
            >
              <cylinderGeometry args={[16, 16, 84, 10]} />
              <meshBasicMaterial transparent opacity={0} depthTest={false} />
            </mesh>
          </group>

          {/* 3. Z-Axis Move Arrow (RED #dc2626 — points along +Z) */}
          <group
            userData={{ isGizmoHandle: true }}
            onPointerOver={(e) => {
              e.stopPropagation();
              setHoveredMoveAxis('z');
            }}
            onPointerOut={() => setHoveredMoveAxis(null)}
            onPointerDown={(e) =>
              startTranslateAxis('z', e.clientX, e.clientY, e)
            }
          >
            <Line
              points={[
                [0, 0, 18],
                [0, 0, 86],
              ]}
              color={
                hoveredMoveAxis === 'z' ||
                (dragState?.kind === 'translate-axis' && dragState.axis === 'z')
                  ? '#f59e0b'
                  : '#dc2626'
              }
              lineWidth={3}
              depthTest={false}
              renderOrder={999}
            />
            <mesh
              position={[0, 0, 94]}
              rotation={[Math.PI / 2, 0, 0]}
              renderOrder={999}
              userData={{ isGizmoHandle: true }}
            >
              <coneGeometry args={[9, 22, 18]} />
              <meshBasicMaterial
                color={
                  hoveredMoveAxis === 'z' ||
                  (dragState?.kind === 'translate-axis' &&
                    dragState.axis === 'z')
                    ? '#f59e0b'
                    : '#dc2626'
                }
                depthTest={false}
              />
            </mesh>
            <mesh
              position={[0, 0, 60]}
              rotation={[Math.PI / 2, 0, 0]}
              renderOrder={999}
              userData={{ isGizmoHandle: true }}
            >
              <cylinderGeometry args={[16, 16, 84, 10]} />
              <meshBasicMaterial transparent opacity={0} depthTest={false} />
            </mesh>
          </group>

          {/* -----------------------------------------------------------------
              B. 3 CONCENTRIC CURVED ROTATION ARCS AROUND THE SAME CENTER
             ----------------------------------------------------------------- */}
          {/* 1. Y-AXIS ROTATION ARC (BLACK #0f172a — Horizontal XZ plane between +X and +Z) */}
          <group
            rotation={[-Math.PI / 2, 0, -Math.PI / 4]}
            userData={{ isGizmoHandle: true }}
            onPointerOver={(e) => {
              e.stopPropagation();
              setHoveredArc('y');
            }}
            onPointerOut={() => setHoveredArc(null)}
            onPointerDown={(e) => startRotateAxis('y', e)}
          >
            <mesh
              geometry={arrowGeometries.visual}
              renderOrder={999}
              userData={{ isGizmoHandle: true }}
            >
              <meshBasicMaterial
                color={
                  hoveredArc === 'y' ||
                  (dragState?.kind === 'rotate-axis' && dragState.axis === 'y')
                    ? '#f59e0b'
                    : '#0f172a'
                }
                side={THREE.DoubleSide}
                depthTest={false}
              />
              <Edges color="#ffffff" threshold={15} />
            </mesh>
            <mesh
              geometry={arrowGeometries.hit}
              renderOrder={999}
              userData={{ isGizmoHandle: true }}
            >
              <meshBasicMaterial
                transparent
                opacity={0}
                side={THREE.DoubleSide}
                depthTest={false}
              />
            </mesh>
          </group>

          {/* 2. X-AXIS ROTATION ARC (BLUE #2563eb — Vertical YZ plane between +Y and +Z) */}
          <group
            rotation={[0, -Math.PI / 2, Math.PI / 4]}
            userData={{ isGizmoHandle: true }}
            onPointerOver={(e) => {
              e.stopPropagation();
              setHoveredArc('x');
            }}
            onPointerOut={() => setHoveredArc(null)}
            onPointerDown={(e) => startRotateAxis('x', e)}
          >
            <mesh
              geometry={arrowGeometries.visual}
              renderOrder={999}
              userData={{ isGizmoHandle: true }}
            >
              <meshBasicMaterial
                color={
                  hoveredArc === 'x' ||
                  (dragState?.kind === 'rotate-axis' && dragState.axis === 'x')
                    ? '#f59e0b'
                    : '#2563eb'
                }
                side={THREE.DoubleSide}
                depthTest={false}
              />
              <Edges color="#ffffff" threshold={15} />
            </mesh>
            <mesh
              geometry={arrowGeometries.hit}
              renderOrder={999}
              userData={{ isGizmoHandle: true }}
            >
              <meshBasicMaterial
                transparent
                opacity={0}
                side={THREE.DoubleSide}
                depthTest={false}
              />
            </mesh>
          </group>

          {/* 3. Z-AXIS ROTATION ARC (RED #dc2626 — Vertical XY plane between +X and +Y) */}
          <group
            rotation={[0, 0, Math.PI / 4]}
            userData={{ isGizmoHandle: true }}
            onPointerOver={(e) => {
              e.stopPropagation();
              setHoveredArc('z');
            }}
            onPointerOut={() => setHoveredArc(null)}
            onPointerDown={(e) => startRotateAxis('z', e)}
          >
            <mesh
              geometry={arrowGeometries.visual}
              renderOrder={999}
              userData={{ isGizmoHandle: true }}
            >
              <meshBasicMaterial
                color={
                  hoveredArc === 'z' ||
                  (dragState?.kind === 'rotate-axis' && dragState.axis === 'z')
                    ? '#f59e0b'
                    : '#dc2626'
                }
                side={THREE.DoubleSide}
                depthTest={false}
              />
              <Edges color="#ffffff" threshold={15} />
            </mesh>
            <mesh
              geometry={arrowGeometries.hit}
              renderOrder={999}
              userData={{ isGizmoHandle: true }}
            >
              <meshBasicMaterial
                transparent
                opacity={0}
                side={THREE.DoubleSide}
                depthTest={false}
              />
            </mesh>
          </group>

          {/* C. Draggable Pivot Reference Point Reticle at the exact Gizmo origin */}
          <Html position={[0, 0, 0]} center zIndexRange={[30, 0]}>
            <div
              onPointerDown={startDragPivot}
              className="w-5.5 h-5.5 rounded-full bg-white hover:bg-amber-50 text-slate-900 hover:text-amber-600 border-[1.5px] border-slate-800 shadow-sm flex items-center justify-center cursor-move transition select-none"
              title="נקודת עוגן לסיבוב והזזה (גרור למיקום הרצוי על הקורה)"
            >
              <IconPivotTarget size={13} />
            </div>
          </Html>
        </group>
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
                  className="w-14 text-xs font-mono tabular-nums font-bold text-center bg-transparent outline-none"
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
                className="bg-white hover:bg-blue-50 text-slate-900 font-mono tabular-nums font-bold text-xs px-2 py-0.5 rounded shadow-sm border border-blue-600 whitespace-nowrap cursor-pointer select-none"
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
                  className="w-3.5 h-3.5 bg-white hover:bg-red-600 border-[1.5px] border-slate-900 hover:border-white shadow-2xs cursor-ns-resize"
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
                  className="w-3.5 h-3.5 bg-white hover:bg-red-600 border-[1.5px] border-slate-900 hover:border-white shadow-2xs cursor-ns-resize"
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
                    className="flex items-center gap-1 bg-white text-slate-900 px-1.5 py-0.5 rounded shadow-md border-2 border-red-600"
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
                      className="w-14 text-xs font-mono tabular-nums font-bold text-center bg-transparent outline-none"
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
                    className="bg-white hover:bg-red-50 text-slate-900 font-mono tabular-nums font-bold text-xs px-2 py-0.5 rounded shadow-sm border border-red-600 whitespace-nowrap cursor-pointer select-none"
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
          <div className="bg-white/95 text-slate-900 border border-slate-300 font-bold font-mono tabular-nums text-xs px-2.5 py-1 rounded-lg shadow-sm whitespace-nowrap pointer-events-none">
            {liveBadge}
          </div>
        </Html>
      )}
    </group>
  );
};
