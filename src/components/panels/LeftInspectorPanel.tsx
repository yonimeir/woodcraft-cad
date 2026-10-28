import React, { useMemo, useState } from 'react';
import { useProjectStore } from '../../store/useProjectStore';
import { STOCK_LIBRARY, getStockById } from '../../data/stockLibrary';
import {
  calculateKregRecommendation,
  detectPartCollisions,
  getPartWorldBounds,
  resolvePartLengths,
} from '../../utils/geometryAndEngineering';
import {
  ChevronDown,
  ChevronUp,
  Lock,
  Plus,
  RotateCw,
  Trash2,
  Unlock,
  X,
} from 'lucide-react';
import {
  IconAlignCenter,
  IconAlignEnd,
  IconAlignStart,
  IconDadoJoint,
  IconDistributeEvenly,
  IconMiterCut,
  IconPivotTarget,
  IconPocketHole,
} from '../icons/WoodCraftIcons';
import { MiterLengthMode } from '../../types/woodcraft';

export const LeftInspectorPanel: React.FC = () => {
  const [cardCollapsed, setCardCollapsed] = useState(false);

  const parts = useProjectStore((s) => s.parts);
  const selectedIds = useProjectStore((s) => s.selectedIds);
  const partEditMode = useProjectStore((s) => s.partEditMode);
  const setPartEditMode = useProjectStore((s) => s.setPartEditMode);
  const activeToolPopover = useProjectStore((s) => s.activeToolPopover);
  const setActiveToolPopover = useProjectStore((s) => s.setActiveToolPopover);
  const updatePart = useProjectStore((s) => s.updatePart);
  const setPartPivot = useProjectStore((s) => s.setPartPivot);
  const rotatePartWithPivot = useProjectStore((s) => s.rotatePartWithPivot);
  const alignSelectedParts = useProjectStore((s) => s.alignSelectedParts);
  const createParametricDado = useProjectStore((s) => s.createParametricDado);
  const removeDadoNotch = useProjectStore((s) => s.removeDadoNotch);
  const distributeAutoSpacer = useProjectStore((s) => s.distributeAutoSpacer);
  const room = useProjectStore((s) => s.room);
  const updateRoom = useProjectStore((s) => s.updateRoom);
  const addRoomObstacle = useProjectStore((s) => s.addRoomObstacle);
  const removeRoomObstacle = useProjectStore((s) => s.removeRoomObstacle);

  // Auto-Spacer state
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

  // If nothing is selected and no tool popover is open, render NOTHING so the 3D canvas is 100% clean!
  if (!selectedPart && activeToolPopover === 'none') {
    return null;
  }

  return (
    <div className="absolute top-3 left-16 z-25 flex flex-col gap-2 max-h-[calc(100%-24px)] overflow-y-auto select-none pointer-events-auto">
      {/* =====================================================================
          1. FOCUSED TOOL POPOVER (Opened from Row 2 Action Icon Toolbar)
         ===================================================================== */}
      {activeToolPopover !== 'none' && (
        <div className="w-72 bg-white/95 backdrop-blur-md border border-slate-200 rounded-xl shadow-xl p-3 text-xs text-slate-800 space-y-3">
          {/* Popover Header */}
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <span className="font-extrabold text-slate-900 flex items-center gap-1.5">
              {activeToolPopover === 'align' && (
                <>
                  <IconAlignCenter size={16} className="text-amber-600" />
                  <span>יישור ופיזור (Align)</span>
                </>
              )}
              {activeToolPopover === 'pivot' && (
                <>
                  <IconPivotTarget size={16} className="text-amber-600" />
                  <span>נקודת עוגן וסיבוב</span>
                </>
              )}
              {activeToolPopover === 'miter' && (
                <>
                  <IconMiterCut size={16} className="text-amber-600" />
                  <span>חיתוכי גרונג (Miter)</span>
                </>
              )}
              {activeToolPopover === 'dado' && (
                <>
                  <IconDadoJoint size={16} className="text-amber-600" />
                  <span>מגרעות (Half-Lap / Dado)</span>
                </>
              )}
              {activeToolPopover === 'pocket' && (
                <>
                  <IconPocketHole size={16} className="text-amber-600" />
                  <span>חורי כיס נסתרים (Kreg)</span>
                </>
              )}
              {activeToolPopover === 'spacer' && (
                <>
                  <IconDistributeEvenly size={16} className="text-amber-600" />
                  <span>פיזור קורות במרווח שווה</span>
                </>
              )}
              {activeToolPopover === 'room' && <span>קירות חדר ומכשולים</span>}
            </span>
            <button
              type="button"
              onClick={() => setActiveToolPopover('none')}
              className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* TOOL 1: ILLUSTRATOR-STYLE ALIGNMENT & DISTRIBUTION */}
          {activeToolPopover === 'align' && (
            <div className="space-y-2.5">
              {(
                [
                  {
                    axis: 'x',
                    label: 'ציר X — כחול (שמאל / מרכז / ימין)',
                    colorClass: 'text-blue-600 font-bold',
                  },
                  {
                    axis: 'z',
                    label: 'ציר Z — אדום (אחור / מרכז / חזית)',
                    colorClass: 'text-red-600 font-bold',
                  },
                  {
                    axis: 'y',
                    label: 'ציר Y — שחור (תחתית / אמצע / עליון)',
                    colorClass: 'text-slate-900 font-bold',
                  },
                ] as const
              ).map(({ axis, label, colorClass }) => (
                <div key={axis} className="space-y-1">
                  <div className={`text-[11px] ${colorClass}`}>
                    {label}
                  </div>
                  <div className="grid grid-cols-4 gap-1.5">
                    <button
                      type="button"
                      onClick={() => alignSelectedParts(axis, 'min')}
                      className="h-8 bg-slate-50 hover:bg-amber-50 border border-slate-200 hover:border-amber-400 rounded-lg flex items-center justify-center text-slate-700 cursor-pointer transition"
                      title="יישר לקצה התחלתי"
                    >
                      <IconAlignStart size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => alignSelectedParts(axis, 'center')}
                      className="h-8 bg-slate-50 hover:bg-amber-50 border border-slate-200 hover:border-amber-400 rounded-lg flex items-center justify-center text-slate-700 cursor-pointer transition"
                      title="יישר למרכז"
                    >
                      <IconAlignCenter size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => alignSelectedParts(axis, 'max')}
                      className="h-8 bg-slate-50 hover:bg-amber-50 border border-slate-200 hover:border-amber-400 rounded-lg flex items-center justify-center text-slate-700 cursor-pointer transition"
                      title="יישר לקצה סופי"
                    >
                      <IconAlignEnd size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => alignSelectedParts(axis, 'distribute')}
                      className="h-8 bg-slate-50 hover:bg-amber-50 border border-slate-200 hover:border-amber-400 rounded-lg flex items-center justify-center text-slate-700 cursor-pointer transition"
                      title="פזר במרווחים שווים (ל-3 חלקים ומעלה)"
                    >
                      <IconDistributeEvenly size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* TOOL 2: PHOTOSHOP / ILLUSTRATOR PIVOT REFERENCE GRID & ROTATION */}
          {activeToolPopover === 'pivot' && selectedPart && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-500">
                  בחר נקודת עוגן (או גרור על הקורה):
                </span>
                <button
                  type="button"
                  onClick={() => setPartPivot(selectedPart.id, { x: 0, y: 0, z: 0 })}
                  className="text-[10px] font-bold text-amber-600 hover:underline cursor-pointer"
                >
                  מרכז (0,0,0)
                </button>
              </div>

              {/* Clean 3x3 Graphical Reference Point Matrix (Illustrator style) */}
              <div className="grid grid-cols-3 gap-1.5 w-28 mx-auto p-2 bg-slate-50 rounded-xl border border-slate-200">
                {([1, 0, -1] as const).map((yVal) =>
                  ([-1, 0, 1] as const).map((xVal) => {
                    const isActive =
                      Math.abs(selectedPart.pivot.x - xVal) < 0.15 &&
                      Math.abs(selectedPart.pivot.y - yVal) < 0.15;
                    return (
                      <button
                        key={`${xVal}_${yVal}`}
                        type="button"
                        onClick={() =>
                          setPartPivot(selectedPart.id, {
                            x: xVal,
                            y: yVal,
                            z: selectedPart.pivot.z,
                          })
                        }
                        className={`w-7 h-7 rounded-md border flex items-center justify-center transition cursor-pointer ${
                          isActive
                            ? 'bg-amber-500 text-white border-amber-600 shadow-xs'
                            : 'bg-white hover:bg-slate-100 border-slate-300 text-slate-400'
                        }`}
                      >
                        {isActive ? (
                          <IconPivotTarget size={14} />
                        ) : (
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                        )}
                      </button>
                    );
                  })
                )}
              </div>

              {/* Z-Depth Anchor Selector */}
              <div className="grid grid-cols-3 gap-1">
                {(
                  [
                    { z: -1, label: 'אחורי' },
                    { z: 0, label: 'מרכז' },
                    { z: 1, label: 'קדמי' },
                  ] as const
                ).map((item) => (
                  <button
                    key={item.z}
                    type="button"
                    onClick={() =>
                      setPartPivot(selectedPart.id, {
                        ...selectedPart.pivot,
                        z: item.z,
                      })
                    }
                    className={`py-1 rounded text-[11px] font-bold border transition cursor-pointer ${
                      Math.abs(selectedPart.pivot.z - item.z) < 0.15
                        ? 'bg-slate-800 text-white border-slate-900'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              {/* Quick 90° Axis Rotations & Exact Angles */}
              <div className="pt-2 border-t border-slate-100 space-y-2">
                {(
                  [
                    {
                      idx: 0,
                      label: 'ציר X (כחול - גלגול)',
                      colorClass: 'text-blue-600 font-bold',
                    },
                    {
                      idx: 1,
                      label: 'ציר Y (שחור - אופקי)',
                      colorClass: 'text-slate-900 font-bold',
                    },
                    {
                      idx: 2,
                      label: 'ציר Z (אדום - העמדה)',
                      colorClass: 'text-red-600 font-bold',
                    },
                  ] as const
                ).map(({ idx, label, colorClass }) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between gap-2"
                  >
                    <span className={`text-[11px] ${colorClass}`}>
                      {label}
                    </span>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        value={Math.round(selectedPart.rotation[idx])}
                        onChange={(e) => {
                          const next: [number, number, number] = [
                            ...selectedPart.rotation,
                          ];
                          next[idx] = Number(e.target.value) || 0;
                          rotatePartWithPivot(selectedPart.id, next, true);
                        }}
                        className="w-14 bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5 text-center font-mono font-bold"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const next: [number, number, number] = [
                            ...selectedPart.rotation,
                          ];
                          next[idx] = (Math.round(next[idx]) + 90) % 360;
                          rotatePartWithPivot(selectedPart.id, next, true);
                        }}
                        className="px-2 py-0.5 bg-slate-100 hover:bg-amber-500 hover:text-white rounded font-mono font-bold text-[11px] flex items-center gap-0.5 cursor-pointer transition"
                      >
                        <RotateCw className="w-3 h-3" />
                        +90°
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TOOL 3: MITER CUTS (גרונג) */}
          {activeToolPopover === 'miter' && selectedPart && (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-lg">
                {(
                  [
                    { id: 'outer', label: 'אורך חיצוני' },
                    { id: 'inner', label: 'אורך פנימי' },
                    { id: 'center', label: 'אורך מרכז' },
                  ] as Array<{ id: MiterLengthMode; label: string }>
                ).map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() =>
                      updatePart(selectedPart.id, { miterLengthMode: m.id })
                    }
                    className={`py-1 rounded text-[10px] font-bold cursor-pointer transition ${
                      selectedPart.miterLengthMode === m.id
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-500'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>

              {(
                [
                  { key: 'miterStart', title: 'קצה שמאל (Start)' },
                  { key: 'miterEnd', title: 'קצה ימין (End)' },
                ] as const
              ).map(({ key, title }) => {
                const cfg = selectedPart[key];
                return (
                  <div
                    key={key}
                    className="p-2 bg-slate-50 rounded-lg border border-slate-200 space-y-2"
                  >
                    <label className="flex items-center justify-between font-bold text-slate-800 cursor-pointer">
                      <span>{title}</span>
                      <input
                        type="checkbox"
                        checked={cfg.enabled}
                        onChange={(e) =>
                          updatePart(selectedPart.id, {
                            [key]: { ...cfg, enabled: e.target.checked },
                          })
                        }
                        className="accent-amber-500"
                      />
                    </label>
                    {cfg.enabled && (
                      <div className="flex items-center justify-between gap-1">
                        {([-45, -30, 30, 45] as const).map((ang) => (
                          <button
                            key={ang}
                            type="button"
                            onClick={() =>
                              updatePart(selectedPart.id, {
                                [key]: { ...cfg, angle: ang },
                              })
                            }
                            className={`flex-1 py-1 rounded font-mono text-[11px] font-bold border cursor-pointer ${
                              cfg.angle === ang
                                ? 'bg-amber-500 text-white border-amber-600'
                                : 'bg-white text-slate-700 border-slate-200'
                            }`}
                          >
                            {ang}°
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* TOOL 4: DADO & HALF-LAP NOTCHES (מגרעות) */}
          {activeToolPopover === 'dado' && selectedPart && (
            <div className="space-y-2.5">
              {partCollisions.length === 0 ? (
                <div className="text-slate-500 text-center py-3">
                  הצב קורה חוצה מול קורה זו כדי ליצור מגרעת חצי-חצי (Half-Lap) או
                  מגרעת מלאה (Dado).
                </div>
              ) : (
                partCollisions.map((col) => {
                  const otherId =
                    col.partAId === selectedPart.id ? col.partBId : col.partAId;
                  const otherName =
                    col.partAId === selectedPart.id
                      ? col.partBName
                      : col.partAName;
                  return (
                    <div
                      key={col.id}
                      className="p-2 bg-slate-50 rounded-lg border border-slate-200 space-y-1.5"
                    >
                      <div className="font-bold text-slate-800 truncate">
                        מפגש עם: {otherName}
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            createParametricDado(
                              selectedPart.id,
                              otherId,
                              'half'
                            )
                          }
                          className="bg-amber-500 hover:bg-amber-600 text-white font-bold py-1 rounded cursor-pointer"
                        >
                          חצי-חצי (Half-Lap)
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            createParametricDado(
                              selectedPart.id,
                              otherId,
                              'full'
                            )
                          }
                          className="bg-slate-800 hover:bg-slate-900 text-white font-bold py-1 rounded cursor-pointer"
                        >
                          מגרעת מלאה (Dado)
                        </button>
                      </div>
                    </div>
                  );
                })
              )}

              {selectedPart.dadoNotches.length > 0 && (
                <div className="space-y-1 pt-2 border-t border-slate-100">
                  <div className="font-bold text-slate-600">מגרעות פעילות:</div>
                  {selectedPart.dadoNotches.map((d) => (
                    <div
                      key={d.id}
                      className="flex items-center justify-between bg-slate-100 px-2 py-1 rounded"
                    >
                      <span className="truncate">{d.cutterPartName}</span>
                      <button
                        type="button"
                        onClick={() => removeDadoNotch(selectedPart.id, d.id)}
                        className="text-red-500 hover:text-red-700 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TOOL 5: POCKET HOLES (חורי כיס) */}
          {activeToolPopover === 'pocket' && selectedPart && (
            <div className="space-y-2.5">
              <label className="flex items-center justify-between font-bold text-slate-800 cursor-pointer">
                <span>הפעל חורי כיס (Kreg)</span>
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
                  className="accent-amber-500"
                />
              </label>
              {selectedPart.pocketHoles.enabled && kregRec && (
                <div className="bg-sky-50 border border-sky-200 rounded-lg p-2 text-[11px] text-sky-900 space-y-1">
                  <div>
                    הגדרת ג'יג ועומק: <strong>{kregRec.jigSettingMm} מ"מ</strong>
                  </div>
                  <div>
                    אורך בורג מומלץ: <strong>{kregRec.screwLengthMm} מ"מ</strong>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TOOL 6: AUTO-SPACER (פיזור אוטומטי במרווח שווה) */}
          {activeToolPopover === 'spacer' && (
            <div className="space-y-2">
              <select
                value={spacerPartA}
                onChange={(e) => setSpacerPartA(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5"
              >
                <option value="">בחר קורת גבול א'...</option>
                {parts.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <select
                value={spacerPartB}
                onChange={(e) => setSpacerPartB(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5"
              >
                <option value="">בחר קורת גבול ב'...</option>
                {parts.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <select
                value={spacerTemplate}
                onChange={(e) => setSpacerTemplate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5"
              >
                <option value="">בחר קורה לשכפול ביניהן...</option>
                {parts.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={25}
                  value={spacerCount}
                  onChange={(e) => setSpacerCount(Number(e.target.value))}
                  className="w-16 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-center font-mono font-bold"
                />
                <div className="grid grid-cols-3 gap-1 flex-1">
                  {(['x', 'z', 'y'] as const).map((ax) => (
                    <button
                      key={ax}
                      type="button"
                      onClick={() => setSpacerAxis(ax)}
                      className={`py-1 rounded font-mono font-bold uppercase cursor-pointer ${
                        spacerAxis === ax
                          ? 'bg-amber-500 text-white'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {ax}
                    </button>
                  ))}
                </div>
              </div>
              <button
                type="button"
                onClick={() =>
                  distributeAutoSpacer({
                    partAId: spacerPartA,
                    partBId: spacerPartB,
                    templatePartId: spacerTemplate,
                    count: spacerCount,
                    axis: spacerAxis,
                  })
                }
                disabled={!spacerPartA || !spacerPartB || !spacerTemplate}
                className="w-full bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-white font-bold py-1.5 rounded-lg cursor-pointer transition"
              >
                פזר במרווחים שווים
              </button>
            </div>
          )}

          {/* TOOL 7: ROOM ENVIRONMENT (קירות חדר) */}
          {activeToolPopover === 'room' && (
            <div className="space-y-2.5">
              <label className="flex items-center justify-between font-bold text-slate-800 cursor-pointer">
                <span>הצג קירות חדר ב-3D</span>
                <input
                  type="checkbox"
                  checked={room.enabled}
                  onChange={(e) => updateRoom({ enabled: e.target.checked })}
                  className="accent-amber-500"
                />
              </label>
              {room.enabled && (
                <>
                  <div className="grid grid-cols-3 gap-1.5">
                    <div>
                      <span className="text-[10px] text-slate-500">רוחב</span>
                      <input
                        type="number"
                        value={room.width}
                        onChange={(e) =>
                          updateRoom({ width: Number(e.target.value) || 2000 })
                        }
                        className="w-full bg-slate-50 border border-slate-200 rounded px-1.5 py-1 font-mono"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500">עומק</span>
                      <input
                        type="number"
                        value={room.depth}
                        onChange={(e) =>
                          updateRoom({ depth: Number(e.target.value) || 2000 })
                        }
                        className="w-full bg-slate-50 border border-slate-200 rounded px-1.5 py-1 font-mono"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500">גובה</span>
                      <input
                        type="number"
                        value={room.height}
                        onChange={(e) =>
                          updateRoom({ height: Number(e.target.value) || 2500 })
                        }
                        className="w-full bg-slate-50 border border-slate-200 rounded px-1.5 py-1 font-mono"
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      addRoomObstacle({
                        type: 'window',
                        name: 'חלון',
                        wall: 'back',
                        offsetX: 600,
                        offsetY: 900,
                        width: 800,
                        height: 1000,
                        depth: 60,
                      })
                    }
                    className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-1.5 rounded-lg flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>הוסף חלון / שקע לקיר</span>
                  </button>
                  {room.obstacles.map((obs) => (
                    <div
                      key={obs.id}
                      className="flex items-center justify-between bg-slate-50 px-2 py-1 rounded border border-slate-200"
                    >
                      <span>{obs.name}</span>
                      <button
                        type="button"
                        onClick={() => removeRoomObstacle(obs.id)}
                        className="text-red-500 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          2. TINKERCAD COMPACT FLOATING SHAPE CARD (Only when a part is selected)
         ===================================================================== */}
      {selectedPart && stock && resolvedLengths && (
        <div className="w-60 bg-white/95 backdrop-blur-md border border-slate-200 rounded-xl shadow-lg overflow-hidden text-xs text-slate-800">
          {/* Header Bar (Like Tinkercad's Shape Box Header: Color Dot + Name + Lock + Collapse) */}
          <div className="flex items-center justify-between px-2.5 py-2 bg-slate-50 border-b border-slate-200/80">
            <div className="flex items-center gap-1.5 min-w-0 flex-1">
              <input
                type="color"
                value={selectedPart.customColor || stock.color}
                onChange={(e) =>
                  updatePart(selectedPart.id, { customColor: e.target.value })
                }
                className="w-4 h-4 rounded-full border border-slate-300 cursor-pointer shrink-0 p-0 bg-transparent"
                title="צבע החלק"
              />
              <input
                type="text"
                value={selectedPart.name}
                onChange={(e) =>
                  updatePart(selectedPart.id, { name: e.target.value })
                }
                className="bg-transparent font-bold text-slate-900 truncate w-full focus:outline-none focus:bg-white focus:px-1 rounded"
              />
            </div>

            <div className="flex items-center gap-0.5 shrink-0">
              <button
                type="button"
                onClick={() =>
                  updatePart(selectedPart.id, { locked: !selectedPart.locked })
                }
                className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
                title={selectedPart.locked ? 'בטל נעילה' : 'נעל חלק'}
              >
                {selectedPart.locked ? (
                  <Lock className="w-3.5 h-3.5 text-amber-600" />
                ) : (
                  <Unlock className="w-3.5 h-3.5" />
                )}
              </button>
              <button
                type="button"
                onClick={() => setCardCollapsed((v) => !v)}
                className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
                title={cardCollapsed ? 'הרחב מאפיינים' : 'קפל כרטיס'}
              >
                {cardCollapsed ? (
                  <ChevronDown className="w-3.5 h-3.5" />
                ) : (
                  <ChevronUp className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          </div>

          {!cardCollapsed && (
            <div className="p-2.5 space-y-2.5">
              {/* Mode Indicator: Single-Click (Move) vs Double-Click (Dimensions) */}
              <div className="grid grid-cols-2 gap-1 bg-slate-100 p-0.5 rounded-lg">
                <button
                  type="button"
                  onClick={() => setPartEditMode('move')}
                  className={`py-1 rounded-md text-[11px] font-bold transition cursor-pointer ${
                    partEditMode === 'move'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  תנועה וסיבוב
                </button>
                <button
                  type="button"
                  onClick={() => setPartEditMode('dimensions')}
                  className={`py-1 rounded-md text-[11px] font-bold transition cursor-pointer ${
                    partEditMode === 'dimensions'
                      ? 'bg-white text-sky-700 shadow-2xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  עריכת מידות
                </button>
              </div>

              {/* Stock Profile Selector */}
              <select
                value={selectedPart.stockId}
                onChange={(e) => {
                  const nextStock = getStockById(e.target.value);
                  updatePart(selectedPart.id, {
                    stockId: nextStock.id,
                    dimensions: {
                      ...selectedPart.dimensions,
                      width:
                        nextStock.category === 'sheet'
                          ? selectedPart.dimensions.width
                          : nextStock.width,
                      thickness: nextStock.thickness,
                    },
                  });
                }}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-[11px] font-semibold text-slate-700"
              >
                {STOCK_LIBRARY.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.thickness}×{s.width})
                  </option>
                ))}
              </select>

              {/* Compact Numeric Dimensions Row */}
              <div className="grid grid-cols-3 gap-1.5">
                <div>
                  <span className="text-[10px] text-slate-400 block">
                    אורך
                  </span>
                  <input
                    type="number"
                    min={50}
                    max={4800}
                    value={Math.round(selectedPart.dimensions.length)}
                    onChange={(e) =>
                      updatePart(selectedPart.id, {
                        dimensions: {
                          ...selectedPart.dimensions,
                          length: Math.max(50, Number(e.target.value) || 50),
                        },
                      })
                    }
                    className="w-full bg-slate-50 border border-slate-200 focus:border-sky-500 rounded px-1.5 py-1 font-mono font-bold text-center outline-none"
                  />
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">
                    רוחב
                  </span>
                  <input
                    type="number"
                    disabled={stock.category !== 'sheet'}
                    value={Math.round(selectedPart.dimensions.width)}
                    onChange={(e) =>
                      updatePart(selectedPart.id, {
                        dimensions: {
                          ...selectedPart.dimensions,
                          width: Math.max(30, Number(e.target.value) || 30),
                        },
                      })
                    }
                    className="w-full bg-slate-50 disabled:opacity-55 border border-slate-200 rounded px-1.5 py-1 font-mono font-bold text-center outline-none"
                  />
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">
                    גובה (Y)
                  </span>
                  <input
                    type="number"
                    min={0}
                    value={floorHeightMm}
                    onChange={(e) => {
                      const targetFloor = Math.max(
                        0,
                        Number(e.target.value) || 0
                      );
                      const deltaY = targetFloor - floorHeightMm;
                      updatePart(selectedPart.id, {
                        position: [
                          selectedPart.position[0],
                          selectedPart.position[1] + deltaY,
                          selectedPart.position[2],
                        ],
                      });
                    }}
                    className="w-full bg-slate-50 border border-slate-200 focus:border-sky-500 rounded px-1.5 py-1 font-mono font-bold text-center outline-none"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
