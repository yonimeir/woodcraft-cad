import React, { useEffect, useMemo, useRef } from 'react';
import { jsPDF } from 'jspdf';
import { useProjectStore } from '../../store/useProjectStore';
import {
  generateCutListGroups,
  optimizeLumber1D,
  optimizeSheets2D,
} from '../../utils/cutOptimizer';
import { getStockById } from '../../data/stockLibrary';
import { SheetStockBoard } from '../../types/woodcraft';
import {
  CheckCircle2,
  FileDown,
  Layers,
  Printer,
  Ruler,
  Scissors,
  Settings2,
  ShoppingBag,
  Wrench,
} from 'lucide-react';

const PALETTE = [
  '#f59e0b',
  '#10b981',
  '#38bdf8',
  '#a855f7',
  '#ec4899',
  '#eab308',
  '#14b8a6',
  '#f97316',
];

const Sheet2DCanvas: React.FC<{ board: SheetStockBoard }> = ({ board }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    const pad = 28;
    const drawW = W - pad * 2;
    const drawH = H - pad * 2;
    const scaleX = drawW / board.sheetLengthMm;
    const scaleY = drawH / board.sheetWidthMm;

    // Raw board background (waste area hatched/dark)
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(pad, pad, drawW, drawH);
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 2;
    ctx.strokeRect(pad, pad, drawW, drawH);

    // Usable area after edge trim
    if (board.edgeTrimMm > 0) {
      const tx = pad + board.edgeTrimMm * scaleX;
      const ty = pad + board.edgeTrimMm * scaleY;
      const tw = (board.sheetLengthMm - board.edgeTrimMm * 2) * scaleX;
      const th = (board.sheetWidthMm - board.edgeTrimMm * 2) * scaleY;
      ctx.strokeStyle = '#fbbf24';
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 1;
      ctx.strokeRect(tx, ty, tw, th);
      ctx.setLineDash([]);
    }

    // Draw each placed part
    board.placements.forEach((p, idx) => {
      const rx = pad + p.xMm * scaleX;
      const ry = pad + p.yMm * scaleY;
      const rw = p.lengthMm * scaleX;
      const rh = p.widthMm * scaleY;

      const color = PALETTE[idx % PALETTE.length];
      ctx.fillStyle = color + '33';
      ctx.fillRect(rx, ry, rw, rh);

      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.strokeRect(rx, ry, rw, rh);

      // Label in center
      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 13px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const centerText = `[${p.groupLabel}] ${p.lengthMm}×${p.widthMm}`;
      if (rw > 55 && rh > 22) {
        ctx.fillText(centerText, rx + rw / 2, ry + rh / 2 - (rh > 42 ? 7 : 0));
        if (rh > 42) {
          ctx.fillStyle = '#cbd5e1';
          ctx.font = '11px "Heebo", sans-serif';
          ctx.fillText(
            `${p.partName}${p.rotated ? ' (מסובב 90°)' : ''}`,
            rx + rw / 2,
            ry + rh / 2 + 10
          );
        }
      }
    });

    // Outer sheet dimensions text
    ctx.fillStyle = '#94a3b8';
    ctx.font = '11px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(
      `אורך פלטה: ${board.sheetLengthMm} מ"מ (כיוון סיבים ראשי ⟶)`,
      W / 2,
      14
    );
  }, [board]);

  return (
    <canvas
      ref={canvasRef}
      width={760}
      height={400}
      className="w-full max-w-[760px] h-auto rounded-lg border border-slate-800 bg-slate-950 mx-auto block"
    />
  );
};

