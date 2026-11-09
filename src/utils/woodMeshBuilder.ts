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

      // 1. Parametric Dado / Half-Lap Notches (with automatic open-end / top-sliver cleanup!)
      for (const dado of part.dadoNotches) {
        const cutter = allParts.find(
          (p) => p.id === dado.cutterPartId && p.visible
        );
        if (!cutter) continue;

        const cutterLengths = resolvePartLengths(cutter);
        const cL = cutterLengths.outerLength + 4; // +4mm clearance for clean CSG cut
        let cT = cutter.dimensions.thickness + 2;
        let cW = cutter.dimensions.width + 2;

        // Compute cutter transform relative to `part` local space
        const cutterCenter = new THREE.Vector3(...cutter.position);
        const relPos = cutterCenter
          .clone()
          .sub(partCenter)
          .applyQuaternion(partInvQuat);

        const cutterQuat = getPartQuaternion(cutter.rotation);
        const relQuat = partInvQuat.clone().multiply(cutterQuat);

        // Local offset inside cutter's own coordinate system (for open-top / end-sliver extension)
        const cutterLocalShift = new THREE.Vector3(0, 0, 0);

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
        } else {
          // Full Dado / Housing Notch (`mode === 'full'`):
          // When a notch is cut near the top/end of an angled or meeting beam (e.g., ridge beam at A-frame apex),
          // extend the cutter box outward along its open cross-section axes (+Y world / outward from beam center)
          // so any small protruding triangular tip ("השפיץ הקטנטן שמבצבץ מעל החיבור") is cleanly sliced off!
          const distToNearestEnd = halfL - Math.abs(relPos.x);
          const isNearBeamEnd = distToNearestEnd < Math.max(W, T, cW, cT) * 1.45;

          const cutterAxisYInPart = new THREE.Vector3(0, 1, 0).applyQuaternion(relQuat);
          const cutterAxisZInPart = new THREE.Vector3(0, 0, 1).applyQuaternion(relQuat);
          const cutterWorldY = new THREE.Vector3(0, 1, 0).applyQuaternion(cutterQuat);
          const cutterWorldZ = new THREE.Vector3(0, 0, 1).applyQuaternion(cutterQuat);

          // Vector pointing from `part` center toward the nearest end / exterior
          const endOutwardDir = new THREE.Vector3(
            Math.sign(relPos.x) || 1,
            relPos.y / Math.max(1, T),
            relPos.z / Math.max(1, W)
          ).normalize();

          const extraClearance = Math.max(W, T) * 1.8 + 80;

          // Extend cutter along its Y axis if aligned with world +Y or outward toward beam end
          const dotYEnd = cutterAxisYInPart.dot(endOutwardDir);
          if (isNearBeamEnd || Math.abs(cutterWorldY.y) > 0.5) {
            const signY =
              Math.abs(cutterWorldY.y) > 0.5
                ? Math.sign(cutterWorldY.y)
                : Math.sign(dotYEnd) || 1;
            cT += extraClearance;
            cutterLocalShift.y += signY * (extraClearance * 0.5);
          }

          // Extend cutter along its Z axis if aligned with world +Y or outward toward beam end
          const dotZEnd = cutterAxisZInPart.dot(endOutwardDir);
          if (isNearBeamEnd || Math.abs(cutterWorldZ.y) > 0.5) {
            const signZ =
              Math.abs(cutterWorldZ.y) > 0.5
                ? Math.sign(cutterWorldZ.y)
                : Math.sign(dotZEnd) || 1;
            cW += extraClearance;
            cutterLocalShift.z += signZ * (extraClearance * 0.5);
          }
        }

        const cutterGeom = new THREE.BoxGeometry(cL, cT, cW);
        const cutterBrush = new Brush(cutterGeom);

        const shiftedRelPos = relPos
          .clone()
          .add(cutterLocalShift.applyQuaternion(relQuat));

        cutterBrush.position.copy(shiftedRelPos);
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

      // 2. Jigsaw / Custom Profile & Flush-Trim Cuts (`part.jigsawCuts`)
      for (const jCut of jigsawCuts) {
        if (jCut.type === 'trim-plane' && jCut.referencePartId) {
          // Trim any protruding portion of `part` that pokes out beyond the outer faces of `referencePartId`
          const refPart = allParts.find(
            (p) => p.id === jCut.referencePartId && p.visible
          );
          if (!refPart) continue;
          const refLengths = resolvePartLengths(refPart);
          const rL = refLengths.outerLength + 400;
          const rT = refPart.dimensions.thickness;
          const rW = refPart.dimensions.width;

          const refCenter = new THREE.Vector3(...refPart.position);
          const relPos = refCenter
            .clone()
            .sub(partCenter)
            .applyQuaternion(partInvQuat);
          const refQuat = getPartQuaternion(refPart.rotation);
          const relQuat = partInvQuat.clone().multiply(refQuat);

          // Subtract both the half-space above/outside the reference beam AND the reference beam's housing
          // so nothing pokes out above or past the reference beam!
          const slabDepth = Math.max(L, W, T) * 2;
          const refWorldY = new THREE.Vector3(0, 1, 0).applyQuaternion(refQuat);
          const refWorldZ = new THREE.Vector3(0, 0, 1).applyQuaternion(refQuat);

          // Determine which local axis of refPart points "outward/upward" (+Y world or away from `part` center)
          const toRefFromPart = relPos.clone().normalize();
          const refYInPart = new THREE.Vector3(0, 1, 0).applyQuaternion(relQuat);
          const refZInPart = new THREE.Vector3(0, 0, 1).applyQuaternion(relQuat);

          const trimAxes: Array<{ localVec: THREE.Vector3; halfDim: number }> = [
            {
              localVec: new THREE.Vector3(
                0,
                refWorldY.y >= 0.2
                  ? 1
                  : refWorldY.y <= -0.2
                  ? -1
                  : Math.sign(refYInPart.dot(toRefFromPart)) || 1,
                0
              ),
              halfDim: rT / 2,
            },
            {
              localVec: new THREE.Vector3(
                0,
                0,
                refWorldZ.y >= 0.2
                  ? 1
                  : refWorldZ.y <= -0.2
                  ? -1
                  : Math.sign(refZInPart.dot(toRefFromPart)) || 1
              ),
              halfDim: rW / 2,
            },
          ];

          for (const ta of trimAxes) {
            const slabGeom = new THREE.BoxGeometry(rL, slabDepth, slabDepth);
            const slabBrush = new Brush(slabGeom);
            const offsetInRef = ta.localVec
              .clone()
              .multiplyScalar(ta.halfDim + slabDepth / 2);
            slabBrush.position
              .copy(relPos)
              .add(offsetInRef.applyQuaternion(relQuat));
            slabBrush.quaternion.copy(relQuat);
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
        return currentBrush.geometry;
      }
    } catch {
      // Fallback to base geometry if CSG encounters degenerate overlap
    }
  }

  return baseGeom;
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
