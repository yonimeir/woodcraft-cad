import { create } from 'zustand';
import {
  CutOptimizerSettings,
  Part,
  PartGroup,
  PivotAnchor,
  RoomEnvironment,
  RoomObstacle,
  SnapLine,
  ToastNotice,
} from '../types/woodcraft';
import { getStockById } from '../data/stockLibrary';
import { STARTER_TEMPLATES } from '../data/starterTemplates';
import {
  computeSmartSnap,
  detectPartCollisions,
  getPartQuaternion,
  getPartWorldBounds,
  resolvePartLengths,
  rotatePartAroundPivot,
} from '../utils/geometryAndEngineering';

const STORAGE_KEY = 'woodcraft_cad_project_v1';

interface HistorySnapshot {
  parts: Part[];
  groups: PartGroup[];
}

export type CameraViewPreset =
  | 'iso'
  | 'top'
  | 'bottom'
  | 'front'
  | 'back'
  | 'left'
  | 'right'
  | 'front-right'
  | 'front-left'
  | 'back-right'
  | 'back-left'
  | 'top-front-right'
  | 'top-front-left'
  | 'top-back-right'
  | 'top-back-left'
  | 'zoom-in'
  | 'zoom-out'
  | 'fit';

export type GizmoMode = 'move' | 'stretch' | 'rotate';

interface ProjectState {
  projectName: string;
  parts: Part[];
  groups: PartGroup[];
  selectedIds: string[];
  activeNotePartId: string | null;
  activeView: '3d' | 'workshop';
  gizmoMode: GizmoMode;
  unitMode: 'mm' | 'cm';
  showLiveDimensions: boolean;
  snapEnabled: boolean;
  angleSnapDeg: number;
  activeSnapLines: SnapLine[];
  cameraPresetRequest: { view: CameraViewPreset; timestamp: number } | null;
  room: RoomEnvironment;
  optimizerSettings: CutOptimizerSettings;
  toasts: ToastNotice[];
  past: HistorySnapshot[];
  future: HistorySnapshot[];

  // Actions
  setProjectName: (name: string) => void;
  setActiveNotePartId: (id: string | null) => void;
  setActiveView: (view: '3d' | 'workshop') => void;
  setGizmoMode: (mode: GizmoMode) => void;
  setUnitMode: (mode: 'mm' | 'cm') => void;
  setShowLiveDimensions: (show: boolean) => void;
  setSnapEnabled: (enabled: boolean) => void;
  setAngleSnapDeg: (deg: number) => void;
  setActiveSnapLines: (lines: SnapLine[]) => void;
  requestCameraView: (view: CameraViewPreset) => void;

  addToast: (message: string, type?: ToastNotice['type']) => void;
  dismissToast: (id: string) => void;

  pushHistory: () => void;
  undo: () => void;
  redo: () => void;

  selectPart: (id: string | null, multi?: boolean) => void;
  selectAll: () => void;
  selectGroup: (groupId: string) => void;

  addPartFromStock: (stockId: string) => void;
  updatePart: (id: string, patch: Partial<Part>, recordHistory?: boolean) => void;
  setPartPivot: (id: string, pivot: PivotAnchor) => void;
  rotatePartWithPivot: (
    id: string,
    newRotation: [number, number, number],
    recordHistory?: boolean
  ) => void;
  stretchPartSide: (
    id: string,
    side: 'length-start' | 'length-end' | 'width-start' | 'width-end',
    newTotalDimMm: number,
    recordHistory?: boolean
  ) => void;
  movePartWithSnap: (
    id: string,
    candidatePos: [number, number, number],
    recordHistory?: boolean
  ) => void;
  moveSelectedDelta: (delta: [number, number, number], recordHistory?: boolean) => void;
  duplicateSelected: () => void;
  deleteSelected: () => void;

  // Grouping / Layers
  createGroupFromSelected: (name?: string) => void;
  ungroup: (groupId: string) => void;
  renameGroup: (groupId: string, name: string) => void;
  toggleGroupVisibility: (groupId: string) => void;
  toggleGroupLock: (groupId: string) => void;
  toggleGroupCollapse: (groupId: string) => void;
  assignPartToGroup: (partId: string, groupId: string | null) => void;

