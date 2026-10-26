import {
  CutListGroup,
  CutOptimizerSettings,
  LumberStockBar,
  Part,
  SheetPlacedRect,
  SheetStockBoard,
} from '../types/woodcraft';
import { getStockById } from '../data/stockLibrary';
import {
  calculateKregRecommendation,
  resolvePartLengths,
} from './geometryAndEngineering';

function indexToLabel(index: number): string {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  if (index < 26) return letters[index];
  const first = Math.floor(index / 26) - 1;
  const second = index % 26;
  return `${letters[first]}${letters[second]}`;
}

/**
 * Generates grouped BOM / Cut List items with labels A, B, C...
 */
export function generateCutListGroups(parts: Part[]): {
  groups: CutListGroup[];
  partIdToLabel: Record<string, string>;
} {
  const visibleParts = parts.filter((p) => p.visible);
  const map = new Map<string, CutListGroup>();
  const partIdToLabel: Record<string, string> = {};

  for (const part of visibleParts) {
    const stock = getStockById(part.stockId);
    const { outerLength, innerLength } = resolvePartLengths(part);
    const cutLen = Math.round(outerLength);
    const inLen = Math.round(innerLength);
    const w = Math.round(part.dimensions.width);
    const t = Math.round(part.dimensions.thickness);
    const mStart = part.miterStart.enabled ? Math.round(part.miterStart.angle) : 0;
    const mEnd = part.miterEnd.enabled ? Math.round(part.miterEnd.angle) : 0;

    const key = [
      part.stockId,
      cutLen,
      w,
      t,
      mStart,
      mEnd,
      part.pocketHoles.enabled ? 'ph' : 'noph',
    ].join('|');

    const kreg = calculateKregRecommendation(part);

    const existing = map.get(key);
    if (existing) {
      existing.quantity += 1;
      existing.partIds.push(part.id);
      if (!existing.partNames.includes(part.name)) {
        existing.partNames.push(part.name);
      }
      if (kreg) {
        existing.pocketHoleCount += kreg.totalScrewsForPart;
      }
      existing.dadoCount += part.dadoNotches.length;
    } else {
      map.set(key, {
        label: '',
        stockId: part.stockId,
        stockName: stock.name,
        category: stock.category,
        quantity: 1,
        cutLengthMm: cutLen,
        innerLengthMm: inLen,
        widthMm: w,
        thicknessMm: t,
        miterStartDeg: mStart,
        miterEndDeg: mEnd,
        hasPocketHoles: part.pocketHoles.enabled,
        pocketHoleCount: kreg ? kreg.totalScrewsForPart : 0,
        kregRec: kreg,
        dadoCount: part.dadoNotches.length,
        partIds: [part.id],
        partNames: [part.name],
        allowRotationInCut: part.allowRotationInCut || !stock.hasGrain,
      });
    }
  }

  // Sort groups by category (lumber, sheet, hardware) and then by stockId & length descending
  const sorted = Array.from(map.values()).sort((a, b) => {
    if (a.category !== b.category) return a.category.localeCompare(b.category);
    if (a.stockId !== b.stockId) return a.stockId.localeCompare(b.stockId);
    return b.cutLengthMm - a.cutLengthMm;
  });

  sorted.forEach((group, idx) => {
    const lbl = indexToLabel(idx);
    group.label = lbl;
    for (const pid of group.partIds) {
      partIdToLabel[pid] = lbl;
    }
  });

  return { groups: sorted, partIdToLabel };
}

/**
 * 1D Bin Packing (First-Fit Decreasing) for Dimensional Lumber
 * Supports Saw Kerf, Edge Trim (Squaring margin), and Nested Miters!
 */
