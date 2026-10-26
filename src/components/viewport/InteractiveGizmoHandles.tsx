import React, { useRef, useState } from 'react';
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
      side: 'length-start' | 'length-end' | 'width-start' | 'width-end';
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
  const { camera, raycaster, pointer } = useThree();
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
  const [showAnchorNodes, setShowAnchorNodes] = useState<boolean>(false);
  const activePointerId = useRef<number | null>(null);

  if (part.locked || !part.visible) return null;

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

  // Helper to intersect current pointer ray with a drag plane
  const intersectPlane = (plane: THREE.Plane): THREE.Vector3 | null => {
    raycaster.setFromCamera(pointer, camera);
    const out = new THREE.Vector3();
    return raycaster.ray.intersectPlane(plane, out);
  };

  // Start translating along X, Y, or Z world axis
  const startAxisTranslate = (axis: 'x' | 'y' | 'z', e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    (e.target as Element)?.setPointerCapture?.(e.pointerId);
    activePointerId.current = e.pointerId;
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
    // Construct a plane containing `axisDir` that faces the camera as much as possible
    const sideVec = new THREE.Vector3().crossVectors(axisDir, camDir).normalize();
    const planeNormal = new THREE.Vector3()
      .crossVectors(axisDir, sideVec)
      .normalize();
    if (planeNormal.lengthSq() < 0.01) {
      planeNormal.set(0, 1, 0);
    }

    const origin = new THREE.Vector3(...part.position);
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(
      planeNormal,
      origin
    );
    const hit = intersectPlane(plane) || origin.clone();

    setDragState({
      kind: 'translate-axis',
      axis,
      startWorldPoint: hit,
      initialPartPos: [...part.position],
      plane,
    });
  };

  // Start stretching an end face
  const startStretch = (
    side: 'length-start' | 'length-end' | 'width-start' | 'width-end',
    e: ThreeEvent<PointerEvent>
  ) => {
    e.stopPropagation();
    (e.target as Element)?.setPointerCapture?.(e.pointerId);
    activePointerId.current = e.pointerId;
    setOrbitEnabled(false);
    pushHistory();

    const isLen = side === 'length-start' || side === 'length-end';
    const dirSign = side === 'length-end' || side === 'width-end' ? 1 : -1;
    const axisVec = (isLen ? bounds.axisX.clone() : bounds.axisZ.clone()).multiplyScalar(
      dirSign
    );

    const camDir = new THREE.Vector3();
    camera.getWorldDirection(camDir);
    const sideVec = new THREE.Vector3().crossVectors(axisVec, camDir).normalize();
    const planeNormal = new THREE.Vector3()
      .crossVectors(axisVec, sideVec)
      .normalize();
    if (planeNormal.lengthSq() < 0.01) planeNormal.set(0, 1, 0);

    const origin = new THREE.Vector3(...part.position);
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(
      planeNormal,
      origin
    );
    const hit = intersectPlane(plane) || origin.clone();

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
  const startRotateAxis = (axis: 'x' | 'y' | 'z', e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    (e.target as Element)?.setPointerCapture?.(e.pointerId);
    activePointerId.current = e.pointerId;
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
    const hit = intersectPlane(plane) || pivotVec.clone().add(uVec);
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

  const handlePointerMove = (e: ThreeEvent<PointerEvent>) => {
    if (!dragState) return;
    e.stopPropagation();

    const hit = intersectPlane(dragState.plane);
    if (!hit) return;

    if (dragState.kind === 'translate-axis') {
      const diff = hit.clone().sub(dragState.startWorldPoint);
      const nextPos: [number, number, number] = [...dragState.initialPartPos];
      if (dragState.axis === 'x') nextPos[0] += diff.x;
      if (dragState.axis === 'y') nextPos[1] += diff.y;
      if (dragState.axis === 'z') nextPos[2] += diff.z;

      movePartWithSnap(part.id, nextPos, false);
      setLiveBadge(
        `מיקום ${dragState.axis.toUpperCase()}: ${fmtLen(
          nextPos[dragState.axis === 'x' ? 0 : dragState.axis === 'y' ? 1 : 2]
        )}`
      );
    } else if (dragState.kind === 'stretch') {
      const diff = hit.clone().sub(dragState.startWorldPoint);
      const projectedDelta = diff.dot(dragState.axisVec);
      // Snap stretch to 5mm increments unless Shift is held
      const rawNewDim = dragState.initialDim + projectedDelta;
      const step = e.shiftKey ? 1 : 5;
      const snappedDim = Math.round(rawNewDim / step) * step;

      stretchPartSide(part.id, dragState.side, snappedDim, false);
      setLiveBadge(
        `${
          dragState.side.startsWith('length') ? 'אורך' : 'רוחב'
        }: ${fmtLen(Math.max(50, snappedDim))}`
      );
    } else if (dragState.kind === 'rotate-axis') {
      const rel = hit.clone().sub(dragState.pivotWorld);
      const curAngleRad = Math.atan2(
        rel.dot(dragState.vVec),
        rel.dot(dragState.uVec)
      );
      let deltaDeg = ((curAngleRad - dragState.startAngleRad) * 180) / Math.PI;

      const snapStep = e.shiftKey ? 1 : angleSnapDeg;
      if (snapStep > 1) {
        deltaDeg = Math.round(deltaDeg / snapStep) * snapStep;
      }

      const axisIdx =
        dragState.axis === 'x' ? 0 : dragState.axis === 'y' ? 1 : 2;
      const nextRot: [number, number, number] = [...dragState.initialRotation];
      nextRot[axisIdx] =
        (((dragState.initialRotation[axisIdx] + deltaDeg) % 360) + 360) % 360;

      rotatePartWithPivot(part.id, nextRot, false);
      setLiveBadge(
        `סיבוב ${dragState.axis.toUpperCase()} (סביב עוגן 🎯): ${Math.round(
          nextRot[axisIdx]
        )}°`
      );
    }
  };

  const handlePointerUp = (e: ThreeEvent<PointerEvent>) => {
    if (!dragState) return;
    e.stopPropagation();
    if (activePointerId.current !== null) {
      try {
        (e.target as Element)?.releasePointerCapture?.(activePointerId.current);
      } catch {
        // ignore
      }
      activePointerId.current = null;
    }
    setDragState(null);
    setLiveBadge(null);
    setActiveSnapLines([]);
    setOrbitEnabled(true);
  };

  // Anchor points on the part for quick 3D click selection
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

  const arrowDist = Math.max(140, Math.min(340, outerLength * 0.25));
  const ringRadius = Math.max(115, Math.min(260, Math.max(outerLength, part.dimensions.width) * 0.28));

  return (
    <group
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {/* 1. World Translation Arrows at Part Center */}
      <group position={part.position}>
        {/* X Axis Arrow (Red) */}
        <group
          onPointerDown={(e) => startAxisTranslate('x', e)}
        >
          <Line
            points={[
              [0, 0, 0],
              [arrowDist, 0, 0],
            ]}
            color="#ef4444"
            lineWidth={3.5}
          />
          <mesh position={[arrowDist, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
            <coneGeometry args={[16, 42, 16]} />
            <meshStandardMaterial color="#ef4444" emissive="#991b1b" />
          </mesh>
        </group>

        {/* Y Axis Elevation Arrow (Green - Tinkercad Elevation Cone) */}
        <group
          onPointerDown={(e) => startAxisTranslate('y', e)}
        >
          <Line
            points={[
              [0, 0, 0],
              [0, arrowDist, 0],
            ]}
            color="#22c55e"
            lineWidth={3.5}
          />
          <mesh position={[0, arrowDist, 0]}>
            <coneGeometry args={[18, 46, 16]} />
            <meshStandardMaterial color="#22c55e" emissive="#166534" />
          </mesh>
        </group>

        {/* Z Axis Arrow (Blue) */}
        <group
          onPointerDown={(e) => startAxisTranslate('z', e)}
        >
          <Line
            points={[
              [0, 0, 0],
              [0, 0, arrowDist],
            ]}
            color="#38bdf8"
            lineWidth={3.5}
          />
          <mesh position={[0, 0, arrowDist]} rotation={[Math.PI / 2, 0, 0]}>
            <coneGeometry args={[16, 42, 16]} />
            <meshStandardMaterial color="#38bdf8" emissive="#075985" />
          </mesh>
        </group>
      </group>

      {/* 2. Stretch Handles (ידיות מתיחה) in Part Local Orientation */}
      {stock.category !== 'hardware' && (
        <group position={part.position} quaternion={quat}>
          {/* End +X Stretch Handle */}
          <mesh
            position={[halfL + 18, 0, 0]}
            onPointerDown={(e) => startStretch('length-end', e)}
          >
            <boxGeometry args={[22, Math.max(26, halfT * 1.1), Math.max(32, halfW * 0.9)]} />
            <meshStandardMaterial
              color="#f59e0b"
              emissive="#b45309"
              roughness={0.3}
            />
          </mesh>

          {/* Start -X Stretch Handle */}
          <mesh
            position={[-halfL - 18, 0, 0]}
            onPointerDown={(e) => startStretch('length-start', e)}
          >
            <boxGeometry args={[22, Math.max(26, halfT * 1.1), Math.max(32, halfW * 0.9)]} />
            <meshStandardMaterial
              color="#f59e0b"
              emissive="#b45309"
              roughness={0.3}
            />
          </mesh>

          {/* Sheet Goods also have Width (+Z / -Z) Stretch Handles */}
          {stock.category === 'sheet' && (
            <>
              <mesh
                position={[0, 0, halfW + 18]}
                onPointerDown={(e) => startStretch('width-end', e)}
              >
                <boxGeometry args={[Math.max(40, halfL * 0.5), Math.max(24, halfT * 1.1), 22]} />
                <meshStandardMaterial color="#fb923c" emissive="#c2410c" />
              </mesh>
              <mesh
                position={[0, 0, -halfW - 18]}
                onPointerDown={(e) => startStretch('width-start', e)}
              >
                <boxGeometry args={[Math.max(40, halfL * 0.5), Math.max(24, halfT * 1.1), 22]} />
                <meshStandardMaterial color="#fb923c" emissive="#c2410c" />
              </mesh>
            </>
          )}

          {/* Optional 3D Clickable Anchor Nodes on the beam when user toggles anchor picker */}
          {showAnchorNodes &&
            anchorCandidates.map((cand, idx) => {
              const isCurrent =
                cand.pivot.x === part.pivot.x &&
                cand.pivot.y === part.pivot.y &&
                cand.pivot.z === part.pivot.z;
              return (
                <mesh
                  key={idx}
                  position={[
                    cand.pivot.x * halfL,
                    cand.pivot.y * halfT,
                    cand.pivot.z * halfW,
                  ]}
                  onClick={(e) => {
                    e.stopPropagation();
                    setPartPivot(part.id, cand.pivot);
                  }}
                >
                  <sphereGeometry args={[isCurrent ? 18 : 13, 16, 16]} />
                  <meshStandardMaterial
                    color={isCurrent ? '#ec4899' : '#fde047'}
                    emissive={isCurrent ? '#be185d' : '#a16207'}
                  />
                </mesh>
              );
            })}
        </group>
      )}

      {/* 3. Selectable Pivot / Anchor Point Pin (🎯) & 3 Axis Rotation Rings centered at Pivot! */}
      <group position={pivotWorldPos}>
        {/* Pivot Pin Sphere */}
        <mesh
          onClick={(e) => {
            e.stopPropagation();
            setShowAnchorNodes((v) => !v);
          }}
        >
          <sphereGeometry args={[16, 20, 20]} />
          <meshStandardMaterial color="#ec4899" emissive="#9d174d" />
        </mesh>

        {/* X Axis Rotation Ring (Red - YZ plane) */}
        <mesh
          rotation={[0, Math.PI / 2, 0]}
          onPointerDown={(e) => startRotateAxis('x', e)}
        >
          <torusGeometry args={[ringRadius, 5.5, 12, 48]} />
          <meshStandardMaterial
            color="#ef4444"
            emissive="#7f1d1d"
            transparent
            opacity={0.85}
          />
        </mesh>

        {/* Y Axis Rotation Ring (Green - XZ plane) */}
        <mesh
          rotation={[Math.PI / 2, 0, 0]}
          onPointerDown={(e) => startRotateAxis('y', e)}
        >
          <torusGeometry args={[ringRadius * 1.08, 5.5, 12, 48]} />
          <meshStandardMaterial
            color="#22c55e"
            emissive="#14532d"
            transparent
            opacity={0.85}
          />
        </mesh>

        {/* Z Axis Rotation Ring (Blue - XY plane) */}
        <mesh
          rotation={[0, 0, 0]}
          onPointerDown={(e) => startRotateAxis('z', e)}
        >
          <torusGeometry args={[ringRadius * 0.92, 5.5, 12, 48]} />
          <meshStandardMaterial
            color="#38bdf8"
            emissive="#0c4a6e"
            transparent
            opacity={0.85}
          />
        </mesh>

        {/* Pivot Pin Badge */}
        <Html position={[0, -28, 0]} center distanceFactor={2100}>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowAnchorNodes((v) => !v);
            }}
            className="bg-pink-950/90 hover:bg-pink-800 text-pink-200 border border-pink-500/60 px-2 py-0.5 rounded-full text-[10px] font-medium whitespace-nowrap shadow cursor-pointer"
            title="לחץ להצגת נקודות עוגן (Anchor Points) לבחירה ישירה על הקורה"
          >
            🎯 ציר סיבוב {showAnchorNodes ? '(בחר נקודה צהובה)' : '(לחץ לשינוי)'}
          </button>
        </Html>
      </group>

      {/* Live Drag Readout Tooltip */}
      {liveBadge && (
        <Html
          position={[
            part.position[0],
            bounds.max[1] + 95,
            part.position[2],
          ]}
          center
        >
          <div className="bg-amber-500 text-slate-950 font-bold font-mono text-xs px-3 py-1 rounded-lg shadow-xl border border-amber-200 whitespace-nowrap">
            {liveBadge}
          </div>
        </Html>
      )}
    </group>
  );
};