export const WorkshopCutOptimizerView: React.FC = () => {
  const projectName = useProjectStore((s) => s.projectName);
  const parts = useProjectStore((s) => s.parts);
  const optimizerSettings = useProjectStore((s) => s.optimizerSettings);
  const updateOptimizerSettings = useProjectStore(
    (s) => s.updateOptimizerSettings
  );
  const setActiveView = useProjectStore((s) => s.setActiveView);
  const addToast = useProjectStore((s) => s.addToast);

  const printableRef = useRef<HTMLDivElement | null>(null);

  const { groups, partIdToLabel } = useMemo(
    () => generateCutListGroups(parts),
    [parts]
  );

  const lumberBars = useMemo(
    () => optimizeLumber1D(parts, partIdToLabel, optimizerSettings),
    [parts, partIdToLabel, optimizerSettings]
  );

  const sheetBoards = useMemo(
    () => optimizeSheets2D(parts, partIdToLabel, optimizerSettings),
    [parts, partIdToLabel, optimizerSettings]
  );

  // Summarize shopping list & Kreg screws & estimated cost
  const shoppingSummary = useMemo(() => {
    const stockCounts = new Map<
      string,
      { name: string; count: number; unitDesc: string; estCostILS: number }
    >();

    for (const bar of lumberBars) {
      const stock = getStockById(bar.stockId);
      const key = `${bar.stockId}_${bar.stockLengthMm}`;
      const cur = stockCounts.get(key) || {
        name: `${stock.name} (אורך ${(bar.stockLengthMm / 1000).toFixed(1)} מ')`,
        count: 0,
        unitDesc: 'קורות',
        estCostILS: 0,
      };
      cur.count += 1;
      cur.estCostILS += Math.round(
        (bar.stockLengthMm / 1000) * stock.referencePriceILS
      );
      stockCounts.set(key, cur);
    }

    for (const board of sheetBoards) {
      const stock = getStockById(board.stockId);
      const key = board.stockId;
      const cur = stockCounts.get(key) || {
        name: `${stock.name} (${board.sheetLengthMm}×${board.sheetWidthMm})`,
        count: 0,
        unitDesc: 'פלטות',
        estCostILS: 0,
      };
      cur.count += 1;
      cur.estCostILS += stock.referencePriceILS;
      stockCounts.set(key, cur);
    }

    // Hardware & Kreg Screws summary
    const screwSummary = new Map<string, number>();
    for (const grp of groups) {
      if (grp.hasPocketHoles && grp.kregRec && grp.pocketHoleCount > 0) {
        const k = `ברגי Kreg ${grp.kregRec.screwLengthMm} מ"מ (${grp.kregRec.screwLengthInch}) - הברגה ${grp.kregRec.threadType}`;
        screwSummary.set(k, (screwSummary.get(k) || 0) + grp.pocketHoleCount);
      }
    }

    const totalCostILS = Array.from(stockCounts.values()).reduce(
      (acc, v) => acc + v.estCostILS,
      0
    );

    return {
      materials: Array.from(stockCounts.values()),
      screws: Array.from(screwSummary.entries()),
      totalCostILS,
    };
  }, [lumberBars, sheetBoards, groups]);

  /**
   * Generates a complete, crisp, Hebrew-friendly Workshop PDF Document
   * using high-res Canvas rendering into jsPDF pages.
   */
  const handleExportPdf = () => {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    // Helper to render a high-resolution Hebrew canvas page and add to PDF
    const pageCanvas = document.createElement('canvas');
    pageCanvas.width = 1240;
    pageCanvas.height = 1754;
    const ctx = pageCanvas.getContext('2d')!;

    // Background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);

    // Header Banner
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, pageCanvas.width, 130);
    ctx.fillStyle = '#f59e0b';
    ctx.font = 'bold 34px "Heebo", sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(
      `תוכנית עבודה ורשימת חיתוך: ${projectName}`,
      pageCanvas.width - 50,
      62
    );
    ctx.fillStyle = '#cbd5e1';
    ctx.font = '20px "Heebo", sans-serif';
    ctx.fillText(
      `WoodCraft 3D CAD | עובי להב: ${optimizerSettings.kerfMm} מ"מ | יישור קצה: ${optimizerSettings.edgeTrimMm} מ"מ | סה"כ חלקים: ${parts.filter((p) => p.visible).length}`,
      pageCanvas.width - 50,
      102
    );

    let yCursor = 175;

    // 1. Try embedding 3D isometric snapshot if available in DOM
    const threeCanvas = document.querySelector(
      '#woodcraft-3d-canvas canvas'
    ) as HTMLCanvasElement | null;
    if (threeCanvas) {
      try {
        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 24px "Heebo", sans-serif';
        ctx.fillText('1. הדמיה תלת-ממדית של הפרויקט:', pageCanvas.width - 50, yCursor);
        yCursor += 18;
        ctx.drawImage(threeCanvas, 220, yCursor, 800, 360);
        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 2;
        ctx.strokeRect(220, yCursor, 800, 360);
        yCursor += 395;
      } catch {
        // ignore if canvas not mounted
      }
    }

    // 2. Cut List Table (BOM)
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 24px "Heebo", sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(
      '2. טבלת חיתוך מרוכזת (BOM / Cut List):',
      pageCanvas.width - 50,
      yCursor
    );
    yCursor += 22;

    // Table Header
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(50, yCursor, pageCanvas.width - 100, 44);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 18px "Heebo", sans-serif';
    ctx.fillText('אות', pageCanvas.width - 70, yCursor + 28);
    ctx.fillText('תיאור החלקים', pageCanvas.width - 150, yCursor + 28);
    ctx.fillText('פרופיל חומר', pageCanvas.width - 450, yCursor + 28);
    ctx.fillText('כמות', pageCanvas.width - 720, yCursor + 28);
    ctx.fillText('מידת חיתוך (מ"מ)', pageCanvas.width - 820, yCursor + 28);
    ctx.fillText('עיבודים (גרונג / Kreg)', pageCanvas.width - 1030, yCursor + 28);
    yCursor += 44;

    groups.forEach((g, idx) => {
      if (yCursor > 1580) return;
      ctx.fillStyle = idx % 2 === 0 ? '#f8fafc' : '#f1f5f9';
      ctx.fillRect(50, yCursor, pageCanvas.width - 100, 40);
      ctx.strokeStyle = '#e2e8f0';
      ctx.strokeRect(50, yCursor, pageCanvas.width - 100, 40);

      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 17px "JetBrains Mono", monospace';
      ctx.fillText(`[${g.label}]`, pageCanvas.width - 70, yCursor + 26);

      ctx.font = '17px "Heebo", sans-serif';
      ctx.fillText(
        g.partNames.slice(0, 2).join(', ').slice(0, 28),
        pageCanvas.width - 150,
        yCursor + 26
      );
      ctx.fillText(g.stockName.slice(0, 26), pageCanvas.width - 450, yCursor + 26);

      ctx.font = 'bold 18px "JetBrains Mono", monospace';
      ctx.fillText(`${g.quantity} יח'`, pageCanvas.width - 720, yCursor + 26);
      ctx.fillText(
        `${g.cutLengthMm} × ${g.widthMm} × ${g.thicknessMm}`,
        pageCanvas.width - 820,
        yCursor + 26
      );

      const mods: string[] = [];
      if (g.miterStartDeg || g.miterEndDeg) {
        mods.push(`גרונג ${g.miterStartDeg}°/${g.miterEndDeg}°`);
      }
      if (g.hasPocketHoles && g.kregRec) {
        mods.push(`Kreg ${g.kregRec.screwLengthMm}mm`);
      }
      if (g.dadoCount > 0) {
        mods.push(`מגרעת`);
      }
      ctx.font = '15px "Heebo", sans-serif';
      ctx.fillText(mods.join(' | ') || 'חיתוך ישר 90°', pageCanvas.width - 1030, yCursor + 26);

      yCursor += 40;
    });

    // 3. Lumber 1D Optimization Summary
    yCursor += 35;
    if (yCursor < 1550 && lumberBars.length > 0) {
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 24px "Heebo", sans-serif';
      ctx.fillText(
        `3. מפת ניסור קורות אופטימלית (${lumberBars.length} קורות לרכישה):`,
        pageCanvas.width - 50,
        yCursor
      );
      yCursor += 25;

      lumberBars.slice(0, 7).forEach((bar, bIdx) => {
        if (yCursor > 1650) return;
        ctx.fillStyle = '#334155';
        ctx.font = 'bold 16px "Heebo", sans-serif';
        ctx.fillText(
          `קורה #${bIdx + 1}: ${bar.stockName} (אורך ${bar.stockLengthMm} מ"מ | ניצולת ${bar.efficiencyPct}% | שארית ${bar.wasteMm} מ"מ)`,
          pageCanvas.width - 50,
          yCursor + 16
        );
        yCursor += 24;

        const barX = 60;
        const barW = pageCanvas.width - 120;
        const barH = 34;
        ctx.fillStyle = '#e2e8f0';
        ctx.fillRect(barX, yCursor, barW, barH);
        ctx.strokeStyle = '#64748b';
        ctx.strokeRect(barX, yCursor, barW, barH);

        bar.cuts.forEach((c, cIdx) => {
          const cx = barX + (c.startMm / bar.stockLengthMm) * barW;
          const cw = (c.lengthMm / bar.stockLengthMm) * barW;
          ctx.fillStyle = PALETTE[cIdx % PALETTE.length];
          ctx.fillRect(cx, yCursor, cw, barH);
          ctx.strokeStyle = '#0f172a';
          ctx.strokeRect(cx, yCursor, cw, barH);

          if (cw > 42) {
            ctx.fillStyle = '#0f172a';
            ctx.font = 'bold 14px "JetBrains Mono", monospace';
            ctx.textAlign = 'center';
            ctx.fillText(
              `[${c.groupLabel}] ${c.lengthMm}`,
              cx + cw / 2,
              yCursor + 22
            );
            ctx.textAlign = 'right';
          }
        });

        yCursor += barH + 18;
      });
    }

    const imgData = pageCanvas.toDataURL('image/png');
    doc.addImage(imgData, 'PNG', 0, 0, 210, 297);
    doc.save(`${projectName.replace(/\s+/g, '_')}_CutList.pdf`);
    addToast('קובץ ה-PDF הופק והורד בהצלחה!', 'success');
  };

  return (
    <div
      ref={printableRef}
      className="flex-1 h-full overflow-y-auto bg-slate-950 p-6 space-y-6 select-text"
    >
      {/* Top Action & Settings Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4 shadow-xl">
        <div>
          <div className="flex items-center gap-2">
            <span className="bg-amber-500/20 text-amber-400 border border-amber-500/40 px-2.5 py-0.5 rounded-full text-xs font-bold">
              מצב סדנה ותוצרים
            </span>
            <h2 className="text-lg font-extrabold text-white">
              תוכנית עבודה, רשימת חיתוך (BOM) ואופטימיזציית ניסור – {projectName}
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            המערכת קיבצה אוטומטית את כל החלקים הזהים וחישבה פריסת ניסור אופטימלית
            למזעור פחת בקורות (1D) ובפלטות (2D Guillotine).
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setActiveView('3d')}
            className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer"
          >
            חזרה לעורך ה-3D
          </button>
          <button
            onClick={() => window.print()}
            className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            הדפס מסך
          </button>
          <button
            onClick={handleExportPdf}
            className="bg-amber-500 hover:bg-amber-400 text-slate-950 px-4 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 shadow-lg transition cursor-pointer"
          >
            <FileDown className="w-4 h-4" />
            הורד תוכנית עבודה ל-PDF
          </button>
        </div>
      </div>

      {/* Optimizer Parameters Panel */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 grid grid-cols-1 md:grid-cols-5 gap-4 items-center">
        <div className="flex items-center gap-2 text-amber-400 font-bold text-xs">
          <Settings2 className="w-4 h-4 shrink-0" />
          <span>פרמטרים למחסן העצים ולמסור:</span>
        </div>

        {/* Stock Bar Length */}
        <div>
          <label className="text-[11px] text-slate-400 block mb-1">
            אורך קורת גלם במחסן:
          </label>
          <select
            value={optimizerSettings.defaultLumberStockLengthMm}
            onChange={(e) =>
              updateOptimizerSettings({
                defaultLumberStockLengthMm: Number(e.target.value),
              })
            }
            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono text-white"
          >
            <option value={2400}>2400 מ"מ (2.4 מ')</option>
            <option value={3000}>3000 מ"מ (3.0 מ')</option>
            <option value={3600}>3600 מ"מ (3.6 מ')</option>
            <option value={4200}>4200 מ"מ (4.2 מ')</option>
            <option value={4800}>4800 מ"מ (4.8 מ')</option>
          </select>
        </div>

        {/* Saw Blade Kerf */}
        <div>
          <label className="text-[11px] text-slate-400 block mb-1">
            עובי להב המסור (Kerf):
          </label>
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              min={0}
              max={10}
              step={0.5}
              value={optimizerSettings.kerfMm}
              onChange={(e) =>
                updateOptimizerSettings({
                  kerfMm: Math.max(0, Number(e.target.value)),
                })
              }
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono text-white"
            />
            <span className="text-xs text-slate-400">מ"מ</span>
          </div>
        </div>

        {/* Edge Trim (Squaring Cut) */}
        <div>
          <label className="text-[11px] text-slate-400 block mb-1">
            יישור קצה פגום (Edge Trim):
          </label>
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              min={0}
              max={60}
              step={5}
              value={optimizerSettings.edgeTrimMm}
              onChange={(e) =>
                updateOptimizerSettings({
                  edgeTrimMm: Math.max(0, Number(e.target.value)),
                })
              }
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono text-white"
            />
            <span className="text-xs text-slate-400">מ"מ</span>
          </div>
        </div>

        {/* Toggles: Nested Miters & Grain Direction */}
        <div className="space-y-1.5 text-xs">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={optimizerSettings.allowNestedMiters}
              onChange={(e) =>
                updateOptimizerSettings({
                  allowNestedMiters: e.target.checked,
                })
              }
              className="accent-amber-500 w-4 h-4"
            />
            <span className="text-slate-200">
              חיתוך גרונג משותף (Nested 45°)
            </span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={optimizerSettings.respectGrainDirection}
              onChange={(e) =>
                updateOptimizerSettings({
                  respectGrainDirection: e.target.checked,
                })
              }
              className="accent-amber-500 w-4 h-4"
            />
            <span className="text-slate-200">שמור על כיוון סיבים בפלטות</span>
          </label>
        </div>
      </div>

      {/* Shopping List & Hardware Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Raw Materials to Buy */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
              <ShoppingBag className="w-4 h-4" />
              רשימת רכש למחסן העצים
            </span>
            <span className="text-xs font-mono bg-amber-500/15 text-amber-300 px-2 py-0.5 rounded">
              הערכת מחיר: ~₪{shoppingSummary.totalCostILS}
            </span>
          </div>
          {shoppingSummary.materials.length === 0 ? (
            <p className="text-xs text-slate-400">אין חומרים בפרויקט.</p>
          ) : (
            <ul className="space-y-1.5 text-xs">
              {shoppingSummary.materials.map((m, i) => (
                <li
                  key={i}
                  className="flex items-center justify-between bg-slate-950/70 px-3 py-1.5 rounded-lg border border-slate-800/80"
                >
                  <span className="text-slate-200 font-medium">{m.name}</span>
                  <span className="font-mono font-bold text-amber-400">
                    {m.count} {m.unitDesc} (~₪{m.estCostILS})
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Card 2: Kreg Pocket Hole Screws & Joinery */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-2.5">
          <div className="text-xs font-bold text-sky-400 flex items-center gap-1.5">
            <Wrench className="w-4 h-4" />
            רשימת ברגי Kreg וחיבורים מומלצים
          </div>
          {shoppingSummary.screws.length === 0 ? (
            <p className="text-xs text-slate-400">
              לא הוגדרו חורי כיס (Kreg) בחלקי הפרויקט. ניתן להפעיל אותם בלחיצה על
              חלק בעורך ה-3D.
            </p>
          ) : (
            <ul className="space-y-1.5 text-xs">
              {shoppingSummary.screws.map(([desc, count], i) => (
                <li
                  key={i}
                  className="flex items-center justify-between bg-sky-950/30 border border-sky-500/30 px-3 py-1.5 rounded-lg"
                >
                  <span className="text-sky-100">{desc}</span>
                  <span className="font-mono font-bold text-amber-300 shrink-0 mr-2">
                    {count} ברגים
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Card 3: Optimization Stats */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-2.5">
          <div className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4" />
            סיכום אופטימיזציה ופחת
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-slate-950/70 p-2.5 rounded-lg border border-slate-800">
              <div className="text-slate-400 text-[11px]">קבוצות חיתוך (A-Z)</div>
              <div className="text-lg font-mono font-bold text-white">
                {groups.length} קבוצות
              </div>
            </div>
            <div className="bg-slate-950/70 p-2.5 rounded-lg border border-slate-800">
              <div className="text-slate-400 text-[11px]">סה"כ חלקים לניסור</div>
              <div className="text-lg font-mono font-bold text-amber-400">
                {parts.filter((p) => p.visible).length} יח'
              </div>
            </div>
            <div className="bg-slate-950/70 p-2.5 rounded-lg border border-slate-800">
              <div className="text-slate-400 text-[11px]">קורות גלם נדרשות</div>
              <div className="text-base font-mono font-bold text-emerald-400">
                {lumberBars.length} קורות
              </div>
            </div>
            <div className="bg-slate-950/70 p-2.5 rounded-lg border border-slate-800">
              <div className="text-slate-400 text-[11px]">פלטות 1220×2440</div>
              <div className="text-base font-mono font-bold text-sky-400">
                {sheetBoards.length} פלטות
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION A: Grouped BOM / Cut List Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Ruler className="w-4 h-4 text-amber-400" />
            א. טבלת רשימת חיתוך מרוכזת (BOM / Cut List)
          </h3>
          <span className="text-xs text-slate-400">
            כל החלקים הזהים קובצו אוטומטית תחת אות מזהה (A, B, C...)
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-950 text-slate-300 border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">אות מזהה</th>
                <th className="py-3 px-4">שמות החלקים במודל</th>
                <th className="py-3 px-4">חומר וחתך</th>
                <th className="py-3 px-4">כמות</th>
                <th className="py-3 px-4">אורך חיתוך חיצוני (Long)</th>
                <th className="py-3 px-4">אורך פנימי (Short)</th>
                <th className="py-3 px-4">רוחב × עובי</th>
                <th className="py-3 px-4">זוויות גרונג</th>
                <th className="py-3 px-4">חורי כיס (Kreg) ומגרעות</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {groups.map((g) => (
                <tr
                  key={g.label}
                  className="hover:bg-slate-800/40 transition text-slate-200"
                >
                  <td className="py-2.5 px-4">
                    <span className="px-2.5 py-1 rounded-md bg-amber-500 text-slate-950 font-mono font-extrabold text-xs">
                      {g.label}
                    </span>
                  </td>
                  <td className="py-2.5 px-4 font-medium">
                    {g.partNames.join(', ')}
                  </td>
                  <td className="py-2.5 px-4 text-slate-300">{g.stockName}</td>
                  <td className="py-2.5 px-4 font-mono font-bold text-amber-400 text-sm">
                    {g.quantity}×
                  </td>
                  <td className="py-2.5 px-4 font-mono font-bold text-white">
                    {g.cutLengthMm} מ"מ
                  </td>
                  <td className="py-2.5 px-4 font-mono text-slate-400">
                    {g.innerLengthMm} מ"מ
                  </td>
                  <td className="py-2.5 px-4 font-mono">
                    {g.widthMm} × {g.thicknessMm} מ"מ
                  </td>
                  <td className="py-2.5 px-4 font-mono">
                    {g.miterStartDeg !== 0 || g.miterEndDeg !== 0 ? (
                      <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded">
                        התחלה: {g.miterStartDeg}° | סוף: {g.miterEndDeg}°
                      </span>
                    ) : (
                      <span className="text-slate-500">90° ישר</span>
                    )}
                  </td>
                  <td className="py-2.5 px-4">
                    <div className="flex flex-wrap gap-1">
                      {g.hasPocketHoles && g.kregRec && (
                        <span className="bg-sky-950 text-sky-300 border border-sky-500/40 px-2 py-0.5 rounded text-[11px]">
                          Kreg: ג'יג {g.kregRec.jigSettingMm} | בורג{' '}
                          {g.kregRec.screwLengthMm} מ"מ ({g.pocketHoleCount} יח')
                        </span>
                      )}
                      {g.dadoCount > 0 && (
                        <span className="bg-emerald-950 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded text-[11px]">
                          {g.dadoCount} מגרעות חצי-חצי
                        </span>
                      )}
                      {!g.hasPocketHoles && g.dadoCount === 0 && (
                        <span className="text-slate-500">—</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* SECTION B: 1D Bin Packing Diagrams for Dimensional Lumber */}
      {lumberBars.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-4 shadow-lg">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Scissors className="w-4 h-4 text-amber-400" />
              ב. מפת ניסור אופטימלית לקורות עץ (1D First-Fit Decreasing Bin Packing)
            </h3>
            <span className="text-xs text-slate-400">
              כולל חישוב עובי להב ({optimizerSettings.kerfMm} מ"מ) ויישור קצוות (
              {optimizerSettings.edgeTrimMm} מ"מ)
            </span>
          </div>

          <div className="space-y-4">
            {lumberBars.map((bar, idx) => (
              <div
                key={`${bar.stockId}-${idx}`}
                className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 space-y-2"
              >
                <div className="flex flex-wrap items-center justify-between text-xs gap-2">
                  <div className="font-bold text-slate-100">
                    קורה #{idx + 1} – {bar.stockName}{' '}
                    <span className="text-amber-400 font-mono">
                      (אורך גלם: {bar.stockLengthMm} מ"מ)
                    </span>
                  </div>
                  <div className="flex items-center gap-3 font-mono text-xs">
                    <span className="text-emerald-400">
                      מנוצל: {bar.usedMm} מ"מ ({bar.efficiencyPct}%)
                    </span>
                    <span className="text-slate-400">
                      פחת / שארית: {bar.wasteMm} מ"מ
                    </span>
                  </div>
                </div>

                {/* 1D Visual Bar Diagram */}
                <div className="relative h-12 w-full bg-slate-900 rounded-lg border border-slate-700 overflow-hidden flex items-center">
                  {/* Left Edge Trim */}
                  {bar.edgeTrimMm > 0 && (
                    <div
                      style={{
                        width: `${(bar.edgeTrimMm / bar.stockLengthMm) * 100}%`,
                      }}
                      className="h-full bg-red-950/70 border-l border-red-500/40 shrink-0"
                      title={`יישור קצה: ${bar.edgeTrimMm} מ"מ`}
                    />
                  )}

                  {/* Cut Segments */}
                  {bar.cuts.map((cut, cIdx) => {
                    const leftPct = (cut.startMm / bar.stockLengthMm) * 100;
                    const widthPct = (cut.lengthMm / bar.stockLengthMm) * 100;
                    const color = PALETTE[cIdx % PALETTE.length];

                    return (
                      <div
                        key={`${cut.partId}-${cIdx}`}
                        style={{
                          position: 'absolute',
                          left: `${leftPct}%`,
                          width: `${widthPct}%`,
                          backgroundColor: `${color}30`,
                          borderColor: color,
                        }}
                        className="h-full border-2 flex flex-col items-center justify-center px-1 overflow-hidden transition hover:brightness-125"
                        title={`[${cut.groupLabel}] ${cut.partName}: ${cut.lengthMm} מ"מ`}
                      >
                        <div className="text-[11px] font-mono font-extrabold text-white truncate">
                          [{cut.groupLabel}] {cut.lengthMm} מ"מ
                        </div>
                        <div className="text-[10px] text-slate-300 truncate">
                          {cut.partName}
                          {cut.nestedWithPrev ? ' (גרונג משותף 45°)' : ''}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SECTION C: 2D Guillotine Bin Packing for Sheet Goods */}
      {sheetBoards.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-4 shadow-lg">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-sky-400" />
              ג. מפת חיתוך פלטות דו-ממדית (2D Guillotine Bin Packing – 1220×2440 מ"מ)
            </h3>
            <span className="text-xs text-slate-400">
              חיתוכי גיליוטינה ישרים המותאמים למסור שולחן / מסור עגול עם מסילה
            </span>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {sheetBoards.map((board, idx) => (
              <div
                key={`${board.stockId}-${idx}`}
                className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 space-y-3"
              >
                <div className="flex items-center justify-between text-xs">
                  <div className="font-bold text-slate-100">
                    פלטה #{idx + 1}: {board.stockName}{' '}
                    <span className="font-mono text-sky-400">
                      ({board.sheetLengthMm}×{board.sheetWidthMm} מ"מ)
                    </span>
                  </div>
                  <span className="font-mono text-emerald-400 font-bold">
                    ניצולת שטח: {board.efficiencyPct}%
                  </span>
                </div>

                <Sheet2DCanvas board={board} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
