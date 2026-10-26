import React, { useState } from 'react';
import { useProjectStore } from '../../store/useProjectStore';
import { STOCK_LIBRARY, getStockById } from '../../data/stockLibrary';
import { generateCutListGroups } from '../../utils/cutOptimizer';
import {
  Box,
  ChevronDown,
  ChevronLeft,
  Copy,
  Eye,
  EyeOff,
  FolderPlus,
  FolderTree,
  Layers,
  Lock,
  Plus,
  Trash2,
  Unlock,
  Wrench,
} from 'lucide-react';

export const RightSidebar: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'layers' | 'stock'>('layers');
  const [stockFilter, setStockFilter] = useState<'lumber' | 'sheet' | 'hardware'>(
    'lumber'
  );
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [newGroupName, setNewGroupName] = useState('');

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
  const assignPartToGroup = useProjectStore((s) => s.assignPartToGroup);
  const duplicateSelected = useProjectStore((s) => s.duplicateSelected);
  const deleteSelected = useProjectStore((s) => s.deleteSelected);

  const { partIdToLabel } = generateCutListGroups(parts);
  const ungroupedParts = parts.filter((p) => !p.groupId);

  return (
    <aside className="w-80 bg-slate-900 border-l border-slate-800 flex flex-col h-full shrink-0 select-none">
      {/* Top Tab Switcher */}
      <div className="grid grid-cols-2 p-2 gap-1.5 bg-slate-950/60 border-b border-slate-800">
        <button
          onClick={() => setActiveTab('layers')}
          className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
            activeTab === 'layers'
              ? 'bg-amber-500 text-slate-950 shadow'
              : 'bg-slate-800/70 text-slate-300 hover:bg-slate-800'
          }`}
        >
          <FolderTree className="w-4 h-4" />
          שכבות וקבוצות ({parts.length})
        </button>
        <button
          onClick={() => setActiveTab('stock')}
          className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
            activeTab === 'stock'
              ? 'bg-amber-500 text-slate-950 shadow'
              : 'bg-slate-800/70 text-slate-300 hover:bg-slate-800'
          }`}
        >
          <Plus className="w-4 h-4" />
          ספריית עץ ורכיבים
        </button>
      </div>

      {/* TAB 1: Photoshop-Style Layers & Groups Panel */}
      {activeTab === 'layers' && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Quick Group & Selection Actions */}
          <div className="p-2.5 border-b border-slate-800 bg-slate-900/50 space-y-2">
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder="שם קבוצה חדשה..."
                className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-amber-500"
              />
              <button
                onClick={() => {
                  createGroupFromSelected(newGroupName);
                  setNewGroupName('');
                }}
                disabled={selectedIds.length === 0}
                className="bg-amber-500/20 hover:bg-amber-500/30 disabled:opacity-40 text-amber-300 border border-amber-500/40 px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
                title="קבץ את החלקים המסומנים לקבוצה אחת"
              >
                <FolderPlus className="w-3.5 h-3.5" />
                קבץ ({selectedIds.length})
              </button>
            </div>

            <div className="flex items-center justify-between gap-1 text-[11px]">
              <span className="text-slate-400">
                נבחרו: <strong className="text-amber-400">{selectedIds.length}</strong>{' '}
                (Shift+Click לבחירה מרובה)
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={duplicateSelected}
                  disabled={selectedIds.length === 0}
                  className="p-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 rounded text-slate-200 cursor-pointer"
                  title="שכפל נבחרים (Ctrl+D)"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={deleteSelected}
                  disabled={selectedIds.length === 0}
                  className="p-1.5 bg-red-950/60 hover:bg-red-900/80 disabled:opacity-40 rounded text-red-300 cursor-pointer"
                  title="מחק נבחרים (Delete)"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Hierarchical Tree List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {groups.map((grp) => {
              const grpParts = parts.filter((p) => p.groupId === grp.id);
              const allSelected =
                grpParts.length > 0 &&
                grpParts.every((p) => selectedIds.includes(p.id));

              return (
                <div
                  key={grp.id}
                  className={`rounded-xl border transition ${
                    allSelected
                      ? 'border-amber-500/70 bg-amber-500/5'
                      : 'border-slate-800 bg-slate-950/40'
                  }`}
                >
                  {/* Group Header */}
                  <div className="flex items-center justify-between px-2 py-1.5 border-b border-slate-800/70">
                    <div className="flex items-center gap-1.5 flex-1 min-w-0">
                      <button
                        onClick={() => toggleGroupCollapse(grp.id)}
                        className="text-slate-400 hover:text-slate-200 cursor-pointer"
                      >
                        {grp.collapsed ? (
                          <ChevronLeft className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
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
                          className="bg-slate-900 border border-amber-500 rounded px-1.5 py-0.5 text-xs text-white w-full"
                        />
                      ) : (
                        <button
                          onClick={() => selectGroup(grp.id)}
                          onDoubleClick={() => {
                            setEditingGroupId(grp.id);
                            setEditingName(grp.name);
                          }}
                          className="text-xs font-bold text-slate-200 hover:text-amber-400 truncate text-right flex-1 cursor-pointer"
                          title="לחיצה לבחירת כל הקבוצה | לחיצה כפולה לשינוי שם"
                        >
                          {grp.name} ({grpParts.length})
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => toggleGroupVisibility(grp.id)}
                        className="p-1 text-slate-400 hover:text-slate-100 cursor-pointer"
                        title={grp.visible ? 'הסתר קבוצה' : 'הצג קבוצה'}
                      >
                        {grp.visible ? (
                          <Eye className="w-3.5 h-3.5" />
                        ) : (
                          <EyeOff className="w-3.5 h-3.5 text-slate-600" />
                        )}
                      </button>
                      <button
                        onClick={() => toggleGroupLock(grp.id)}
                        className="p-1 text-slate-400 hover:text-slate-100 cursor-pointer"
                        title={grp.locked ? 'בטל נעילת קבוצה' : 'נעל קבוצה'}
                      >
                        {grp.locked ? (
                          <Lock className="w-3.5 h-3.5 text-amber-400" />
                        ) : (
                          <Unlock className="w-3.5 h-3.5" />
                        )}
                      </button>
                      <button
                        onClick={() => ungroup(grp.id)}
                        className="text-[10px] text-slate-400 hover:text-red-400 px-1 cursor-pointer"
                        title="פרק קבוצה"
                      >
                        פרק
                      </button>
                    </div>
                  </div>

                  {/* Group Children */}
                  {!grp.collapsed && (
                    <div className="p-1.5 space-y-1">
                      {grpParts.map((part) => {
                        const isSel = selectedIds.includes(part.id);
                        const lbl = partIdToLabel[part.id] || '?';
                        return (
                          <div
                            key={part.id}
                            onClick={(e) =>
                              selectPart(part.id, e.shiftKey || e.ctrlKey)
                            }
                            className={`flex items-center justify-between px-2 py-1.5 rounded-lg text-xs cursor-pointer transition ${
                              isSel
                                ? 'bg-amber-500/20 border border-amber-500/60 text-amber-200'
                                : 'hover:bg-slate-800/70 text-slate-300 border border-transparent'
                            }`}
                          >
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="px-1.5 py-0.2 bg-slate-800 text-amber-400 font-mono font-bold text-[10px] rounded">
                                {lbl}
                              </span>
                              <span className="truncate font-medium">
                                {part.name}
                              </span>
                            </div>
                            <div
                              className="flex items-center gap-1 shrink-0"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                onClick={() =>
                                  updatePart(
                                    part.id,
                                    { visible: !part.visible },
                                    false
                                  )
                                }
                                className="p-0.5 text-slate-400 hover:text-white cursor-pointer"
                              >
                                {part.visible ? (
                                  <Eye className="w-3.5 h-3.5" />
                                ) : (
                                  <EyeOff className="w-3.5 h-3.5 text-slate-600" />
                                )}
                              </button>
                              <button
                                onClick={() =>
                                  updatePart(
                                    part.id,
                                    { locked: !part.locked },
                                    false
                                  )
                                }
                                className="p-0.5 text-slate-400 hover:text-white cursor-pointer"
                              >
                                {part.locked ? (
                                  <Lock className="w-3.5 h-3.5 text-amber-400" />
                                ) : (
                                  <Unlock className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Ungrouped Parts Section */}
            {ungroupedParts.length > 0 && (
              <div className="space-y-1">
                <div className="text-[11px] font-semibold text-slate-400 px-1 pt-1 flex items-center justify-between">
                  <span>חלקים ללא קבוצה ({ungroupedParts.length})</span>
                </div>
                {ungroupedParts.map((part) => {
                  const isSel = selectedIds.includes(part.id);
                  const lbl = partIdToLabel[part.id] || '?';
                  const stock = getStockById(part.stockId);
                  return (
                    <div
                      key={part.id}
                      onClick={(e) =>
                        selectPart(part.id, e.shiftKey || e.ctrlKey)
                      }
                      className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs cursor-pointer transition ${
                        isSel
                          ? 'bg-amber-500/20 border border-amber-500/60 text-amber-200'
                          : 'bg-slate-950/40 hover:bg-slate-800/70 text-slate-300 border border-slate-800/80'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="px-1.5 py-0.2 bg-slate-800 text-amber-400 font-mono font-bold text-[10px] rounded">
                          {lbl}
                        </span>
                        <div className="truncate">
                          <div className="font-medium truncate">{part.name}</div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            {part.dimensions.length}×{part.dimensions.width}×
                            {part.dimensions.thickness} מ"מ ({stock.species})
                          </div>
                        </div>
                      </div>

                      <div
                        className="flex items-center gap-1 shrink-0"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {groups.length > 0 && (
                          <select
                            value={part.groupId || ''}
                            onChange={(e) =>
                              assignPartToGroup(
                                part.id,
                                e.target.value || null
                              )
                            }
                            className="bg-slate-900 border border-slate-700 rounded text-[10px] px-1 py-0.5 text-slate-300"
                            title="שייך לקבוצה"
                          >
                            <option value="">ללא קבוצה</option>
                            {groups.map((g) => (
                              <option key={g.id} value={g.id}>
                                {g.name}
                              </option>
                            ))}
                          </select>
                        )}
                        <button
                          onClick={() =>
                            updatePart(
                              part.id,
                              { visible: !part.visible },
                              false
                            )
                          }
                          className="p-0.5 text-slate-400 hover:text-white cursor-pointer"
                        >
                          {part.visible ? (
                            <Eye className="w-3.5 h-3.5" />
                          ) : (
                            <EyeOff className="w-3.5 h-3.5 text-slate-600" />
                          )}
                        </button>
                        <button
                          onClick={() =>
                            updatePart(part.id, { locked: !part.locked }, false)
                          }
                          className="p-0.5 text-slate-400 hover:text-white cursor-pointer"
                        >
                          {part.locked ? (
                            <Lock className="w-3.5 h-3.5 text-amber-400" />
                          ) : (
                            <Unlock className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: Stock Library (Dimensional Lumber, Sheet Goods, Hardware) */}
      {activeTab === 'stock' && (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="grid grid-cols-3 gap-1 p-2 border-b border-slate-800 bg-slate-950/40">
            <button
              onClick={() => setStockFilter('lumber')}
              className={`py-1.5 rounded-md text-xs font-semibold flex items-center justify-center gap-1 cursor-pointer ${
                stockFilter === 'lumber'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Box className="w-3.5 h-3.5" />
              קורות עץ
            </button>
            <button
              onClick={() => setStockFilter('sheet')}
              className={`py-1.5 rounded-md text-xs font-semibold flex items-center justify-center gap-1 cursor-pointer ${
                stockFilter === 'sheet'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              פלטות לבוד
            </button>
            <button
              onClick={() => setStockFilter('hardware')}
              className={`py-1.5 rounded-md text-xs font-semibold flex items-center justify-center gap-1 cursor-pointer ${
                stockFilter === 'hardware'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Wrench className="w-3.5 h-3.5" />
              פרזול
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-2.5 space-y-2">
            {STOCK_LIBRARY.filter((s) => s.category === stockFilter).map(
              (item) => (
                <div
                  key={item.id}
                  onClick={() => addPartFromStock(item.id)}
                  className="group p-3 rounded-xl bg-slate-950/60 hover:bg-slate-800/80 border border-slate-800 hover:border-amber-500/60 transition cursor-pointer flex items-center justify-between gap-2 shadow-sm"
                >
                  <div className="flex items-start gap-2.5 min-w-0">
                    <div
                      className="w-8 h-8 rounded-lg border border-white/20 shrink-0 mt-0.5 shadow-inner"
                      style={{ backgroundColor: item.color }}
                    />
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-100 group-hover:text-amber-300 transition">
                        {item.name}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {item.nominalName}
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                        חוזק אלסטי E={item.elasticModulusGPa} GPa | צפיפות{' '}
                        {item.densityKgM3} ק"ג/מ"ק
                      </div>
                    </div>
                  </div>
                  <button className="bg-amber-500/15 group-hover:bg-amber-500 text-amber-400 group-hover:text-slate-950 p-1.5 rounded-lg transition shrink-0">
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              )
            )}
          </div>
        </div>
      )}
    </aside>
  );
};