  // Parametric Dado / Half-Lap & Auto-Spacer
  createParametricDado: (partAId: string, partBId: string, mode: 'half' | 'full') => void;
  removeDadoNotch: (partId: string, dadoId: string) => void;
  validateAndCleanDados: () => void;
  distributeAutoSpacer: (params: {
    partAId: string;
    partBId: string;
    templatePartId: string;
    count: number;
    axis: 'x' | 'y' | 'z';
  }) => void;

  // Room & Optimizer settings
  updateRoom: (patch: Partial<RoomEnvironment>) => void;
  addRoomObstacle: (obstacle: Omit<RoomObstacle, 'id'>) => void;
  updateRoomObstacle: (id: string, patch: Partial<RoomObstacle>) => void;
  removeRoomObstacle: (id: string) => void;
  updateOptimizerSettings: (patch: Partial<CutOptimizerSettings>) => void;

  // Templates & Persistence
  loadTemplate: (templateId: string) => void;
  clearWorkspace: () => void;
  exportProjectJson: () => string;
  importProjectJson: (jsonStr: string) => boolean;
}

const DEFAULT_ROOM: RoomEnvironment = {
  enabled: false,
  width: 3200,
  depth: 2400,
  height: 2500,
  showBackWall: true,
  showLeftWall: true,
  showRightWall: false,
  showBaseboard: true,
  baseboardHeight: 80,
  baseboardThickness: 15,
  obstacles: [
    {
      id: 'obs-window-1',
      type: 'window',
      name: 'חלון קיר אחורי',
      wall: 'back',
      offsetX: 1100,
      offsetY: 950,
      width: 1000,
      height: 1100,
      depth: 40,
    },
    {
      id: 'obs-outlet-1',
      type: 'outlet',
      name: 'שקע חשמל כפול',
      wall: 'back',
      offsetX: 600,
      offsetY: 400,
      width: 140,
      height: 85,
      depth: 15,
    },
  ],
};

const DEFAULT_OPTIMIZER: CutOptimizerSettings = {
  kerfMm: 3,
  edgeTrimMm: 15,
  defaultLumberStockLengthMm: 3600,
  allowNestedMiters: false,
  respectGrainDirection: true,
};

function loadInitialState(): {
  projectName: string;
  parts: Part[];
  groups: PartGroup[];
  room: RoomEnvironment;
  optimizerSettings: CutOptimizerSettings;
} {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.parts) && parsed.parts.length > 0) {
        return {
          projectName: parsed.projectName || 'שולחן עבודה מסיבי',
          parts: parsed.parts,
          groups: parsed.groups || [],
          room: { ...DEFAULT_ROOM, ...(parsed.room || {}) },
          optimizerSettings: {
            ...DEFAULT_OPTIMIZER,
            ...(parsed.optimizerSettings || {}),
          },
        };
      }
    }
  } catch {
    // ignore storage parse errors
  }

  const starter = STARTER_TEMPLATES[0];
  return {
    projectName: starter.name,
    parts: JSON.parse(JSON.stringify(starter.parts)),
    groups: JSON.parse(JSON.stringify(starter.groups)),
    room: { ...DEFAULT_ROOM },
    optimizerSettings: { ...DEFAULT_OPTIMIZER },
  };
}

function saveToLocalStorage(state: {
  projectName: string;
  parts: Part[];
  groups: PartGroup[];
  room: RoomEnvironment;
  optimizerSettings: CutOptimizerSettings;
}) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        projectName: state.projectName,
        parts: state.parts,
        groups: state.groups,
        room: state.room,
        optimizerSettings: state.optimizerSettings,
      })
    );
  } catch {
    // ignore quota errors
  }
}

const initial = loadInitialState();

