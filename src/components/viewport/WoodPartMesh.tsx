import React, { useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { ThreeEvent, useThree } from '@react-three/fiber';
import { Edges, Html } from '@react-three/drei';
import { Part, StructuralLoadResult } from '../../types/woodcraft';
import { useProjectStore } from '../../store/useProjectStore';
import {
  buildPartGeometry,
  getPartTextureForStock,
} from '../../utils/woodMeshBuilder';
import {
  getPartQuaternion,
  resolvePartLengths,
} from '../../utils/geometryAndEngineering';

interface Props {
  part: Part;
  allParts: Part[];
  isSelected: boolean;
  hasCollision: boolean;
  cutLabel: string;
  loadWarning?: StructuralLoadResult;
  setOrbitEnabled: (enabled: boolean) => void;
}

export const WoodPartMesh: React.FC<Props> = ({
  part,
  allParts,
  isSelected,
  hasCollision,
  loadWarning,
  setOrbitEnabled,
}) => {
  const { camera, raycaster, pointer } = useThree();
  const selectPart = useProjectStore((s) => s.selectPart);
  const activeNotePartId = useProjectStore((s) => s.activeNotePartId);
  const setActiveNotePartId = useProjectStore((s) => s.setActiveNotePartId);
  const movePartWithSnap = useProjectStore((s) => s.movePartWithSnap);
  const pushHistory = useProjectStore((s) => s.pushHistory);
  const setActiveSnapLines = useProjectStore((s) => s.setActiveSnapLines);

  const [hovered, setHovered] = useState(false);
  const dragPlaneRef = useRef<THREE.Plane | null>(null);
  const dragModeRef = useRef<'xz' | 'y'>('xz');
  const dragOffsetRef = useRef<THREE.Vector3>(new THREE.Vector3());
  const isDraggingRef = useRef<boolean>(false);
  const pointerDownPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const geometry = useMemo(
    () => buildPartGeometry(part, allParts),
    [
      part.dimensions.length,
      part.dimensions.width,
      part.dimensions.thickness,
      part.miterLengthMode,
      part.miterStart.enabled,
      part.miterStart.angle,
      part.miterStart.axis,
      part.miterEnd.enabled,
      part.miterEnd.angle,
      part.miterEnd.axis,
      part.dadoNotches,
      part.position,
      part.rotation,
      allParts,
    ]
  );

  const texture = useMemo(
    () => getPartTextureForStock(part.stockId),
    [part.stockId]
  );

  if (!part.visible) return null;

  const quat = getPartQuaternion(part.rotation);
  const { outerLength } = resolvePartLengths(part);
  const halfL = outerLength / 2;
  const halfT = part.dimensions.thickness / 2;
  const halfW = part.dimensions.width / 2;

  const hasSevereLoad =
    loadWarning &&
    (loadWarning.severity === 'critical' || loadWarning.severity === 'warning');

  const edgeColor = isSelected
    ? '#f59e0b'
    : hasSevereLoad
    ? '#ef4444'
    : hasCollision
    ? '#f97316'
    : hovered
    ? '#fde047'
    : '#1e293b';

  const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    const isMulti = e.ctrlKey || e.metaKey;
    selectPart(part.id, isMulti);

    if (part.locked) return;

    pointerDownPosRef.current = { x: e.clientX, y: e.clientY };
    (e.target as Element)?.setPointerCapture?.(e.pointerId);

    // If holding Alt or Shift, drag vertically along Y axis; otherwise drag horizontally on XZ plane
    if (e.altKey || e.shiftKey) {
      dragModeRef.current = 'y';
      const camDir = new THREE.Vector3();
      camera.getWorldDirection(camDir);
      camDir.y = 0;
      if (camDir.lengthSq() < 0.01) camDir.set(0, 0, 1);
      camDir.normalize();
      const vPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(
        camDir,
        new THREE.Vector3(...part.position)
      );
      raycaster.setFromCamera(pointer, camera);
      const hitPoint = new THREE.Vector3();
      if (raycaster.ray.intersectPlane(vPlane, hitPoint)) {
        dragPlaneRef.current = vPlane;
        dragOffsetRef.current.set(...part.position).sub(hitPoint);
      }
    } else {
      dragModeRef.current = 'xz';
      const plane = new THREE.Plane(
        new THREE.Vector3(0, 1, 0),
        -part.position[1]
      );
      raycaster.setFromCamera(pointer, camera);
      const hitPoint = new THREE.Vector3();
      if (raycaster.ray.intersectPlane(plane, hitPoint)) {
        dragPlaneRef.current = plane;
        dragOffsetRef.current.set(...part.position).sub(hitPoint);
      }
    }
  };

  const handlePointerMove = (e: ThreeEvent<PointerEvent>) => {
    if (!dragPlaneRef.current || part.locked) return;
    const distPx = Math.hypot(
      e.clientX - pointerDownPosRef.current.x,
      e.clientY - pointerDownPosRef.current.y
    );

    if (!isDraggingRef.current && distPx > 5) {
      isDraggingRef.current = true;
      setOrbitEnabled(false);
      pushHistory();
    }

    if (isDraggingRef.current) {
      e.stopPropagation();
      raycaster.setFromCamera(pointer, camera);
      const hitPoint = new THREE.Vector3();
      if (raycaster.ray.intersectPlane(dragPlaneRef.current, hitPoint)) {
        if (dragModeRef.current === 'y') {
          const candidatePos: [number, number, number] = [
            part.position[0],
            hitPoint.y + dragOffsetRef.current.y,
            part.position[2],
          ];
          movePartWithSnap(part.id, candidatePos, false);
        } else {
          const candidatePos: [number, number, number] = [
            hitPoint.x + dragOffsetRef.current.x,
            part.position[1],
            hitPoint.z + dragOffsetRef.current.z,
          ];
          movePartWithSnap(part.id, candidatePos, false);
        }
      }
    }
  };

  const handlePointerUp = (e: ThreeEvent<PointerEvent>) => {
    if (dragPlaneRef.current) {
      e.stopPropagation();
      try {
        (e.target as Element)?.releasePointerCapture?.(e.pointerId);
      } catch {
        // ignore
      }
      dragPlaneRef.current = null;
      if (isDraggingRef.current) {
        isDraggingRef.current = false;
        setActiveSnapLines([]);
        setOrbitEnabled(true);
      }
    }
  };

  // Compute Pocket Hole visual marker positions in local space
  const pocketHoleMarkers: Array<[number, number, number]> = [];
  if (part.pocketHoles.enabled) {
    const faceY =
      part.pocketHoles.face === 'top'
        ? halfT + 1.5
        : part.pocketHoles.face === 'bottom'
        ? -halfT - 1.5
        : 0;
    const count = Math.max(1, Math.min(6, part.pocketHoles.holesPerEdge));

    const addEndHoles = (xPos: number) => {
      for (let i = 0; i < count; i++) {
        const frac = count === 1 ? 0 : (i / (count - 1) - 0.5) * 0.65;
        pocketHoleMarkers.push([xPos, faceY, frac * part.dimensions.width]);
      }
    };

    if (part.pocketHoles.ends === 'start' || part.pocketHoles.ends === 'both') {
      addEndHoles(-halfL + 32);
    }
    if (part.pocketHoles.ends === 'end' || part.pocketHoles.ends === 'both') {
      addEndHoles(halfL - 32);
    }
    if (part.pocketHoles.ends === 'sides') {
      addEndHoles(-halfL + 32);
      addEndHoles(halfL - 32);
      pocketHoleMarkers.push([0, faceY, -halfW + 25]);
      pocketHoleMarkers.push([0, faceY, halfW - 25]);
    }
  }

  return (
    <group position={part.position} quaternion={quat}>
      <mesh
        geometry={geometry}
        castShadow
        receiveShadow
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
        }}
        onPointerOut={() => setHovered(false)}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <meshStandardMaterial
          map={texture}
          color={part.customColor || '#ffffff'}
          roughness={0.68}
          metalness={0.05}
          emissive={
            hasSevereLoad
              ? '#dc2626'
              : isSelected
              ? '#f59e0b'
              : hasCollision
              ? '#ea580c'
              : '#000000'
          }
          emissiveIntensity={
            hasSevereLoad ? 0.22 : isSelected ? 0.14 : hasCollision ? 0.16 : 0
          }
        />
        <Edges
          threshold={15}
          color={edgeColor}
          scale={isSelected ? 1.003 : 1.001}
        />
      </mesh>

      {/* Visual Kreg Pocket Hole Markers */}
      {pocketHoleMarkers.map((pos, idx) => (
        <mesh
          key={idx}
          position={pos}
          rotation={[0, 0, pos[0] < 0 ? 0.35 : -0.35]}
        >
          <cylinderGeometry args={[4.8, 3.2, 18, 12]} />
          <meshStandardMaterial color="#0284c7" emissive="#0369a1" />
        </mesh>
      ))}

      {/* ONLY render a small clickable ⚠️ button when there's an actual engineering warning or collision */}
      {(hasSevereLoad || hasCollision) && (
        <Html position={[0, halfT + 28, 0]} center>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              selectPart(part.id);
              setActiveNotePartId(
                activeNotePartId === part.id ? null : part.id
              );
            }}
            className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shadow-lg border transition cursor-pointer ${
              hasSevereLoad
                ? 'bg-red-600 hover:bg-red-500 text-white border-red-200 animate-bounce'
                : 'bg-amber-500 hover:bg-amber-400 text-slate-950 border-amber-200'
            }`}
            title={
              hasSevereLoad
                ? 'לחץ לפתיחת הערת עומסים ושקיעה על קורה זו'
                : 'לחץ לפתיחת אפשרויות חיתוך מגרעת (Half-Lap) במפגש הקורות'
            }
          >
            ⚠️
          </button>
        </Html>
      )}
    </group>
  );
};