export function optimizeLumber1D(
  parts: Part[],
  partIdToLabel: Record<string, string>,
  settings: CutOptimizerSettings
): LumberStockBar[] {
  const visibleLumber = parts.filter((p) => {
    if (!p.visible) return false;
    const stock = getStockById(p.stockId);
    return stock.category === 'lumber';
  });

  // Group by stockId
  const byStock = new Map<string, Part[]>();
  for (const p of visibleLumber) {
    const arr = byStock.get(p.stockId) || [];
    arr.push(p);
    byStock.set(p.stockId, arr);
  }

  const allBars: LumberStockBar[] = [];

  for (const [stockId, stockParts] of byStock.entries()) {
    const stock = getStockById(stockId);

    // Prepare individual cut items sorted longest first (First Fit Decreasing)
    const items = stockParts
      .map((p) => {
        const { outerLength } = resolvePartLengths(p);
        return {
          partId: p.id,
          partName: p.name,
          groupLabel: partIdToLabel[p.id] || '?',
          lengthMm: Math.round(outerLength),
          widthMm: p.dimensions.width,
          miterStartDeg: p.miterStart.enabled ? Math.round(p.miterStart.angle) : 0,
          miterEndDeg: p.miterEnd.enabled ? Math.round(p.miterEnd.angle) : 0,
        };
      })
      .sort((a, b) => b.lengthMm - a.lengthMm);

    const barsForStock: LumberStockBar[] = [];

    for (const item of items) {
      // Determine target stock bar length
      let targetStockLen = settings.defaultLumberStockLengthMm;
      const usableDefault = targetStockLen - settings.edgeTrimMm * 2;
      if (item.lengthMm > usableDefault) {
        // Pick the smallest commercial stock length that fits, or custom length
        const available = stock.stockLengths.find(
          (len) => len - settings.edgeTrimMm * 2 >= item.lengthMm
        );
        targetStockLen = available || item.lengthMm + settings.edgeTrimMm * 2 + 100;
      }

      let placed = false;

      for (const bar of barsForStock) {
        const maxUsableEnd = bar.stockLengthMm - settings.edgeTrimMm;
        const lastCut = bar.cuts[bar.cuts.length - 1];

        let curStart = lastCut
          ? lastCut.startMm + lastCut.lengthMm + settings.kerfMm
          : settings.edgeTrimMm;
        let nested = false;

        // Check if Nested Miters can save space between lastCut.miterEndDeg and item.miterStartDeg
        if (
          settings.allowNestedMiters &&
          lastCut &&
          Math.abs(lastCut.miterEndDeg) >= 15 &&
          Math.abs(Math.abs(lastCut.miterEndDeg) - Math.abs(item.miterStartDeg)) <= 2
        ) {
          const rad = (Math.abs(item.miterStartDeg) * Math.PI) / 180;
          const miterOverlap = Math.floor(item.widthMm * Math.tan(rad) * 0.85);
          if (miterOverlap > settings.kerfMm) {
            curStart -= miterOverlap;
            nested = true;
          }
        }

        if (curStart + item.lengthMm <= maxUsableEnd) {
          bar.cuts.push({
            groupLabel: item.groupLabel,
            partName: item.partName,
            partId: item.partId,
            startMm: Math.round(curStart),
            lengthMm: item.lengthMm,
            miterStartDeg: item.miterStartDeg,
            miterEndDeg: item.miterEndDeg,
            nestedWithPrev: nested,
          });
          placed = true;
          break;
        }
      }

      if (!placed) {
        const newBar: LumberStockBar = {
          barIndex: barsForStock.length + 1,
          stockId,
          stockName: stock.name,
          stockLengthMm: targetStockLen,
          edgeTrimMm: settings.edgeTrimMm,
          cuts: [
            {
              groupLabel: item.groupLabel,
              partName: item.partName,
              partId: item.partId,
              startMm: settings.edgeTrimMm,
              lengthMm: item.lengthMm,
              miterStartDeg: item.miterStartDeg,
              miterEndDeg: item.miterEndDeg,
              nestedWithPrev: false,
            },
          ],
          usedMm: 0,
          wasteMm: 0,
          efficiencyPct: 0,
        };
        barsForStock.push(newBar);
      }
    }

    // Finalize stats per bar
    for (const bar of barsForStock) {
      const sumParts = bar.cuts.reduce((acc, c) => acc + c.lengthMm, 0);
      bar.usedMm = sumParts;
      bar.wasteMm = Math.max(0, bar.stockLengthMm - sumParts);
      bar.efficiencyPct = Math.round((sumParts / bar.stockLengthMm) * 1000) / 10;
      allBars.push(bar);
    }
  }

  return allBars;
}

interface FreeRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * 2D Guillotine Bin Packing for Sheet Goods (1220 x 2440 mm boards).
 * Uses Guillotine free-rectangle splitting with saw kerf and optional grain-direction rotation.
 */
