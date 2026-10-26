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
  const gizmoMode = useProjectStore((s) => s.gizmoMode);
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

  const intersectPlane = (plane: THREE.Plane): THREE.Vector3 | null => {
    raycaster.setFromCamera(pointer, camera);
    const out = new THREE.Vector3();
    return raycaster.ray.intersectPlane(plane, out);
  };

  // Start translating along X, Y (Up/Down), or Z world axis
  const startAxisTranslate = (
    axis: 'x' | 'y' | 'z',
    e: ThreeEvent<PointerEvent>
  ) => {
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
    const sideVec = new THREE.Vector3().crossVectors(axisDir, camDir).normalize();
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
    const axisVec = (
      isLen ? bounds.axisX.clone() : bounds.axisZ.clone()
    ).multiplyScalar(dirSign);

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
  const startRotateAxis = (
    axis: 'x' | 'y' | 'z',
    e: ThreeEvent<PointerEvent>
  ) => {
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
      const updatedBounds = getPartWorldBounds({ ...part, position: nextPos });
      if (dragState.axis === 'y') {
        setLiveBadge(
          `גובה מתחתית הקורה לרצפה: ${fmtLen(Math.max(0, updatedBounds.min[1]))}`
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
      const step = e.shiftKey ? 1 : 5;
      const snappedDim = Math.round(rawNewDim / step) * step;

      stretchPartSide(part.id, dragState.side, snappedDim, false);
      setLiveBadge(
        `${
          dragState.side.startsWith('length') ? 'אורך חדש' : 'רוחב חדש'
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

  // Compute handle distances strictly OUTSIDE the part's world bounding box
  // so no arrow or cone is ever buried inside a tall or long beam!
  const xTipOffset = bounds.size[0] / 2 + 85;
  const yTopOffset = bounds.size[1] / 2 + 85;
  const zTipOffset = bounds.size[2] / 2 + 85;

  const ringRadius = Math.max(
    115,
    Math.min(240, Math.max(outerLength, part.dimensions.width) * 0.26)
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

  return (
    <group onPointerMove={handlePointerMove} onPointerUp={handlePointerUp}>
      {/* MODE 1: MOVE & ELEVATION (הזזה וגובה ✥) */}
      {gizmoMode === 'move' && (
        <group position={part.position}>
          {/* Y Axis Up/Down Handle (Green - Always above the top of the part + downward cone) */}
          <group onPointerDown={(e) => startAxisTranslate('y', e)}>
            <Line
              points={[
                [0, -bounds.size[1] / 2 - 45, 0],
                [0, yTopOffset, 0],
              ]}
              color="#22c55e"
              lineWidth={4}
              depthTest={false}
              renderOrder={999}
            />
            {/* Top Up-Cone */}
            <mesh position={[0, yTopOffset, 0]} renderOrder={999}>
              <coneGeometry args={[22, 54, 18]} />
              <meshBasicMaterial color="#22c55e" depthTest={false} />
            </mesh>
            {/* Bottom Down-Cone */}
            <mesh
              position={[0, -bounds.size[1] / 2 - 45, 0]}
              rotation={[Math.PI, 0, 0]}
              renderOrder={999}
            >
              <coneGeometry args={[18, 42, 18]} />
              <meshBasicMaterial color="#16a34a" depthTest={false} />
            </mesh>
            {/* Generous Invisible Hit Cylinder for easy grabbing */}
            <mesh position={[0, yTopOffset / 2, 0]} renderOrder={999}>
              <cylinderGeometry args={[32, 32, yTopOffset + bounds.size[1] / 2 + 60, 12]} />
              <meshBasicMaterial transparent opacity={0} depthTest={false} />
            </mesh>
          </group>

          {/* X Axis Left/Right Handle (Red) */}
          <group onPointerDown={(e) => startAxisTranslate('x', e)}>
            <Line
              points={[
                [0, 0, 0],
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
            >
              <coneGeometry args={[18, 46, 16]} />
              <meshBasicMaterial color="#ef4444" depthTest={false} />
            </mesh>
            <mesh
              position={[xTipOffset / 2, 0, 0]}
              rotation={[0, 0, -Math.PI / 2]}
              renderOrder={999}
            >
              <cylinderGeometry args={[28, 28, xTipOffset, 12]} />
              <meshBasicMaterial transparent opacity={0} depthTest={false} />
            </mesh>
          </group>

          {/* Z Axis Front/Back Handle (Blue) */}
          <group onPointerDown={(e) => startAxisTranslate('z', e)}>
            <Line
              points={[
                [0, 0, 0],
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
            >
              <coneGeometry args={[18, 46, 16]} />
              <meshBasicMaterial color="#38bdf8" depthTest={false} />
            </mesh>
            <mesh
              position={[0, 0, zTipOffset / 2]}
              rotation={[Math.PI / 2, 0, 0]}
              renderOrder={999}
            >
              <cylinderGeometry args={[28, 28, zTipOffset, 12]} />
              <meshBasicMaterial transparent opacity={0} depthTest={false} />
            </mesh>
          </group>
        </group>
      )}

      {/* MODE 2: STRETCH HANDLES (מתיחת אורך/רוחב ↔) */}
      {gizmoMode === 'stretch' && stock.category !== 'hardware' && (
        <group position={part.position} quaternion={quat}>
          {/* End +X Stretch Handle */}
          <mesh
            position={[halfL + 22, 0, 0]}
            onPointerDown={(e) => startStretch('length-end', e)}
            renderOrder={999}
          >
            <boxGeometry
              args={[28, Math.max(34, halfT * 1.25), Math.max(40, halfW * 0.95)]}
            />
            <meshBasicMaterial color="#f59e0b" depthTest={false} />
          </mesh>

          {/* Start -X Stretch Handle */}
          <mesh
            position={[-halfL - 22, 0, 0]}
            onPointerDown={(e) => startStretch('length-start', e)}
            renderOrder={999}
          >
            <boxGeometry
              args={[28, Math.max(34, halfT * 1.25), Math.max(40, halfW * 0.95)]}
            />
            <meshBasicMaterial color="#f59e0b" depthTest={false} />
          </mesh>

          {/* Sheet Goods also have Width (+Z / -Z) Stretch Handles */}
          {stock.category === 'sheet' && (
            <>
              <mesh
                position={[0, 0, halfW + 22]}
                onPointerDown={(e) => startStretch('width-end', e)}
                renderOrder={999}
              >
                <boxGeometry
                  args={[Math.max(50, halfL * 0.5), Math.max(30, halfT * 1.2), 28]}
                />
                <meshBasicMaterial color="#fb923c" depthTest={false} />
              </mesh>
              <mesh
                position={[0, 0, -halfW - 22]}
                onPointerDown={(e) => startStretch('width-start', e)}
                renderOrder={999}
              >
                <boxGeometry
                  args={[Math.max(50, halfL * 0.5), Math.max(30, halfT * 1.2), 28]}
                />
                <meshBasicMaterial color="#fb923c" depthTest={false} />
              </mesh>
            </>
          )}
        </group>
      )}

      {/* MODE 3: ROTATION RINGS & ANCHOR POINT (סיבוב סביב עוגן ↻) */}
      {gizmoMode === 'rotate' && (
        <>
          {showAnchorNodes && (
            <group position={part.position} quaternion={quat}>
              {anchorCandidates.map((cand, idx) => {
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

          <group position={pivotWorldPos}>
            <mesh
              onClick={(e) => {
                e.stopPropagation();
                setShowAnchorNodes((v) => !v);
              }}
              renderOrder={999}
            >
              <sphereGeometry args={[16, 20, 20]} />
              <meshBasicMaterial color="#ec4899" depthTest={false} />
            </mesh>

            {/* X Axis Rotation Ring (Red) */}
            <mesh
              rotation={[0, Math.PI / 2, 0]}
              onPointerDown={(e) => startRotateAxis('x', e)}
              renderOrder={999}
            >
              <torusGeometry args={[ringRadius, 7, 12, 48]} />
              <meshBasicMaterial
                color="#ef4444"
                transparent
                opacity={0.9}
                depthTest={false}
              />
            </mesh>

            {/* Y Axis Rotation Ring (Green) */}
            <mesh
              rotation={[Math.PI / 2, 0, 0]}
              onPointerDown={(e) => startRotateAxis('y', e)}
              renderOrder={999}
            >
              <torusGeometry args={[ringRadius * 1.1, 7, 12, 48]} />
              <meshBasicMaterial
                color="#22c55e"
                transparent
                opacity={0.9}
                depthTest={false}
              />
            </mesh>

            {/* Z Axis Rotation Ring (Blue) */}
            <mesh
              rotation={[0, 0, 0]}
              onPointerDown={(e) => startRotateAxis('z', e)}
              renderOrder={999}
            >
              <torusGeometry args={[ringRadius * 0.9, 7, 12, 48]} />
              <meshBasicMaterial
                color="#38bdf8"
                transparent
                opacity={0.9}
                depthTest={false}
              />
            </mesh>

            <Html position={[0, -32, 0]} center>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowAnchorNodes((v) => !v);
                }}
                className="bg-pink-950/90 hover:bg-pink-800 text-pink-200 border border-pink-500/60 px-2 py-0.5 rounded-full text-[10px] font-medium whitespace-nowrap shadow cursor-pointer"
              >
                🎯 ציר סיבוב {showAnchorNodes ? '(בחר נקודה צהובה)' : '(לחץ לשינוי)'}
              </button>
            </Html>
          </group>
        </>
      )}

      {/* Clean Compact Drag Readout Tooltip */}
      {liveBadge && (
        <Html
          position={[
            part.position[0],
            bounds.max[1] + 95,
            part.position[2],
          ]}
          center
        >
          <div className="bg-amber-500 text-slate-950 font-bold font-mono text-xs px-2.5 py-1 rounded-lg shadow-xl border border-amber-200 whitespace-nowrap pointer-events-none">
            {liveBadge}
          </div>
        </Html>
      )}
    </group>
  );
};
