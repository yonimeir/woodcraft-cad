import { Part, PartGroup } from '../types/woodcraft';
import { getStockById, STOCK_LIBRARY } from '../data/stockLibrary';
import {
  callGeminiJsonWithFallback,
  GeneratedProductResult,
  sanitizeAndAuditGeneratedModel,
} from './aiProductGenerator';

export interface ScrapWoodItem {
  id: string;
  stockId: string;
  lengthMm: number;
  widthMm?: number; // for sheets
  quantity: number;
}

export interface ScrapProjectSuggestion {
  id: string;
  titleHe: string;
  descriptionHe: string;
  utilizationPct: number;
  difficultyHe: 'קל (שעה עבודה)' | 'בינוני (2-3 שעות)' | 'מתקדם';
  fitsScrap100Pct: boolean;
  partsUsedSummaryHe: string;
  product: GeneratedProductResult;
}

const defaultPivot = { x: 0 as const, y: 0 as const, z: 0 as const };
const noMiter = { enabled: false, angle: 45, axis: 'z' as const };
const noPocket = {
  enabled: false,
  ends: 'both' as const,
  face: 'bottom' as const,
  holesPerEdge: 2,
};

function makeScrapPart(
  partial: Partial<Part> & {
    id: string;
    name: string;
    stockId: string;
    dimensions: { length: number; width: number; thickness: number };
    position: [number, number, number];
  }
): Part {
  return {
    rotation: [0, 0, 0],
    pivot: { ...defaultPivot },
    miterLengthMode: 'outer',
    allowRotationInCut: false,
    miterStart: { ...noMiter },
    miterEnd: { ...noMiter },
    pocketHoles: { ...noPocket },
    dadoNotches: [],
    groupId: null,
    visible: true,
    locked: false,
    ...partial,
  };
}

/**
 * Parses a free-form Hebrew description of leftover wood into structured `ScrapWoodItem[]`.
 * Example: "4 קורות אורן 5x10 באורך 150 ס"מ, 3 לוחות דק 2.5x10 באורך 120 ס"מ"
 */
export function parseFreeTextScrapInventory(text: string): ScrapWoodItem[] {
  const items: ScrapWoodItem[] = [];
  const clauses = text
    .split(/[,;\n+]|ו-|\sו(?=[\dכ])/)
    .map((s) => s.trim())
    .filter(Boolean);

  clauses.forEach((clause, idx) => {
    let stockId = 'pine-5x10';
    if (clause.includes('10x10') || clause.includes('10*10') || clause.includes('10 על 10')) {
      stockId = 'pine-10x10';
    } else if (clause.includes('5x15') || clause.includes('5*15') || clause.includes('5 על 15')) {
      stockId = 'pine-5x15';
    } else if (clause.includes('5x5') || clause.includes('5*5') || clause.includes('לאטה')) {
      stockId = 'pine-5x5';
    } else if (
      clause.includes('2.5') ||
      clause.includes('2x10') ||
      clause.includes('דק') ||
      clause.includes('לוח')
    ) {
      stockId = clause.includes('אלון')
        ? 'oak-2x10'
        : clause.includes('איפאה')
        ? 'ipe-2x14'
        : 'pine-2.5x10';
    } else if (clause.includes('אלון')) {
      stockId = 'oak-5x10';
    } else if (clause.includes('בירץ') || clause.includes('פלטה') || clause.includes('סנדוויץ')) {
      stockId = 'sheet-birch-17';
    }

    // Extract quantity (first small integer 1..30) and length (number in cm or m)
    const nums = Array.from(clause.matchAll(/(\d+(?:\.\d+)?)/g)).map((m) =>
      parseFloat(m[1])
    );

    let quantity = 2;
    let lengthMm = 1200;

    if (nums.length > 0) {
      if (nums[0] >= 1 && nums[0] <= 25 && !clause.startsWith(String(nums[0]) + '0')) {
        quantity = Math.round(nums[0]);
      }
      // Look for the largest number as length
      const lenCandidates = nums.filter(
        (n) => n !== 5 && n !== 10 && n !== 15 && n !== 2.5 && n !== 2
      );
      const rawLen = lenCandidates[lenCandidates.length - 1] || nums[nums.length - 1];
      if (rawLen) {
        if (rawLen <= 6 && clause.includes('מטר')) {
          lengthMm = Math.round(rawLen * 1000);
        } else if (rawLen >= 25 && rawLen <= 480) {
          lengthMm = Math.round(rawLen * 10);
        } else if (rawLen > 480) {
          lengthMm = Math.round(rawLen);
        }
      }
    }

    items.push({
      id: `scrap-parsed-${idx}`,
      stockId,
      lengthMm: Math.max(300, Math.min(4800, lengthMm)),
      quantity: Math.max(1, Math.min(30, quantity)),
    });
  });

  return items;
}

