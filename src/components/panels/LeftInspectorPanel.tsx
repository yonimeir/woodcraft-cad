import React, { useMemo, useState } from 'react';
import { useProjectStore } from '../../store/useProjectStore';
import { STOCK_LIBRARY, getStockById } from '../../data/stockLibrary';
import {
  buildSelectedAlignUnits,
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
  IconDropToFloor,
  IconJigsawCut,
  IconMiterCut,
  IconPivotTarget,
  IconPocketHole,
} from '../icons/WoodCraftIcons';
import { JigsawCutType, MiterLengthMode } from '../../types/woodcraft';

export const LeftInspectorPanel: React.FC = () => {
  const [cardCollapsed, setCardCollapsed] = useState(false);

  const parts = useProjectStore((s) => s.parts);
  const groups = useProjectStore((s) => s.groups);
  const selectedIds = useProjectStore((s) => s.selectedIds);
  const alignKeyUnitId = useProjectStore((s) => s.alignKeyUnitId);
  const setAlignKeyUnitId = useProjectStore((s) => s.setAlignKeyUnitId);
  const partEditMode = useProjectStore((s) => s.partEditMode);
  const setPartEditMode = useProjectStore((s) => s.setPartEditMode);
  const activeToolPopover = useProjectStore((s) => s.activeToolPopover);
  const setActiveToolPopover = useProjectStore((s) => s.setActiveToolPopover);
  const updatePart = useProjectStore((s) => s.updatePart);
  const setPartPivot = useProjectStore((s) => s.setPartPivot);
  const rotatePartWithPivot = useProjectStore((s) => s.rotatePartWithPivot);
  const rotatePartByWorldAxis = useProjectStore((s) => s.rotatePartByWorldAxis);
  const alignSelectedParts = useProjectStore((s) => s.alignSelectedParts);
  const createParametricDado = useProjectStore((s) => s.createParametricDado);
  const createBisectingMiterJoint = useProjectStore(
    (s) => s.createBisectingMiterJoint
  );
  const applyFloorFlushMiter = useProjectStore((s) => s.applyFloorFlushMiter);
  const trimProtrudingTipAgainstPart = useProjectStore(
    (s) => s.trimProtrudingTipAgainstPart
  );
  const addJigsawCut = useProjectStore((s) => s.addJigsawCut);
  const updateJigsawCut = useProjectStore((s) => s.updateJigsawCut);
  const removeJigsawCut = useProjectStore((s) => s.removeJigsawCut);
  const removeDadoNotch = useProjectStore((s) => s.removeDadoNotch);
  const angleSnapDeg = useProjectStore((s) => s.angleSnapDeg);
  const setAngleSnapDeg = useProjectStore((s) => s.setAngleSnapDeg);
  const gridSnapStepMm = useProjectStore((s) => s.gridSnapStepMm);
  const setGridSnapStepMm = useProjectStore((s) => s.setGridSnapStepMm);
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

  const alignUnits = useMemo(
    () => buildSelectedAlignUnits(parts, groups, selectedIds),
    [parts, groups, selectedIds]
  );

  const activeSelectedGroup = useMemo(() => {
    if (!selectedPart?.groupId || selectedIds.length <= 1) return null;
    const grp = groups.find((g) => g.id === selectedPart.groupId);
    const allInSameGroup = selectedIds.every(
      (id) => parts.find((p) => p.id === id)?.groupId === selectedPart.groupId
    );
    return allInSameGroup ? grp || null : null;
  }, [selectedPart, selectedIds, groups, parts]);

  // If nothing is selected and no tool popover is open, render NOTHING so the 3D canvas is 100% clean!
  if (!selectedPart && activeToolPopover === 'none') {
    return null;
  }

  return (
    <div className="absolute top-3 end-16 z-25 flex flex-col gap-2 max-h-[calc(100%-24px)] overflow-y-auto select-none pointer-events-auto">
      {/* =====================================================================
          1. FOCUSED TOOL POPOVER (Opened from Row 2 Action Icon Toolbar)
         ===================================================================== */}
      {activeToolPopover !== 'none' && (
        <div className="w-72 surface-modal backdrop-blur-md rounded-xl p-3 text-xs text-slate-800 space-y-3">
          {/* Popover Header */}
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <span className="font-extrabold text-slate-900 flex items-center gap-1.5">
              {activeToolPopover === 'align' && (
                <>
                  <IconAlignCenter size={16} className="text-amber-600" />
                  <span>יישור ופיזור</span>
                </>
              )}
              {activeToolPopover === 'pivot' && (
                <>
                  <IconPivotTarget size={16} className="text-amber-600" />
                  <span>עוגן וסיבוב</span>
                </>
              )}
              {activeToolPopover === 'miter' && (
                <>
                  <IconMiterCut size={16} className="text-amber-600" />
                  <span>חיתוכי גרונג</span>
                </>
              )}
              {activeToolPopover === 'dado' && (
                <>
                  <IconDadoJoint size={16} className="text-amber-600" />
                  <span>מגרעות</span>
                </>
              )}
              {activeToolPopover === 'jigsaw' && (
                <>
                  <IconJigsawCut size={16} className="text-amber-600" />
                  <span>ג'יגסו וחיתוך צורני</span>
                </>
              )}
              {activeToolPopover === 'pocket' && (
                <>
                  <IconPocketHole size={16} className="text-amber-600" />
                  <span>חורי כיס (Kreg)</span>
                </>
              )}
              {activeToolPopover === 'spacer' && (
                <>
                  <IconDistributeEvenly size={16} className="text-amber-600" />
                  <span>שכפול במרווח</span>
                </>
              )}
              {activeToolPopover === 'room' && <span>קירות חדר</span>}
            </span>
            <button
              type="button"
              onClick={() => setActiveToolPopover('none')}
              className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* TOOL 1: ILLUSTRATOR-STYLE ALIGNMENT & DISTRIBUTION (WITH KEY OBJECT / "קורת אם" & GROUPS AS 1 UNIT) */}
          {activeToolPopover === 'align' && (
            <div className="space-y-2">
              {alignUnits.length >= 2 && (
                <div className="p-2 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-bold text-slate-700">קורת אם:</span>
                    {alignKeyUnitId && (
                      <button
                        type="button"
                        onClick={() => setAlignKeyUnitId(null)}
                        className="text-[10px] font-bold text-amber-600 hover:underline cursor-pointer"
                      >
                        לפי הבחירה
                      </button>
                    )}
                  </div>
                  <select
                    value={alignKeyUnitId || ''}
                    onChange={(e) =>
                      setAlignKeyUnitId(e.target.value ? e.target.value : null)
                    }
                    className="w-full bg-white border border-slate-200 focus:border-amber-500 rounded-lg px-2 py-1 text-[11px] font-bold text-slate-800 outline-none cursor-pointer"
                  >
                    <option value="">תיבת הבחירה ({alignUnits.length})</option>
                    {alignUnits.map((u) => (
                      <option key={u.unitId} value={u.unitId}>
                        קורת אם: {u.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {(
                [
                  {
                    axis: 'x',
                    label: 'ציר X (כחול)',
                    colorClass: 'text-blue-600 font-bold',
                  },
                  {
                    axis: 'z',
                    label: 'ציר Z (אדום)',
                    colorClass: 'text-red-600 font-bold',
                  },
                  {
                    axis: 'y',
                    label: 'ציר Y (שחור)',
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
                      className="h-8 bg-slate-50 hover:bg-amber-50 border border-slate-200 hover:border-amber-400 rounded-lg flex items-center justify-center text-slate-700 cursor-pointer"
                      title={
                        alignKeyUnitId
                          ? 'יישר לקצה התחלתי של קורת האם'
                          : 'יישר לקצה התחלתי'
                      }
                    >
                      <IconAlignStart size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => alignSelectedParts(axis, 'center')}
                      className="h-8 bg-slate-50 hover:bg-amber-50 border border-slate-200 hover:border-amber-400 rounded-lg flex items-center justify-center text-slate-700 cursor-pointer"
                      title={
                        alignKeyUnitId
                          ? 'יישר למרכז קורת האם'
                          : 'יישר למרכז'
                      }
                    >
                      <IconAlignCenter size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => alignSelectedParts(axis, 'max')}
                      className="h-8 bg-slate-50 hover:bg-amber-50 border border-slate-200 hover:border-amber-400 rounded-lg flex items-center justify-center text-slate-700 cursor-pointer"
                      title={
                        alignKeyUnitId
                          ? 'יישר לקצה סופי של קורת האם'
                          : 'יישר לקצה סופי'
                      }
                    >
                      <IconAlignEnd size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => alignSelectedParts(axis, 'distribute')}
                      className="h-8 bg-slate-50 hover:bg-amber-50 border border-slate-200 hover:border-amber-400 rounded-lg flex items-center justify-center text-slate-700 cursor-pointer"
                      title="פזר במרווחים שווים (ל-3 יחידות ומעלה)"
                    >
                      <IconDistributeEvenly size={16} />
                    </button>
                  </div>
                  {alignKeyUnitId && alignUnits.length >= 2 && (
                    <div className="grid grid-cols-2 gap-1 pt-0.5">
                      <button
                        type="button"
                        onClick={() => alignSelectedParts(axis, 'butt-min')}
                        className="py-1 bg-amber-50 hover:bg-amber-500 text-amber-900 hover:text-white border border-amber-200 rounded-md text-[10px] font-bold cursor-pointer transition"
                        title="הצמד לדופן ההתחלתית של קורת האם (Butt Joint)"
                      >
                        הצמד לדופן -
                      </button>
                      <button
                        type="button"
                        onClick={() => alignSelectedParts(axis, 'butt-max')}
                        className="py-1 bg-amber-50 hover:bg-amber-500 text-amber-900 hover:text-white border border-amber-200 rounded-md text-[10px] font-bold cursor-pointer transition"
                        title="הצמד לדופן הסופית של קורת האם (Butt Joint)"
                      >
                        הצמד לדופן +
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* TOOL 2: PHOTOSHOP / ILLUSTRATOR PIVOT REFERENCE GRID & ROTATION */}
          {activeToolPopover === 'pivot' && selectedPart && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-600">
                  נקודת עוגן:
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
                        className={`w-7 h-7 rounded-md border flex items-center justify-center cursor-pointer ${
                          isActive
                            ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-2xs'
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
                    className={`py-1 rounded text-[11px] font-bold border cursor-pointer ${
                      Math.abs(selectedPart.pivot.z - item.z) < 0.15
                        ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-2xs'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              {/* Precision Angle Step Selector & World-Axis Rotations */}
              <div className="pt-2 border-t border-slate-100 space-y-2">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[10px] font-bold text-slate-500">
                    צעד סיבוב:
                  </span>
                  <div className="flex items-center gap-0.5 bg-slate-100 p-0.5 rounded-lg">
                    {([0.5, 1, 5, 15, 45, 90] as const).map((stepVal) => (
                      <button
                        key={stepVal}
                        type="button"
                        onClick={() => setAngleSnapDeg(stepVal)}
                        className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold cursor-pointer transition ${
                          angleSnapDeg === stepVal
                            ? 'bg-amber-500 text-white'
                            : 'text-slate-600 hover:bg-white'
                        }`}
                      >
                        {stepVal}°
                      </button>
                    ))}
                  </div>
                </div>

                {(
                  [
                    {
                      idx: 0,
                      axis: 'x' as const,
                      shortcut: 'X',
                      label: 'ציר X (כחול)',
                      colorClass: 'text-blue-600 font-bold',
                    },
                    {
                      idx: 1,
                      axis: 'y' as const,
                      shortcut: 'Y',
                      label: 'ציר Y (שחור)',
                      colorClass: 'text-slate-900 font-bold',
                    },
                    {
                      idx: 2,
                      axis: 'z' as const,
                      shortcut: 'Z',
                      label: 'ציר Z (אדום)',
                      colorClass: 'text-red-600 font-bold',
                    },
                  ] as const
                ).map(({ idx, axis, shortcut, label, colorClass }) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between gap-1.5"
                  >
                    <span
                      className={`text-[11px] flex items-center gap-1 ${colorClass}`}
                    >
                      <span>{label}</span>
                      <kbd className="px-1 py-0.5 bg-slate-100 border border-slate-200 rounded text-[9px] font-mono text-slate-600">
                        {shortcut}
                      </kbd>
                    </span>
                    <div className="flex items-center gap-1 tabular-nums">
                      <button
                        type="button"
                        onClick={() =>
                          rotatePartByWorldAxis(
                            selectedPart.id,
                            axis,
                            -angleSnapDeg,
                            true
                          )
                        }
                        className="px-1.5 py-0.5 bg-slate-100 hover:bg-amber-500 hover:text-white rounded font-mono font-bold text-[10px] cursor-pointer transition"
                        title={`סובב -${angleSnapDeg}° סביב ${label}`}
                      >
                        -{angleSnapDeg}°
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          rotatePartByWorldAxis(
                            selectedPart.id,
                            axis,
                            angleSnapDeg,
                            true
                          )
                        }
                        className="px-1.5 py-0.5 bg-slate-100 hover:bg-amber-500 hover:text-white rounded font-mono font-bold text-[10px] cursor-pointer transition"
                        title={`סובב +${angleSnapDeg}° סביב ${label}`}
                      >
                        +{angleSnapDeg}°
                      </button>
                      <input
                        type="number"
                        step={0.5}
                        value={Math.round(selectedPart.rotation[idx] * 10) / 10}
                        onChange={(e) => {
                          const next: [number, number, number] = [
                            ...selectedPart.rotation,
                          ];
                          next[idx] = parseFloat(e.target.value) || 0;
                          rotatePartWithPivot(selectedPart.id, next, true);
                        }}
                        className="w-14 bg-slate-50 border border-slate-200 rounded px-1 py-0.5 text-center font-mono font-bold text-[11px]"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TOOL 3: MITER CUTS (גרונג — יישור רצפה, חיתוך קצוות חופשי/מגנטי, וגרונג חצי-חצי) */}
          {activeToolPopover === 'miter' && selectedPart && (
            <div className="space-y-2.5">
              {/* 1-Click Floor-Flush Miter Cut */}
              <button
                type="button"
                onClick={() => applyFloorFlushMiter(selectedPart.id)}
                className="w-full py-1.5 px-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-[11px] flex items-center justify-center gap-1.5 cursor-pointer transition active:scale-[0.98]"
                title="חיתוך גרונג ליישור מלא עם הרצפה (Y=0)"
              >
                <IconDropToFloor size={14} />
                <span>יישור גרונג לקו הרצפה (Y=0)</span>
              </button>

              {/* Automatic Bisecting Miter Joint & Trim Protruding Tips */}
              {partCollisions.length > 0 && (
                <div className="p-2 bg-amber-50 border border-amber-200 rounded-xl space-y-1.5">
                  {partCollisions.map((col) => {
                    const otherId =
                      col.partAId === selectedPart.id
                        ? col.partBId
                        : col.partAId;
                    const otherName =
                      col.partAId === selectedPart.id
                        ? col.partBName
                        : col.partAName;
                    return (
                      <div key={col.id} className="space-y-1">
                        <button
                          type="button"
                          onClick={() =>
                            createBisectingMiterJoint(selectedPart.id, otherId)
                          }
                          className="w-full py-1.5 px-2 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-lg text-[11px] flex items-center justify-center gap-1.5 cursor-pointer transition active:scale-[0.98]"
                        >
                          <IconMiterCut size={14} />
                          <span>גרונג חצי-חצי ({otherName})</span>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            trimProtrudingTipAgainstPart(
                              selectedPart.id,
                              otherId
                            )
                          }
                          className="w-full py-1 px-2 bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 font-bold rounded-lg text-[10px] flex items-center justify-center gap-1 cursor-pointer transition"
                        >
                          <span>מגנט חיתוך קצה לגבול "{otherName}"</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Free / Magnetic Trim-Plane Editor directly inside Miter tool if active */}
              {(selectedPart.jigsawCuts || [])
                .filter((c) => c.type === 'trim-plane')
                .map((tCut) => (
                  <div
                    key={tCut.id}
                    className="p-2 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 text-[10px]"
                  >
                    <div className="flex items-center justify-between font-bold text-slate-800">
                      <span className="truncate">{tCut.label}</span>
                      <button
                        type="button"
                        onClick={() => removeJigsawCut(selectedPart.id, tCut.id)}
                        className="text-red-500 hover:text-red-700 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="flex items-center gap-1">
                      <select
                        value={tCut.referencePartId || ''}
                        onChange={(e) =>
                          updateJigsawCut(selectedPart.id, tCut.id, {
                            referencePartId: e.target.value || undefined,
                            offsetMm: e.target.value ? 0 : tCut.offsetMm,
                            angleDeg: e.target.value ? 0 : tCut.angleDeg,
                          })
                        }
                        className="flex-1 bg-white border border-slate-200 rounded px-1.5 py-0.5 font-bold"
                      >
                        <option value="">חיתוך חופשי (ללא הצמדה)</option>
                        {parts
                          .filter(
                            (p) =>
                              p.id !== selectedPart.id &&
                              p.visible &&
                              p.detachedFragmentIndex === undefined
                          )
                          .map((p) => (
                            <option key={p.id} value={p.id}>
                              מגנט לגבול: {p.name}
                            </option>
                          ))}
                      </select>
                      {tCut.referencePartId && (
                        <button
                          type="button"
                          onClick={() =>
                            updateJigsawCut(selectedPart.id, tCut.id, {
                              offsetMm: 0,
                              angleDeg: 0,
                            })
                          }
                          className="px-1.5 py-0.5 bg-amber-500 text-white rounded font-bold cursor-pointer"
                          title="אפס היסט וזווית בדיוק לגבול הקורה"
                        >
                          0
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-1.5 tabular-nums">
                      <div>
                        <span className="text-slate-500 block">היסט (מ"מ):</span>
                        <input
                          type="number"
                          step={1}
                          value={tCut.offsetMm || 0}
                          onChange={(e) =>
                            updateJigsawCut(selectedPart.id, tCut.id, {
                              offsetMm: Number(e.target.value) || 0,
                            })
                          }
                          className="w-full bg-white border border-slate-200 rounded px-1.5 py-0.5 font-mono font-bold"
                        />
                      </div>
                      <div>
                        <span className="text-slate-500 block">זווית (°):</span>
                        <input
                          type="number"
                          step={0.5}
                          value={tCut.angleDeg || 0}
                          onChange={(e) =>
                            updateJigsawCut(selectedPart.id, tCut.id, {
                              angleDeg: Number(e.target.value) || 0,
                            })
                          }
                          className="w-full bg-white border border-slate-200 rounded px-1.5 py-0.5 font-mono font-bold"
                        />
                      </div>
                    </div>
                  </div>
                ))}

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
                  { key: 'miterStart', title: 'קצה שמאל / תחתון (Start)' },
                  { key: 'miterEnd', title: 'קצה ימין / עליון (End)' },
                ] as const
              ).map(({ key, title }) => {
                const cfg = selectedPart[key];
                const setAngle = (val: number) => {
                  const clamped = Math.max(
                    -75,
                    Math.min(75, Math.round(val * 10) / 10)
                  );
                  updatePart(selectedPart.id, {
                    [key]: { ...cfg, angle: clamped },
                  });
                };
                return (
                  <div
                    key={key}
                    className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2"
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
                      <div className="space-y-2 pt-1 border-t border-slate-200/70">
                        {/* Cut Plane Axis Selector (Width Z vs Thickness Y) */}
                        <div className="grid grid-cols-2 gap-1 bg-slate-200/70 p-0.5 rounded-lg">
                          <button
                            type="button"
                            onClick={() =>
                              updatePart(selectedPart.id, {
                                [key]: { ...cfg, axis: 'z' },
                              })
                            }
                            className={`py-0.5 rounded text-[10px] font-bold cursor-pointer ${
                              cfg.axis === 'z'
                                ? 'bg-white text-slate-900 shadow-2xs'
                                : 'text-slate-600'
                            }`}
                          >
                            על הרוחב (Z)
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              updatePart(selectedPart.id, {
                                [key]: { ...cfg, axis: 'y' },
                              })
                            }
                            className={`py-0.5 rounded text-[10px] font-bold cursor-pointer ${
                              cfg.axis === 'y'
                                ? 'bg-white text-slate-900 shadow-2xs'
                                : 'text-slate-600'
                            }`}
                          >
                            על העובי (Y)
                          </button>
                        </div>

                        {/* Continuous Slider + Exact 0.1° Numeric Input + Fine ±1° Buttons */}
                        <div className="flex items-center gap-1.5 tabular-nums">
                          <button
                            type="button"
                            onClick={() => setAngle(cfg.angle - 1)}
                            className="px-1.5 py-1 bg-white border border-slate-200 hover:bg-slate-100 rounded font-mono font-bold text-[10px] cursor-pointer"
                            title="הפחת מעלה אחת (-1°)"
                          >
                            -1°
                          </button>
                          <input
                            type="range"
                            min={-75}
                            max={75}
                            step={0.5}
                            value={cfg.angle}
                            onChange={(e) =>
                              setAngle(parseFloat(e.target.value) || 0)
                            }
                            className="flex-1 accent-amber-500 cursor-pointer"
                          />
                          <button
                            type="button"
                            onClick={() => setAngle(cfg.angle + 1)}
                            className="px-1.5 py-1 bg-white border border-slate-200 hover:bg-slate-100 rounded font-mono font-bold text-[10px] cursor-pointer"
                            title="הוסף מעלה אחת (+1°)"
                          >
                            +1°
                          </button>
                          <input
                            type="number"
                            min={-75}
                            max={75}
                            step={0.1}
                            value={cfg.angle}
                            onChange={(e) =>
                              setAngle(parseFloat(e.target.value) || 0)
                            }
                            className="w-14 bg-white border border-slate-300 focus:border-amber-500 rounded px-1 py-0.5 text-center font-mono font-bold text-[11px] outline-none"
                          />
                        </div>

                        {/* Quick Presets */}
                        <div className="grid grid-cols-6 gap-1">
                          {([-45, -30, -15, 15, 30, 45] as const).map((ang) => (
                            <button
                              key={ang}
                              type="button"
                              onClick={() => setAngle(ang)}
                              className={`py-0.5 rounded font-mono text-[10px] font-bold border cursor-pointer ${
                                Math.abs(cfg.angle - ang) < 0.05
                                  ? 'bg-amber-500 text-white border-amber-600'
                                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                              }`}
                            >
                              {ang}°
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* TOOL 4: DADO, HALF-LAP & BISECTING MITER AT BEAM INTERSECTIONS (מגרעות ומפגשים) */}
          {activeToolPopover === 'dado' && selectedPart && (
            <div className="space-y-2.5">
              {partCollisions.length === 0 ? (
                <div className="text-slate-500 text-center py-2.5 bg-slate-50 rounded-lg border border-slate-200">
                  הצב שתי קורות נפגשות ליצירת מגרעת או גרונג חצי-חצי
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
                      className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5"
                    >
                      <div className="font-bold text-slate-800 truncate">
                        מפגש עם: {otherName}
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          createBisectingMiterJoint(selectedPart.id, otherId)
                        }
                        className="w-full bg-sky-600 hover:bg-sky-700 text-white font-bold py-1.5 rounded-lg flex items-center justify-center gap-1.5 cursor-pointer transition"
                      >
                        <IconMiterCut size={14} />
                        <span>גרונג חצי-חצי במפגש (חוצה זווית)</span>
                      </button>
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
                          className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold py-1 rounded-lg cursor-pointer"
                        >
                          מגרעת חצי-חצי
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
                          className="bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 font-bold py-1 rounded-lg cursor-pointer"
                        >
                          מגרעת מלאה (Dado)
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          trimProtrudingTipAgainstPart(selectedPart.id, otherId)
                        }
                        className="w-full py-1 px-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 font-bold rounded-lg text-[10px] cursor-pointer transition"
                      >
                        חתוך קצה מבצבץ מעבר ל-"{otherName}"
                      </button>
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

          {/* TOOL 4.5: JIGSAW & CUSTOM PROFILE / FREE-LINE CUTS (ג'יגסו וחיתוך קצוות) */}
          {activeToolPopover === 'jigsaw' && selectedPart && (
            <div className="space-y-2.5">
              <div className="grid grid-cols-2 gap-1.5">
                {(
                  [
                    {
                      type: 'trim-plane' as JigsawCutType,
                      label: 'חיתוך קצה מבצבץ',
                      defaults: {
                        edge: 'top' as const,
                        referencePartId:
                          partCollisions.length > 0
                            ? partCollisions[0].partAId === selectedPart.id
                              ? partCollisions[0].partBId
                              : partCollisions[0].partAId
                            : undefined,
                        depthMm: 60,
                        offsetMm: 0,
                        angleDeg: 0,
                      },
                    },
                    {
                      type: 'taper' as JigsawCutType,
                      label: 'קו חיתוך אלכסוני',
                      defaults: {
                        edge: 'bottom' as const,
                        angleDeg: 15,
                        depthMm: Math.round(
                          Math.max(
                            selectedPart.dimensions.width,
                            selectedPart.dimensions.thickness
                          ) * 0.35
                        ),
                      },
                    },
                    {
                      type: 'arch' as JigsawCutType,
                      label: 'קשת (Arch)',
                      defaults: {
                        edge: 'bottom' as const,
                        lengthMm: Math.round(
                          selectedPart.dimensions.length * 0.65
                        ),
                        depthMm: Math.round(
                          Math.max(
                            selectedPart.dimensions.width,
                            selectedPart.dimensions.thickness
                          ) * 0.45
                        ),
                        offsetMm: 0,
                      },
                    },
                    {
                      type: 'chamfer' as JigsawCutType,
                      label: 'קטימת פינות',
                      defaults: {
                        edge: 'all-corners' as const,
                        radiusMm: 30,
                      },
                    },
                    {
                      type: 'l-notch' as JigsawCutType,
                      label: 'מדרגה (L-Notch)',
                      defaults: {
                        edge: 'end' as const,
                        lengthMm: 80,
                        depthMm: Math.round(
                          Math.max(
                            selectedPart.dimensions.width,
                            selectedPart.dimensions.thickness
                          ) * 0.5
                        ),
                      },
                    },
                  ] as const
                ).map((preset) => (
                  <button
                    key={preset.type}
                    type="button"
                    onClick={() =>
                      addJigsawCut(selectedPart.id, {
                        type: preset.type,
                        label: preset.label,
                        ...preset.defaults,
                      })
                    }
                    className="py-1.5 px-2 bg-slate-50 hover:bg-amber-50 border border-slate-200 hover:border-amber-400 rounded-lg font-bold text-[11px] text-slate-900 text-start transition cursor-pointer active:scale-[0.98]"
                  >
                    + {preset.label}
                  </button>
                ))}
              </div>

              {/* Active Jigsaw Cuts Editor */}
              {(selectedPart.jigsawCuts || []).length > 0 && (
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  {(selectedPart.jigsawCuts || []).map((jCut) => (
                    <div
                      key={jCut.id}
                      className="p-2 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-[11px] text-slate-800 truncate">
                          {jCut.label}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeJigsawCut(selectedPart.id, jCut.id)}
                          className="text-red-500 hover:text-red-700 p-0.5 cursor-pointer"
                          title="מחק חיתוך"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {jCut.type === 'trim-plane' && (
                        <div className="space-y-1.5 text-[10px]">
                          <div className="flex items-center gap-1">
                            <select
                              value={jCut.referencePartId || ''}
                              onChange={(e) =>
                                updateJigsawCut(selectedPart.id, jCut.id, {
                                  referencePartId: e.target.value || undefined,
                                  offsetMm: e.target.value ? 0 : jCut.offsetMm,
                                  angleDeg: e.target.value ? 0 : jCut.angleDeg,
                                })
                              }
                              className="flex-1 bg-white border border-slate-200 rounded px-1.5 py-0.5 font-bold"
                            >
                              <option value="">חיתוך חופשי</option>
                              {parts
                                .filter(
                                  (p) =>
                                    p.id !== selectedPart.id &&
                                    p.visible &&
                                    p.detachedFragmentIndex === undefined
                                )
                                .map((p) => (
                                  <option key={p.id} value={p.id}>
                                    מגנט לגבול: {p.name}
                                  </option>
                                ))}
                            </select>
                            {jCut.referencePartId && (
                              <button
                                type="button"
                                onClick={() =>
                                  updateJigsawCut(selectedPart.id, jCut.id, {
                                    offsetMm: 0,
                                    angleDeg: 0,
                                  })
                                }
                                className="px-1.5 py-0.5 bg-amber-500 text-white rounded font-bold cursor-pointer"
                                title="מגנט ישר לגבול הקורה"
                              >
                                מגנט
                              </button>
                            )}
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-1.5 text-[10px] tabular-nums">
                        {jCut.offsetMm !== undefined && (
                          <div>
                            <span className="text-slate-500 block">
                              היסט (מ"מ):
                            </span>
                            <input
                              type="number"
                              step={1}
                              value={jCut.offsetMm}
                              onChange={(e) =>
                                updateJigsawCut(selectedPart.id, jCut.id, {
                                  offsetMm: Number(e.target.value) || 0,
                                })
                              }
                              className="w-full bg-white border border-slate-200 rounded px-1.5 py-0.5 font-mono font-bold"
                            />
                          </div>
                        )}
                        {jCut.angleDeg !== undefined && (
                          <div>
                            <span className="text-slate-500 block">
                              זווית (°):
                            </span>
                            <input
                              type="number"
                              step={0.5}
                              min={-70}
                              max={70}
                              value={jCut.angleDeg}
                              onChange={(e) =>
                                updateJigsawCut(selectedPart.id, jCut.id, {
                                  angleDeg: Number(e.target.value) || 0,
                                })
                              }
                              className="w-full bg-white border border-slate-200 rounded px-1.5 py-0.5 font-mono font-bold"
                            />
                          </div>
                        )}
                        {jCut.depthMm !== undefined &&
                          (!jCut.referencePartId || jCut.type !== 'trim-plane') && (
                            <div>
                              <span className="text-slate-500 block">
                                עומק (מ"מ):
                              </span>
                              <input
                                type="number"
                                step={2}
                                min={5}
                                max={600}
                                value={jCut.depthMm}
                                onChange={(e) =>
                                  updateJigsawCut(selectedPart.id, jCut.id, {
                                    depthMm: Math.max(
                                      5,
                                      Number(e.target.value) || 10
                                    ),
                                  })
                                }
                                className="w-full bg-white border border-slate-200 rounded px-1.5 py-0.5 font-mono font-bold"
                              />
                            </div>
                          )}
                        {jCut.lengthMm !== undefined && (
                          <div>
                            <span className="text-slate-500 block">
                              מפתח (מ"מ):
                            </span>
                            <input
                              type="number"
                              step={10}
                              min={20}
                              max={selectedPart.dimensions.length}
                              value={jCut.lengthMm}
                              onChange={(e) =>
                                updateJigsawCut(selectedPart.id, jCut.id, {
                                  lengthMm: Math.max(
                                    20,
                                    Number(e.target.value) || 40
                                  ),
                                })
                              }
                              className="w-full bg-white border border-slate-200 rounded px-1.5 py-0.5 font-mono font-bold"
                            />
                          </div>
                        )}
                        {jCut.radiusMm !== undefined && (
                          <div>
                            <span className="text-slate-500 block">
                              קטימה (מ"מ):
                            </span>
                            <input
                              type="number"
                              step={5}
                              min={10}
                              max={200}
                              value={jCut.radiusMm}
                              onChange={(e) =>
                                updateJigsawCut(selectedPart.id, jCut.id, {
                                  radiusMm: Math.max(
                                    10,
                                    Number(e.target.value) || 20
                                  ),
                                })
                              }
                              className="w-full bg-white border border-slate-200 rounded px-1.5 py-0.5 font-mono font-bold"
                            />
                          </div>
                        )}
                        {(jCut.type === 'arch' ||
                          jCut.type === 'taper' ||
                          jCut.type === 'l-notch' ||
                          jCut.type === 'trim-plane') && (
                          <div>
                            <span className="text-slate-500 block">דופן:</span>
                            <select
                              value={jCut.edge || 'top'}
                              onChange={(e) =>
                                updateJigsawCut(selectedPart.id, jCut.id, {
                                  edge: e.target.value as NonNullable<
                                    typeof jCut.edge
                                  >,
                                })
                              }
                              className="w-full bg-white border border-slate-200 rounded px-1 py-0.5 font-bold"
                            >
                              <option value="top">עליונה / קדמית</option>
                              <option value="bottom">תחתונה / אחורית</option>
                              <option value="start">קצה התחלה</option>
                              <option value="end">קצה סיום</option>
                            </select>
                          </div>
                        )}
                      </div>
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
              {/* Group Unit Banner when an entire Group is selected */}
              {activeSelectedGroup && (
                <div className="px-2 py-1 bg-amber-50 border border-amber-200 rounded-lg text-[11px] font-bold text-amber-900 truncate">
                  קבוצה: {activeSelectedGroup.name} ({selectedIds.length})
                </div>
              )}

              {/* Severed Offcut Piece Action Banner */}
              {selectedPart.detachedFragmentIndex !== undefined && (
                <button
                  type="button"
                  onClick={() => useProjectStore.getState().deleteSelected()}
                  className="w-full py-1.5 px-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold text-[11px] flex items-center justify-center gap-1.5 cursor-pointer transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>מחק שארית מנותקת (Delete)</span>
                </button>
              )}

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

              {/* Precision World-Axis Angle Controls (X Blue, Y Black, Z Red) */}
              <div className="pt-1.5 border-t border-slate-100 space-y-1.5">
                <div className="flex items-center justify-between text-[10px] text-slate-400">
                  <span>סיבוב מדויק (0.5° / 1° / 90°)</span>
                  <div className="flex items-center gap-0.5">
                    {([1, 5, 15, 90] as const).map((st) => (
                      <button
                        key={st}
                        type="button"
                        onClick={() => setAngleSnapDeg(st)}
                        className={`px-1 py-0.2 rounded font-mono font-bold cursor-pointer ${
                          angleSnapDeg === st
                            ? 'bg-amber-500 text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {st}°
                      </button>
                    ))}
                  </div>
                </div>

                {(
                  [
                    {
                      idx: 0,
                      axis: 'x' as const,
                      label: 'X כחול',
                      badgeCls: 'text-blue-600 font-bold',
                      btnCls:
                        'bg-blue-50 hover:bg-blue-600 text-blue-700 hover:text-white border-blue-200',
                    },
                    {
                      idx: 1,
                      axis: 'y' as const,
                      label: 'Y שחור',
                      badgeCls: 'text-slate-900 font-bold',
                      btnCls:
                        'bg-slate-100 hover:bg-slate-900 text-slate-900 hover:text-white border-slate-300',
                    },
                    {
                      idx: 2,
                      axis: 'z' as const,
                      label: 'Z אדום',
                      badgeCls: 'text-red-600 font-bold',
                      btnCls:
                        'bg-red-50 hover:bg-red-600 text-red-700 hover:text-white border-red-200',
                    },
                  ] as const
                ).map(({ idx, axis, label, badgeCls, btnCls }) => (
                  <div
                    key={axis}
                    className="flex items-center justify-between gap-1 tabular-nums"
                  >
                    <span className={`text-[11px] w-12 ${badgeCls}`}>
                      {label}
                    </span>
                    <div className="flex items-center gap-1 flex-1 justify-end">
                      <button
                        type="button"
                        onClick={() =>
                          rotatePartByWorldAxis(
                            selectedPart.id,
                            axis,
                            -angleSnapDeg,
                            true
                          )
                        }
                        className={`px-1.5 py-0.5 border rounded font-mono font-bold text-[10px] cursor-pointer transition ${btnCls}`}
                        title={`סובב -${angleSnapDeg}° סביב ${label}`}
                      >
                        -{angleSnapDeg}°
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          rotatePartByWorldAxis(
                            selectedPart.id,
                            axis,
                            angleSnapDeg,
                            true
                          )
                        }
                        className={`px-1.5 py-0.5 border rounded font-mono font-bold text-[10px] cursor-pointer transition ${btnCls}`}
                        title={`סובב +${angleSnapDeg}° סביב ${label}`}
                      >
                        +{angleSnapDeg}°
                      </button>
                      <input
                        type="number"
                        step={0.5}
                        value={Math.round(selectedPart.rotation[idx] * 10) / 10}
                        onChange={(e) => {
                          const next: [number, number, number] = [
                            ...selectedPart.rotation,
                          ];
                          next[idx] = parseFloat(e.target.value) || 0;
                          rotatePartWithPivot(selectedPart.id, next, true);
                        }}
                        className="w-13 bg-slate-50 border border-slate-200 focus:border-sky-500 rounded px-1 py-0.5 font-mono font-bold text-center text-[11px] outline-none"
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Fine Movement Step Selector (for Arrow Keys & Drag) */}
              <div className="pt-1.5 border-t border-slate-100 flex items-center justify-between text-[10px]">
                <span className="text-slate-400">צעד הזזה בחיצים:</span>
                <div className="flex items-center gap-0.5 tabular-nums">
                  {([1, 5, 10, 50] as const).map((mm) => (
                    <button
                      key={mm}
                      type="button"
                      onClick={() => setGridSnapStepMm(mm)}
                      className={`px-1.5 py-0.5 rounded font-mono font-bold cursor-pointer ${
                        gridSnapStepMm === mm
                          ? 'bg-sky-600 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {mm}
                    </button>
                  ))}
                  <span className="text-slate-400 ms-0.5">מ"מ</span>
                </div>
              </div>

              {/* Instant Joint Actions & Floor-Flush Miter in Compact Card */}
              <div className="pt-1.5 border-t border-slate-100 space-y-1">
                {selectedPart.rotation.some((r) => Math.abs(r % 90) > 0.5) && (
                  <button
                    type="button"
                    onClick={() => applyFloorFlushMiter(selectedPart.id)}
                    className="w-full py-1 px-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md font-bold text-[10px] flex items-center justify-center gap-1 cursor-pointer transition"
                    title="חיתוך גרונג אוטומטי ליישור עם קו הרצפה (Y=0)"
                  >
                    <IconDropToFloor size={12} />
                    <span>יישור גרונג לקו הרצפה (Y=0)</span>
                  </button>
                )}

                {partCollisions.length > 0 && (
                  <>
                    <span className="text-[10px] font-bold text-amber-700 block">
                      חיבור במפגש קורות ({partCollisions.length}):
                    </span>
                    {partCollisions.slice(0, 2).map((col) => {
                      const otherId =
                        col.partAId === selectedPart.id
                          ? col.partBId
                          : col.partAId;
                      const otherName =
                        col.partAId === selectedPart.id
                          ? col.partBName
                          : col.partAName;
                      return (
                        <div key={col.id} className="space-y-1">
                          <div className="text-[10px] text-slate-500 truncate">
                            מול: {otherName}
                          </div>
                          <div className="grid grid-cols-2 gap-1">
                            <button
                              type="button"
                              onClick={() =>
                                createBisectingMiterJoint(
                                  selectedPart.id,
                                  otherId
                                )
                              }
                              className="py-1 px-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-md font-bold text-[10px] flex items-center justify-center gap-1 cursor-pointer transition"
                              title="חיתוך גרונג חצי-חצי אוטומטי במפגש שתי הקורות"
                            >
                              <IconMiterCut size={12} />
                              <span>גרונג חצי-חצי</span>
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                createParametricDado(
                                  selectedPart.id,
                                  otherId,
                                  'half'
                                )
                              }
                              className="py-1 px-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-md font-bold text-[10px] flex items-center justify-center gap-1 cursor-pointer transition"
                              title="מגרעת חצי-חצי משולבת במפגש שתי הקורות"
                            >
                              <IconDadoJoint size={12} />
                              <span>מגרעת חצי-חצי</span>
                            </button>
                          </div>
                          <div className="grid grid-cols-2 gap-1">
                            <button
                              type="button"
                              onClick={() =>
                                createParametricDado(
                                  selectedPart.id,
                                  otherId,
                                  'full'
                                )
                              }
                              className="py-1 px-1 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 rounded-md font-bold text-[9px] cursor-pointer transition"
                            >
                              מגרעת מלאה (Dado)
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                trimProtrudingTipAgainstPart(
                                  selectedPart.id,
                                  otherId
                                )
                              }
                              className="py-1 px-1 bg-white hover:bg-amber-50 text-amber-900 border border-amber-300 rounded-md font-bold text-[9px] cursor-pointer transition"
                              title="חתוך חלקי קורה שמבצבצים מעבר לקורה החוצה"
                            >
                              חתוך קצה מבצבץ
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
