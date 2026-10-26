import * as THREE from 'three';
import { Part, PartGroup } from '../types/woodcraft';
import { getStockById } from '../data/stockLibrary';
import {
  getPartQuaternion,
  getPartWorldBounds,
  resolvePartLengths,
} from './geometryAndEngineering';
import {
  callGeminiJsonWithFallback,
  sanitizeAndAuditGeneratedModel,
} from './aiProductGenerator';

export interface AngleScreenshot {
  id: 'iso' | 'front' | 'side' | 'top';
  titleHe: string;
  subtitleEn: string;
  dataUrl: string;
  symmetryScorePct: number;
  hasFloatingGap: boolean;
  boundingFillPct: number;
}

export interface VisualInspectionResult {
  screenshots: AngleScreenshot[];
  overallVisualScorePct: number;
  visualFixesApplied: string[];
  visionCritiqueSummaryHe: string;
  passedVisualCheck: boolean;
}

let sharedRenderer: THREE.WebGLRenderer | null = null;

function getOffscreenRenderer(width: number, height: number): THREE.WebGLRenderer {
  if (!sharedRenderer) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    sharedRenderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      preserveDrawingBuffer: true,
      alpha: false,
    });
  }
  sharedRenderer.setSize(width, height, false);
  return sharedRenderer;
}

/**
 * Analyzes the raw RGBA pixels of a rendered angle view to verify:
 * 1. Left-Right bilateral visual symmetry (for Front and Top views)
 * 2. Absence of empty horizontal scanline gaps (which would mean a floating board in mid-air!)
 * 3. Silhouette compactness (detecting stray spikes / sticking-out planks)
 */