export const useProjectStore = create<ProjectState>((set, get) => ({
  projectName: initial.projectName,
  parts: initial.parts,
  groups: initial.groups,
  selectedIds: initial.parts[0] ? [initial.parts[0].id] : [],
  activeNotePartId: null,
  activeView: '3d',
  gizmoMode: 'move',
  unitMode: 'mm',
  showLiveDimensions: false,
  snapEnabled: true,
  angleSnapDeg: 15,
  activeSnapLines: [],
  cameraPresetRequest: null,
  room: initial.room,
  optimizerSettings: initial.optimizerSettings,
  toasts: [],
  past: [],
  future: [],

  setProjectName: (projectName) => {
    set({ projectName });
    saveToLocalStorage({ ...get(), projectName });
  },

  setActiveNotePartId: (activeNotePartId) => set({ activeNotePartId }),
  setActiveView: (activeView) => set({ activeView }),
  setGizmoMode: (gizmoMode) => set({ gizmoMode }),
  setUnitMode: (unitMode) => set({ unitMode }),
  setShowLiveDimensions: (showLiveDimensions) => set({ showLiveDimensions }),
  setSnapEnabled: (snapEnabled) => set({ snapEnabled, activeSnapLines: [] }),
  setAngleSnapDeg: (angleSnapDeg) => set({ angleSnapDeg }),
  setActiveSnapLines: (activeSnapLines) => set({ activeSnapLines }),

  requestCameraView: (view) =>
    set({ cameraPresetRequest: { view, timestamp: Date.now() } }),

  addToast: (message, type = 'info') => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    set((s) => ({ toasts: [...s.toasts, { id, message, type }] }));
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, 5000);
  },

  dismissToast: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

  pushHistory: () => {
    const { parts, groups, past } = get();
    const snapshot: HistorySnapshot = {
      parts: JSON.parse(JSON.stringify(parts)),
      groups: JSON.parse(JSON.stringify(groups)),
    };
    set({
      past: [...past.slice(-29), snapshot],
      future: [],
    });
  },

  undo: () => {
    const { past, future, parts, groups } = get();
    if (past.length === 0) return;
    const prev = past[past.length - 1];
    const currentSnap: HistorySnapshot = {
      parts: JSON.parse(JSON.stringify(parts)),
      groups: JSON.parse(JSON.stringify(groups)),
    };
    set({
      parts: prev.parts,
      groups: prev.groups,
      past: past.slice(0, -1),
      future: [currentSnap, ...future],
    });
    saveToLocalStorage({ ...get(), parts: prev.parts, groups: prev.groups });
  },

  redo: () => {
    const { past, future, parts, groups } = get();
    if (future.length === 0) return;
    const next = future[0];
    const currentSnap: HistorySnapshot = {
      parts: JSON.parse(JSON.stringify(parts)),
      groups: JSON.parse(JSON.stringify(groups)),
    };
    set({
      parts: next.parts,
      groups: next.groups,
      past: [...past, currentSnap],
      future: future.slice(1),
    });
    saveToLocalStorage({ ...get(), parts: next.parts, groups: next.groups });
  },

  selectPart: (id, multi = false) => {
    if (!id) {
      set({ selectedIds: [] });
      return;
    }
    const { selectedIds } = get();
    if (multi) {
      if (selectedIds.includes(id)) {
        set({ selectedIds: selectedIds.filter((i) => i !== id) });
      } else {
        set({ selectedIds: [...selectedIds, id] });
      }
    } else {
      set({ selectedIds: [id] });
    }
  },

  selectAll: () => {
    const visibleUnlocked = get()
      .parts.filter((p) => p.visible && !p.locked)
      .map((p) => p.id);
    set({ selectedIds: visibleUnlocked });
  },

  selectGroup: (groupId) => {
    const groupParts = get()
      .parts.filter((p) => p.groupId === groupId && p.visible)
      .map((p) => p.id);
    set({ selectedIds: groupParts });
  },

  addPartFromStock: (stockId) => {
    const stock = getStockById(stockId);
    get().pushHistory();
    const count = get().parts.length + 1;
    const newId = `part-${Date.now().toString(36)}-${count}`;
    const offset = ((count % 5) - 2) * 80;
    const newPart: Part = {
      id: newId,
      name: `${stock.name.split(' ')[0]} ${stock.name.split(' ')[1] || ''} #${count}`,
      stockId: stock.id,
      dimensions: {
        length: stock.defaultLength,
        width: stock.width,
        thickness: stock.thickness,
      },
      miterLengthMode: 'outer',
      position: [offset, stock.thickness / 2, offset],
      rotation: [0, 0, 0],
      pivot: { x: 0, y: 0, z: 0 },
      allowRotationInCut: !stock.hasGrain,
      miterStart: { enabled: false, angle: 45, axis: 'z' },
      miterEnd: { enabled: false, angle: 45, axis: 'z' },
      pocketHoles: {
        enabled: false,
        ends: 'both',
        face: 'bottom',
        holesPerEdge: 2,
      },
      dadoNotches: [],
      groupId: null,
      visible: true,
      locked: false,
    };

    const nextParts = [...get().parts, newPart];
    set({ parts: nextParts, selectedIds: [newId] });
    saveToLocalStorage({ ...get(), parts: nextParts });
    get().addToast(`נוסף רכיב: ${newPart.name}`, 'success');
  },

  updatePart: (id, patch, recordHistory = true) => {
    const existing = get().parts.find((p) => p.id === id);
    if (!existing || (existing.locked && patch.locked === undefined)) return;
    if (recordHistory) get().pushHistory();

    const nextParts = get().parts.map((p) => (p.id === id ? { ...p, ...patch } : p));
    set({ parts: nextParts });
    get().validateAndCleanDados();
    saveToLocalStorage({ ...get(), parts: get().parts });
  },

  setPartPivot: (id, pivot) => {
    const nextParts = get().parts.map((p) => (p.id === id ? { ...p, pivot } : p));
    set({ parts: nextParts });
    saveToLocalStorage({ ...get(), parts: nextParts });
  },

  rotatePartWithPivot: (id, newRotation, recordHistory = true) => {
    const part = get().parts.find((p) => p.id === id);
    if (!part || part.locked) return;
    if (recordHistory) get().pushHistory();

    const { position, rotation } = rotatePartAroundPivot(part, newRotation);
    const nextParts = get().parts.map((p) =>
      p.id === id ? { ...p, position, rotation } : p
    );
    set({ parts: nextParts });
    get().validateAndCleanDados();
    saveToLocalStorage({ ...get(), parts: get().parts });
  },

  stretchPartSide: (id, side, newTotalDimMm, recordHistory = false) => {
    const part = get().parts.find((p) => p.id === id);
    if (!part || part.locked) return;
    const stock = getStockById(part.stockId);
    if (stock.category === 'hardware') return;
    if ((side === 'width-start' || side === 'width-end') && stock.category !== 'sheet') {
      return;
    }

    if (recordHistory) get().pushHistory();

    const clamped = Math.max(50, Math.min(4800, Math.round(newTotalDimMm)));
    const quat = getPartQuaternion(part.rotation);

    if (side === 'length-start' || side === 'length-end') {
      const oldLen = part.dimensions.length;
      const delta = clamped - oldLen;
      if (Math.abs(delta) < 0.5) return;

      // Move center along local X so the opposite end stays anchored!
      const dirSign = side === 'length-end' ? 1 : -1;
      const localShift = getPartWorldBounds(part).axisX
        .clone()
        .multiplyScalar((delta / 2) * dirSign);

      const newPos: [number, number, number] = [
        Math.round((part.position[0] + localShift.x) * 10) / 10,
        Math.round((part.position[1] + localShift.y) * 10) / 10,
        Math.round((part.position[2] + localShift.z) * 10) / 10,
      ];

      const nextParts = get().parts.map((p) =>
        p.id === id
          ? {
              ...p,
              dimensions: { ...p.dimensions, length: clamped },
              position: newPos,
            }
          : p
      );
      set({ parts: nextParts });
    } else {
      // width-start or width-end for sheets (local Z axis)
      const oldW = part.dimensions.width;
      const clampedW = Math.max(50, Math.min(1220, clamped));
      const delta = clampedW - oldW;
      if (Math.abs(delta) < 0.5) return;

      const dirSign = side === 'width-end' ? 1 : -1;
      const localShift = getPartWorldBounds(part).axisZ
        .clone()
        .multiplyScalar((delta / 2) * dirSign);

      void quat;
      const newPos: [number, number, number] = [
        Math.round((part.position[0] + localShift.x) * 10) / 10,
        Math.round((part.position[1] + localShift.y) * 10) / 10,
        Math.round((part.position[2] + localShift.z) * 10) / 10,
      ];

      const nextParts = get().parts.map((p) =>
        p.id === id
          ? {
              ...p,
              dimensions: { ...p.dimensions, width: clampedW },
              position: newPos,
            }
          : p
      );
      set({ parts: nextParts });
    }

    get().validateAndCleanDados();
    saveToLocalStorage({ ...get(), parts: get().parts });
  },

  movePartWithSnap: (id, candidatePos, recordHistory = false) => {
    const { parts, room, snapEnabled, selectedIds } = get();
    const part = parts.find((p) => p.id === id);
    if (!part || part.locked) return;
    if (recordHistory) get().pushHistory();

    let finalPos = candidatePos;
    let snapLines: SnapLine[] = [];

    const movingIds = selectedIds.includes(id) ? selectedIds : [id];
    const otherParts = parts.filter((p) => !movingIds.includes(p.id));

    if (snapEnabled) {
      const res = computeSmartSnap(part, candidatePos, otherParts, room, 18);
      finalPos = res.snappedPosition;
      snapLines = res.snapLines;
    } else {
      // Still keep above floor Y=0
      const b = getPartWorldBounds({ ...part, position: candidatePos });
      if (b.min[1] < 0) {
        finalPos = [
          candidatePos[0],
          candidatePos[1] - b.min[1],
          candidatePos[2],
        ];
      }
    }

    const delta: [number, number, number] = [
      finalPos[0] - part.position[0],
      finalPos[1] - part.position[1],
      finalPos[2] - part.position[2],
    ];

    const nextParts = parts.map((p) => {
      if (movingIds.includes(p.id) && !p.locked) {
        return {
          ...p,
          position: [
            Math.round((p.position[0] + delta[0]) * 10) / 10,
            Math.round(Math.max(5, p.position[1] + delta[1]) * 10) / 10,
            Math.round((p.position[2] + delta[2]) * 10) / 10,
          ] as [number, number, number],
        };
      }
      return p;
    });

    set({ parts: nextParts, activeSnapLines: snapLines });
    get().validateAndCleanDados();
    saveToLocalStorage({ ...get(), parts: get().parts });
  },

  moveSelectedDelta: (delta, recordHistory = true) => {
    const { parts, selectedIds } = get();
    if (selectedIds.length === 0) return;
    if (recordHistory) get().pushHistory();

    const nextParts = parts.map((p) => {
      if (!selectedIds.includes(p.id) || p.locked) return p;
      const candidate: [number, number, number] = [
        Math.round((p.position[0] + delta[0]) * 10) / 10,
        Math.round((p.position[1] + delta[1]) * 10) / 10,
        Math.round((p.position[2] + delta[2]) * 10) / 10,
      ];
      const b = getPartWorldBounds({ ...p, position: candidate });
      if (b.min[1] < 0) {
        candidate[1] -= b.min[1];
      }
      return { ...p, position: candidate };
    });

    set({ parts: nextParts });
    get().validateAndCleanDados();
    saveToLocalStorage({ ...get(), parts: get().parts });
  },

  duplicateSelected: () => {
    const { parts, selectedIds } = get();
    if (selectedIds.length === 0) return;
    get().pushHistory();

    const newClones: Part[] = [];
    const newIds: string[] = [];

    for (const id of selectedIds) {
      const orig = parts.find((p) => p.id === id);
      if (!orig) continue;
      const cloneId = `part-${Date.now().toString(36)}-${Math.random()
        .toString(36)
        .slice(2, 6)}`;
      newIds.push(cloneId);
      newClones.push({
        ...JSON.parse(JSON.stringify(orig)),
        id: cloneId,
        name: `${orig.name} (עותק)`,
        position: [orig.position[0] + 80, orig.position[1], orig.position[2] + 80],
        dadoNotches: [],
        locked: false,
      });
    }

    const nextParts = [...parts, ...newClones];
    set({ parts: nextParts, selectedIds: newIds });
    saveToLocalStorage({ ...get(), parts: nextParts });
    get().addToast(`שוכפלו ${newClones.length} חלקים`, 'success');
  },

  deleteSelected: () => {
    const { parts, selectedIds } = get();
    if (selectedIds.length === 0) return;
    get().pushHistory();

    const nextParts = parts.filter((p) => !selectedIds.includes(p.id) || p.locked);
    set({ parts: nextParts, selectedIds: [] });
    get().validateAndCleanDados();
    saveToLocalStorage({ ...get(), parts: get().parts });
    get().addToast('החלקים הנבחרים נמחקו', 'info');
  },

  createGroupFromSelected: (name) => {
    const { parts, groups, selectedIds } = get();
    if (selectedIds.length === 0) return;
    get().pushHistory();

    const colors = ['#f59e0b', '#10b981', '#38bdf8', '#a855f7', '#ec4899', '#eab308'];
    const newGroupId = `grp-${Date.now().toString(36)}`;
    const groupName = name?.trim() || `קבוצה ${groups.length + 1}`;
    const newGroup: PartGroup = {
      id: newGroupId,
      name: groupName,
      color: colors[groups.length % colors.length],
      visible: true,
      locked: false,
      collapsed: false,
    };

    const nextParts = parts.map((p) =>
      selectedIds.includes(p.id) ? { ...p, groupId: newGroupId } : p
    );
    const nextGroups = [...groups, newGroup];
    set({ parts: nextParts, groups: nextGroups });
    saveToLocalStorage({ ...get(), parts: nextParts, groups: nextGroups });
    get().addToast(`נוצרה קבוצה חדשה: "${groupName}"`, 'success');
  },

  ungroup: (groupId) => {
    const { parts, groups } = get();
    get().pushHistory();
    const nextParts = parts.map((p) =>
      p.groupId === groupId ? { ...p, groupId: null } : p
    );
    const nextGroups = groups.filter((g) => g.id !== groupId);
    set({ parts: nextParts, groups: nextGroups });
    saveToLocalStorage({ ...get(), parts: nextParts, groups: nextGroups });
    get().addToast('הקבוצה פורקה ליחידות בודדות', 'info');
  },

  renameGroup: (groupId, name) => {
    const nextGroups = get().groups.map((g) =>
      g.id === groupId ? { ...g, name } : g
    );
    set({ groups: nextGroups });
    saveToLocalStorage({ ...get(), groups: nextGroups });
  },

  toggleGroupVisibility: (groupId) => {
    const { groups, parts } = get();
    const grp = groups.find((g) => g.id === groupId);
    if (!grp) return;
    const nextVisible = !grp.visible;
    const nextGroups = groups.map((g) =>
      g.id === groupId ? { ...g, visible: nextVisible } : g
    );
    const nextParts = parts.map((p) =>
      p.groupId === groupId ? { ...p, visible: nextVisible } : p
    );
    set({ groups: nextGroups, parts: nextParts });
    saveToLocalStorage({ ...get(), groups: nextGroups, parts: nextParts });
  },

  toggleGroupLock: (groupId) => {
    const { groups, parts } = get();
    const grp = groups.find((g) => g.id === groupId);
    if (!grp) return;
    const nextLocked = !grp.locked;
    const nextGroups = groups.map((g) =>
      g.id === groupId ? { ...g, locked: nextLocked } : g
    );
    const nextParts = parts.map((p) =>
      p.groupId === groupId ? { ...p, locked: nextLocked } : p
    );
    set({ groups: nextGroups, parts: nextParts });
    saveToLocalStorage({ ...get(), groups: nextGroups, parts: nextParts });
  },

  toggleGroupCollapse: (groupId) => {
    const nextGroups = get().groups.map((g) =>
      g.id === groupId ? { ...g, collapsed: !g.collapsed } : g
    );
    set({ groups: nextGroups });
  },

  assignPartToGroup: (partId, groupId) => {
    const nextParts = get().parts.map((p) =>
      p.id === partId ? { ...p, groupId } : p
    );
    set({ parts: nextParts });
    saveToLocalStorage({ ...get(), parts: nextParts });
  },

  createParametricDado: (partAId, partBId, mode) => {
    const { parts } = get();
    const partA = parts.find((p) => p.id === partAId);
    const partB = parts.find((p) => p.id === partBId);
    if (!partA || !partB) return;
    get().pushHistory();

    const nextParts = parts.map((p) => {
      if (p.id === partAId) {
        const filtered = p.dadoNotches.filter((d) => d.cutterPartId !== partBId);
        return {
          ...p,
          dadoNotches: [
            ...filtered,
            {
              id: `dado-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
              cutterPartId: partBId,
              cutterPartName: partB.name,
              mode,
            },
          ],
        };
      }
      return p;
    });

    set({ parts: nextParts });
    saveToLocalStorage({ ...get(), parts: nextParts });
    get().addToast(
      `נוצרה מגרעת ${mode === 'half' ? 'חצי-חצי (Half-Lap)' : 'מלאה (Dado)'} על "${
        partA.name
      }" מול "${partB.name}"`,
      'success'
    );
  },

  removeDadoNotch: (partId, dadoId) => {
    get().pushHistory();
    const nextParts = get().parts.map((p) =>
      p.id === partId
        ? { ...p, dadoNotches: p.dadoNotches.filter((d) => d.id !== dadoId) }
        : p
    );
    set({ parts: nextParts });
    saveToLocalStorage({ ...get(), parts: nextParts });
    get().addToast('המגרעת הוסרה', 'info');
  },

  validateAndCleanDados: () => {
    const { parts } = get();
    const collisions = detectPartCollisions(parts);
    const activePairs = new Set<string>();
    for (const c of collisions) {
      activePairs.add(`${c.partAId}__${c.partBId}`);
      activePairs.add(`${c.partBId}__${c.partAId}`);
    }

    let removedMessages: string[] = [];
    let changed = false;

    const cleanedParts = parts.map((p) => {
      if (p.dadoNotches.length === 0) return p;
      const validDados = p.dadoNotches.filter((d) => {
        const cutterExists = parts.some((other) => other.id === d.cutterPartId && other.visible);
        const stillIntersecting = activePairs.has(`${p.id}__${d.cutterPartId}`);
        if (!cutterExists || !stillIntersecting) {
          changed = true;
          removedMessages.push(
            `המגרעת בחלק "${p.name}" (מול "${d.cutterPartName}") נמחקה אוטומטית כי הקורות כבר אינן חוצות זו את זו.`
          );
          return false;
        }
        return true;
      });
      return validDados.length === p.dadoNotches.length
        ? p
        : { ...p, dadoNotches: validDados };
    });

    if (changed) {
      set({ parts: cleanedParts });
      for (const msg of removedMessages) {
        get().addToast(msg, 'warning');
      }
    }
  },

  distributeAutoSpacer: ({ partAId, partBId, templatePartId, count, axis }) => {
    const { parts } = get();
    const partA = parts.find((p) => p.id === partAId);
    const partB = parts.find((p) => p.id === partBId);
    const template = parts.find((p) => p.id === templatePartId);
    if (!partA || !partB || !template || count < 1 || count > 30) return;

    get().pushHistory();

    const bA = getPartWorldBounds(partA);
    const bB = getPartWorldBounds(partB);
    const bT = getPartWorldBounds(template);

    const axisIdx = axis === 'x' ? 0 : axis === 'y' ? 1 : 2;
    const firstIsA = bA.center[axisIdx] <= bB.center[axisIdx];
    const startBoundary = firstIsA ? bA.max[axisIdx] : bB.max[axisIdx];
    const endBoundary = firstIsA ? bB.min[axisIdx] : bA.min[axisIdx];

    const totalClearSpan = endBoundary - startBoundary;
    const itemThicknessOnAxis = bT.size[axisIdx];
    const totalItemsWidth = count * itemThicknessOnAxis;
    const gapSize = (totalClearSpan - totalItemsWidth) / (count + 1);

    const newParts: Part[] = [];
    const newIds: string[] = [];

    for (let i = 0; i < count; i++) {
      const centerCoord =
        startBoundary +
        gapSize * (i + 1) +
        itemThicknessOnAxis * i +
        itemThicknessOnAxis / 2;

      const pos: [number, number, number] = [...template.position];
      pos[axisIdx] = Math.round(centerCoord * 10) / 10;

      const cloneId = `spacer-${Date.now().toString(36)}-${i}`;
      newIds.push(cloneId);
      newParts.push({
        ...JSON.parse(JSON.stringify(template)),
        id: cloneId,
        name: `${template.name} (${i + 1}/${count})`,
        position: pos,
        dadoNotches: [],
        locked: false,
      });
    }

    const nextParts = [...parts, ...newParts];
    set({ parts: nextParts, selectedIds: newIds });
    saveToLocalStorage({ ...get(), parts: nextParts });
    get().addToast(
      `פוזרו ${count} יחידות במרווח שווה של ${Math.round(gapSize)} מ"מ`,
      'success'
    );
  },

  updateRoom: (patch) => {
    const nextRoom = { ...get().room, ...patch };
    set({ room: nextRoom });
    saveToLocalStorage({ ...get(), room: nextRoom });
  },

  addRoomObstacle: (obstacle) => {
    const nextRoom: RoomEnvironment = {
      ...get().room,
      obstacles: [
        ...get().room.obstacles,
        { ...obstacle, id: `obs-${Date.now().toString(36)}` },
      ],
    };
    set({ room: nextRoom });
    saveToLocalStorage({ ...get(), room: nextRoom });
  },

  updateRoomObstacle: (id, patch) => {
    const nextRoom: RoomEnvironment = {
      ...get().room,
      obstacles: get().room.obstacles.map((o) =>
        o.id === id ? { ...o, ...patch } : o
      ),
    };
    set({ room: nextRoom });
    saveToLocalStorage({ ...get(), room: nextRoom });
  },

  removeRoomObstacle: (id) => {
    const nextRoom: RoomEnvironment = {
      ...get().room,
      obstacles: get().room.obstacles.filter((o) => o.id !== id),
    };
    set({ room: nextRoom });
    saveToLocalStorage({ ...get(), room: nextRoom });
  },

  updateOptimizerSettings: (patch) => {
    const nextSettings = { ...get().optimizerSettings, ...patch };
    set({ optimizerSettings: nextSettings });
    saveToLocalStorage({ ...get(), optimizerSettings: nextSettings });
  },

  loadTemplate: (templateId) => {
    const tmpl = STARTER_TEMPLATES.find((t) => t.id === templateId);
    if (!tmpl) return;
    get().pushHistory();
    const parts: Part[] = JSON.parse(JSON.stringify(tmpl.parts));
    const groups: PartGroup[] = JSON.parse(JSON.stringify(tmpl.groups));
    const room: RoomEnvironment = tmpl.room
      ? { ...get().room, ...tmpl.room }
      : { ...get().room, enabled: false };

    set({
      projectName: tmpl.name,
      parts,
      groups,
      room,
      selectedIds: parts[0] ? [parts[0].id] : [],
      activeSnapLines: [],
    });
    saveToLocalStorage({
      ...get(),
      projectName: tmpl.name,
      parts,
      groups,
      room,
    });
    get().addToast(`נטענה תבנית: ${tmpl.name}`, 'success');
  },

  clearWorkspace: () => {
    get().pushHistory();
    set({
      projectName: 'פרויקט נגרות חדש',
      parts: [],
      groups: [],
      selectedIds: [],
      activeSnapLines: [],
    });
    saveToLocalStorage({
      ...get(),
      projectName: 'פרויקט נגרות חדש',
      parts: [],
      groups: [],
    });
    get().addToast('משטח העבודה נוקה', 'info');
  },

  exportProjectJson: () => {
    const { projectName, parts, groups, room, optimizerSettings } = get();
    void resolvePartLengths;
    return JSON.stringify(
      {
        version: '1.0',
        projectName,
        exportedAt: new Date().toISOString(),
        parts,
        groups,
        room,
        optimizerSettings,
      },
      null,
      2
    );
  },

  importProjectJson: (jsonStr) => {
    try {
      const parsed = JSON.parse(jsonStr);
      if (!parsed || !Array.isArray(parsed.parts)) return false;
      get().pushHistory();
      const nextState = {
        projectName: parsed.projectName || 'פרויקט מיובא',
        parts: parsed.parts,
        groups: parsed.groups || [],
        room: { ...DEFAULT_ROOM, ...(parsed.room || {}) },
        optimizerSettings: {
          ...DEFAULT_OPTIMIZER,
          ...(parsed.optimizerSettings || {}),
        },
      };
      set({
        ...nextState,
        selectedIds: nextState.parts[0] ? [nextState.parts[0].id] : [],
      });
      saveToLocalStorage(nextState);
      get().addToast(`הפרויקט "${nextState.projectName}" נטען בהצלחה`, 'success');
      return true;
    } catch {
      get().addToast('שגיאה בקריאת קובץ הפרויקט', 'warning');
      return false;
    }
  },
}));
