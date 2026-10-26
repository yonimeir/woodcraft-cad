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
      if (vx < 0 && part.miterStart.enabled && Math.abs(part.miterStart.angle) > 0.5) {
        const ang = Math.max(-70, Math.min(70, part.miterStart.angle));
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
      if (vx > 0 && part.miterEnd.enabled && Math.abs(part.miterEnd.angle) > 0.5) {
        const ang = Math.max(-70, Math.min(70, part.miterEnd.angle));
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

  // Apply Parametric Dado / Half-Lap notches using `three-bvh-csg` if any active `dadoNotches` exist
  if (part.dadoNotches.length > 0) {
    try {
      const partQuat = getPartQuaternion(part.rotation);
      const partInvQuat = partQuat.clone().invert();
      const partCenter = new THREE.Vector3(...part.position);

      let currentBrush = new Brush(baseGeom);
      currentBrush.updateMatrixWorld();

      let anySubtracted = false;

      for (const dado of part.dadoNotches) {
        const cutter = allParts.find(
          (p) => p.id === dado.cutterPartId && p.visible
        );
        if (!cutter) continue;

        const cutterLengths = resolvePartLengths(cutter);
        const cL = cutterLengths.outerLength + 2; // +2mm clearance for clean CSG cut
        const cT = cutter.dimensions.thickness + 2;
        const cW = cutter.dimensions.width + 2;

        const cutterGeom = new THREE.BoxGeometry(cL, cT, cW);
        const cutterBrush = new Brush(cutterGeom);

        // Compute cutter transform relative to `part` local space
        const cutterCenter = new THREE.Vector3(...cutter.position);
        const relPos = cutterCenter.clone().sub(partCenter).applyQuaternion(partInvQuat);

        // If mode === 'half' (Half-Lap), shift the cutter up by half of `part`'s thickness
        // so it only carves the top half (or intersecting half) of `part`!
        if (dado.mode === 'half') {
          relPos.y += T * 0.5;
        }

        const cutterQuat = getPartQuaternion(cutter.rotation);
        const relQuat = partInvQuat.clone().multiply(cutterQuat);

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