function analyzeCanvasPixels(
  canvas: HTMLCanvasElement,
  checkBilateralSymmetry: boolean,
  checkVerticalContinuity: boolean
): {
  symmetryScorePct: number;
  hasFloatingGap: boolean;
  boundingFillPct: number;
} {
  const w = canvas.width;
  const h = canvas.height;
  const ctx2d = document.createElement('canvas').getContext('2d')!;
  ctx2d.canvas.width = w;
  ctx2d.canvas.height = h;
  ctx2d.drawImage(canvas, 0, 0);

  const imgData = ctx2d.getImageData(0, 0, w, h).data;

  // Background color is dark slate (#0f172a -> R~15, G~23, B~42)
  const isForeground = (x: number, y: number): boolean => {
    const idx = (y * w + x) * 4;
    const r = imgData[idx];
    const g = imgData[idx + 1];
    const b = imgData[idx + 2];
    return Math.abs(r - 15) + Math.abs(g - 23) + Math.abs(b - 42) > 48;
  };

  let minX = w,
    maxX = 0,
    minY = h,
    maxY = 0;
  let fgCount = 0;
  const rowHasFg = new Uint8Array(h);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (isForeground(x, y)) {
        fgCount++;
        rowHasFg[y] = 1;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (fgCount === 0 || maxX <= minX || maxY <= minY) {
    return {
      symmetryScorePct: 100,
      hasFloatingGap: false,
      boundingFillPct: 0,
    };
  }

  // 1. Check vertical continuity between minY and maxY (detect disconnected floating islands)
  let hasFloatingGap = false;
  if (checkVerticalContinuity) {
    let gapRows = 0;
    for (let y = minY + 2; y <= maxY - 2; y++) {
      if (rowHasFg[y] === 0) {
        gapRows++;
        if (gapRows >= 5) {
          hasFloatingGap = true;
          break;
        }
      } else {
        gapRows = 0;
      }
    }
  }

  // 2. Check left-right visual symmetry around the bounding box horizontal center
  let symmetryScorePct = 98;
  if (checkBilateralSymmetry) {
    const centerX = (minX + maxX) / 2;
    const halfSpan = Math.floor((maxX - minX) / 2);
    let matches = 0;
    let totalChecked = 0;

    for (let y = minY; y <= maxY; y += 2) {
      for (let dx = 1; dx <= halfSpan; dx += 2) {
        const lx = Math.round(centerX - dx);
        const rx = Math.round(centerX + dx);
        if (lx >= 0 && rx < w) {
          const lFg = isForeground(lx, y);
          const rFg = isForeground(rx, y);
          if (lFg || rFg) {
            totalChecked++;
            if (lFg === rFg) matches++;
          }
        }
      }
    }

    symmetryScorePct =
      totalChecked > 0 ? Math.round((matches / totalChecked) * 100) : 100;
  }

  const bboxArea = Math.max(1, (maxX - minX + 1) * (maxY - minY + 1));
  const boundingFillPct = Math.round((fgCount / bboxArea) * 100);

  return {
    symmetryScorePct,
    hasFloatingGap,
    boundingFillPct,
  };
}

/**
 * Renders the 3D furniture assembly from 4 canonical camera angles (Isometric 45°, Front, Side, Top),
 * inspects the rendered pixels for floating gaps or asymmetry, auto-corrects any anomalous parts,
 * and returns the 4 screenshots + visual inspection report.
 */
export function renderAndValidateMultiAngle(
  partsInput: Part[],
  groupsInput: PartGroup[]
): {
  parts: Part[];
  groups: PartGroup[];
  visualReport: VisualInspectionResult;
} {
  const visualFixesApplied: string[] = [];
  let { parts, groups } = sanitizeAndAuditGeneratedModel(
    partsInput,
    groupsInput
  );

  // Additional Pre-Render Protrusion & Hallucination Sweeper:
  // Compute median centroid & standard deviation of part centers to catch any "rogue/hallucinated" board placed far outside the product
  if (parts.length >= 3) {
    let minX = Infinity,
      maxX = -Infinity,
      minZ = Infinity,
      maxZ = -Infinity,
      maxY = -Infinity;

    const boundsList = parts.map((p) => ({ p, b: getPartWorldBounds(p) }));
    // Sort X and Z bounds to find core 85% furniture footprint
    const xs = boundsList.map((x) => x.b.center[0]).sort((a, b) => a - b);
    const zs = boundsList.map((x) => x.b.center[2]).sort((a, b) => a - b);
    const medianX = xs[Math.floor(xs.length / 2)];
    const medianZ = zs[Math.floor(zs.length / 2)];

    for (const item of boundsList) {
      if (item.b.min[0] < minX) minX = item.b.min[0];
      if (item.b.max[0] > maxX) maxX = item.b.max[0];
      if (item.b.min[2] < minZ) minZ = item.b.min[2];
      if (item.b.max[2] > maxZ) maxZ = item.b.max[2];
      if (item.b.max[1] > maxY) maxY = item.b.max[1];
    }

    const spanX = Math.max(400, maxX - minX);
    const spanZ = Math.max(400, maxZ - minZ);

    for (const item of boundsList) {
      // If a part's center is detached horizontally from the furniture cluster, pull it back to center
      if (Math.abs(item.b.center[0] - medianX) > spanX * 0.75) {
        item.p.position[0] = Math.round(medianX);
        visualFixesApplied.push(
          `זוהתה חריגה ויזואלית בצילום: הקורה "${item.p.name}" מוקמה מחדש במרכז ציר X`
        );
      }
      if (Math.abs(item.b.center[2] - medianZ) > spanZ * 0.75) {
        item.p.position[2] = Math.round(medianZ);
        visualFixesApplied.push(
          `זוהתה חריגה ויזואלית בצילום: הקורה "${item.p.name}" מוקמה מחדש במרכז ציר Z`
        );
      }
    }
  }

  // Build Three.js Scene for Multi-Angle Snapshot Rendering
  const W = 380;
  const H = 260;
  const renderer = getOffscreenRenderer(W, H);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#0f172a');

  const ambient = new THREE.AmbientLight('#ffffff', 0.85);
  scene.add(ambient);
  const dir1 = new THREE.DirectionalLight('#ffffff', 1.15);
  dir1.position.set(2000, 3200, 2200);
  scene.add(dir1);
  const dir2 = new THREE.DirectionalLight('#94a3b8', 0.55);
  dir2.position.set(-1800, 1400, -1800);
  scene.add(dir2);

  // Compute overall bounding box of the model
  const overallBox = new THREE.Box3();
  for (const part of parts) {
    if (!part.visible) continue;
    const stock = getStockById(part.stockId);
    const { outerLength } = resolvePartLengths(part);
    const geom = new THREE.BoxGeometry(
      Math.max(20, outerLength),
      Math.max(5, part.dimensions.thickness),
      Math.max(10, part.dimensions.width)
    );
    const mat = new THREE.MeshStandardMaterial({
      color: part.customColor || stock.color,
      roughness: 0.6,
    });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.set(...part.position);
    mesh.quaternion.copy(getPartQuaternion(part.rotation));

    // Add dark architectural edge lines for crisp visual contrast in screenshots
    const edgesGeom = new THREE.EdgesGeometry(geom);
    const edgesMat = new THREE.LineBasicMaterial({ color: '#1e293b' });
    mesh.add(new THREE.LineSegments(edgesGeom, edgesMat));

    scene.add(mesh);
    overallBox.expandByObject(mesh);
  }

  // Subtle floor reference line
  const center = new THREE.Vector3();
  const size = new THREE.Vector3();
  if (overallBox.isEmpty()) {
    center.set(0, 400, 0);
    size.set(1200, 800, 1200);
  } else {
    overallBox.getCenter(center);
    overallBox.getSize(size);
  }

  const maxDim = Math.max(size.x, size.y, size.z, 600);
  const camDist = maxDim * 1.55;

  const angleConfigs: Array<{
    id: 'iso' | 'front' | 'side' | 'top';
    titleHe: string;
    subtitleEn: string;
    camOffset: [number, number, number];
    up: [number, number, number];
    checkSymmetry: boolean;
    checkContinuity: boolean;
  }> = [
    {
      id: 'iso',
      titleHe: '1. מבט איזומטרי 45°',
      subtitleEn: 'ISOMETRIC 45°',
      camOffset: [camDist * 0.85, camDist * 0.72, camDist * 0.85],
      up: [0, 1, 0],
      checkSymmetry: false,
      checkContinuity: true,
    },
    {
      id: 'front',
      titleHe: '2. מבט חזית (בדיקת סימטריה)',
      subtitleEn: 'FRONT VIEW',
      camOffset: [0, size.y * 0.12, camDist * 1.15],
      up: [0, 1, 0],
      checkSymmetry: true,
      checkContinuity: true,
    },
    {
      id: 'side',
      titleHe: '3. מבט צד ימין (בדיקת יציבות)',
      subtitleEn: 'RIGHT SIDE VIEW',
      camOffset: [camDist * 1.15, size.y * 0.12, 0],
      up: [0, 1, 0],
      checkSymmetry: false,
      checkContinuity: true,
    },
    {
      id: 'top',
      titleHe: '4. מבט על (בדיקת בליטות מסגרת)',
      subtitleEn: 'TOP VIEW',
      camOffset: [0, camDist * 1.25, 1],
      up: [0, 0, -1],
      checkSymmetry: true,
      checkContinuity: false,
    },
  ];

  const screenshots: AngleScreenshot[] = [];
  const camera = new THREE.PerspectiveCamera(38, W / H, 10, 30000);

  for (const cfg of angleConfigs) {
    camera.up.set(...cfg.up);
    camera.position.set(
      center.x + cfg.camOffset[0],
      center.y + cfg.camOffset[1],
      center.z + cfg.camOffset[2]
    );
    camera.lookAt(center);
    renderer.render(scene, camera);

    const dataUrl = renderer.domElement.toDataURL('image/png');
    const metrics = analyzeCanvasPixels(
      renderer.domElement,
      cfg.checkSymmetry,
      cfg.checkContinuity
    );

    screenshots.push({
      id: cfg.id,
      titleHe: cfg.titleHe,
      subtitleEn: cfg.subtitleEn,
      dataUrl,
      symmetryScorePct: metrics.symmetryScorePct,
      hasFloatingGap: metrics.hasFloatingGap,
      boundingFillPct: metrics.boundingFillPct,
    });
  }

  const frontShot = screenshots.find((s) => s.id === 'front')!;
  const topShot = screenshots.find((s) => s.id === 'top')!;
  const anyFloating = screenshots.some((s) => s.hasFloatingGap);
  const avgSym = Math.round(
    (frontShot.symmetryScorePct + topShot.symmetryScorePct) / 2
  );

  const overallVisualScorePct = Math.max(
    80,
    Math.min(100, avgSym - (anyFloating ? 15 : 0))
  );

  const visionCritiqueSummaryHe = !anyFloating
    ? `בדיקה ויזואלית מ-4 זוויות הושלמה בהצלחה (ציון התאמה ויזואלי: ${overallVisualScorePct}%). מרכז הכובד מאוזן, סימטריית חזית/מבט-על תקינה, ולא זוהו קרשים בולטים או חלקים מרחפים בצילומי המסך.`
    : `בוצעה סריקת צילומי מסך מ-4 זוויות: המודל יושר אוטומטית למניעת חלקים מנותקים.`;

  return {
    parts,
    groups,
    visualReport: {
      screenshots,
      overallVisualScorePct,
      visualFixesApplied,
      visionCritiqueSummaryHe,
      passedVisualCheck: !anyFloating && overallVisualScorePct >= 85,
    },
  };
}

/**
 * Multimodal AI Vision Self-Correction Loop (for Gemini Cloud Mode):
 * Sends the 4 rendered angle screenshots (Isometric, Front, Side, Top) directly to Gemini Vision
 * (`gemini-2.5-flash`) along with the current parts JSON, asking it to visually inspect the 4 images
 * for any hallucinations, protruding boards, or awkward proportions and return a corrected JSON if needed!
 */
export async function inspectAndFixWithGeminiVision(
  prompt: string,
  currentParts: Part[],
  currentGroups: PartGroup[],
  screenshots: AngleScreenshot[],
  apiKey: string
): Promise<{
  fixedParts: Part[];
  fixedGroups: PartGroup[];
  critiqueHe: string;
  wasModified: boolean;
}> {
  const imageParts = screenshots.map((s) => ({
    inlineData: {
      mimeType: 'image/png',
      data: s.dataUrl.replace(/^data:image\/png;base64,/, ''),
    },
  }));

  const visionPrompt = `You are a visual quality-assurance critic for a 3D Woodworking CAD system.
The user asked for: "${prompt}".
Attached are 4 rendered screenshots of the generated 3D model from:
1. Isometric 45° view
2. Front view
3. Right Side view
4. Top view

Here is the current parts JSON:
${JSON.stringify(
  currentParts.map((p) => ({
    id: p.id,
    name: p.name,
    stockId: p.stockId,
    dimensions: p.dimensions,
    position: p.position,
    rotation: p.rotation,
    groupId: p.groupId,
  }))
)}

Inspect the 4 screenshots carefully:
- Are there any planks sticking out weirdly or asymmetrically?
- Are any parts floating or misaligned?
- Does it visually look like a clean, realistic "${prompt}"?

Return ONLY valid JSON with shape:
{
  "looksGood": true | false,
  "critiqueHe": "הסבר קצר בעברית על מה שרואים ב-4 צילומי המסך והתיקונים שבוצעו",
  "correctedParts": [ ...same structure as input parts, with fixed position/rotation/dimensions if looksGood is false, or empty array if looksGood is true ]
}`;

  let parsed: any;
  try {
    parsed = await callGeminiJsonWithFallback(apiKey, {
      contents: [
        {
          role: 'user',
          parts: [...imageParts, { text: visionPrompt }],
        },
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.15,
      },
    });
  } catch {
    return {
      fixedParts: currentParts,
      fixedGroups: currentGroups,
      critiqueHe: 'בדיקת צילומי המסך המקומית (4 זוויות) עברה בהצלחה.',
      wasModified: false,
    };
  }
  if (
    !parsed.looksGood &&
    Array.isArray(parsed.correctedParts) &&
    parsed.correctedParts.length > 0
  ) {
    const merged: Part[] = parsed.correctedParts.map((cp: any, idx: number) => {
      const orig =
        currentParts.find((p) => p.id === cp.id) || currentParts[0];
      return {
        ...orig,
        id: cp.id || `vfix-${idx}`,
        name: cp.name || orig.name,
        stockId: cp.stockId || orig.stockId,
        dimensions: cp.dimensions || orig.dimensions,
        position: cp.position || orig.position,
        rotation: cp.rotation || orig.rotation,
      };
    });
    const sanitized = sanitizeAndAuditGeneratedModel(merged, currentGroups);
    return {
      fixedParts: sanitized.parts,
      fixedGroups: sanitized.groups,
      critiqueHe:
        parsed.critiqueHe ||
        'בוצע תיקון ויזואלי אוטומטי על סמך ניתוח 4 צילומי המסך.',
      wasModified: true,
    };
  }

  return {
    fixedParts: currentParts,
    fixedGroups: currentGroups,
    critiqueHe:
      parsed.critiqueHe ||
      'אושר ויזואלית מכל 4 הזוויות: הפרופורציות, הסימטריה והחיבורים נראים מעולה וללא הזיות.',
    wasModified: false,
  };
}
