import * as THREE from 'three';
import { Brush, Evaluator, SUBTRACTION } from 'three-bvh-csg';
import { Part, WoodSpecies } from '../types/woodcraft';
import { getStockById } from '../data/stockLibrary';
import {
  getPartQuaternion,
  resolvePartLengths,
} from './geometryAndEngineering';

const textureCache = new Map<string, THREE.CanvasTexture>();
const csgEvaluator = new Evaluator();

/**
 * Connected-Component 3D Mesh Island Splitter:
 * Analyzes a CSG-subtracted BufferGeometry and determines whether the cut physically severed the beam
 * into 2 or more disconnected 3D islands (e.g., when a Dado or Jigsaw cut slices all the way through
 * the cross-section near the top/end of a beam, leaving a disconnected remainder/sliver).
 * If connected, returns a single island. If severed, returns all islands sorted largest-first (index 0 = main beam, index 1+ = severed remainder pieces).
 */
export function splitDisconnectedMeshIslands(
  geom: THREE.BufferGeometry
): THREE.BufferGeometry[] {
  const posAttr = geom.getAttribute('position');
  if (!posAttr || posAttr.count < 3) return [geom];

  const indexAttr = geom.getIndex();
  const triCount = indexAttr
    ? Math.floor(indexAttr.count / 3)
    : Math.floor(posAttr.count / 3);
  if (triCount <= 1) return [geom];

  const getVertIdx = (tri: number, corner: number): number =>
    indexAttr ? indexAttr.getX(tri * 3 + corner) : tri * 3 + corner;

  // Map quantized 3D vertex positions (0.15mm tolerance) to welded vertex IDs
  const posKeyToId = new Map<string, number>();
  const vertToTris: number[][] = [];
  const triVertIds = new Int32Array(triCount * 3);

  for (let t = 0; t < triCount; t++) {
    for (let c = 0; c < 3; c++) {
      const vi = getVertIdx(t, c);
      const qx = Math.round(posAttr.getX(vi) * 5);
      const qy = Math.round(posAttr.getY(vi) * 5);
      const qz = Math.round(posAttr.getZ(vi) * 5);
      const key = `${qx}_${qy}_${qz}`;
      let id = posKeyToId.get(key);
      if (id === undefined) {
        id = vertToTris.length;
        posKeyToId.set(key, id);
        vertToTris.push([]);
      }
      triVertIds[t * 3 + c] = id;
      vertToTris[id].push(t);
    }
  }

  // BFS to find connected triangle components
  const visited = new Uint8Array(triCount);
  const components: number[][] = [];

  for (let t = 0; t < triCount; t++) {
    if (visited[t]) continue;
    const comp: number[] = [];
    const queue: number[] = [t];
    visited[t] = 1;

    while (queue.length > 0) {
      const cur = queue.pop()!;
      comp.push(cur);
      for (let c = 0; c < 3; c++) {
        const vid = triVertIds[cur * 3 + c];
        const neighbors = vertToTris[vid];
        for (let i = 0; i < neighbors.length; i++) {
          const nb = neighbors[i];
          if (!visited[nb]) {
            visited[nb] = 1;
            queue.push(nb);
          }
        }
      }
    }
    components.push(comp);
  }

  if (components.length <= 1) {
    return [geom];
  }

  // Compute approximate bounding-box volume / surface metric for each island so index 0 is always the main beam
  const uvAttr = geom.getAttribute('uv');
  const normAttr = geom.getAttribute('normal');

  const islandItems = components.map((tris) => {
    const positions = new Float32Array(tris.length * 9);
    const normals = normAttr ? new Float32Array(tris.length * 9) : null;
    const uvs = uvAttr ? new Float32Array(tris.length * 6) : null;

    let minX = Infinity,
      minY = Infinity,
      minZ = Infinity;
    let maxX = -Infinity,
      maxY = -Infinity,
      maxZ = -Infinity;

    for (let i = 0; i < tris.length; i++) {
      const t = tris[i];
      for (let c = 0; c < 3; c++) {
        const vi = getVertIdx(t, c);
        const px = posAttr.getX(vi);
        const py = posAttr.getY(vi);
        const pz = posAttr.getZ(vi);

        const pBase = i * 9 + c * 3;
        positions[pBase] = px;
        positions[pBase + 1] = py;
        positions[pBase + 2] = pz;

        if (px < minX) minX = px;
        if (py < minY) minY = py;
        if (pz < minZ) minZ = pz;
        if (px > maxX) maxX = px;
        if (py > maxY) maxY = py;
        if (pz > maxZ) maxZ = pz;

        if (normals && normAttr) {
          normals[pBase] = normAttr.getX(vi);
          normals[pBase + 1] = normAttr.getY(vi);
          normals[pBase + 2] = normAttr.getZ(vi);
        }
        if (uvs && uvAttr) {
          const uBase = i * 6 + c * 2;
          uvs[uBase] = uvAttr.getX(vi);
          uvs[uBase + 1] = uvAttr.getY(vi);
        }
      }
    }

    const subGeom = new THREE.BufferGeometry();
    subGeom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    if (normals) {
      subGeom.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    } else {
      subGeom.computeVertexNormals();
    }
    if (uvs) {
      subGeom.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    }

    const volScore =
      Math.max(1, maxX - minX) *
      Math.max(1, maxY - minY) *
      Math.max(1, maxZ - minZ);

    return { subGeom, volScore };
  });

  islandItems.sort((a, b) => b.volScore - a.volScore);
  return islandItems.map((item) => item.subGeom);
}