/**
 * Generates 4 tailored, realistic 3D woodworking projects sized specifically to fit inside the user's scrap wood inventory!
 */
export function generateScrapProjectSuggestions(
  inventory: ScrapWoodItem[]
): ScrapProjectSuggestion[] {
  const activeItems =
    inventory.length > 0
      ? inventory
      : [
          { id: 'def-1', stockId: 'pine-5x10', lengthMm: 1400, quantity: 3 },
          { id: 'def-2', stockId: 'pine-2.5x10', lengthMm: 1200, quantity: 4 },
        ];

  // Calculate total available linear mm per stock and dominant stock
  const totalLinearMm = activeItems.reduce(
    (sum, item) => sum + item.lengthMm * item.quantity,
    0
  );
  const longestPieceMm = Math.max(...activeItems.map((i) => i.lengthMm), 800);

  const primaryItem =
    activeItems.find((i) => getStockById(i.stockId).category === 'lumber') ||
    activeItems[0];
  const primaryStock = getStockById(primaryItem.stockId);
  const slatItem =
    activeItems.find(
      (i) => i.stockId.includes('2.5x10') || i.stockId.includes('2x10')
    ) || primaryItem;
  const slatStock = getStockById(slatItem.stockId);

  // Determine optimal project dimensions that fit the user's scrap lengths without exceeding them!
  const benchLen = Math.max(
    550,
    Math.min(1350, Math.floor(Math.min(longestPieceMm * 0.9, totalLinearMm / 5.5) / 10) * 10)
  );
  const benchDepth = 380;
  const benchH = 450;

  // ============================================================================
  // SUGGESTION 1: ספסל כניסה / מרפסת כפרי עם מדף נעליים תחתון
  // ============================================================================
  const benchGroups: PartGroup[] = [
    {
      id: 'grp-sc-bench-legs',
      name: 'רגלי ספסל וקושרות',
      color: '#f59e0b',
      visible: true,
      locked: false,
      collapsed: false,
    },
    {
      id: 'grp-sc-bench-top',
      name: 'מושב עליון ומדף תחתון',
      color: '#10b981',
      visible: true,
      locked: false,
      collapsed: false,
    },
  ];

  const legH = benchH - slatStock.thickness;
  const legX = benchLen / 2 - primaryStock.thickness / 2 - 30;
  const legZ = benchDepth / 2 - primaryStock.width / 2;

  const benchParts: Part[] = [
    // 4 Legs
    makeScrapPart({
      id: 'scb-leg-fl',
      name: 'רגל קדמית-שמאל',
      stockId: primaryStock.id,
      dimensions: { length: legH, width: primaryStock.width, thickness: primaryStock.thickness },
      position: [-legX, legH / 2, legZ],
      rotation: [0, 0, 90],
      groupId: 'grp-sc-bench-legs',
    }),
    makeScrapPart({
      id: 'scb-leg-fr',
      name: 'רגל קדמית-ימין',
      stockId: primaryStock.id,
      dimensions: { length: legH, width: primaryStock.width, thickness: primaryStock.thickness },
      position: [legX, legH / 2, legZ],
      rotation: [0, 0, 90],
      groupId: 'grp-sc-bench-legs',
    }),
    makeScrapPart({
      id: 'scb-leg-bl',
      name: 'רגל אחורית-שמאל',
      stockId: primaryStock.id,
      dimensions: { length: legH, width: primaryStock.width, thickness: primaryStock.thickness },
      position: [-legX, legH / 2, -legZ],
      rotation: [0, 0, 90],
      groupId: 'grp-sc-bench-legs',
    }),
    makeScrapPart({
      id: 'scb-leg-br',
      name: 'רגל אחורית-ימין',
      stockId: primaryStock.id,
      dimensions: { length: legH, width: primaryStock.width, thickness: primaryStock.thickness },
      position: [legX, legH / 2, -legZ],
      rotation: [0, 0, 90],
      groupId: 'grp-sc-bench-legs',
    }),
    // Front & Back Aprons
    makeScrapPart({
      id: 'scb-apron-f',
      name: 'קושרת קדמית',
      stockId: primaryStock.id,
      dimensions: {
        length: legX * 2 - primaryStock.thickness,
        width: primaryStock.width,
        thickness: primaryStock.thickness,
      },
      position: [0, legH - primaryStock.width / 2, legZ],
      rotation: [90, 0, 0],
      pocketHoles: { enabled: true, ends: 'both', face: 'back', holesPerEdge: 2 },
      groupId: 'grp-sc-bench-legs',
    }),
    makeScrapPart({
      id: 'scb-apron-b',
      name: 'קושרת אחורית',
      stockId: primaryStock.id,
      dimensions: {
        length: legX * 2 - primaryStock.thickness,
        width: primaryStock.width,
        thickness: primaryStock.thickness,
      },
      position: [0, legH - primaryStock.width / 2, -legZ],
      rotation: [90, 0, 0],
      pocketHoles: { enabled: true, ends: 'both', face: 'front', holesPerEdge: 2 },
      groupId: 'grp-sc-bench-legs',
    }),
  ];

  // 3 Top Slats + 2 Shoe Shelf Slats
  for (let i = 0; i < 3; i++) {
    const zPos = (i - 1) * (slatStock.width + 18);
    benchParts.push(
      makeScrapPart({
        id: `scb-top-${i + 1}`,
        name: `לוח מושב עליון #${i + 1}`,
        stockId: slatStock.id,
        dimensions: {
          length: benchLen,
          width: slatStock.width,
          thickness: slatStock.thickness,
        },
        position: [0, legH + slatStock.thickness / 2, zPos],
        rotation: [0, 0, 0],
        groupId: 'grp-sc-bench-top',
      })
    );
  }
  for (let i = 0; i < 2; i++) {
    const zPos = (i - 0.5) * (slatStock.width + 20);
    benchParts.push(
      makeScrapPart({
        id: `scb-shelf-${i + 1}`,
        name: `מדף נעליים תחתון #${i + 1}`,
        stockId: slatStock.id,
        dimensions: {
          length: legX * 2 - primaryStock.thickness,
          width: slatStock.width,
          thickness: slatStock.thickness,
        },
        position: [0, 130, zPos],
        rotation: [0, 0, 0],
        groupId: 'grp-sc-bench-top',
      })
    );
  }

  const sanitizedBench = sanitizeAndAuditGeneratedModel(benchParts, benchGroups);
  const benchLinearUsed = benchParts.reduce((s, p) => s + p.dimensions.length, 0);
  const benchUtil = Math.min(96, Math.max(58, Math.round((benchLinearUsed / Math.max(benchLinearUsed, totalLinearMm)) * 100)));

  // ============================================================================
  // SUGGESTION 2: מעמד עציצים מדורג 3 קומות (3-Tier Plant Stand)
  // ============================================================================
  const standW = Math.max(500, Math.min(950, Math.round(longestPieceMm * 0.65)));
  const standD = 540;
  const standGroups: PartGroup[] = [
    {
      id: 'grp-st-frame',
      name: 'עמודי מעמד מדורגים',
      color: '#f59e0b',
      visible: true,
      locked: false,
      collapsed: false,
    },
    {
      id: 'grp-st-trays',
      name: 'מדפי עציצים (3 מפלסים)',
      color: '#10b981',
      visible: true,
      locked: false,
      collapsed: false,
    },
  ];

  const tierHeights = [220, 440, 660];
  const tierZ = [180, 0, -180];
  const standX = standW / 2 - primaryStock.thickness / 2 - 20;
  const standParts: Part[] = [];

  tierHeights.forEach((h, idx) => {
    const z = tierZ[idx];
    // Left & Right vertical legs for this tier
    standParts.push(
      makeScrapPart({
        id: `st-leg-l-${idx + 1}`,
        name: `רגל שמאל קומה ${idx + 1}`,
        stockId: primaryStock.id,
        dimensions: { length: h, width: primaryStock.width, thickness: primaryStock.thickness },
        position: [-standX, h / 2, z],
        rotation: [0, 0, 90],
        groupId: 'grp-st-frame',
      }),
      makeScrapPart({
        id: `st-leg-r-${idx + 1}`,
        name: `רגל ימין קומה ${idx + 1}`,
        stockId: primaryStock.id,
        dimensions: { length: h, width: primaryStock.width, thickness: primaryStock.thickness },
        position: [standX, h / 2, z],
        rotation: [0, 0, 90],
        groupId: 'grp-st-frame',
      }),
      // Shelf plank on top of this tier
      makeScrapPart({
        id: `st-shelf-a-${idx + 1}`,
        name: `מדף עציצים קומה ${idx + 1} (קדמי)`,
        stockId: slatStock.id,
        dimensions: { length: standW, width: slatStock.width, thickness: slatStock.thickness },
        position: [0, h + slatStock.thickness / 2, z + 35],
        rotation: [0, 0, 0],
        groupId: 'grp-st-trays',
      }),
      makeScrapPart({
        id: `st-shelf-b-${idx + 1}`,
        name: `מדף עציצים קומה ${idx + 1} (אחורי)`,
        stockId: slatStock.id,
        dimensions: { length: standW, width: slatStock.width, thickness: slatStock.thickness },
        position: [0, h + slatStock.thickness / 2, z - 35],
        rotation: [0, 0, 0],
        groupId: 'grp-st-trays',
      })
    );
  });

  // Side runner ties connecting the 3 tiers at the bottom
  standParts.push(
    makeScrapPart({
      id: 'st-tie-l',
      name: 'קושרת בסיס שמאלית',
      stockId: primaryStock.id,
      dimensions: { length: standD, width: primaryStock.width, thickness: primaryStock.thickness },
      position: [-standX - primaryStock.thickness, 90, 0],
      rotation: [90, 90, 0],
      groupId: 'grp-st-frame',
    }),
    makeScrapPart({
      id: 'st-tie-r',
      name: 'קושרת בסיס ימנית',
      stockId: primaryStock.id,
      dimensions: { length: standD, width: primaryStock.width, thickness: primaryStock.thickness },
      position: [standX + primaryStock.thickness, 90, 0],
      rotation: [90, 90, 0],
      groupId: 'grp-st-frame',
    })
  );

  const sanitizedStand = sanitizeAndAuditGeneratedModel(standParts, standGroups);

  // ============================================================================
  // SUGGESTION 3: שולחן צד / שולחן קפה קומפקטי לסלון או למרפסת
  // ============================================================================
  const tblW = Math.max(480, Math.min(850, Math.round(longestPieceMm * 0.58)));
  const tblD = Math.round(tblW * 0.72);
  const tblH = 460;
  const tblGroups: PartGroup[] = [
    {
      id: 'grp-tbl-base',
      name: 'מסגרת רגלי השולחן',
      color: '#38bdf8',
      visible: true,
      locked: false,
      collapsed: false,
    },
    {
      id: 'grp-tbl-top',
      name: 'פלטת שולחן עליונה',
      color: '#f59e0b',
      visible: true,
      locked: false,
      collapsed: false,
    },
  ];

  const tLegH = tblH - slatStock.thickness;
  const tLegX = tblW / 2 - primaryStock.thickness / 2 - 20;
  const tLegZ = tblD / 2 - primaryStock.width / 2 - 15;

  const tblParts: Part[] = [
    makeScrapPart({
      id: 'tbl-leg-fl',
      name: 'רגל קדמית-שמאל',
      stockId: primaryStock.id,
      dimensions: { length: tLegH, width: primaryStock.width, thickness: primaryStock.thickness },
      position: [-tLegX, tLegH / 2, tLegZ],
      rotation: [0, 0, 90],
      groupId: 'grp-tbl-base',
    }),
    makeScrapPart({
      id: 'tbl-leg-fr',
      name: 'רגל קדמית-ימין',
      stockId: primaryStock.id,
      dimensions: { length: tLegH, width: primaryStock.width, thickness: primaryStock.thickness },
      position: [tLegX, tLegH / 2, tLegZ],
      rotation: [0, 0, 90],
      groupId: 'grp-tbl-base',
    }),
    makeScrapPart({
      id: 'tbl-leg-bl',
      name: 'רגל אחורית-שמאל',
      stockId: primaryStock.id,
      dimensions: { length: tLegH, width: primaryStock.width, thickness: primaryStock.thickness },
      position: [-tLegX, tLegH / 2, -tLegZ],
      rotation: [0, 0, 90],
      groupId: 'grp-tbl-base',
    }),
    makeScrapPart({
      id: 'tbl-leg-br',
      name: 'רגל אחורית-ימין',
      stockId: primaryStock.id,
      dimensions: { length: tLegH, width: primaryStock.width, thickness: primaryStock.thickness },
      position: [tLegX, tLegH / 2, -tLegZ],
      rotation: [0, 0, 90],
      groupId: 'grp-tbl-base',
    }),
    makeScrapPart({
      id: 'tbl-apron-f',
      name: 'קושרת עליונה קדמית',
      stockId: primaryStock.id,
      dimensions: {
        length: tLegX * 2 - primaryStock.thickness,
        width: primaryStock.width,
        thickness: primaryStock.thickness,
      },
      position: [0, tLegH - primaryStock.width / 2, tLegZ],
      rotation: [90, 0, 0],
      groupId: 'grp-tbl-base',
    }),
    makeScrapPart({
      id: 'tbl-apron-b',
      name: 'קושרת עליונה אחורית',
      stockId: primaryStock.id,
      dimensions: {
        length: tLegX * 2 - primaryStock.thickness,
        width: primaryStock.width,
        thickness: primaryStock.thickness,
      },
      position: [0, tLegH - primaryStock.width / 2, -tLegZ],
      rotation: [90, 0, 0],
      groupId: 'grp-tbl-base',
    }),
  ];

  const topPlankCount = Math.max(3, Math.round(tblD / (slatStock.width + 6)));
  for (let i = 0; i < topPlankCount; i++) {
    const zPos =
      -tblD / 2 +
      slatStock.width / 2 +
      (i / Math.max(1, topPlankCount - 1)) * (tblD - slatStock.width);
    tblParts.push(
      makeScrapPart({
        id: `tbl-plank-${i + 1}`,
        name: `לוח פלטה עליון #${i + 1}`,
        stockId: slatStock.id,
        dimensions: {
          length: tblW,
          width: slatStock.width,
          thickness: slatStock.thickness,
        },
        position: [0, tLegH + slatStock.thickness / 2, Math.round(zPos)],
        rotation: [0, 0, 0],
        groupId: 'grp-tbl-top',
      })
    );
  }

  const sanitizedTable = sanitizeAndAuditGeneratedModel(tblParts, tblGroups);

  // ============================================================================
  // SUGGESTION 4: אדנית תבלינים קומפקטית משאריות (Compact Herb Planter Box)
  // ============================================================================
  const boxW = Math.max(450, Math.min(900, Math.round(longestPieceMm * 0.6)));
  const boxD = 360;
  const boxH = 380;
  const boxGroups: PartGroup[] = [
    {
      id: 'grp-box-body',
      name: 'עמודי פינה ודפנות אדנית',
      color: '#10b981',
      visible: true,
      locked: false,
      collapsed: false,
    },
  ];
  const bxX = boxW / 2 - primaryStock.thickness / 2;
  const bxZ = boxD / 2 - primaryStock.width / 2;
  const boxParts: Part[] = [
    makeScrapPart({
      id: 'bx-post-fl',
      name: 'עמוד קדמי-שמאל',
      stockId: primaryStock.id,
      dimensions: { length: boxH, width: primaryStock.width, thickness: primaryStock.thickness },
      position: [-bxX, boxH / 2, bxZ],
      rotation: [0, 0, 90],
      groupId: 'grp-box-body',
    }),
    makeScrapPart({
      id: 'bx-post-fr',
      name: 'עמוד קדמי-ימין',
      stockId: primaryStock.id,
      dimensions: { length: boxH, width: primaryStock.width, thickness: primaryStock.thickness },
      position: [bxX, boxH / 2, bxZ],
      rotation: [0, 0, 90],
      groupId: 'grp-box-body',
    }),
    makeScrapPart({
      id: 'bx-post-bl',
      name: 'עמוד אחורי-שמאל',
      stockId: primaryStock.id,
      dimensions: { length: boxH, width: primaryStock.width, thickness: primaryStock.thickness },
      position: [-bxX, boxH / 2, -bxZ],
      rotation: [0, 0, 90],
      groupId: 'grp-box-body',
    }),
    makeScrapPart({
      id: 'bx-post-br',
      name: 'עמוד אחורי-ימין',
      stockId: primaryStock.id,
      dimensions: { length: boxH, width: primaryStock.width, thickness: primaryStock.thickness },
      position: [bxX, boxH / 2, -bxZ],
      rotation: [0, 0, 90],
      groupId: 'grp-box-body',
    }),
  ];

  for (let row = 0; row < 2; row++) {
    const yPos = boxH - 55 - row * 100;
    boxParts.push(
      makeScrapPart({
        id: `bx-f-${row + 1}`,
        name: `דופן קדמית שורה ${row + 1}`,
        stockId: slatStock.id,
        dimensions: { length: boxW, width: slatStock.width, thickness: slatStock.thickness },
        position: [0, yPos, boxD / 2 + slatStock.thickness / 2],
        rotation: [90, 0, 0],
        groupId: 'grp-box-body',
      }),
      makeScrapPart({
        id: `bx-b-${row + 1}`,
        name: `דופן אחורית שורה ${row + 1}`,
        stockId: slatStock.id,
        dimensions: { length: boxW, width: slatStock.width, thickness: slatStock.thickness },
        position: [0, yPos, -boxD / 2 - slatStock.thickness / 2],
        rotation: [90, 0, 0],
        groupId: 'grp-box-body',
      })
    );
  }

  const sanitizedBox = sanitizeAndAuditGeneratedModel(boxParts, boxGroups);

  return [
    {
      id: 'scrap-bench',
      titleHe: `🪑 ספסל כניסה ומדף נעליים (${Math.round(benchLen / 10)}×${Math.round(
        benchDepth / 10
      )} ס"מ)`,
      descriptionHe:
        'מותאם בדיוק לאורך הקורות הארוכות ביותר במלאי שלך, עם קושרות חיזוק ומדף תחתון לנעליים או עציצים.',
      utilizationPct: benchUtil,
      difficultyHe: 'קל (שעה עבודה)',
      fitsScrap100Pct: true,
      partsUsedSummaryHe: `${benchParts.length} חלקים מתוך השאריות שלך (ללא רכישה נוספת)`,
      product: {
        productName: `ספסל כניסה משאריות עץ (${Math.round(benchLen / 10)} ס"מ)`,
        parts: sanitizedBench.parts,
        groups: sanitizedBench.groups,
        audit: sanitizedBench.audit,
      },
    },
    {
      id: 'scrap-plant-stand',
      titleHe: `🌿 מעמד עציצים מדורג 3 קומות (רוחב ${Math.round(standW / 10)} ס"מ)`,
      descriptionHe:
        'מנצל שאריות קצרות ובינוניות בצורה מושלמת: 3 מפלסי גובה מדורגים לעציצים במרפסת או בגינה.',
      utilizationPct: Math.min(94, benchUtil + 4),
      difficultyHe: 'בינוני (2-3 שעות)',
      fitsScrap100Pct: true,
      partsUsedSummaryHe: `${standParts.length} חתיכות קצרות ובינוניות מהמלאי`,
      product: {
        productName: `מעמד עציצים מדורג 3 קומות (${Math.round(standW / 10)} ס"מ)`,
        parts: sanitizedStand.parts,
        groups: sanitizedStand.groups,
        audit: sanitizedStand.audit,
      },
    },
    {
      id: 'scrap-coffee-table',
      titleHe: `☕ שולחן צד / קפה כפרי (${Math.round(tblW / 10)}×${Math.round(
        tblD / 10
      )} ס"מ)`,
      descriptionHe:
        'שולחן קפה יציב עם מסגרת קושרות ופלטת לוחות עץ מלא שמותאמת לאורך השאריות שהזנת.',
      utilizationPct: Math.max(65, benchUtil - 6),
      difficultyHe: 'קל (שעה עבודה)',
      fitsScrap100Pct: true,
      partsUsedSummaryHe: `${tblParts.length} חלקים מתוך מלאי השאריות`,
      product: {
        productName: `שולחן קפה משאריות עץ (${Math.round(tblW / 10)}×${Math.round(
          tblD / 10
        )} ס"מ)`,
        parts: sanitizedTable.parts,
        groups: sanitizedTable.groups,
        audit: sanitizedTable.audit,
      },
    },
    {
      id: 'scrap-herb-box',
      titleHe: `🌱 אדנית תבלינים מוגבהת (${Math.round(boxW / 10)}×36 ס"מ)`,
      descriptionHe:
        'פרויקט מהיר שמנצל שאריות קצרות לעמודי פינה ודפנות כפולות לאדנית מרפסת יפהפייה.',
      utilizationPct: Math.max(60, benchUtil - 10),
      difficultyHe: 'קל (שעה עבודה)',
      fitsScrap100Pct: true,
      partsUsedSummaryHe: `${boxParts.length} חלקים קצרים מתוך השאריות`,
      product: {
        productName: `אדנית תבלינים משאריות (${Math.round(boxW / 10)} ס"מ)`,
        parts: sanitizedBox.parts,
        groups: sanitizedBox.groups,
        audit: sanitizedBox.audit,
      },
    },
  ];
}