export function optimizeSheets2D(
  parts: Part[],
  partIdToLabel: Record<string, string>,
  settings: CutOptimizerSettings
): SheetStockBoard[] {
  const visibleSheets = parts.filter((p) => {
    if (!p.visible) return false;
    const stock = getStockById(p.stockId);
    return stock.category === 'sheet';
  });

  const byStock = new Map<string, Part[]>();
  for (const p of visibleSheets) {
    const arr = byStock.get(p.stockId) || [];
    arr.push(p);
    byStock.set(p.stockId, arr);
  }

  const allBoards: SheetStockBoard[] = [];

  for (const [stockId, sheetParts] of byStock.entries()) {
    const stock = getStockById(stockId);
    const rawLength = stock.sheetSize?.length || 2440;
    const rawWidth = stock.sheetSize?.width || 1220;

    // Sort descending by area (or longest side)
    const items = sheetParts
      .map((p) => {
        const { outerLength } = resolvePartLengths(p);
        const canRotate =
          !settings.respectGrainDirection || !stock.hasGrain || p.allowRotationInCut;
        return {
          partId: p.id,
          partName: p.name,
          groupLabel: partIdToLabel[p.id] || '?',
          lengthMm: Math.min(rawLength - settings.edgeTrimMm * 2, Math.round(outerLength)),
          widthMm: Math.min(rawWidth - settings.edgeTrimMm * 2, Math.round(p.dimensions.width)),
          canRotate,
        };
      })
      .sort((a, b) => b.lengthMm * b.widthMm - a.lengthMm * a.widthMm);

    const boards: Array<{
      board: SheetStockBoard;
      freeRects: FreeRect[];
    }> = [];

    const createNewBoard = () => {
      const trim = settings.edgeTrimMm;
      const b: SheetStockBoard = {
        boardIndex: boards.length + 1,
        stockId,
        stockName: stock.name,
        sheetLengthMm: rawLength,
        sheetWidthMm: rawWidth,
        edgeTrimMm: trim,
        placements: [],
        usedAreaMm2: 0,
        totalAreaMm2: rawLength * rawWidth,
        efficiencyPct: 0,
      };
      boards.push({
        board: b,
        freeRects: [
          {
            x: trim,
            y: trim,
            w: rawLength - trim * 2,
            h: rawWidth - trim * 2,
          },
        ],
      });
    };

    for (const item of items) {
      let placed = false;

      const tryPlaceOnBoard = (entry: {
        board: SheetStockBoard;
        freeRects: FreeRect[];
      }): boolean => {
        let bestRectIdx = -1;
        let bestRot = false;
        let bestShortSideFit = Infinity;

        for (let i = 0; i < entry.freeRects.length; i++) {
          const r = entry.freeRects[i];
          // Normal orientation (length along X, width along Y)
          if (item.lengthMm <= r.w && item.widthMm <= r.h) {
            const leftoverW = r.w - item.lengthMm;
            const leftoverH = r.h - item.widthMm;
            const shortSide = Math.min(leftoverW, leftoverH);
            if (shortSide < bestShortSideFit) {
              bestShortSideFit = shortSide;
              bestRectIdx = i;
              bestRot = false;
            }
          }
          // Rotated 90 deg orientation (if allowed)
          if (item.canRotate && item.widthMm <= r.w && item.lengthMm <= r.h) {
            const leftoverW = r.w - item.widthMm;
            const leftoverH = r.h - item.lengthMm;
            const shortSide = Math.min(leftoverW, leftoverH);
            if (shortSide < bestShortSideFit) {
              bestShortSideFit = shortSide;
              bestRectIdx = i;
              bestRot = true;
            }
          }
        }

        if (bestRectIdx === -1) return false;

        const chosen = entry.freeRects[bestRectIdx];
        const placedW = bestRot ? item.widthMm : item.lengthMm;
        const placedH = bestRot ? item.lengthMm : item.widthMm;

        const placement: SheetPlacedRect = {
          groupLabel: item.groupLabel,
          partName: item.partName,
          partId: item.partId,
          xMm: Math.round(chosen.x),
          yMm: Math.round(chosen.y),
          lengthMm: placedW,
          widthMm: placedH,
          rotated: bestRot,
        };
        entry.board.placements.push(placement);

        // Remove chosen rect and split guillotine-style with kerf
        entry.freeRects.splice(bestRectIdx, 1);
        const kerf = settings.kerfMm;
        const rightW = chosen.w - placedW - kerf;
        const bottomH = chosen.h - placedH - kerf;

        // Guillotine split along the shorter leftover axis to maximize remaining contiguous area
        if (rightW > bottomH) {
          // Vertical guillotine cut first
          if (rightW > 20) {
            entry.freeRects.push({
              x: chosen.x + placedW + kerf,
              y: chosen.y,
              w: rightW,
              h: chosen.h,
            });
          }
          if (bottomH > 20) {
            entry.freeRects.push({
              x: chosen.x,
              y: chosen.y + placedH + kerf,
              w: placedW,
              h: bottomH,
            });
          }
        } else {
          // Horizontal guillotine cut first
          if (bottomH > 20) {
            entry.freeRects.push({
              x: chosen.x,
              y: chosen.y + placedH + kerf,
              w: chosen.w,
              h: bottomH,
            });
          }
          if (rightW > 20) {
            entry.freeRects.push({
              x: chosen.x + placedW + kerf,
              y: chosen.y,
              w: rightW,
              h: placedH,
            });
          }
        }

        return true;
      };

      for (const entry of boards) {
        if (tryPlaceOnBoard(entry)) {
          placed = true;
          break;
        }
      }

      if (!placed) {
        createNewBoard();
        tryPlaceOnBoard(boards[boards.length - 1]);
      }
    }

    for (const entry of boards) {
      const b = entry.board;
      b.usedAreaMm2 = b.placements.reduce(
        (acc, p) => acc + p.lengthMm * p.widthMm,
        0
      );
      b.efficiencyPct = Math.round((b.usedAreaMm2 / b.totalAreaMm2) * 1000) / 10;
      allBoards.push(b);
    }
  }

  return allBoards;
}
