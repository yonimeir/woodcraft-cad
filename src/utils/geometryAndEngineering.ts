import * as THREE from 'three';
import {
  CollisionPair,
  KregRecommendation,
  Part,
  PivotAnchor,
  RoomEnvironment,
  SnapLine,
  StructuralLoadResult,
} from '../types/woodcraft';
import { getStockById } from '../data/stockLibrary';

export interface ResolvedPartLengths {
  outerLength: number;
  innerLength: number;
  centerLength: number;
  deltaStart: number;
  deltaEnd: number;
}

/**
 * Resolves the outer (Long-to-Long), inner (Short-to-Short), and centerline lengths
 * of a part based on its miter cuts and `miterLengthMode`.
 */
export function resolvePartLengths(part: Part): ResolvedPartLengths {
  const { length, width, thickness } = part.dimensions;

  const calcDelta = (enabled: boolean, angleDeg: number, axis: 'y' | 'z') => {
    if (!enabled || Math.abs(angleDeg) < 0.5) return 0;
    const rad = (Math.min(Math.abs(angleDeg), 75) * Math.PI) / 180;
    const crossDim = axis === 'z' ? width : thickness;
    return crossDim * Math.tan(rad);
  };

  const deltaStart = calcDelta(
    part.miterStart.enabled,
    part.miterStart.angle,
    part.miterStart.axis
  );
  const deltaEnd = calcDelta(
    part.miterEnd.enabled,
    part.miterEnd.angle,
    part.miterEnd.axis
  );

  let outerLength = length;
  let innerLength = length;
  let centerLength = length;

  if (part.miterLengthMode === 'outer') {
    outerLength = Math.max(40, length);
    innerLength = Math.max(20, outerLength - deltaStart - deltaEnd);
    centerLength = Math.max(30, outerLength - 0.5 * (deltaStart + deltaEnd));
  } else if (part.miterLengthMode === 'inner') {
    innerLength = Math.max(20, length);
    outerLength = innerLength + deltaStart + deltaEnd;
    centerLength = innerLength + 0.5 * (deltaStart + deltaEnd);
  } else {
    // 'center'
    centerLength = Math.max(30, length);
    outerLength = centerLength + 0.5 * (deltaStart + deltaEnd);
    innerLength = Math.max(20, centerLength - 0.5 * (deltaStart + deltaEnd));
  }

  return {
    outerLength: Math.round(outerLength * 10) / 10,
    innerLength: Math.round(innerLength * 10) / 10,
    centerLength: Math.round(centerLength * 10) / 10,
    deltaStart: Math.round(deltaStart * 10) / 10,
    deltaEnd: Math.round(deltaEnd * 10) / 10,
  };
}

export interface WorldBounds {
  min: [number, number, number];
  max: [number, number, number];
  center: [number, number, number];
  size: [number, number, number];
  corners: THREE.Vector3[];
  axisX: THREE.Vector3;
  axisY: THREE.Vector3;
  axisZ: THREE.Vector3;
}

export function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function radToDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

export function getPartQuaternion(rotationDeg: [number, number, number]): THREE.Quaternion {
  const euler = new THREE.Euler(
    degToRad(rotationDeg[0]),
    degToRad(rotationDeg[1]),
    degToRad(rotationDeg[2]),
    'XYZ'
  );
  return new THREE.Quaternion().setFromEuler(euler);
}

/**
 * Computes the world-space position of any anchor/pivot point on a part.
 */
export function getPivotWorldPosition(
  part: Part,
  customPivot?: PivotAnchor
): [number, number, number] {
  const pivot = customPivot || part.pivot;
  const { outerLength } = resolvePartLengths(part);
  const { width, thickness } = part.dimensions;

  const localOffset = new THREE.Vector3(
    (pivot.x * outerLength) / 2,
    (pivot.y * thickness) / 2,
    (pivot.z * width) / 2
  );

  const quat = getPartQuaternion(part.rotation);
  localOffset.applyQuaternion(quat);

  return [
    Math.round((part.position[0] + localOffset.x) * 100) / 100,
    Math.round((part.position[1] + localOffset.y) * 100) / 100,
    Math.round((part.position[2] + localOffset.z) * 100) / 100,
  ];
}

/**
 * Rotates a part to a new Euler rotation `[rx, ry, rz]` while keeping its selected `pivot` anchor point fixed in world space.
 */
