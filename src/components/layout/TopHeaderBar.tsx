import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { useProjectStore, ToolPopoverType } from '../../store/useProjectStore';
import { buildPartGeometry } from '../../utils/woodMeshBuilder';
import { getPartQuaternion } from '../../utils/geometryAndEngineering';
import { TemplatesModal } from '../modals/TemplatesModal';
import { ProductGeneratorModal } from '../modals/ProductGeneratorModal';
import {
  Box,
  ClipboardPaste,
  Copy,
  CopyPlus,
  Download,
  FileCode2,
  FileSpreadsheet,
  FolderPlus,
  FolderX,
  Home,
  Magnet,
  Redo2,
  Ruler,
  Scissors,
  Trash2,
  Undo2,
  Upload,
} from 'lucide-react';
import {
  IconAiBlueprint,
  IconAlignCenter,
  IconDadoJoint,
  IconDistributeEvenly,
  IconDropToFloor,
  IconMiterCut,
  IconPivotTarget,
  IconPocketHole,
  IconTemplatesGrid,
  IconWoodCraftLogo,
} from '../icons/WoodCraftIcons';

export const TopHeaderBar: React.FC = () => {
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [generatorOpen, setGeneratorOpen] = useState(false);
  const [ioMenuOpen, setIoMenuOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const projectName = useProjectStore((s) => s.projectName);
  const setProjectName = useProjectStore((s) => s.setProjectName);
  const parts = useProjectStore((s) => s.parts);
  const selectedIds = useProjectStore((s) => s.selectedIds);
  const activeView = useProjectStore((s) => s.activeView);
  const setActiveView = useProjectStore((s) => s.setActiveView);
  const activeToolPopover = useProjectStore((s) => s.activeToolPopover);
  const setActiveToolPopover = useProjectStore((s) => s.setActiveToolPopover);
  const unitMode = useProjectStore((s) => s.unitMode);
  const setUnitMode = useProjectStore((s) => s.setUnitMode);
  const showLiveDimensions = useProjectStore((s) => s.showLiveDimensions);
  const setShowLiveDimensions = useProjectStore((s) => s.setShowLiveDimensions);
  const snapEnabled = useProjectStore((s) => s.snapEnabled);
  const setSnapEnabled = useProjectStore((s) => s.setSnapEnabled);

  const past = useProjectStore((s) => s.past);
  const future = useProjectStore((s) => s.future);
  const clipboardParts = useProjectStore((s) => s.clipboardParts);
  const undo = useProjectStore((s) => s.undo);
  const redo = useProjectStore((s) => s.redo);
  const copySelected = useProjectStore((s) => s.copySelected);
  const pasteClipboard = useProjectStore((s) => s.pasteClipboard);
  const duplicateSelected = useProjectStore((s) => s.duplicateSelected);
  const deleteSelected = useProjectStore((s) => s.deleteSelected);
  const dropSelectedToFloor = useProjectStore((s) => s.dropSelectedToFloor);
  const createGroupFromSelected = useProjectStore(
    (s) => s.createGroupFromSelected
  );
  const ungroupSelected = useProjectStore((s) => s.ungroupSelected);
  const clearWorkspace = useProjectStore((s) => s.clearWorkspace);
  const exportProjectJson = useProjectStore((s) => s.exportProjectJson);
  const importProjectJson = useProjectStore((s) => s.importProjectJson);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail === 'templates') setTemplatesOpen(true);
      if (detail === 'generator') setGeneratorOpen(true);
    };
    window.addEventListener('woodcraft:open-modal', handler);
    return () => window.removeEventListener('woodcraft:open-modal', handler);
  }, []);

  const togglePopover = (tool: ToolPopoverType) => {
    setActiveToolPopover(activeToolPopover === tool ? 'none' : tool);
  };

  const handleSaveJson = () => {
    const json = exportProjectJson();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${projectName.replace(/\s+/g, '_')}.woodjson`;
    a.click();
    URL.revokeObjectURL(url);
    setIoMenuOpen(false);
  };

  // Export 3D Model as Wavefront .OBJ (compatible with SketchUp, Fusion 360, Blender, Bambu/Cura)
  const handleExportOBJ = () => {
    let objOut = `# WoodCraft 3D CAD Export - ${projectName}\n`;
    let vertexOffset = 1;

    for (const part of parts) {
      if (!part.visible) continue;
      const geom = buildPartGeometry(part, parts);
      const posAttr = geom.getAttribute('position');
      if (!posAttr) continue;

      const quat = getPartQuaternion(part.rotation);
      const offsetVec = new THREE.Vector3(...part.position);
      const v = new THREE.Vector3();

      objOut += `o ${part.name.replace(/\s+/g, '_')}\n`;
      for (let i = 0; i < posAttr.count; i++) {
        v.fromBufferAttribute(posAttr, i);
        v.applyQuaternion(quat).add(offsetVec);
        objOut += `v ${v.x.toFixed(2)} ${v.y.toFixed(2)} ${v.z.toFixed(2)}\n`;
      }

      const indexAttr = geom.getIndex();
      if (indexAttr) {
        for (let i = 0; i < indexAttr.count; i += 3) {
          const a = indexAttr.getX(i) + vertexOffset;
          const b = indexAttr.getX(i + 1) + vertexOffset;
          const c = indexAttr.getX(i + 2) + vertexOffset;
          objOut += `f ${a} ${b} ${c}\n`;
        }
      } else {
        for (let i = 0; i < posAttr.count; i += 3) {
          objOut += `f ${vertexOffset + i} ${vertexOffset + i + 1} ${
            vertexOffset + i + 2
          }\n`;
        }
      }
      vertexOffset += posAttr.count;
    }

    const blob = new Blob([objOut], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${projectName.replace(/\s+/g, '_')}.obj`;
    a.click();
    URL.revokeObjectURL(url);
    setIoMenuOpen(false);
  };

  const handleLoadJsonFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        importProjectJson(reader.result);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
    setIoMenuOpen(false);
  };

  const hasSelection = selectedIds.length > 0;
  const hasGroupedSelection = parts.some(
    (p) => selectedIds.includes(p.id) && Boolean(p.groupId)
  );

  const iconBtnClass = (active = false, disabled = false) =>
    `h-8 px-2 rounded-lg flex items-center justify-center gap-1.5 text-xs font-semibold transition border ${
      disabled
        ? 'opacity-35 pointer-events-none text-slate-400 border-transparent'
        : active
        ? 'bg-amber-500 text-white border-amber-600 shadow-sm cursor-pointer'
        : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200/90 hover:border-slate-300 cursor-pointer'
    }`;

  return (
    <>
      <div className="shrink-0 select-none bg-white border-b border-slate-200 shadow-2xs z-30">
        {/* ROW 1: Tinkercad-Style Clean Light Header (46px) */}
        <header className="h-11.5 px-3.5 flex items-center justify-between gap-3 border-b border-slate-100">
          {/* Right: WoodCraft Brand Icon + Project Name Pill */}
          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-2 bg-amber-500 text-white px-2.5 py-1 rounded-lg shadow-2xs">
              <IconWoodCraftLogo size={18} />
              <span className="text-xs font-extrabold tracking-tight">
                WoodCraft
              </span>
            </div>

            <input
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              className="bg-slate-100 hover:bg-slate-200/70 focus:bg-white border border-transparent focus:border-amber-500 rounded-full px-3 py-1 text-xs font-bold text-slate-800 w-44 focus:outline-none transition"
              title="שם הפרויקט"
            />
          </div>

          {/* Center-Left: Mode Switcher (3D vs Cut-List) & AI / Templates / Export */}
          <div className="flex items-center gap-2">
            {/* Primary View Switcher */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
              <button
                type="button"
                onClick={() => setActiveView('3d')}
                className={`px-3 py-1 rounded-md text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                  activeView === '3d'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Box className="w-3.5 h-3.5 text-amber-600" />
                <span>3D</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveView('workshop')}
                className={`px-3 py-1 rounded-md text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                  activeView === 'workshop'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Scissors className="w-3.5 h-3.5 text-amber-600" />
                <span>תוכנית חיתוך ו-BOM</span>
              </button>
            </div>

            <div className="h-5 w-px bg-slate-200 mx-0.5" />

            {/* AI Generator */}
            <button
              type="button"
              onClick={() => setGeneratorOpen(true)}
              className="h-8 bg-amber-500 hover:bg-amber-600 text-white px-3 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-2xs transition cursor-pointer"
              title="מחולל מוצרים חכם ויועץ פרויקטים משאריות עץ"
            >
              <IconAiBlueprint size={16} />
              <span>מחולל הנדסי</span>
            </button>

            {/* Validated Templates */}
            <button
              type="button"
              onClick={() => setTemplatesOpen(true)}
              className="h-8 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 px-2.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
              title="תבניות נגרות מוכנות"
            >
              <IconTemplatesGrid size={16} />
              <span>תבניות</span>
            </button>

            {/* Import / Export Menu (with clear file format explanations) */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIoMenuOpen((v) => !v)}
                className="h-8 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 px-2.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                title="שמירה, פתיחה וייצוא קבצים (.woodjson / .OBJ / .PDF)"
              >
                <Download className="w-3.5 h-3.5" />
                <span>קבצים וייצוא</span>
              </button>

              {ioMenuOpen && (
                <div className="absolute left-0 top-10 w-64 bg-white border border-slate-200 rounded-xl shadow-xl p-1.5 z-50 text-xs space-y-1">
                  <button
                    type="button"
                    onClick={handleSaveJson}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-slate-100 text-slate-700 text-right cursor-pointer"
                  >
                    <Download className="w-4 h-4 text-amber-600 shrink-0" />
                    <div>
                      <div className="font-bold text-slate-900">
                        שמור קובץ פרויקט (.woodjson)
                      </div>
                      <div className="text-[10px] text-slate-500">
                        גיבוי מלא של כל הקורות והקבוצות לעריכה עתידית
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-slate-100 text-slate-700 text-right cursor-pointer"
                  >
                    <Upload className="w-4 h-4 text-sky-600 shrink-0" />
                    <div>
                      <div className="font-bold text-slate-900">
                        פתח קובץ פרויקט (.woodjson)
                      </div>
                      <div className="text-[10px] text-slate-500">
                        טעינת פרויקט שמור מהמחשב
                      </div>
                    </div>
                  </button>

                  <div className="h-px bg-slate-100 my-1" />

                  <button
                    type="button"
                    onClick={handleExportOBJ}
                    disabled={parts.length === 0}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-slate-100 disabled:opacity-40 text-slate-700 text-right cursor-pointer"
                  >
                    <FileCode2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <div>
                      <div className="font-bold text-slate-900">
                        ייצא מודל תלת-ממדי (.OBJ)
                      </div>
                      <div className="text-[10px] text-slate-500">
                        קובץ 3D אוניברסלי ל-SketchUp, Fusion 360 או הדפסה
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setActiveView('workshop');
                      setIoMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-slate-100 text-slate-700 text-right cursor-pointer"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-amber-600 shrink-0" />
                    <div>
                      <div className="font-bold text-slate-900">
                        ייצא מפת חיתוך וכתב כמויות (.PDF)
                      </div>
                      <div className="text-[10px] text-slate-500">
                        תוכנית עבודה מפורטת לנגרייה ורשימת קניות
                      </div>
                    </div>
                  </button>
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept=".woodjson,.json"
                onChange={handleLoadJsonFile}
                className="hidden"
              />
            </div>
          </div>
        </header>

        {/* ROW 2: Tinkercad-Style Action & Woodworking Icon Toolbar (Only in 3D view) */}
        {activeView === '3d' && (
          <div className="h-10.5 px-3.5 bg-slate-50/90 flex items-center justify-between gap-2">
            {/* Right Group: Clipboard & History Icons (Tinkercad left group equivalent in RTL) */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={copySelected}
                disabled={!hasSelection}
                className={iconBtnClass(false, !hasSelection)}
                title="העתק (Ctrl+C)"
              >
                <Copy className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={pasteClipboard}
                disabled={clipboardParts.length === 0}
                className={iconBtnClass(false, clipboardParts.length === 0)}
                title="הדבק (Ctrl+V)"
              >
                <ClipboardPaste className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={duplicateSelected}
                disabled={!hasSelection}
                className={iconBtnClass(false, !hasSelection)}
                title="שכפל (Ctrl+D)"
              >
                <CopyPlus className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={deleteSelected}
                disabled={!hasSelection}
                className={iconBtnClass(false, !hasSelection)}
                title="מחק נבחרים (Delete)"
              >
                <Trash2 className="w-4 h-4 text-red-600" />
              </button>

              <div className="h-5 w-px bg-slate-200 mx-1" />

              <button
                type="button"
                onClick={undo}
                disabled={past.length === 0}
                className={iconBtnClass(false, past.length === 0)}
                title="בטל פעולה (Ctrl+Z)"
              >
                <Undo2 className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={redo}
                disabled={future.length === 0}
                className={iconBtnClass(false, future.length === 0)}
                title="בצע שוב (Ctrl+Y)"
              >
                <Redo2 className="w-4 h-4" />
              </button>

              {parts.length > 0 && (
                <>
                  <div className="h-5 w-px bg-slate-200 mx-1" />
                  <button
                    type="button"
                    onClick={clearWorkspace}
                    className="h-8 px-2 rounded-lg text-[11px] font-semibold text-slate-500 hover:text-red-600 hover:bg-red-50 transition cursor-pointer"
                    title="נקה את כל משטח העבודה"
                  >
                    נקה הכל
                  </button>
                </>
              )}
            </div>

            {/* Center & Left Group: WoodCraft Joinery Tools, Pivot, Illustrator Alignment & Workplane Aids */}
            <div className="flex items-center gap-1">
              {/* 1. Group & Ungroup */}
              <button
                type="button"
                onClick={() => createGroupFromSelected()}
                disabled={!hasSelection}
                className={iconBtnClass(false, !hasSelection)}
                title="קבץ חלקים נבחרים (Ctrl+G)"
              >
                <FolderPlus className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={ungroupSelected}
                disabled={!hasGroupedSelection}
                className={iconBtnClass(false, !hasGroupedSelection)}
                title="פרק קבוצה נבחרת"
              >
                <FolderX className="w-4 h-4" />
              </button>

              {/* 2. Illustrator-Style Align & Distribute Tool */}
              <button
                type="button"
                onClick={() => togglePopover('align')}
                disabled={!hasSelection}
                className={iconBtnClass(
                  activeToolPopover === 'align',
                  !hasSelection
                )}
                title="יישור ופיזור חלקים (בסגנון Adobe Illustrator)"
              >
                <IconAlignCenter size={16} />
                <span className="hidden md:inline">יישור</span>
              </button>

              {/* 3. Drop to Floor (D) */}
              <button
                type="button"
                onClick={dropSelectedToFloor}
                disabled={!hasSelection}
                className={iconBtnClass(false, !hasSelection)}
                title="הנח צמוד לרצפה Y=0 (מקש D)"
              >
                <IconDropToFloor size={16} />
              </button>

              <div className="h-5 w-px bg-slate-200 mx-1" />

              {/* 4. Photoshop / Illustrator Reference Point (Pivot Anchor) */}
              <button
                type="button"
                onClick={() => togglePopover('pivot')}
                disabled={!hasSelection}
                className={iconBtnClass(
                  activeToolPopover === 'pivot',
                  !hasSelection
                )}
                title="נקודת עוגן לסיבוב (ניתן גם לגרור את סמן העוגן ישירות על הקורה)"
              >
                <IconPivotTarget size={16} />
                <span className="hidden lg:inline">עוגן</span>
              </button>

              {/* 5. Miter Cuts (גרונג) */}
              <button
                type="button"
                onClick={() => togglePopover('miter')}
                disabled={!hasSelection}
                className={iconBtnClass(
                  activeToolPopover === 'miter',
                  !hasSelection
                )}
                title="חיתוכי גרונג וזוויות בקצוות הקורה"
              >
                <IconMiterCut size={16} />
                <span className="hidden lg:inline">גרונג</span>
              </button>

              {/* 6. Dado / Half-Lap Notches (מגרעות) */}
              <button
                type="button"
                onClick={() => togglePopover('dado')}
                disabled={!hasSelection}
                className={iconBtnClass(
                  activeToolPopover === 'dado',
                  !hasSelection
                )}
                title="מגרעות חצי-חצי (Half-Lap) וחיבורי Dado"
              >
                <IconDadoJoint size={16} />
                <span className="hidden lg:inline">מגרעות</span>
              </button>

              {/* 7. Pocket Holes (חורי כיס) */}
              <button
                type="button"
                onClick={() => togglePopover('pocket')}
                disabled={!hasSelection}
                className={iconBtnClass(
                  activeToolPopover === 'pocket',
                  !hasSelection
                )}
                title="קידוחי חורי כיס נסתרים (Kreg)"
              >
                <IconPocketHole size={16} />
                <span className="hidden lg:inline">חורי כיס</span>
              </button>

              {/* 8. Auto-Spacer (מרווחים שווים) */}
              <button
                type="button"
                onClick={() => togglePopover('spacer')}
                className={iconBtnClass(activeToolPopover === 'spacer', false)}
                title="שכפול ופיזור אוטומטי במרווחים שווים בין שתי קורות"
              >
                <IconDistributeEvenly size={16} />
                <span className="hidden xl:inline">מרווחים</span>
              </button>

              <div className="h-5 w-px bg-slate-200 mx-1" />

              {/* 9. Room Context, Ruler, Magnetic Snap, Units */}
              <button
                type="button"
                onClick={() => togglePopover('room')}
                className={iconBtnClass(activeToolPopover === 'room', false)}
                title="קירות חדר ומכשולים"
              >
                <Home className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => setShowLiveDimensions(!showLiveDimensions)}
                className={iconBtnClass(showLiveDimensions, false)}
                title="סרגל קווי מידה"
              >
                <Ruler className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => setSnapEnabled(!snapEnabled)}
                className={iconBtnClass(snapEnabled, false)}
                title={
                  snapEnabled ? 'הצמדה מגנטית פעילה' : 'הצמדה מגנטית כבויה'
                }
              >
                <Magnet className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => setUnitMode(unitMode === 'mm' ? 'cm' : 'mm')}
                className="h-8 px-2 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-[11px] font-mono font-bold text-slate-700 cursor-pointer"
                title="החלף בין מילימטרים לסנטימטרים"
              >
                {unitMode === 'mm' ? 'מ"מ' : 'ס"מ'}
              </button>
            </div>
          </div>
        )}
      </div>

      <TemplatesModal
        isOpen={templatesOpen}
        onClose={() => setTemplatesOpen(false)}
      />
      <ProductGeneratorModal
        isOpen={generatorOpen}
        onClose={() => setGeneratorOpen(false)}
      />
    </>
  );
};