/**
 * Merges a subset of BufferGeometries into a single BufferGeometry.
 */
function mergeIslandGeometries(
  islands: THREE.BufferGeometry[]
): THREE.BufferGeometry {
  if (islands.length === 0) return new THREE.BufferGeometry();
  if (islands.length === 1) return islands[0];

  let totalVerts = 0;
  let hasUV = true;
  for (const g of islands) {
    totalVerts += g.getAttribute('position').count;
    if (!g.getAttribute('uv')) hasUV = false;
  }

  const positions = new Float32Array(totalVerts * 3);
  const normals = new Float32Array(totalVerts * 3);
  const uvs = hasUV ? new Float32Array(totalVerts * 2) : null;

  let vOffset = 0;
  for (const g of islands) {
    const pos = g.getAttribute('position');
    const norm = g.getAttribute('normal');
    const uv = g.getAttribute('uv');
    positions.set(pos.array as Float32Array, vOffset * 3);
    if (norm) {
      normals.set(norm.array as Float32Array, vOffset * 3);
    }
    if (uvs && uv) {
      uvs.set(uv.array as Float32Array, vOffset * 2);
    }
    vOffset += pos.count;
  }

  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  merged.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  if (uvs) {
    merged.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  }
  return merged;
}

/**
 * Generates a realistic procedural wood grain texture on a 2D canvas
 * so boards show authentic wood grain direction without external assets.
 */