export function rotatePartAroundPivot(
  part: Part,
  newRotationDeg: [number, number, number],
  overridePivot?: PivotAnchor
): { position: [number, number, number]; rotation: [number, number, number] } {
  const pivot = overridePivot || part.pivot;
  const { outerLength } = resolvePartLengths(part);
  const { width, thickness } = part.dimensions;

  // World position of the anchor before rotation
  const anchorWorld = new THREE.Vector3(...getPivotWorldPosition(part, pivot));

  // Local offset from geometric center to anchor
  const localOffset = new THREE.Vector3(
    (pivot.x * outerLength) / 2,
    (pivot.y * thickness) / 2,
    (pivot.z * width) / 2
  );

  const newQuat = getPartQuaternion(newRotationDeg);
  const rotatedOffset = localOffset.clone().applyQuaternion(newQuat);

  const newCenter = anchorWorld.sub(rotatedOffset);

  return {
    position: [
      Math.round(newCenter.x * 10) / 10,
      Math.round(newCenter.y * 10) / 10,
      Math.round(newCenter.z * 10) / 10,
    ],
    rotation: [
      ((Math.round(newRotationDeg[0] * 10) / 10) % 360 + 360) % 360,
      ((Math.round(newRotationDeg[1] * 10) / 10) % 360 + 360) % 360,
      ((Math.round(newRotationDeg[2] * 10) / 10) % 360 + 360) % 360,
    ],
  };
}

/**
 * Computes the world-space Axis-Aligned Bounding Box (AABB) and oriented axes of a Part.
 */
export function getPartWorldBounds(part: Part): WorldBounds {
  const { outerLength } = resolvePartLengths(part);
  const hx = outerLength / 2;
  const hy = part.dimensions.thickness / 2;
  const hz = part.dimensions.width / 2;

  const quat = getPartQuaternion(part.rotation);
  const center = new THREE.Vector3(...part.position);

  const axisX = new THREE.Vector3(1, 0, 0).applyQuaternion(quat).normalize();
  const axisY = new THREE.Vector3(0, 1, 0).applyQuaternion(quat).normalize();
  const axisZ = new THREE.Vector3(0, 0, 1).applyQuaternion(quat).normalize();

  const corners: THREE.Vector3[] = [];
  let minX = Infinity,
    minY = Infinity,
    minZ = Infinity;
  let maxX = -Infinity,
    maxY = -Infinity,
    maxZ = -Infinity;

  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const v = new THREE.Vector3(sx * hx, sy * hy, sz * hz)
          .applyQuaternion(quat)
          .add(center);
        corners.push(v);
        if (v.x < minX) minX = v.x;
        if (v.y < minY) minY = v.y;
        if (v.z < minZ) minZ = v.z;
        if (v.x > maxX) maxX = v.x;
        if (v.y > maxY) maxY = v.y;
        if (v.z > maxZ) maxZ = v.z;
      }
    }
  }

  return {
    min: [minX, minY, minZ],
    max: [maxX, maxY, maxZ],
    center: [center.x, center.y, center.z],
    size: [maxX - minX, maxY - minY, maxZ - minZ],
    corners,
    axisX,
    axisY,
    axisZ,
  };
}

/**
 * Smart Magnetic Snapping Engine:
 * Given a moving part at a candidate world position, snaps its faces, edges, and centers
 * to nearby stationary parts, the floor (Y=0), and optional room walls.
 */
