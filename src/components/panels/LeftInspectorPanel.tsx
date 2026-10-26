import React, { useMemo, useState } from 'react';
import { useProjectStore } from '../../store/useProjectStore';
import { STOCK_LIBRARY, getStockById } from '../../data/stockLibrary';
import {
  analyzeStructuralLoads,
  calculateKregRecommendation,
  detectPartCollisions,
  getPartWorldBounds,
  resolvePartLengths,
} from '../../utils/geometryAndEngineering';
import {
  AlertTriangle,
  Compass,
  Crosshair,
  Home,
  RotateCw,
  Ruler,
  Scissors,
  ShieldCheck,
  Sliders,
  Sparkles,
  Wrench,
} from 'lucide-react';
import { MiterLengthMode, PivotAnchor } from '../../types/woodcraft';

export const LeftInspectorPanel: React.FC = () => {
  const [panelMode, setPanelMode] = useState<'inspector' | 'spacer' | 'room'>(
    'inspector'
  );

  const parts = useProjectStore((s) => s.parts);
  const selectedIds = useProjectStore((s) => s.selectedIds);
  const updatePart = useProjectStore((s) => s.updatePart);
  const setPartPivot = useProjectStore((s) => s.setPartPivot);
  const rotatePartWithPivot = useProjectStore((s) => s.rotatePartWithPivot);
  const createParametricDado = useProjectStore((s) => s.createParametricDado);
  const removeDadoNotch = useProjectStore((s) => s.removeDadoNotch);
  const distributeAutoSpacer = useProjectStore((s) => s.distributeAutoSpacer);
  const room = useProjectStore((s) => s.room);
  const updateRoom = useProjectStore((s) => s.updateRoom);
  const addRoomObstacle = useProjectStore((s) => s.addRoomObstacle);
  const removeRoomObstacle = useProjectStore((s) => s.removeRoomObstacle);

  // Auto-Spacer local state
  const [spacerPartA, setSpacerPartA] = useState<string>('');
  const [spacerPartB, setSpacerPartB] = useState<string>('');
  const [spacerTemplate, setSpacerTemplate] = useState<string>('');
  const [spacerCount, setSpacerCount] = useState<number>(4);
  const [spacerAxis, setSpacerAxis] = useState<'x' | 'y' | 'z'>('z');

  const selectedPart =
    selectedIds.length > 0
      ? parts.find((p) => p.id === selectedIds[0])
      : undefined;

  const stock = selectedPart ? getStockById(selectedPart.stockId) : undefined;
  const resolvedLengths = selectedPart
    ? resolvePartLengths(selectedPart)
    : undefined;
  const selectedBounds = selectedPart
    ? getPartWorldBounds(selectedPart)
    : undefined;
  const floorHeightMm = selectedBounds
    ? Math.max(0, Math.round(selectedBounds.min[1]))
    : 0;
  const kregRec = selectedPart
    ? calculateKregRecommendation(selectedPart)
    : null;

  const allCollisions = useMemo(() => detectPartCollisions(parts), [parts]);
  const partCollisions = useMemo(() => {
    if (!selectedPart) return [];
    return allCollisions.filter(
      (c) => c.partAId === selectedPart.id || c.partBId === selectedPart.id
    );
  }, [allCollisions, selectedPart]);

  const loadAnalysis = useMemo(() => {
    if (!selectedPart) return undefined;
    return analyzeStructuralLoads(parts).find(
      (r) => r.partId === selectedPart.id
    );
  }, [parts, selectedPart]);

  // 9-point grid for X (-1, 0, 1) and Y (-1, 0, 1) + Z depth selector
  const pivotGridRows: Array<{ y: -1 | 0 | 1; label: string }> = [
    { y: 1, label: 'עליון (+Y)' },
    { y: 0, label: 'אמצע (0)' },
    { y: -1, label: 'תחתון (-Y)' },
  ];
  const pivotGridCols: Array<{ x: -1 | 0 | 1; label: string }> = [
    { x: -1, label: 'קצה שמאל' },
    { x: 0, label: 'מרכז' },
    { x: 1, label: 'קצה ימין' },
  ];

  return (
    <aside className="w-88 bg-slate-900 border-r border-slate-800 flex flex-col h-full shrink-0 select-none overflow-hidden">
      {/* Top Mode Switcher */}
      <div className="grid grid-cols-3 p-2 gap-1 bg-slate-950/60 border-b border-slate-800">
        <button
          onClick={() => setPanelMode('inspector')}
          className={`flex items-center justify-center gap-1 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
            panelMode === 'inspector'
              ? 'bg-amber-500 text-slate-950 shadow'
              : 'bg-slate-800/70 text-slate-300 hover:bg-slate-800'
          }`}
        >
          <Sliders className="w-3.5 h-3.5" />
          מאפיינים ועיבוד
        </button>
        <button
          onClick={() => setPanelMode('spacer')}
          className={`flex items-center justify-center gap-1 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
            panelMode === 'spacer'
              ? 'bg-amber-500 text-slate-950 shadow'
              : 'bg-slate-800/70 text-slate-300 hover:bg-slate-800'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          מרווחים שווים
        </button>
        <button
          onClick={() => setPanelMode('room')}
          className={`flex items-center justify-center gap-1 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
            panelMode === 'room'
              ? 'bg-amber-500 text-slate-950 shadow'
              : 'bg-slate-800/70 text-slate-300 hover:bg-slate-800'
          }`}
        >
          <Home className="w-3.5 h-3.5" />
          סביבת חדר
        </button>
      </div>

      {/* MODE 1: PART INSPECTOR */}
      {panelMode === 'inspector' && (
        <div className="flex-1 overflow-y-auto p-3 space-y-4">
          {!selectedPart || !stock || !resolvedLengths ? (
            <div className="text-center py-12 px-4 bg-slate-950/40 rounded-2xl border border-slate-800/80 space-y-2">
              <Compass className="w-10 h-10 text-amber-400/60 mx-auto" />
              <div className="text-sm font-bold text-slate-200">
                לא נבחר חלק לעריכה
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                לחץ על קורה או פלטה במרחב התלת-ממדי (או בפאנל השכבות מימין) כדי
                לערוך מידות, לבחור נקודת ציר לסיבוב (Anchor Point), להוסיף חיתוכי
                גרונג, חורי כיס או מגרעות.
              </p>
            </div>
          ) : (
            <>
              {/* 1. Part Identity & Material Profile */}
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider">
                    זיהוי ופרופיל חומר
                  </span>
                  <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded font-mono">
                    {stock.category === 'lumber'
                      ? 'קורת עץ מלא'
                      : stock.category === 'sheet'
                      ? 'פלטה / לביד'
                      : 'פרזול'}
                  </span>
                </div>

                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">
                    שם החלק בתוכנית:
                  </label>
                  <input
                    type="text"
                    value={selectedPart.name}
                    onChange={(e) =>
                      updatePart(selectedPart.id, { name: e.target.value })
                    }
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:border-amber-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">
                    פרופיל חומר מספריית המדף:
                  </label>
                  <select
                    value={selectedPart.stockId}
                    onChange={(e) => {
                      const nextStock = getStockById(e.target.value);
                      updatePart(selectedPart.id, {
                        stockId: nextStock.id,
                        dimensions: {
                          length: selectedPart.dimensions.length,
                          width:
                            nextStock.category === 'lumber'
                              ? nextStock.width
                              : selectedPart.dimensions.width,
                          thickness: nextStock.thickness,
                        },
                      });
                    }}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-100 focus:border-amber-500 focus:outline-none"
                  >
                    {STOCK_LIBRARY.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.thickness}×{s.width} מ"מ)
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 2. Structural Load & Sag Warning / Status Card */}
              {loadAnalysis && (
                <div
                  className={`rounded-xl p-3 border space-y-2 ${
                    loadAnalysis.severity === 'critical' ||
                    loadAnalysis.severity === 'warning'
                      ? 'bg-red-950/50 border-red-500/70 text-red-100'
                      : loadAnalysis.severity === 'caution'
                      ? 'bg-amber-950/40 border-amber-500/60 text-amber-100'
                      : 'bg-emerald-950/30 border-emerald-500/40 text-emerald-100'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold flex items-center gap-1.5">
                      {loadAnalysis.severity === 'safe' ? (
                        <ShieldCheck className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-red-400" />
                      )}
                      בדיקת עומסים ושקיעה (Sagulator)
                    </span>
                    <span className="text-[11px] font-mono font-bold px-1.5 py-0.5 rounded bg-black/30">
                      שקיעה: {loadAnalysis.deflectionMm} מ"מ
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-1.5 text-[11px] font-mono bg-black/20 p-2 rounded-lg">
                    <div>מפתח חופשי: {loadAnalysis.unsupportedSpanMm} מ"מ</div>
                    <div>עומס מחושב: ~{loadAnalysis.assumedLoadKg} ק"ג</div>
                    <div>תקן מקסימלי: {loadAnalysis.allowableDeflectionMm} מ"מ</div>
                    <div>
                      מנח חתך:{' '}
                      {loadAnalysis.isLaidFlat ? 'שוכב (חלש)' : 'על הדופן (חזק)'}
                    </div>
                  </div>

                  <p className="text-[11px] leading-relaxed opacity-95">
                    {loadAnalysis.recommendationHe}
                  </p>

                  {loadAnalysis.isLaidFlat &&
                    (loadAnalysis.severity === 'warning' ||
                      loadAnalysis.severity === 'critical') && (
                      <button
                        onClick={() =>
                          rotatePartWithPivot(selectedPart.id, [
                            (selectedPart.rotation[0] + 90) % 360,
                            selectedPart.rotation[1],
                            selectedPart.rotation[2],
                          ])
                        }
                        className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold py-1.5 rounded-lg text-xs transition cursor-pointer"
                      >
                        סובב קורה ב-90° על דופנה (שקיעה תרד ל-
                        {loadAnalysis.edgewiseDeflectionMm} מ"מ)
                      </button>
                    )}
                </div>
              )}

              {/* 3. Dimensions & Illustrator-style Miter Length Reference Mode */}
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                    <Ruler className="w-3.5 h-3.5" />
                    מידות החלק (במ"מ)
                  </span>
                  <span className="text-[10px] text-slate-400">
                    ניתן גם למתוח ידיות ב-3D
                  </span>
                </div>

                {/* Length Input + Slider */}
                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-slate-300 font-medium">
                      אורך (Length):
                    </span>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min={50}
                        max={4800}
                        step={5}
                        value={Math.round(selectedPart.dimensions.length)}
                        disabled={stock.category === 'hardware'}
                        onChange={(e) =>
                          updatePart(selectedPart.id, {
                            dimensions: {
                              ...selectedPart.dimensions,
                              length: Math.max(50, Number(e.target.value) || 50),
                            },
                          })
                        }
                        className="w-20 bg-slate-900 border border-slate-700 rounded px-2 py-0.5 text-left font-mono text-xs text-amber-300"
                      />
                      <span className="text-[11px] text-slate-400">מ"מ</span>
                    </div>
                  </div>
                  {stock.category !== 'hardware' && (
                    <input
                      type="range"
                      min={100}
                      max={3600}
                      step={10}
                      value={selectedPart.dimensions.length}
                      onChange={(e) =>
                        updatePart(
                          selectedPart.id,
                          {
                            dimensions: {
                              ...selectedPart.dimensions,
                              length: Number(e.target.value),
                            },
                          },
                          false
                        )
                      }
                      className="w-full accent-amber-500 cursor-pointer"
                    />
                  )}
                </div>

                {/* Height from Floor (Y) Input + Slider + Drop to Floor button */}
                <div className="pt-2 border-t border-slate-800/80">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-emerald-400 font-semibold">
                      גובה מהרצפה (ציר Y ↕):
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          if (!selectedBounds) return;
                          const halfH = selectedBounds.size[1] / 2;
                          updatePart(selectedPart.id, {
                            position: [
                              selectedPart.position[0],
                              halfH,
                              selectedPart.position[2],
                            ],
                          });
                        }}
                        className="bg-emerald-950 hover:bg-emerald-800 text-emerald-300 border border-emerald-500/40 px-1.5 py-0.5 rounded text-[10px] font-semibold cursor-pointer"
                        title="הנח את תחתית הקורה בדיוק על הרצפה (0 מ''מ)"
                      >
                        הנח על הרצפה (0)
                      </button>
                      <input
                        type="number"
                        min={0}
                        max={2500}
                        step={5}
                        value={floorHeightMm}
                        onChange={(e) => {
                          if (!selectedBounds) return;
                          const targetBottom = Math.max(
                            0,
                            Number(e.target.value) || 0
                          );
                          const halfH = selectedBounds.size[1] / 2;
                          updatePart(selectedPart.id, {
                            position: [
                              selectedPart.position[0],
                              targetBottom + halfH,
                              selectedPart.position[2],
                            ],
                          });
                        }}
                        className="w-18 bg-slate-900 border border-slate-700 rounded px-2 py-0.5 text-left font-mono text-xs text-emerald-300"
                      />
                      <span className="text-[11px] text-slate-400">מ"מ</span>
                    </div>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={1800}
                    step={5}
                    value={floorHeightMm}
                    onChange={(e) => {
                      if (!selectedBounds) return;
                      const targetBottom = Number(e.target.value);
                      const halfH = selectedBounds.size[1] / 2;
                      updatePart(
                        selectedPart.id,
                        {
                          position: [
                            selectedPart.position[0],
                            targetBottom + halfH,
                            selectedPart.position[2],
                          ],
                        },
                        false
                      );
                    }}
                    className="w-full accent-emerald-500 cursor-pointer"
                  />
                </div>

                {/* Width Input (Editable only for Sheet Goods; Fixed for Dimensional Lumber) */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">
                      רוחב (Width){' '}
                      {stock.category === 'lumber' ? '🔒 קבוע' : '(פלטה)'}:
                    </label>
                    <input
                      type="number"
                      min={40}
                      max={1220}
                      step={5}
                      disabled={stock.category !== 'sheet'}
                      value={Math.round(selectedPart.dimensions.width)}
                      onChange={(e) =>
                        updatePart(selectedPart.id, {
                          dimensions: {
                            ...selectedPart.dimensions,
                            width: Math.max(
                              40,
                              Math.min(1220, Number(e.target.value) || 40)
                            ),
                          },
                        })
                      }
                      className="w-full bg-slate-900 disabled:bg-slate-900/40 border border-slate-700 rounded px-2 py-1 text-xs font-mono text-slate-200 disabled:text-slate-500"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">
                      עובי (Thickness) 🔒 קבוע:
                    </label>
                    <input
                      type="number"
                      disabled
                      value={selectedPart.dimensions.thickness}
                      className="w-full bg-slate-900/40 border border-slate-800 rounded px-2 py-1 text-xs font-mono text-slate-500"
                    />
                  </div>
                </div>

                {/* Illustrator-style Length Reference Mode (Outer / Inner / Center) */}
                {(selectedPart.miterStart.enabled ||
                  selectedPart.miterEnd.enabled) && (
                  <div className="pt-2 border-t border-slate-800 space-y-1.5">
                    <label className="text-[11px] text-amber-300 font-semibold block">
                      ייחוס מידת האורך בחיתוך גרונג (כמו באילוסטרייטור):
                    </label>
                    <div className="grid grid-cols-3 gap-1">
                      {(
                        [
                          { id: 'outer', label: 'חיצוני (Long)' },
                          { id: 'center', label: 'מרכז (Path)' },
                          { id: 'inner', label: 'פנימי (Short)' },
                        ] as Array<{ id: MiterLengthMode; label: string }>
                      ).map((m) => (
                        <button
                          key={m.id}
                          onClick={() =>
                            updatePart(selectedPart.id, {
                              miterLengthMode: m.id,
                            })
                          }
                          className={`py-1 rounded text-[11px] font-semibold transition cursor-pointer ${
                            selectedPart.miterLengthMode === m.id
                              ? 'bg-amber-500 text-slate-950'
                              : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-700'
                          }`}
                        >
                          {m.label}
                        </button>
                      ))}
                    </div>
                    <div className="text-[10px] font-mono text-slate-400 bg-slate-900/90 p-1.5 rounded flex justify-between">
                      <span>חיצוני: {resolvedLengths.outerLength} מ"מ</span>
                      <span>מרכז: {resolvedLengths.centerLength} מ"מ</span>
                      <span>פנימי: {resolvedLengths.innerLength} מ"מ</span>
                    </div>
                  </div>
                )}

                {/* Grain Direction / Rotation permission on 2D Sheet */}
                {stock.category === 'sheet' && stock.hasGrain && (
                  <label className="flex items-center justify-between pt-2 border-t border-slate-800 text-xs cursor-pointer">
                    <span className="text-slate-300">
                      אפשר סיבוב 90° על הפלטה (התעלם מכיוון סיבים)
                    </span>
                    <input
                      type="checkbox"
                      checked={selectedPart.allowRotationInCut}
                      onChange={(e) =>
                        updatePart(selectedPart.id, {
                          allowRotationInCut: e.target.checked,
                        })
                      }
                      className="accent-amber-500 w-4 h-4"
                    />
                  </label>
                )}
              </div>

              {/* 4. Selectable Anchor / Pivot Point (נקודת עוגן לסיבוב 🎯) & Axis Rotation */}
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-pink-400 flex items-center gap-1.5">
                    <Crosshair className="w-3.5 h-3.5" />
                    נקודת עוגן לסיבוב (Anchor / Pivot 🎯)
                  </span>
                </div>

                <p className="text-[11px] text-slate-400 leading-tight">
                  בחר סביב איזו נקודה בקורה יתבצע הסיבוב (מרכז הקורה, קצה ימין/שמאל,
                  או פינה תחתונה/עליונה):
                </p>

                {/* 9-Point Visual Grid Selector (X vs Y) */}
                <div className="bg-slate-900 p-2 rounded-lg border border-slate-800 space-y-1.5">
                  <div className="grid grid-cols-4 gap-1 text-[10px] text-slate-400 text-center items-center">
                    <div />
                    {pivotGridCols.map((c) => (
                      <div key={c.x} className="font-semibold">
                        {c.label}
                      </div>
                    ))}
                  </div>
                  {pivotGridRows.map((row) => (
                    <div
                      key={row.y}
                      className="grid grid-cols-4 gap-1 items-center"
                    >
                      <span className="text-[10px] text-slate-400">
                        {row.label}
                      </span>
                      {pivotGridCols.map((col) => {
                        const isActive =
                          selectedPart.pivot.x === col.x &&
                          selectedPart.pivot.y === row.y;
                        return (
                          <button
                            key={`${col.x}_${row.y}`}
                            onClick={() =>
                              setPartPivot(selectedPart.id, {
                                x: col.x,
                                y: row.y,
                                z: selectedPart.pivot.z,
                              })
                            }
                            className={`h-7 rounded flex items-center justify-center transition cursor-pointer border ${
                              isActive
                                ? 'bg-pink-600 text-white border-pink-300 font-bold shadow'
                                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                            }`}
                            title={`עוגן: ${col.label}, ${row.label}`}
                          >
                            {isActive ? '🎯' : '•'}
                          </button>
                        );
                      })}
                    </div>
                  ))}

                  {/* Z Depth Anchor Selector */}
                  <div className="flex items-center justify-between pt-1.5 border-t border-slate-800 text-[11px]">
                    <span className="text-slate-400">עומק עוגן (ציר Z):</span>
                    <div className="flex gap-1">
                      {(
                        [
                          { z: -1, label: 'אחורי' },
                          { z: 0, label: 'מרכז' },
                          { z: 1, label: 'קדמי' },
                        ] as Array<{ z: -1 | 0 | 1; label: string }>
                      ).map((zp) => (
                        <button
                          key={zp.z}
                          onClick={() =>
                            setPartPivot(selectedPart.id, {
                              ...selectedPart.pivot,
                              z: zp.z,
                            } as PivotAnchor)
                          }
                          className={`px-2 py-0.5 rounded text-[10px] cursor-pointer ${
                            selectedPart.pivot.z === zp.z
                              ? 'bg-pink-600 text-white font-bold'
                              : 'bg-slate-800 text-slate-300'
                          }`}
                        >
                          {zp.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Rotation Angles around selected Pivot */}
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-200">
                    <span className="flex items-center gap-1">
                      <RotateCw className="w-3.5 h-3.5 text-amber-400" />
                      זוויות סיבוב סביב העוגן:
                    </span>
                    <button
                      onClick={() =>
                        rotatePartWithPivot(selectedPart.id, [0, 0, 0])
                      }
                      className="text-[10px] text-amber-400 hover:underline cursor-pointer"
                    >
                      אפס ל-0°
                    </button>
                  </div>

                  {(['x', 'y', 'z'] as const).map((axis, idx) => {
                    const colors = [
                      'text-red-400',
                      'text-emerald-400',
                      'text-sky-400',
                    ];
                    const labels = [
                      'ציר X (גלגול / העמדה על דופן)',
                      'ציר Y (סיבוב אופקי על הרצפה)',
                      'ציר Z (הטיה / העמדת רגל אנכית)',
                    ];
                    const curDeg = Math.round(selectedPart.rotation[idx]);

                    return (
                      <div
                        key={axis}
                        className="bg-slate-900/90 p-2 rounded-lg border border-slate-800/80 space-y-1"
                      >
                        <div className="flex items-center justify-between text-[11px]">
                          <span className={`font-semibold ${colors[idx]}`}>
                            {labels[idx]}
                          </span>
                          <span className="font-mono font-bold text-slate-200">
                            {curDeg}°
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="range"
                            min={0}
                            max={360}
                            step={5}
                            value={curDeg}
                            onChange={(e) => {
                              const next: [number, number, number] = [
                                ...selectedPart.rotation,
                              ];
                              next[idx] = Number(e.target.value);
                              rotatePartWithPivot(selectedPart.id, next, false);
                            }}
                            className="flex-1 accent-amber-500 cursor-pointer"
                          />
                          <button
                            onClick={() => {
                              const next: [number, number, number] = [
                                ...selectedPart.rotation,
                              ];
                              next[idx] = (next[idx] + 45) % 360;
                              rotatePartWithPivot(selectedPart.id, next, true);
                            }}
                            className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-1.5 py-0.5 rounded text-[10px] font-mono cursor-pointer"
                          >
                            +45°
                          </button>
                          <button
                            onClick={() => {
                              const next: [number, number, number] = [
                                ...selectedPart.rotation,
                              ];
                              next[idx] = (next[idx] + 90) % 360;
                              rotatePartWithPivot(selectedPart.id, next, true);
                            }}
                            className="bg-slate-800 hover:bg-slate-700 text-amber-300 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold cursor-pointer"
                          >
                            +90°
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 5. Joinery & Modifications: Miter Cuts, Pocket Holes (Kreg), Dado Notches */}
              {stock.category !== 'hardware' && (
                <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3 space-y-3">
                  <div className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                    <Scissors className="w-3.5 h-3.5" />
                    עיבודים וחיבורים (גרונג, חורי כיס, מגרעות)
                  </div>

                  {/* A. Miter Cuts (Start & End) */}
                  <div className="space-y-2 border-b border-slate-800 pb-3">
                    {/* Start Miter */}
                    <div className="bg-slate-900 p-2 rounded-lg border border-slate-800 space-y-1.5">
                      <label className="flex items-center justify-between text-xs font-semibold cursor-pointer">
                        <span>חיתוך גרונג בקצה שמאל / התחלה (-X)</span>
                        <input
                          type="checkbox"
                          checked={selectedPart.miterStart.enabled}
                          onChange={(e) =>
                            updatePart(selectedPart.id, {
                              miterStart: {
                                ...selectedPart.miterStart,
                                enabled: e.target.checked,
                              },
                            })
                          }
                          className="accent-amber-500 w-4 h-4"
                        />
                      </label>
                      {selectedPart.miterStart.enabled && (
                        <div className="space-y-1.5 pt-1">
                          <div className="flex items-center justify-between gap-1">
                            {[-45, -30, 30, 45].map((ang) => (
                              <button
                                key={ang}
                                onClick={() =>
                                  updatePart(selectedPart.id, {
                                    miterStart: {
                                      ...selectedPart.miterStart,
                                      angle: ang,
                                    },
                                  })
                                }
                                className={`flex-1 py-1 rounded text-[11px] font-mono font-bold cursor-pointer ${
                                  selectedPart.miterStart.angle === ang
                                    ? 'bg-amber-500 text-slate-950'
                                    : 'bg-slate-800 text-slate-300'
                                }`}
                              >
                                {ang}°
                              </button>
                            ))}
                          </div>
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-slate-400">כיוון להב:</span>
                            <div className="flex gap-1">
                              <button
                                onClick={() =>
                                  updatePart(selectedPart.id, {
                                    miterStart: {
                                      ...selectedPart.miterStart,
                                      axis: 'z',
                                    },
                                  })
                                }
                                className={`px-2 py-0.5 rounded text-[10px] cursor-pointer ${
                                  selectedPart.miterStart.axis === 'z'
                                    ? 'bg-amber-500/30 text-amber-300 border border-amber-500/50'
                                    : 'bg-slate-800 text-slate-400'
                                }`}
                              >
                                על הרוחב (Miter)
                              </button>
                              <button
                                onClick={() =>
                                  updatePart(selectedPart.id, {
                                    miterStart: {
                                      ...selectedPart.miterStart,
                                      axis: 'y',
                                    },
                                  })
                                }
                                className={`px-2 py-0.5 rounded text-[10px] cursor-pointer ${
                                  selectedPart.miterStart.axis === 'y'
                                    ? 'bg-amber-500/30 text-amber-300 border border-amber-500/50'
                                    : 'bg-slate-800 text-slate-400'
                                }`}
                              >
                                על העובי (Bevel)
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* End Miter */}
                    <div className="bg-slate-900 p-2 rounded-lg border border-slate-800 space-y-1.5">
                      <label className="flex items-center justify-between text-xs font-semibold cursor-pointer">
                        <span>חיתוך גרונג בקצה ימין / סוף (+X)</span>
                        <input
                          type="checkbox"
                          checked={selectedPart.miterEnd.enabled}
                          onChange={(e) =>
                            updatePart(selectedPart.id, {
                              miterEnd: {
                                ...selectedPart.miterEnd,
                                enabled: e.target.checked,
                              },
                            })
                          }
                          className="accent-amber-500 w-4 h-4"
                        />
                      </label>
                      {selectedPart.miterEnd.enabled && (
                        <div className="space-y-1.5 pt-1">
                          <div className="flex items-center justify-between gap-1">
                            {[-45, -30, 30, 45].map((ang) => (
                              <button
                                key={ang}
                                onClick={() =>
                                  updatePart(selectedPart.id, {
                                    miterEnd: {
                                      ...selectedPart.miterEnd,
                                      angle: ang,
                                    },
                                  })
                                }
                                className={`flex-1 py-1 rounded text-[11px] font-mono font-bold cursor-pointer ${
                                  selectedPart.miterEnd.angle === ang
                                    ? 'bg-amber-500 text-slate-950'
                                    : 'bg-slate-800 text-slate-300'
                                }`}
                              >
                                {ang}°
                              </button>
                            ))}
                          </div>
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-slate-400">כיוון להב:</span>
                            <div className="flex gap-1">
                              <button
                                onClick={() =>
                                  updatePart(selectedPart.id, {
                                    miterEnd: {
                                      ...selectedPart.miterEnd,
                                      axis: 'z',
                                    },
                                  })
                                }
                                className={`px-2 py-0.5 rounded text-[10px] cursor-pointer ${
                                  selectedPart.miterEnd.axis === 'z'
                                    ? 'bg-amber-500/30 text-amber-300 border border-amber-500/50'
                                    : 'bg-slate-800 text-slate-400'
                                }`}
                              >
                                על הרוחב (Miter)
                              </button>
                              <button
                                onClick={() =>
                                  updatePart(selectedPart.id, {
                                    miterEnd: {
                                      ...selectedPart.miterEnd,
                                      axis: 'y',
                                    },
                                  })
                                }
                                className={`px-2 py-0.5 rounded text-[10px] cursor-pointer ${
                                  selectedPart.miterEnd.axis === 'y'
                                    ? 'bg-amber-500/30 text-amber-300 border border-amber-500/50'
                                    : 'bg-slate-800 text-slate-400'
                                }`}
                              >
                                על העובי (Bevel)
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* B. Kreg Pocket Holes & Automatic Screw Calculator */}
                  <div className="space-y-2 border-b border-slate-800 pb-3">
                    <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800 space-y-2">
                      <label className="flex items-center justify-between text-xs font-semibold cursor-pointer">
                        <span className="flex items-center gap-1.5 text-sky-300">
                          <Wrench className="w-3.5 h-3.5" />
                          חורי כיס (Kreg Pocket Holes)
                        </span>
                        <input
                          type="checkbox"
                          checked={selectedPart.pocketHoles.enabled}
                          onChange={(e) =>
                            updatePart(selectedPart.id, {
                              pocketHoles: {
                                ...selectedPart.pocketHoles,
                                enabled: e.target.checked,
                              },
                            })
                          }
                          className="accent-sky-500 w-4 h-4"
                        />
                      </label>

                      {selectedPart.pocketHoles.enabled && (
                        <div className="space-y-2 pt-1 text-xs">
                          <div className="grid grid-cols-2 gap-1.5">
                            <div>
                              <span className="text-[10px] text-slate-400 block mb-0.5">
                                מיקום הקידוחים:
                              </span>
                              <select
                                value={selectedPart.pocketHoles.ends}
                                onChange={(e) =>
                                  updatePart(selectedPart.id, {
                                    pocketHoles: {
                                      ...selectedPart.pocketHoles,
                                      ends: e.target.value as any,
                                    },
                                  })
                                }
                                className="w-full bg-slate-950 border border-slate-700 rounded px-1.5 py-1 text-[11px]"
                              >
                                <option value="both">שני הקצוות</option>
                                <option value="start">קצה התחלה בלבד</option>
                                <option value="end">קצה סוף בלבד</option>
                                <option value="sides">כל ההיקף (4 פאות)</option>
                              </select>
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-400 block mb-0.5">
                                חורים בכל קצה:
                              </span>
                              <input
                                type="number"
                                min={1}
                                max={6}
                                value={selectedPart.pocketHoles.holesPerEdge}
                                onChange={(e) =>
                                  updatePart(selectedPart.id, {
                                    pocketHoles: {
                                      ...selectedPart.pocketHoles,
                                      holesPerEdge: Math.max(
                                        1,
                                        Math.min(6, Number(e.target.value) || 2)
                                      ),
                                    },
                                  })
                                }
                                className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-[11px] font-mono"
                              />
                            </div>
                          </div>

                          {/* Automatic Kreg Recommendation Box */}
                          {kregRec && (
                            <div className="bg-sky-950/60 border border-sky-500/40 rounded-lg p-2 text-[11px] space-y-1">
                              <div className="font-bold text-sky-300">
                                המלצת מערכת אוטומטית (עובי עץ {kregRec.woodThicknessMm}{' '}
                                מ"מ):
                              </div>
                              <div className="grid grid-cols-2 gap-1 text-slate-200 font-mono text-[10px]">
                                <div>הגדרת ג'יג: {kregRec.jigSettingMm}</div>
                                <div>טבעת מקדח: {kregRec.drillCollarMm}</div>
                                <div className="col-span-2 text-amber-300 font-bold">
                                  בורג מומלץ: {kregRec.screwLengthMm} מ"מ (
                                  {kregRec.screwLengthInch}) – הברגה{' '}
                                  {kregRec.threadType}
                                </div>
                                <div className="col-span-2 text-slate-400">
                                  סה"כ לחלק זה: {kregRec.totalScrewsForPart} ברגים
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* C. Parametric Half-Lap / Dado Notches */}
                  <div className="space-y-2">
                    <div className="text-xs font-semibold text-slate-200">
                      מגרעות חצי-חצי (Half-Lap / Dado):
                    </div>

                    {selectedPart.dadoNotches.length > 0 ? (
                      <div className="space-y-1.5">
                        {selectedPart.dadoNotches.map((dado) => (
                          <div
                            key={dado.id}
                            className="flex items-center justify-between bg-emerald-950/40 border border-emerald-500/40 px-2.5 py-1.5 rounded-lg text-[11px]"
                          >
                            <div>
                              <span className="font-bold text-emerald-300">
                                {dado.mode === 'half'
                                  ? 'מגרעת חצי-חצי (50%)'
                                  : 'מגרעת מלאה (Dado)'}
                              </span>
                              <div className="text-slate-300">
                                מול: "{dado.cutterPartName}"
                              </div>
                            </div>
                            <button
                              onClick={() =>
                                removeDadoNotch(selectedPart.id, dado.id)
                              }
                              className="text-red-400 hover:text-red-300 text-[10px] font-semibold px-2 py-0.5 bg-red-950/60 rounded cursor-pointer"
                            >
                              הסר
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[11px] text-slate-400">
                        אין מגרעות פעילות על חלק זה. כאשר שתי קורות חוצות זו את זו,
                        ניתן ליצור מגרעת אוטומטית בלחיצת כפתור.
                      </p>
                    )}

                    {/* Available intersecting beams to carve a dado from */}
                    {partCollisions.map((col) => {
                      const otherId =
                        col.partAId === selectedPart.id
                          ? col.partBId
                          : col.partAId;
                      const otherName =
                        col.partAId === selectedPart.id
                          ? col.partBName
                          : col.partAName;
                      const alreadyHas = selectedPart.dadoNotches.some(
                        (d) => d.cutterPartId === otherId
                      );
                      if (alreadyHas) return null;

                      return (
                        <div
                          key={col.id}
                          className="bg-amber-950/40 border border-amber-500/50 p-2 rounded-lg space-y-1.5 text-[11px]"
                        >
                          <div className="text-amber-200">
                            חוצה את הקורה: <strong>"{otherName}"</strong>
                          </div>
                          <div className="flex gap-1.5">
                            <button
                              onClick={() =>
                                createParametricDado(
                                  selectedPart.id,
                                  otherId,
                                  'half'
                                )
                              }
                              className="flex-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold py-1 rounded text-[11px] cursor-pointer"
                            >
                              צור מגרעת חצי-חצי
                            </button>
                            <button
                              onClick={() =>
                                createParametricDado(
                                  selectedPart.id,
                                  otherId,
                                  'full'
                                )
                              }
                              className="flex-1 bg-slate-800 hover:bg-slate-700 text-amber-300 py-1 rounded text-[11px] cursor-pointer"
                            >
                              מגרעת מלאה
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* MODE 2: AUTO-SPACER TOOL (מרווחים שווים) */}
      {panelMode === 'spacer' && (
        <div className="flex-1 overflow-y-auto p-3 space-y-4">
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3.5 space-y-3">
            <div className="flex items-center gap-2 text-amber-400 font-bold text-xs">
              <Sparkles className="w-4 h-4" />
              כלי פיזור במרווחים שווים (Auto-Spacer)
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              בחר שתי קורות קצה (קורה א' וקורה ב') ואת החלק שברצונך לשכפל ביניהן
              (למשל שלבי ספסל, מדפים בארון, או קורות פרגולה). המערכת תחשב ותפזר את
              היחידות במרווח נטו שווה לחלוטין.
            </p>

            <div className="space-y-2.5 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">
                  קורת גבול א' (התחלה):
                </label>
                <select
                  value={spacerPartA}
                  onChange={(e) => setSpacerPartA(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100"
                >
                  <option value="">-- בחר קורה א' --</option>
                  {parts.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">
                  קורת גבול ב' (סוף):
                </label>
                <select
                  value={spacerPartB}
                  onChange={(e) => setSpacerPartB(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100"
                >
                  <option value="">-- בחר קורה ב' --</option>
                  {parts.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">
                  רכיב לשכפול ופיזור:
                </label>
                <select
                  value={spacerTemplate || selectedIds[0] || ''}
                  onChange={(e) => setSpacerTemplate(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100"
                >
                  <option value="">-- בחר חלק לתבנית --</option>
                  {parts.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-slate-400 block mb-1">
                    כמות יחידות:
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={25}
                    value={spacerCount}
                    onChange={(e) =>
                      setSpacerCount(
                        Math.max(1, Math.min(25, Number(e.target.value) || 1))
                      )
                    }
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 font-mono"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">ציר פיזור:</label>
                  <select
                    value={spacerAxis}
                    onChange={(e) =>
                      setSpacerAxis(e.target.value as 'x' | 'y' | 'z')
                    }
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5"
                  >
                    <option value="x">ציר X (רוחב)</option>
                    <option value="y">ציר Y (גובה - מדפים)</option>
                    <option value="z">ציר Z (עומק - שלבים)</option>
                  </select>
                </div>
              </div>

              <button
                onClick={() => {
                  const tmplId = spacerTemplate || selectedIds[0];
                  if (!spacerPartA || !spacerPartB || !tmplId) return;
                  distributeAutoSpacer({
                    partAId: spacerPartA,
                    partBId: spacerPartB,
                    templatePartId: tmplId,
                    count: spacerCount,
                    axis: spacerAxis,
                  });
                }}
                disabled={
                  !spacerPartA ||
                  !spacerPartB ||
                  spacerPartA === spacerPartB ||
                  !(spacerTemplate || selectedIds[0])
                }
                className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 font-bold py-2 rounded-xl transition cursor-pointer mt-2"
              >
                פזר {spacerCount} יחידות במרווח שווה
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODE 3: IKEA-STYLE ROOM ENVIRONMENT BUILDER */}
      {panelMode === 'room' && (
        <div className="flex-1 overflow-y-auto p-3 space-y-4">
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3 space-y-3">
            <label className="flex items-center justify-between text-xs font-bold text-sky-400 cursor-pointer">
              <span className="flex items-center gap-1.5">
                <Home className="w-4 h-4" />
                הצג קירות חדר / נישה (סביבת ייחוס)
              </span>
              <input
                type="checkbox"
                checked={room.enabled}
                onChange={(e) => updateRoom({ enabled: e.target.checked })}
                className="accent-sky-500 w-4 h-4"
              />
            </label>

            <p className="text-[11px] text-slate-400">
              הגדר קירות, פאנלים, חלונות ושקעי חשמל כדי לתכנן את הרהיט בהתאמה מדויקת
              לחדר (כולל הצמדה מגנטית לקירות).
            </p>

            <div className="grid grid-cols-3 gap-2 text-xs">
              <div>
                <label className="text-[10px] text-slate-400 block mb-1">
                  רוחב חדר (X):
                </label>
                <input
                  type="number"
                  step={100}
                  value={room.width}
                  onChange={(e) =>
                    updateRoom({ width: Math.max(800, Number(e.target.value)) })
                  }
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 font-mono text-xs"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-400 block mb-1">
                  עומק חדר (Z):
                </label>
                <input
                  type="number"
                  step={100}
                  value={room.depth}
                  onChange={(e) =>
                    updateRoom({ depth: Math.max(800, Number(e.target.value)) })
                  }
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 font-mono text-xs"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-400 block mb-1">
                  גובה תקרה (Y):
                </label>
                <input
                  type="number"
                  step={100}
                  value={room.height}
                  onChange={(e) =>
                    updateRoom({ height: Math.max(1500, Number(e.target.value)) })
                  }
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 font-mono text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs pt-1">
              <label className="flex items-center gap-2 bg-slate-900 p-2 rounded border border-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={room.showBackWall}
                  onChange={(e) =>
                    updateRoom({ showBackWall: e.target.checked })
                  }
                  className="accent-sky-500"
                />
                <span>קיר אחורי</span>
              </label>
              <label className="flex items-center gap-2 bg-slate-900 p-2 rounded border border-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={room.showLeftWall}
                  onChange={(e) =>
                    updateRoom({ showLeftWall: e.target.checked })
                  }
                  className="accent-sky-500"
                />
                <span>קיר שמאל</span>
              </label>
              <label className="flex items-center gap-2 bg-slate-900 p-2 rounded border border-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={room.showRightWall}
                  onChange={(e) =>
                    updateRoom({ showRightWall: e.target.checked })
                  }
                  className="accent-sky-500"
                />
                <span>קיר ימין (נישה)</span>
              </label>
              <label className="flex items-center gap-2 bg-slate-900 p-2 rounded border border-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={room.showBaseboard}
                  onChange={(e) =>
                    updateRoom({ showBaseboard: e.target.checked })
                  }
                  className="accent-sky-500"
                />
                <span>פאנל רצפה (8 ס"מ)</span>
              </label>
            </div>

            {/* Add Window / Door / Outlet */}
            <div className="pt-2 border-t border-slate-800 space-y-2">
              <div className="text-xs font-bold text-slate-200">
                אלמנטים על הקיר (חלונות, דלתות, שקעים):
              </div>
              <div className="grid grid-cols-3 gap-1.5 text-[11px]">
                <button
                  onClick={() =>
                    addRoomObstacle({
                      type: 'window',
                      name: 'חלון',
                      wall: 'back',
                      offsetX: 900,
                      offsetY: 950,
                      width: 1000,
                      height: 1000,
                      depth: 40,
                    })
                  }
                  className="bg-sky-900/50 hover:bg-sky-800/70 text-sky-200 border border-sky-500/40 py-1.5 rounded-lg cursor-pointer"
                >
                  + הוסף חלון
                </button>
                <button
                  onClick={() =>
                    addRoomObstacle({
                      type: 'door',
                      name: 'דלת כניסה',
                      wall: 'left',
                      offsetX: 400,
                      offsetY: 0,
                      width: 850,
                      height: 2050,
                      depth: 45,
                    })
                  }
                  className="bg-amber-900/40 hover:bg-amber-800/60 text-amber-200 border border-amber-500/40 py-1.5 rounded-lg cursor-pointer"
                >
                  + הוסף דלת
                </button>
                <button
                  onClick={() =>
                    addRoomObstacle({
                      type: 'outlet',
                      name: 'שקע חשמל',
                      wall: 'back',
                      offsetX: 500,
                      offsetY: 350,
                      width: 140,
                      height: 85,
                      depth: 18,
                    })
                  }
                  className="bg-yellow-900/40 hover:bg-yellow-800/60 text-yellow-200 border border-yellow-500/40 py-1.5 rounded-lg cursor-pointer"
                >
                  + שקע חשמל
                </button>
              </div>

              <div className="space-y-1.5 mt-2">
                {room.obstacles.map((obs) => (
                  <div
                    key={obs.id}
                    className="bg-slate-900 p-2 rounded-lg border border-slate-800 text-[11px] flex items-center justify-between"
                  >
                    <div>
                      <div className="font-bold text-slate-200">
                        {obs.name} ({obs.width}×{obs.height} מ"מ)
                      </div>
                      <div className="text-[10px] text-slate-400">
                        קיר:{' '}
                        {obs.wall === 'back'
                          ? 'אחורי'
                          : obs.wall === 'left'
                          ? 'שמאל'
                          : 'ימין'}{' '}
                        | היסט: X={obs.offsetX}, גובה={obs.offsetY}
                      </div>
                    </div>
                    <button
                      onClick={() => removeRoomObstacle(obs.id)}
                      className="text-red-400 hover:text-red-300 text-[10px] px-1.5 py-0.5 bg-red-950/50 rounded cursor-pointer"
                    >
                      הסר
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};