export function getWoodTexture(
  species: WoodSpecies,
  baseHex: string,
  grainHex: string,
  hasGrain: boolean
): THREE.CanvasTexture {
  const key = `${species}_${baseHex}_${grainHex}_${hasGrain}`;
  if (textureCache.has(key)) {
    return textureCache.get(key)!;
  }

  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (hasGrain) {
    ctx.strokeStyle = grainHex;
    ctx.globalAlpha = 0.28;

    // Draw longitudinal wood fibers along X axis
    for (let i = 0; i < 65; i++) {
      const yBase = (i / 65) * canvas.height;
      ctx.lineWidth = 1 + (i % 3) * 0.8;
      ctx.beginPath();
      ctx.moveTo(0, yBase);
      for (let x = 0; x <= canvas.width; x += 32) {
        const wave =
          Math.sin(x * 0.018 + i * 0.7) * 3.5 +
          Math.cos(x * 0.04 - i * 0.3) * 1.5;
        ctx.lineTo(x, yBase + wave);
      }
      ctx.stroke();
    }

    // Add subtle cathedral grain arches
    ctx.globalAlpha = 0.14;
    for (let k = 0; k < 4; k++) {
      const cx = 90 + k * 120;
      const cy = 40 + (k % 2) * 160;
      for (let r = 12; r < 65; r += 12) {
        ctx.beginPath();
        ctx.ellipse(cx, cy, r * 2.4, r * 0.55, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  } else {
    // Subtle speckle for MDF or brushed metal
    ctx.fillStyle = grainHex;
    ctx.globalAlpha = 0.12;
    for (let i = 0; i < 600; i++) {
      const x = (i * 73) % canvas.width;
      const y = (i * 41) % canvas.height;
      ctx.fillRect(x, y, 2, 2);
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.needsUpdate = true;
  textureCache.set(key, texture);
  return texture;
}

/**
 * Builds the 3D BufferGeometry for a Part, applying:
 * 1. Exact Miter Cuts at start (-X) and end (+X)
 * 2. Parametric Half-Lap / Dado Boolean Subtractions (`three-bvh-csg`) from intersecting cutter parts
 */
export function buildPartGeometry(
  part: Part,
  allParts: Part[]
): THREE.BufferGeometry {
  const { outerLength } = resolvePartLengths(part);
  const L = Math.max(20, outerLength);
  const T = Math.max(5, part.dimensions.thickness);
  const W = Math.max(10, part.dimensions.width);

  const baseGeom = new THREE.BoxGeometry(L, T, W, 1, 1, 1);

  // Apply Miter Cuts by shearing/clipping the end vertices at x = -L/2 and x = +L/2
  const posAttr = baseGeom.attributes.position;
  const halfL = L / 2;

  if (part.miterStart.enabled || part.miterEnd.enabled) {
    for (let i = 0; i < posAttr.count; i++) {
      let vx = posAttr.getX(i);
      const vy = posAttr.getY(i); // in [-T/2, +T/2]
      const vz = posAttr.getZ(i); // in [-W/2, +W/2]

      // Start end (-X)
      if (vx < 0 && part.miterStart.enabled && Math.abs(part.miterStart.angle) >= 0.1) {
        const ang = Math.max(-75, Math.min(75, part.miterStart.angle));
        const tanA = Math.tan((ang * Math.PI) / 180);
        if (part.miterStart.axis === 'z') {
          // Cut across width Z: one side stays at -halfL, the other shifts inward (+X)
          const normalizedZ = tanA >= 0 ? (vz + W / 2) / W : (W / 2 - vz) / W;
          const inset = normalizedZ * W * Math.abs(tanA);
          vx = Math.min(halfL - 5, -halfL + inset);
        } else {
          // Bevel across thickness Y
          const normalizedY = tanA >= 0 ? (vy + T / 2) / T : (T / 2 - vy) / T;
          const inset = normalizedY * T * Math.abs(tanA);
          vx = Math.min(halfL - 5, -halfL + inset);
        }
      }

      // End cap (+X)
      if (vx > 0 && part.miterEnd.enabled && Math.abs(part.miterEnd.angle) >= 0.1) {
        const ang = Math.max(-75, Math.min(75, part.miterEnd.angle));
        const tanA = Math.tan((ang * Math.PI) / 180);
        if (part.miterEnd.axis === 'z') {
          const normalizedZ = tanA >= 0 ? (vz + W / 2) / W : (W / 2 - vz) / W;
          const inset = normalizedZ * W * Math.abs(tanA);
          vx = Math.max(-halfL + 5, halfL - inset);
        } else {
          const normalizedY = tanA >= 0 ? (vy + T / 2) / T : (T / 2 - vy) / T;
          const inset = normalizedY * T * Math.abs(tanA);
          vx = Math.max(-halfL + 5, halfL - inset);
        }
      }

      posAttr.setX(i, vx);
    }
    posAttr.needsUpdate = true;
    baseGeom.computeVertexNormals();
  }

  const jigsawCuts = part.jigsawCuts || [];
  const hasDados = part.dadoNotches.length > 0;
  const hasJigsaw = jigsawCuts.length > 0;

  // Apply Parametric Dado / Half-Lap notches AND Jigsaw / Flush-Trim cuts using `three-bvh-csg`
  if (hasDados || hasJigsaw) {
    try {
      const partQuat = getPartQuaternion(part.rotation);
      const partInvQuat = partQuat.clone().invert();
      const partCenter = new THREE.Vector3(...part.position);

      let currentBrush = new Brush(baseGeom);
      currentBrush.updateMatrixWorld();

      let anySubtracted = false;

      // 1. Parametric Dado / Half-Lap Notches (exact cutter box — no artificial extension!)
      for (const dado of part.dadoNotches) {
        const cutter = allParts.find(
          (p) => p.id === dado.cutterPartId && p.visible
        );
        if (!cutter) continue;

        const cutterLengths = resolvePartLengths(cutter);
        const cL = cutterLengths.outerLength + 2; // +2mm clearance for clean CSG cut
        const cT = cutter.dimensions.thickness + 2;
        const cW = cutter.dimensions.width + 2;

        // Compute cutter transform relative to `part` local space
        const cutterCenter = new THREE.Vector3(...cutter.position);
        const relPos = cutterCenter
          .clone()
          .sub(partCenter)
          .applyQuaternion(partInvQuat);

        const cutterQuat = getPartQuaternion(cutter.rotation);
        const relQuat = partInvQuat.clone().multiply(cutterQuat);

        if (dado.mode === 'half') {
          // Half-Lap: shift cutter outward along cross-section axis by 50% so the two beams interlock flush
          const normY = Math.abs(relPos.y) / Math.max(1, T);
          const normZ = Math.abs(relPos.z) / Math.max(1, W);
          const signOrder = part.id < cutter.id ? 1 : -1;
          if (normZ > normY + 0.15) {
            const dirZ = Math.abs(relPos.z) > 1 ? Math.sign(relPos.z) : signOrder;
            relPos.z += dirZ * (W * 0.5);
          } else {
            const dirY = Math.abs(relPos.y) > 1 ? Math.sign(relPos.y) : signOrder;
            relPos.y += dirY * (T * 0.5);
          }
        }

        const cutterGeom = new THREE.BoxGeometry(cL, cT, cW);
        const cutterBrush = new Brush(cutterGeom);

        cutterBrush.position.copy(relPos);
        cutterBrush.quaternion.copy(relQuat);
        cutterBrush.updateMatrixWorld();

        const resultBrush = csgEvaluator.evaluate(
          currentBrush,
          cutterBrush,
          SUBTRACTION
        );
        currentBrush = resultBrush;
        anySubtracted = true;
      }

      // 2. Jigsaw / Custom Profile & Free/Snapped Flush-Trim Cuts (`part.jigsawCuts`)
      for (const jCut of jigsawCuts) {
        if (jCut.type === 'trim-plane') {
          const slabSize = Math.max(L, W, T) * 4;
          const shiftMm = jCut.offsetMm || 0;
          const extraAngRad = ((jCut.angleDeg || 0) * Math.PI) / 180;
          const edge = jCut.edge || 'top';

          const refPart = jCut.referencePartId
            ? allParts.find((p) => p.id === jCut.referencePartId && p.visible)
            : undefined;

          if (refPart) {
            // Magnetic Flush Trim aligned to the boundary of `refPart` + free user offset (`offsetMm`) and angle (`angleDeg`)!
            const refCenter = new THREE.Vector3(...refPart.position);
            const relPos = refCenter
              .clone()
              .sub(partCenter)
              .applyQuaternion(partInvQuat);
            const refQuat = getPartQuaternion(refPart.rotation);
            const relQuat = partInvQuat.clone().multiply(refQuat);

            const rT = refPart.dimensions.thickness;
            const rW = refPart.dimensions.width;
            const refWorldY = new THREE.Vector3(0, 1, 0).applyQuaternion(refQuat);
            const refWorldZ = new THREE.Vector3(0, 0, 1).applyQuaternion(refQuat);
            const toRefFromPart = relPos.clone().normalize();
            const refYInPart = new THREE.Vector3(0, 1, 0).applyQuaternion(relQuat);
            const refZInPart = new THREE.Vector3(0, 0, 1).applyQuaternion(relQuat);

            // Pick the primary boundary face of refPart (top/bottom/front/back or nearest outward face)
            const useZAxis =
              edge === 'front' ||
              edge === 'back' ||
              Math.abs(refWorldZ.y) > Math.abs(refWorldY.y) + 0.15;

            const slabGeom = new THREE.BoxGeometry(slabSize, slabSize, slabSize);
            const slabBrush = new Brush(slabGeom);

            const extraRot = new THREE.Quaternion().setFromAxisAngle(
              new THREE.Vector3(1, 0, 0),
              extraAngRad
            );
            const finalQuat = relQuat.clone().multiply(extraRot);

            if (useZAxis) {
              const signZ =
                edge === 'bottom' || edge === 'back'
                  ? -1
                  : refWorldZ.y >= 0.2
                  ? 1
                  : refWorldZ.y <= -0.2
                  ? -1
                  : Math.sign(refZInPart.dot(toRefFromPart)) || 1;
              const localOffset = new THREE.Vector3(
                0,
                0,
                signZ * (rW / 2 + shiftMm + slabSize / 2)
              ).applyQuaternion(finalQuat);
              slabBrush.position.copy(relPos).add(localOffset);
            } else {
              const signY =
                edge === 'bottom'
                  ? -1
                  : refWorldY.y >= 0.2
                  ? 1
                  : refWorldY.y <= -0.2
                  ? -1
                  : Math.sign(refYInPart.dot(toRefFromPart)) || 1;
              const localOffset = new THREE.Vector3(
                0,
                signY * (rT / 2 + shiftMm + slabSize / 2),
                0
              ).applyQuaternion(finalQuat);
              slabBrush.position.copy(relPos).add(localOffset);
            }

            slabBrush.quaternion.copy(finalQuat);
            slabBrush.updateMatrixWorld();
            currentBrush = csgEvaluator.evaluate(
              currentBrush,
              slabBrush,
              SUBTRACTION
            );
            anySubtracted = true;
          } else {
            // Free custom cut plane along the beam (`offsetMm` from end/center + `angleDeg` tilt)
            const slabGeom = new THREE.BoxGeometry(slabSize, slabSize, slabSize);
            const slabBrush = new Brush(slabGeom);
            const endSign = edge === 'start' ? -1 : 1;
            const cutDepthFromEnd = Math.max(5, jCut.depthMm ?? 60) - shiftMm;
            const planeX = endSign * (halfL - cutDepthFromEnd + slabSize / 2);
            if (W >= T) {
              slabBrush.rotation.set(0, extraAngRad, 0);
            } else {
              slabBrush.rotation.set(0, 0, extraAngRad);
            }
            slabBrush.position.set(planeX, 0, 0);
            slabBrush.updateMatrixWorld();
            currentBrush = csgEvaluator.evaluate(
              currentBrush,
              slabBrush,
              SUBTRACTION
            );
            anySubtracted = true;
          }
        } else if (jCut.type === 'arch') {
          // Jigsaw Curved Arch Cutout along bottom/top/front/back edge
          const span = Math.max(40, Math.min(L - 20, jCut.lengthMm || L * 0.65));
          const depth = Math.max(10, Math.min(Math.max(W, T) * 0.85, jCut.depthMm || Math.max(W, T) * 0.45));
          const offset = jCut.offsetMm || 0;
          const edge = jCut.edge || 'bottom';

          // Build a cylinder stretched into an elliptical arch
          const cylGeom = new THREE.CylinderGeometry(1, 1, Math.max(T, W) * 3, 40);
          // Cylinder is along Y by default; rotate or scale according to whether the board's wide face is Z or Y
          if (W >= T) {
            // Cut arch into Z width (cylinder axis along Y thickness)
            cylGeom.scale(span / 2, 1, depth);
            const archBrush = new Brush(cylGeom);
            const zSign = edge === 'top' || edge === 'front' ? 1 : -1;
            archBrush.position.set(offset, 0, zSign * (W / 2));
            archBrush.updateMatrixWorld();
            currentBrush = csgEvaluator.evaluate(
              currentBrush,
              archBrush,
              SUBTRACTION
            );
          } else {
            // Cut arch into Y height (cylinder axis along Z width)
            cylGeom.rotateX(Math.PI / 2);
            cylGeom.scale(span / 2, depth, 1);
            const archBrush = new Brush(cylGeom);
            const ySign = edge === 'top' ? 1 : -1;
            archBrush.position.set(offset, ySign * (T / 2), 0);
            archBrush.updateMatrixWorld();
            currentBrush = csgEvaluator.evaluate(
              currentBrush,
              archBrush,
              SUBTRACTION
            );
          }
          anySubtracted = true;
        } else if (jCut.type === 'taper') {
          // Jigsaw Free Diagonal Line / Taper Cut along the beam
          const ang = Math.max(-75, Math.min(75, jCut.angleDeg ?? 15));
          const depth = Math.max(5, Math.min(Math.max(W, T) - 5, jCut.depthMm ?? Math.max(W, T) * 0.4));
          const edge = jCut.edge || 'bottom';
          const slabLen = L * 2.5;
          const slabSize = Math.max(W, T) * 3;
          const slabGeom = new THREE.BoxGeometry(slabLen, slabSize, slabSize);
          const slabBrush = new Brush(slabGeom);

          const rad = (ang * Math.PI) / 180;
          if (W >= T) {
            const zSign = edge === 'top' || edge === 'front' ? 1 : -1;
            slabBrush.rotation.set(0, zSign * rad, 0);
            slabBrush.position.set(
              0,
              0,
              zSign * (W / 2 - depth * 0.5 + slabSize / 2)
            );
          } else {
            const ySign = edge === 'top' ? 1 : -1;
            slabBrush.rotation.set(0, 0, ySign * rad);
            slabBrush.position.set(
              0,
              ySign * (T / 2 - depth * 0.5 + slabSize / 2),
              0
            );
          }
          slabBrush.updateMatrixWorld();
          currentBrush = csgEvaluator.evaluate(
            currentBrush,
            slabBrush,
            SUBTRACTION
          );
          anySubtracted = true;
        } else if (jCut.type === 'chamfer' || jCut.type === 'corner-round') {
          // Corner Chamfer / Dog-Ear / Rounding at beam ends (Jigsaw decorative pergola/board end)
          const r = Math.max(10, Math.min(Math.max(W, T) * 0.9, jCut.radiusMm || jCut.depthMm || 35));
          const ends =
            jCut.edge === 'start'
              ? [-1]
              : jCut.edge === 'end'
              ? [1]
              : [-1, 1];
          for (const xSign of ends) {
            for (const cSign of [-1, 1]) {
              const cutBox = new THREE.BoxGeometry(r * 2.2, r * 2.2, r * 2.2);
              const cutBrush = new Brush(cutBox);
              if (W >= T) {
                cutBrush.rotation.set(0, Math.PI / 4, 0);
                cutBrush.position.set(
                  xSign * (halfL + r * 0.35),
                  0,
                  cSign * (W / 2 + r * 0.35)
                );
              } else {
                cutBrush.rotation.set(0, 0, Math.PI / 4);
                cutBrush.position.set(
                  xSign * (halfL + r * 0.35),
                  cSign * (T / 2 + r * 0.35),
                  0
                );
              }
              cutBrush.updateMatrixWorld();
              currentBrush = csgEvaluator.evaluate(
                currentBrush,
                cutBrush,
                SUBTRACTION
              );
              anySubtracted = true;
            }
          }
        } else if (jCut.type === 'l-notch') {
          // Jigsaw L-Notch / Step Cutout at a beam corner
          const cutL = Math.max(15, Math.min(L * 0.7, jCut.lengthMm || 80));
          const cutD = Math.max(10, Math.min(Math.max(W, T) * 0.85, jCut.depthMm || 45));
          const xSign = jCut.edge === 'start' ? -1 : 1;
          const boxGeom = new THREE.BoxGeometry(
            cutL * 2,
            W >= T ? T * 3 : cutD * 2,
            W >= T ? cutD * 2 : W * 3
          );
          const notchBrush = new Brush(boxGeom);
          if (W >= T) {
            notchBrush.position.set(xSign * halfL, 0, W / 2);
          } else {
            notchBrush.position.set(xSign * halfL, T / 2, 0);
          }
          notchBrush.updateMatrixWorld();
          currentBrush = csgEvaluator.evaluate(
            currentBrush,
            notchBrush,
            SUBTRACTION
          );
          anySubtracted = true;
        }
      }

      if (anySubtracted && currentBrush.geometry) {
        currentBrush.geometry.computeVertexNormals();
        const islands = splitDisconnectedMeshIslands(currentBrush.geometry);
        if (islands.length > 1) {
          if (part.detachedFragmentIndex !== undefined) {
            return islands[part.detachedFragmentIndex] || islands[0];
          }
          if (
            part.excludedFragmentIndices &&
            part.excludedFragmentIndices.length > 0
          ) {
            const excl = new Set(part.excludedFragmentIndices);
            const kept = islands.filter((_, idx) => !excl.has(idx));
            if (kept.length > 0) {
              return mergeIslandGeometries(kept);
            }
          }
        }
        return currentBrush.geometry;
      }
    } catch {
      // Fallback to base geometry if CSG encounters degenerate overlap
    }
  }

  return baseGeom;
}

/**
 * Inspects `part` after CSG cuts and returns the number of disconnected 3D mesh islands.
 * If `> 1`, the cut physically severed the beam into `islandCount` separate pieces
 * (index 0 = main body, index 1..N-1 = severed remainder/offcut pieces).
 */
export function countPartDisconnectedIslands(
  part: Part,
  allParts: Part[]
): number {
  const cleanPart: Part = {
    ...part,
    detachedFragmentIndex: undefined,
    excludedFragmentIndices: undefined,
  };
  const geom = buildPartGeometry(cleanPart, allParts);
  const islands = splitDisconnectedMeshIslands(geom);
  return islands.length;
}

export function getPartTextureForStock(stockId: string): THREE.CanvasTexture {
  const stock = getStockById(stockId);
  return getWoodTexture(
    stock.species,
    stock.color,
    stock.grainColor,
    stock.hasGrain
  );
}