export function computeSmartSnap(
  movingPart: Part,
  candidatePosition: [number, number, number],
  otherParts: Part[],
  room: RoomEnvironment,
  snapThresholdMm = 18
): {
  snappedPosition: [number, number, number];
  snapLines: SnapLine[];
} {
  const tempPart: Part = { ...movingPart, position: candidatePosition };
  const bounds = getPartWorldBounds(tempPart);
  const halfSize: [number, number, number] = [
    bounds.size[0] / 2,
    bounds.size[1] / 2,
    bounds.size[2] / 2,
  ];

  const finalPos: [number, number, number] = [...candidatePosition];
  const snapLines: SnapLine[] = [];

  // 1. Floor snap (Y = 0)
  const bottomY = finalPos[1] - halfSize[1];
  if (Math.abs(bottomY) <= snapThresholdMm) {
    finalPos[1] = halfSize[1];
  } else if (bottomY < 0) {
    // Prevent sinking below floor by default
    finalPos[1] = halfSize[1];
  }

  // 2. Room walls snap if enabled
  if (room.enabled) {
    const roomHalfW = room.width / 2;
    const roomHalfD = room.depth / 2;
    if (room.showBackWall) {
      const backZ = -roomHalfD;
      if (Math.abs(finalPos[2] - halfSize[2] - backZ) <= snapThresholdMm) {
        finalPos[2] = backZ + halfSize[2];
        snapLines.push({
          id: 'snap-wall-back',
          start: [-roomHalfW, finalPos[1], backZ],
          end: [roomHalfW, finalPos[1], backZ],
          color: '#38bdf8',
          label: 'הצמדה לקיר אחורי',
        });
      }
    }
    if (room.showLeftWall) {
      const leftX = -roomHalfW;
      if (Math.abs(finalPos[0] - halfSize[0] - leftX) <= snapThresholdMm) {
        finalPos[0] = leftX + halfSize[0];
        snapLines.push({
          id: 'snap-wall-left',
          start: [leftX, finalPos[1], -roomHalfD],
          end: [leftX, finalPos[1], roomHalfD],
          color: '#38bdf8',
          label: 'הצמדה לקיר שמאל',
        });
      }
    }
    if (room.showRightWall) {
      const rightX = roomHalfW;
      if (Math.abs(finalPos[0] + halfSize[0] - rightX) <= snapThresholdMm) {
        finalPos[0] = rightX - halfSize[0];
        snapLines.push({
          id: 'snap-wall-right',
          start: [rightX, finalPos[1], -roomHalfD],
          end: [rightX, finalPos[1], roomHalfD],
          color: '#38bdf8',
          label: 'הצמדה לקיר ימין',
        });
      }
    }
  }

  // 3. Snap against other visible parts (Face-to-Face, Edge Flush, Center-to-Center)
  let bestDx = Infinity;
  let bestDy = Infinity;
  let bestDz = Infinity;
  let lineX: SnapLine | null = null;
  let lineY: SnapLine | null = null;
  let lineZ: SnapLine | null = null;

  const curMin: [number, number, number] = [
    finalPos[0] - halfSize[0],
    finalPos[1] - halfSize[1],
    finalPos[2] - halfSize[2],
  ];
  const curMax: [number, number, number] = [
    finalPos[0] + halfSize[0],
    finalPos[1] + halfSize[1],
    finalPos[2] + halfSize[2],
  ];

  for (const target of otherParts) {
    if (target.id === movingPart.id || !target.visible) continue;
    const tb = getPartWorldBounds(target);

    // Check proximity (only snap to parts within reasonable range or along alignment lines)
    // X axis candidates:
    const xCandidates = [
      // Butt joint (Face-to-face): my max to target min, my min to target max
      { delta: tb.min[0] - curMax[0], snapVal: tb.min[0], type: 'הצמדת פאה (Butt)' },
      { delta: tb.max[0] - curMin[0], snapVal: tb.max[0], type: 'הצמדת פאה (Butt)' },
      // Flush edges: my min to target min, my max to target max
      { delta: tb.min[0] - curMin[0], snapVal: tb.min[0], type: 'יישור קצה (Flush)' },
      { delta: tb.max[0] - curMax[0], snapVal: tb.max[0], type: 'יישור קצה (Flush)' },
      // Center-to-center
      { delta: tb.center[0] - finalPos[0], snapVal: tb.center[0], type: 'מרכז למרכז' },
    ];

    for (const c of xCandidates) {
      if (Math.abs(c.delta) <= snapThresholdMm && Math.abs(c.delta) < Math.abs(bestDx)) {
        bestDx = c.delta;
        lineX = {
          id: `snap-x-${target.id}`,
          start: [c.snapVal, Math.min(finalPos[1], tb.center[1]), Math.min(finalPos[2], tb.center[2]) - 100],
          end: [c.snapVal, Math.max(finalPos[1], tb.center[1]), Math.max(finalPos[2], tb.center[2]) + 100],
          color: c.type.includes('מרכז') ? '#f472b6' : '#22c55e',
          label: c.type,
        };
      }
    }

    // Y axis candidates:
    const yCandidates = [
      { delta: tb.max[1] - curMin[1], snapVal: tb.max[1], type: 'הנחה על פאה עליונה' },
      { delta: tb.min[1] - curMax[1], snapVal: tb.min[1], type: 'הצמדה לתחתית' },
      { delta: tb.max[1] - curMax[1], snapVal: tb.max[1], type: 'יישור גובה עליון' },
      { delta: tb.min[1] - curMin[1], snapVal: tb.min[1], type: 'יישור גובה תחתון' },
      { delta: tb.center[1] - finalPos[1], snapVal: tb.center[1], type: 'מרכז גובה' },
    ];

    for (const c of yCandidates) {
      if (Math.abs(c.delta) <= snapThresholdMm && Math.abs(c.delta) < Math.abs(bestDy)) {
        bestDy = c.delta;
        lineY = {
          id: `snap-y-${target.id}`,
          start: [Math.min(finalPos[0], tb.center[0]) - 100, c.snapVal, finalPos[2]],
          end: [Math.max(finalPos[0], tb.center[0]) + 100, c.snapVal, finalPos[2]],
          color: '#38bdf8',
          label: c.type,
        };
      }
    }

    // Z axis candidates:
    const zCandidates = [
      { delta: tb.min[2] - curMax[2], snapVal: tb.min[2], type: 'הצמדת פאה (Butt)' },
      { delta: tb.max[2] - curMin[2], snapVal: tb.max[2], type: 'הצמדת פאה (Butt)' },
      { delta: tb.min[2] - curMin[2], snapVal: tb.min[2], type: 'יישור קצה (Flush)' },
      { delta: tb.max[2] - curMax[2], snapVal: tb.max[2], type: 'יישור קצה (Flush)' },
      { delta: tb.center[2] - finalPos[2], snapVal: tb.center[2], type: 'מרכז למרכז' },
    ];

    for (const c of zCandidates) {
      if (Math.abs(c.delta) <= snapThresholdMm && Math.abs(c.delta) < Math.abs(bestDz)) {
        bestDz = c.delta;
        lineZ = {
          id: `snap-z-${target.id}`,
          start: [Math.min(finalPos[0], tb.center[0]) - 100, finalPos[1], c.snapVal],
          end: [Math.max(finalPos[0], tb.center[0]) + 100, finalPos[1], c.snapVal],
          color: c.type.includes('מרכז') ? '#f472b6' : '#22c55e',
          label: c.type,
        };
      }
    }
  }

  if (Math.abs(bestDx) <= snapThresholdMm) {
    finalPos[0] += bestDx;
    if (lineX) snapLines.push(lineX);
  }
  if (Math.abs(bestDy) <= snapThresholdMm) {
    finalPos[1] += bestDy;
    if (lineY) snapLines.push(lineY);
  }
  if (Math.abs(bestDz) <= snapThresholdMm) {
    finalPos[2] += bestDz;
    if (lineZ) snapLines.push(lineZ);
  }

  // Re-ensure floor bound
  if (finalPos[1] - halfSize[1] < 0) {
    finalPos[1] = halfSize[1];
  }

  return {
    snappedPosition: [
      Math.round(finalPos[0] * 10) / 10,
      Math.round(finalPos[1] * 10) / 10,
      Math.round(finalPos[2] * 10) / 10,
    ],
    snapLines,
  };
}