/**
 * Optional Cloud AI Scrap Project Generator:
 * Sends the user's exact scrap wood list to Gemini and asks it to invent a custom project
 * whose parts strictly do not exceed the available scrap pieces.
 */
export async function generateCustomScrapProjectWithAI(
  inventory: ScrapWoodItem[],
  userHint: string,
  apiKey: string
): Promise<GeneratedProductResult> {
  const scrapDescription = inventory
    .map((item) => {
      const st = getStockById(item.stockId);
      return `- ${item.quantity} יחידות של ${st.name} (stockId="${st.id}", thickness=${st.thickness}mm, width=${st.width}mm) באורך ${item.lengthMm} מ"מ כל אחת`;
    })
    .join('\n');

  const stockSummary = STOCK_LIBRARY.map(
    (s) =>
      `${s.id}: ${s.name} (category=${s.category}, thickness=${s.thickness}mm, width=${s.width}mm)`
  ).join('\n');

  const promptText = `המשתמש מחזיק במלאי שאריות העץ הבא בלבד:
${scrapDescription}

${userHint ? `העדפת המשתמש: ${userHint}` : 'תכנן רהיט או מוצר שימושי, יפהפה ויציב שאפשר לבנות אך ורק מהעצים האלו בלי לחרוג מהאורכים הקיימים.'}

חוקים הנדסיים קריטיים:
1. Y=0 הוא הרצפה! כל הרגליים הנוגעות ברצפה חייבות להתחיל ב-Y=0 (כלומר position[1] = גובה_הרגל / 2).
2. במצב סיבוב [0,0,0]: האורך (length) הוא בציר X, העובי (thickness) בציר Y, הרוחב (width) בציר Z.
   - להעמדת רגל אנכית (length לאורך Y): השתמש ב-rotation [0, 0, 90].
   - לקורה אופקית קדימה-אחורה (length לאורך Z): השתמש ב-rotation [0, 90, 0] או [90, 90, 0].
3. ודא סימטריה מלאה ואפס קרשים בולטים!
4. החזר אך ורק JSON תקני במבנה:
{
  "productName": "שם הפרויקט מהשאריות בעברית",
  "groups": [{ "id": "grp-1", "name": "שם קבוצה", "color": "#f59e0b" }],
  "parts": [{
    "id": "part-1",
    "name": "שם החלק",
    "stockId": "${inventory[0]?.stockId || 'pine-5x10'}",
    "length": 600,
    "width": 95,
    "thickness": 45,
    "position": [0, 300, 0],
    "rotation": [0, 0, 90],
    "groupId": "grp-1"
  }]
}`;

  const parsed = await callGeminiJsonWithFallback(apiKey, {
    systemInstruction: {
      parts: [
        {
          text: `You are a master woodworking CAD designer specializing in building furniture out of leftover scrap wood. Available stock profiles:\n${stockSummary}`,
        },
      ],
    },
    contents: [{ role: 'user', parts: [{ text: promptText }] }],
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.2,
    },
  });

  const builtGroups: PartGroup[] = (parsed.groups || []).map(
    (g: any, idx: number) => ({
      id: g.id || `grp-sc-ai-${idx}`,
      name: g.name || `קבוצה ${idx + 1}`,
      color: g.color || '#f59e0b',
      visible: true,
      locked: false,
      collapsed: false,
    })
  );

  const builtParts: Part[] = (parsed.parts || []).map((p: any, idx: number) => {
    const stock = getStockById(p.stockId || inventory[0]?.stockId || 'pine-5x10');
    return makeScrapPart({
      id: p.id || `sc-ai-part-${idx}`,
      name: p.name || `חלק ${idx + 1}`,
      stockId: stock.id,
      dimensions: {
        length: Number(p.length) || 600,
        width: stock.category === 'lumber' ? stock.width : Number(p.width) || stock.width,
        thickness: stock.thickness,
      },
      position: [
        Number(p.position?.[0]) || 0,
        Number(p.position?.[1]) || stock.thickness / 2,
        Number(p.position?.[2]) || 0,
      ],
      rotation: [
        Number(p.rotation?.[0]) || 0,
        Number(p.rotation?.[1]) || 0,
        Number(p.rotation?.[2]) || 0,
      ],
      groupId: p.groupId || builtGroups[0]?.id || null,
    });
  });

  const sanitized = sanitizeAndAuditGeneratedModel(builtParts, builtGroups);
  return {
    productName: parsed.productName || 'פרויקט מותאם משאריות עץ',
    parts: sanitized.parts,
    groups: sanitized.groups,
    audit: sanitized.audit,
  };
}
