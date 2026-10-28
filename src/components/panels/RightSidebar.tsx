import React, { useState } from 'react';
import { useProjectStore } from '../../store/useProjectStore';
import { STOCK_LIBRARY, getStockById } from '../../data/stockLibrary';
import { generateCutListGroups } from '../../utils/cutOptimizer';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  FolderPlus,
  FolderTree,
  Lock,
  Trash2,
  Unlock,
} from 'lucide-react';
import { IconScrapWood } from '../icons/WoodCraftIcons';

export const RightSidebar: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState<'stock' | 'layers'>('stock');
  const [stockFilter, setStockFilter] = useState<
    'lumber' | 'sheet' | 'hardware'
  >('lumber');
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  const parts = useProjectStore((s) => s.parts);
  const groups = useProjectStore((s) => s.groups);
  const selectedIds = useProjectStore((s) => s.selectedIds);
  const selectPart = useProjectStore((s) => s.selectPart);
  const selectGroup = useProjectStore((s) => s.selectGroup);
  const addPartFromStock = useProjectStore((s) => s.addPartFromStock);
  const updatePart = useProjectStore((s) => s.updatePart);
  const createGroupFromSelected = useProjectStore(
    (s) => s.createGroupFromSelected
  );
  const ungroup = useProjectStore((s) => s.ungroup);
  const renameGroup = useProjectStore((s) => s.renameGroup);
  const toggleGroupVisibility = useProjectStore((s) => s.toggleGroupVisibility);
  const toggleGroupLock = useProjectStore((s) => s.toggleGroupLock);
  const toggleGroupCollapse = useProjectStore((s) => s.toggleGroupCollapse);

  const { partIdToLabel } = generateCutListGroups(parts);
  const ungroupedParts = parts.filter((p) => !p.groupId);

  if (collapsed) {
    return (
      <div className="relative h-full z-20 flex items-center select-none">
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          className="h-14 w-6 bg-white hover:bg-slate-50 border border-r-0 border-slate-200 rounded-l-xl shadow-md flex items-center justify-center text-slate-600 hover:text-amber-600 cursor-pointer transition"
          title="פתח ספריית עצים ושכבות"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <aside className="relative w-64 bg-white border-l border-slate-200 flex flex-col h-full shrink-0 select-none z-20 shadow-xs">
      {/* Tinkercad-Style Side Collapse Tab */}
      <button
        type="button"
        onClick={() => setCollapsed(true)}
        className="absolute -left-5 top-1/2 -translate-y-1/2 h-12 w-5 bg-white hover:bg-slate-50 border border-r-0 border-slate-200 rounded-l-lg shadow-sm flex items-center justify-center text-slate-500 hover:text-slate-900 cursor-pointer transition"
        title="קפל פאנל צד"
      >
        <ChevronRight className="w-3.5 h-3.5" />
      </button>

      {/* Top Compact Switcher: Wood Shapes vs Layers */}
      <div className="grid grid-cols-2 p-1.5 gap-1 bg-slate-50 border-b border-slate-200">
        <button
          type="button"
          onClick={() => setActiveTab('stock')}
          className={`flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-bold transition cursor-pointer ${
            activeTab === 'stock'
              ? 'bg-white text-slate-900 shadow-2xs border border-slate-200/80'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <IconScrapWood size={15} />
          <span>פרופילי עץ</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('layers')}
          className={`flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-bold transition cursor-pointer ${
            activeTab === 'layers'
              ? 'bg-white text-slate-900 shadow-2xs border border-slate-200/80'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <FolderTree className="w-3.5 h-3.5" />
          <span>חלקים ({parts.length})</span>
        </button>
      </div>

      {/* TAB 1: SHAPE-BASED WOOD STOCK DRAWER (Like Tinkercad Basic Shapes!) */}
      {activeTab === 'stock' && (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="grid grid-cols-3 gap-1 p-1.5 border-b border-slate-100 bg-white">
            {(
              [
                { id: 'lumber', label: 'קורות' },
                { id: 'sheet', label: 'לוחות' },
                { id: 'hardware', label: 'פרזול' },
              ] as const
            ).map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setStockFilter(cat.id)}
                className={`py-1 rounded text-[11px] font-bold transition cursor-pointer ${
                  stockFilter === cat.id
                    ? 'bg-amber-500 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* 2-Column Shape Grid (Visual Wood Cross-Section + Dimensions) */}
          <div className="flex-1 overflow-y-auto p-2 grid grid-cols-2 gap-2 content-start">
            {STOCK_LIBRARY.filter((s) => s.category === stockFilter).map(
              (stock) => {
                // Visual proportional block preview
                const shapeW =
                  stock.category === 'sheet'
                    ? 48
                    : Math.max(18, Math.min(46, Math.round(stock.width * 0.32)));
                const shapeH =
                  stock.category === 'sheet'
                    ? 10
                    : Math.max(
                        12,
                        Math.min(36, Math.round(stock.thickness * 0.36))
                      );

                return (
                  <button
                    key={stock.id}
                    type="button"
                    onClick={() => addPartFromStock(stock.id)}
                    className="group bg-slate-50 hover:bg-amber-50/60 border border-slate-200 hover:border-amber-400 rounded-xl p-2 flex flex-col items-center justify-between gap-1.5 transition cursor-pointer text-center shadow-2xs"
                    title={`${stock.name} — לחץ להוספה למשטח`}
                  >
                    <div className="h-11 w-full flex items-center justify-center">
                      <div
                        style={{
                          width: `${shapeW}px`,
                          height: `${shapeH}px`,
                          backgroundColor: stock.color,
                        }}
                        className="rounded-xs border border-slate-700/40 shadow-xs group-hover:scale-105 transition"
                      />
                    </div>
                    <div className="w-full">
                      <div className="text-[11px] font-bold text-slate-800 truncate">
                        {stock.name.replace(/קורת |פלטת /g, '')}
                      </div>
                      <div className="text-[10px] font-mono text-slate-500">
                        {stock.thickness}×{stock.width} מ"מ
                      </div>
                    </div>
                  </button>
                );
              }
            )}
          </div>
        </div>
      )}

      {/* TAB 2: CLEAN COMPACT LAYERS & GROUPS TREE */}
      {activeTab === 'layers' && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {selectedIds.length > 0 && (
            <div className="p-2 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
              <span className="text-[11px] text-slate-600 font-medium">
                נבחרו: <strong>{selectedIds.length}</strong>
              </span>
              <button
                type="button"
                onClick={() => createGroupFromSelected()}
                className="bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 px-2 py-1 rounded-md text-[11px] font-bold flex items-center gap-1 cursor-pointer"
              >
                <FolderPlus className="w-3.5 h-3.5 text-amber-600" />
                <span>קבץ</span>
              </button>
            </div>
          )}

          <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
            {groups.map((grp) => {
              const grpParts = parts.filter((p) => p.groupId === grp.id);
              const allSelected =
                grpParts.length > 0 &&
                grpParts.every((p) => selectedIds.includes(p.id));

              return (
                <div
                  key={grp.id}
                  className={`rounded-lg border transition ${
                    allSelected
                      ? 'border-sky-500 bg-sky-50/40'
                      : 'border-slate-200 bg-slate-50/50'
                  }`}
                >
                  <div className="flex items-center justify-between px-2 py-1.5">
                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                      <button
                        type="button"
                        onClick={() => toggleGroupCollapse(grp.id)}
                        className="text-slate-400 hover:text-slate-700 cursor-pointer"
                      >
                        {grp.collapsed ? (
                          <ChevronLeft className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5" />
                        )}
                      </button>
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: grp.color }}
                      />
                      {editingGroupId === grp.id ? (
                        <input
                          type="text"
                          value={editingName}
                          autoFocus
                          onChange={(e) => setEditingName(e.target.value)}
                          onBlur={() => {
                            if (editingName.trim()) {
                              renameGroup(grp.id, editingName.trim());
                            }
                            setEditingGroupId(null);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              if (editingName.trim()) {
                                renameGroup(grp.id, editingName.trim());
                              }
                              setEditingGroupId(null);
                            }
                          }}
                          className="bg-white border border-amber-500 rounded px-1 py-0.5 text-xs text-slate-900 w-24"
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => selectGroup(grp.id)}
                          onDoubleClick={() => {
                            setEditingGroupId(grp.id);
                            setEditingName(grp.name);
                          }}
                          className="text-xs font-bold text-slate-800 truncate text-right cursor-pointer"
                        >
                          {grp.name} ({grpParts.length})
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => toggleGroupVisibility(grp.id)}
                        className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
                      >
                        {grp.visible ? (
                          <Eye className="w-3.5 h-3.5" />
                        ) : (
                          <EyeOff className="w-3.5 h-3.5 text-red-500" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => ungroup(grp.id)}
                        className="p-1 text-slate-400 hover:text-red-600 cursor-pointer"
                        title="פרק קבוצה"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {!grp.collapsed && (
                    <div className="px-1.5 pb-1.5 space-y-1 border-t border-slate-200/60 pt-1">
                      {grpParts.map((part) => {
                        const isSel = selectedIds.includes(part.id);
                        return (
                          <div
                            key={part.id}
                            onClick={(e) =>
                              selectPart(part.id, e.shiftKey || e.ctrlKey)
                            }
                            className={`flex items-center justify-between px-2 py-1 rounded text-xs cursor-pointer transition ${
                              isSel
                                ? 'bg-sky-500 text-white font-bold'
                                : 'hover:bg-white text-slate-700'
                            }`}
                          >
                            <span className="truncate">{part.name}</span>
                            <span className="font-mono text-[10px] opacity-80">
                              {Math.round(part.dimensions.length)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}

            {ungroupedParts.map((part) => {
              const isSel = selectedIds.includes(part.id);
              const stock = getStockById(part.stockId);
              return (
                <div
                  key={part.id}
                  onClick={(e) =>
                    selectPart(part.id, e.shiftKey || e.ctrlKey || e.metaKey)
                  }
                  className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg border text-xs cursor-pointer transition ${
                    isSel
                      ? 'bg-sky-50 border-sky-500 text-slate-900 font-bold'
                      : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-5 h-5 rounded text-[10px] font-mono font-bold flex items-center justify-center shrink-0 border border-slate-300"
                      style={{ backgroundColor: stock.color, color: '#0f172a' }}
                    >
                      {partIdToLabel[part.id] || '•'}
                    </span>
                    <div className="truncate">
                      <div className="truncate">{part.name}</div>
                      <div className="text-[10px] font-mono text-slate-400">
                        {part.dimensions.thickness}×{part.dimensions.width}×
                        {Math.round(part.dimensions.length)}
                      </div>
                    </div>
                  </div>

                  <div
                    className="flex items-center gap-0.5"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      onClick={() =>
                        updatePart(part.id, { visible: !part.visible })
                      }
                      className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
                    >
                      {part.visible ? (
                        <Eye className="w-3.5 h-3.5" />
                      ) : (
                        <EyeOff className="w-3.5 h-3.5 text-red-500" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        updatePart(part.id, { locked: !part.locked })
                      }
                      className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
                    >
                      {part.locked ? (
                        <Lock className="w-3.5 h-3.5 text-amber-600" />
                      ) : (
                        <Unlock className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>
              );
            })}

            {parts.length === 0 && (
              <div className="text-center py-8 text-xs text-slate-400">
                אין חלקים במשטח העבודה
              </div>
            )}
          </div>
        </div>
      )}
    </aside>
  );
};