/**
 * Detects 3D volumetric collisions (overlaps > 2mm in all 3 axes) between visible parts.
 * Used both for collision warnings and for parametric Half-Lap / Dado joints!
 */
export function detectPartCollisions(parts: Part[]): CollisionPair[] {
  const visibleParts = parts.filter((p) => p.visible);
  const boundsMap = new Map<string, WorldBounds>();
  for (const p of visibleParts) {
    boundsMap.set(p.id, getPartWorldBounds(p));
  }

  const collisions: CollisionPair[] = [];
  const epsilon = 15.0; // Ignore touching faces and slight butt-joint overlaps (< 15mm)

  for (let i = 0; i < visibleParts.length; i++) {
    for (let j = i + 1; j < visibleParts.length; j++) {
      const a = visibleParts[i];
      const b = visibleParts[j];
      const ba = boundsMap.get(a.id)!;
      const bb = boundsMap.get(b.id)!;

      const minX = Math.max(ba.min[0], bb.min[0]);
      const maxX = Math.min(ba.max[0], bb.max[0]);
      const minY = Math.max(ba.min[1], bb.min[1]);
      const maxY = Math.min(ba.max[1], bb.max[1]);
      const minZ = Math.max(ba.min[2], bb.min[2]);
      const maxZ = Math.min(ba.max[2], bb.max[2]);

      const dx = maxX - minX;
      const dy = maxY - minY;
      const dz = maxZ - minZ;

      if (dx > epsilon && dy > epsilon && dz > epsilon) {
        const hasDadoAlready =
          a.dadoNotches.some((d) => d.cutterPartId === b.id) ||
          b.dadoNotches.some((d) => d.cutterPartId === a.id);

        collisions.push({
          id: `${a.id}__${b.id}`,
          partAId: a.id,
          partBId: b.id,
          partAName: a.name,
          partBName: b.name,
          overlapBox: {
            min: [minX, minY, minZ],
            max: [maxX, maxY, maxZ],
            size: [dx, dy, dz],
          },
          hasDadoAlready,
        });
      }
    }
  }

  return collisions;
}

/**
 * Calculates Kreg Pocket-Hole Jig & Screw settings based on wood thickness and species.
 */
export function calculateKregRecommendation(part: Part): KregRecommendation | null {
  if (!part.pocketHoles.enabled) return null;
  const stock = getStockById(part.stockId);
  const t = part.dimensions.thickness;

  let jigSettingMm = '19 מ"מ (3/4")';
  let drillCollarMm = '19 מ"מ (3/4")';
  let screwLengthMm = 32;
  let screwLengthInch = '1-1/4"';

  if (t <= 14) {
    jigSettingMm = '12 מ"מ (1/2")';
    drillCollarMm = '12 מ"מ (1/2")';
    screwLengthMm = 25;
    screwLengthInch = '1"';
  } else if (t <= 18) {
    jigSettingMm = '16 מ"מ (5/8")';
    drillCollarMm = '16 מ"מ (5/8")';
    screwLengthMm = 32;
    screwLengthInch = '1-1/4"';
  } else if (t <= 24) {
    jigSettingMm = '19 מ"מ (3/4")';
    drillCollarMm = '19 מ"מ (3/4")';
    screwLengthMm = 38;
    screwLengthInch = '1-1/2"';
  } else if (t <= 33) {
    jigSettingMm = '29 מ"מ (1-1/8")';
    drillCollarMm = '29 מ"מ (1-1/8")';
    screwLengthMm = 51;
    screwLengthInch = '2"';
  } else {
    jigSettingMm = '38 מ"מ (1-1/2")';
    drillCollarMm = '38 מ"מ (1-1/2")';
    screwLengthMm = 64;
    screwLengthInch = '2-1/2"';
  }

  const isHardwood = stock.species === 'oak' || stock.species === 'ipe';
  const threadType = isHardwood
    ? 'עדינה (Fine - לעץ קשה כגון אלון)'
    : 'גסה (Coarse - לעץ רך/לבוד)';

  const edgeMultiplier =
    part.pocketHoles.ends === 'both'
      ? 2
      : part.pocketHoles.ends === 'sides'
      ? 4
      : 1;

  return {
    woodThicknessMm: t,
    jigSettingMm,
    drillCollarMm,
    screwLengthMm,
    screwLengthInch,
    threadType,
    totalScrewsForPart: part.pocketHoles.holesPerEdge * edgeMultiplier,
  };
}

/**
 * Structural Sag & Load Calculator (Engineering Beam Deflection Engine):
 * Evaluates horizontal beams and shelves for sag under realistic woodworking loads.
 * Specifically catches cases like an Oak 2x10 (20x100mm) or Pine 5x10 placed across a 3-meter span!
 */
export function analyzeStructuralLoads(parts: Part[]): StructuralLoadResult[] {
  const visibleParts = parts.filter((p) => p.visible);
  const boundsMap = new Map<string, WorldBounds>();
  for (const p of visibleParts) {
    boundsMap.set(p.id, getPartWorldBounds(p));
  }

  const results: StructuralLoadResult[] = [];

  for (const part of visibleParts) {
    const stock = getStockById(part.stockId);
    if (stock.category === 'hardware') continue;

    const b = boundsMap.get(part.id)!;
    const { outerLength } = resolvePartLengths(part);

    // Check if the part's primary length axis (local X) is mostly horizontal
    // axisX.y near 0 means horizontal beam/shelf; axisX.y near 1 means vertical post/leg
    const verticalComponent = Math.abs(b.axisX.y);
    if (verticalComponent > 0.45 || outerLength < 450) {
      // It's a vertical leg or very short block — no horizontal span sag risk
      continue;
    }

    // Determine effective vertical height (h) and horizontal breadth (width_b) of the cross section
    // In local space, Y is thickness and Z is width.
    // Let's project local Y and local Z onto world Y (vertical) to see how the beam is oriented:
    const localYVertical = Math.abs(b.axisY.y);
    const localZVertical = Math.abs(b.axisZ.y);

    const hMm = Math.max(
      10,
      localYVertical * part.dimensions.thickness + localZVertical * part.dimensions.width
    );
    const breadthMm = Math.max(
      10,
      (1 - localYVertical) * part.dimensions.thickness +
        (1 - localZVertical) * part.dimensions.width
    );

    const isLaidFlat = hMm < breadthMm;

    // Find supports below this beam (other parts whose top touches or intersects the bottom of this beam,
    // or if the beam rests directly on the floor Y=0)
    if (b.min[1] <= 5) {
      // Resting directly on the floor — fully supported
      continue;
    }

    // Collect positions along the beam's primary horizontal axis where it is supported
    const beamDir = new THREE.Vector3(b.axisX.x, 0, b.axisX.z).normalize();
    const beamCenter2D = new THREE.Vector3(b.center[0], 0, b.center[2]);

    const supportIntervals: Array<[number, number]> = [];

    for (const other of visibleParts) {
      if (other.id === part.id) continue;
      const ob = boundsMap.get(other.id)!;

      // Check if `other` is below or intersecting `part` vertically, and overlaps in X/Z
      const horizOverlapX = Math.min(b.max[0], ob.max[0]) - Math.max(b.min[0], ob.min[0]);
      const horizOverlapZ = Math.min(b.max[2], ob.max[2]) - Math.max(b.min[2], ob.min[2]);
      const verticalTouch =
        ob.max[1] >= b.min[1] - 15 && ob.min[1] < b.min[1] + b.size[1] * 0.5;

      if (horizOverlapX > -10 && horizOverlapZ > -10 && verticalTouch) {
        // Project the overlapping box's corners onto the beam axis [-outerLength/2, +outerLength/2]
        const overlapCenter = new THREE.Vector3(
          (Math.max(b.min[0], ob.min[0]) + Math.min(b.max[0], ob.max[0])) / 2,
          0,
          (Math.max(b.min[2], ob.min[2]) + Math.min(b.max[2], ob.max[2])) / 2
        );
        const relPos = overlapCenter.sub(beamCenter2D).dot(beamDir);
        const halfSupportWidth = Math.max(25, Math.min(ob.size[0], ob.size[2]) / 2);
        supportIntervals.push([relPos - halfSupportWidth, relPos + halfSupportWidth]);
      }
    }

    // Compute maximum unsupported span (in mm)
    let unsupportedSpanMm = outerLength;
    if (supportIntervals.length >= 2) {
      supportIntervals.sort((a, b) => a[0] - b[0]);
      let maxGap = 0;
      for (let i = 0; i < supportIntervals.length - 1; i++) {
        const gap = supportIntervals[i + 1][0] - supportIntervals[i][1];
        if (gap > maxGap) maxGap = gap;
      }
      // Also check overhangs at either end
      const leftOverhang = supportIntervals[0][0] - -outerLength / 2;
      const rightOverhang = outerLength / 2 - supportIntervals[supportIntervals.length - 1][1];
      unsupportedSpanMm = Math.max(maxGap, leftOverhang * 2, rightOverhang * 2);
    } else if (supportIntervals.length === 1) {
      // Cantilever or single central support -> effectively behaves like double the overhang
      unsupportedSpanMm = outerLength;
    }

    if (unsupportedSpanMm < 850) continue;

    // Engineering beam deflection calculation:
    // E in N/mm^2 (MPa) = elasticModulusGPa * 1000
    const E_MPa = stock.elasticModulusGPa * 1000;
    // Moment of inertia I = (b * h^3) / 12 in mm^4
    const I_mm4 = (breadthMm * Math.pow(hMm, 3)) / 12;

    // Self-weight of the span in N + realistic utility design load:
    // Scale design load proportionally to unsupported span (e.g. ~55 kg/m uniform load)
    const spanMeters = unsupportedSpanMm / 1000;
    const volumeM3 = (unsupportedSpanMm * breadthMm * hMm) / 1e9;
    const selfWeightKg = volumeM3 * stock.densityKgM3;
    const designUsageLoadKg = Math.round(spanMeters * 55);
    const totalLoadKg = selfWeightKg + designUsageLoadKg;
    const totalLoadN = totalLoadKg * 9.81;

    // Uniformly distributed load + modest center load deflection:
    // delta = (5 * W_unif * L^3) / (384 * E * I) + (P_center * L^3) / (48 * E * I)
    const W_unif = totalLoadN * 0.8;
    const P_center = totalLoadN * 0.2;
    const L = unsupportedSpanMm;

    const deflectionMm =
      (5 * W_unif * Math.pow(L, 3)) / (384 * E_MPa * I_mm4) +
      (P_center * Math.pow(L, 3)) / (48 * E_MPa * I_mm4);

    // Also compute what deflection would be if rotated 90 deg onto its strong edge:
    const strongH = Math.max(part.dimensions.thickness, part.dimensions.width);
    const strongB = Math.min(part.dimensions.thickness, part.dimensions.width);
    const I_strong = (strongB * Math.pow(strongH, 3)) / 12;
    const edgewiseDeflectionMm =
      (5 * W_unif * Math.pow(L, 3)) / (384 * E_MPa * I_strong) +
      (P_center * Math.pow(L, 3)) / (48 * E_MPa * I_strong);

    // Allowable deflection standard: L / 360 (or max 4.5 mm for furniture)
    const allowableDeflectionMm = Math.min(L / 360, 5.0);

    let severity: StructuralLoadResult['severity'] = 'safe';
    if (deflectionMm > allowableDeflectionMm * 2.5 || deflectionMm > 12) {
      severity = 'critical';
    } else if (deflectionMm > allowableDeflectionMm) {
      severity = 'warning';
    } else if (deflectionMm > allowableDeflectionMm * 0.75) {
      severity = 'caution';
    }

    let recommendationHe = 'המפתח תקין ועומד בעומס בבטחה.';
    if (severity === 'critical' || severity === 'warning') {
      const tips: string[] = [];
      if (isLaidFlat && strongH > hMm * 1.4) {
        tips.push(
          `סובב את הקורה ב-90° על דופנה (Edgewise) כדי להקטין את השקיעה מ-${deflectionMm.toFixed(
            1
          )} מ"מ ל-${edgewiseDeflectionMm.toFixed(1)} מ"מ`
        );
      }
      if (unsupportedSpanMm > 1400) {
        tips.push(
          `הוסף רגל תמיכה אמצעית להקטנת המפתח החופשי מ-${Math.round(
            unsupportedSpanMm / 10
          )} ס"מ ל-${Math.round(unsupportedSpanMm / 20)} ס"מ`
        );
      }
      tips.push('או בחר קורה בעלת חתך עבה/גבוה יותר (כגון 5×15 או 5×20)');
      recommendationHe = `אזהרת כפיפה/שקיעה: במפתח חופשי של ${Math.round(
        unsupportedSpanMm / 10
      )} ס"מ, החלק "${part.name}" (${stock.name}) צפוי לשקוע כ-${deflectionMm.toFixed(
        1
      )} מ"מ (מעל התקן המומלץ של ${allowableDeflectionMm.toFixed(1)} מ"מ). מומלץ: ${tips.join(
        ', '
      )}.`;
    } else if (severity === 'caution') {
      recommendationHe = `מפתח גבולי (${Math.round(
        unsupportedSpanMm / 10
      )} ס"מ): שקיעה צפויה של ${deflectionMm.toFixed(
        1
      )} מ"מ תחת עומס מלא. לעומסים כבדים מומלץ להוסיף קושרת או תמיכה.`;
    }

    results.push({
      partId: part.id,
      partName: part.name,
      isHorizontalSpan: true,
      unsupportedSpanMm: Math.round(unsupportedSpanMm),
      assumedLoadKg: Math.round(totalLoadKg),
      deflectionMm: Math.round(deflectionMm * 10) / 10,
      allowableDeflectionMm: Math.round(allowableDeflectionMm * 10) / 10,
      severity,
      isLaidFlat,
      edgewiseDeflectionMm: Math.round(edgewiseDeflectionMm * 10) / 10,
      recommendationHe,
    });
  }

  return results;
}
