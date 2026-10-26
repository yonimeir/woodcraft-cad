export type StockCategory = 'lumber' | 'sheet' | 'hardware';

export type WoodSpecies =
  | 'pine'
  | 'oak'
  | 'birch'
  | 'okoume'
  | 'mdf'
  | 'ipe'
  | 'spruce'
  | 'metal';

export interface StockProfile {
  id: string;
  name: string;
  category: StockCategory;
  species: WoodSpecies;
  nominalName: string;
  /** Actual thickness in mm (local Y axis when horizontal) */
  thickness: number;
  /** Actual width in mm (local Z axis when horizontal) */
  width: number;
  /** Default length when spawned in mm (local X axis) */
  defaultLength: number;
  /** Standard commercial lengths in mm for 1D lumber */
  stockLengths: number[];
  /** Standard raw sheet dimensions in mm for 2D sheet goods */
  sheetSize?: {
    length: number;
    width: number;
  };
  color: string;
  grainColor: string;
  hasGrain: boolean;
  /** Young's Modulus of Elasticity (E) in GPa for structural deflection calculation */
  elasticModulusGPa: number;
  /** Allowable bending stress in MPa */
  bendingStrengthMPa: number;
  /** Density in kg/m^3 */
  densityKgM3: number;
  /** Reference price in ILS per linear meter (for lumber) or per full sheet (for sheets) or per unit (hardware) */
  referencePriceILS: number;
}

export interface PivotAnchor {
  /** -1 = Start (Left/-X), 0 = Center, 1 = End (Right/+X) */
  x: -1 | 0 | 1;
  /** -1 = Bottom (-Y), 0 = Middle, 1 = Top (+Y) */
  y: -1 | 0 | 1;
  /** -1 = Back (-Z), 0 = Center, 1 = Front (+Z) */
  z: -1 | 0 | 1;
}

/**
 * How the user-specified `dimensions.length` relates to miter cuts:
 * - 'outer': Length is the maximum outside length (Long point to Long point)
 * - 'inner': Length is the inside length (Short point to Short point)
 * - 'center': Length is measured along the centerline (Path center)
 */
export type MiterLengthMode = 'outer' | 'inner' | 'center';

export interface MiterCut {
  enabled: boolean;
  /** Angle in degrees (-60 to 60, typically 45 or -45) */
  angle: number;
  /** Axis of the cut plane rotation: 'z' cuts across width, 'y' bevels across thickness */
  axis: 'z' | 'y';
}

export interface PocketHoleConfig {
  enabled: boolean;
  ends: 'start' | 'end' | 'both' | 'sides';
  face: 'bottom' | 'top' | 'back' | 'front';
  holesPerEdge: number;
}

export interface DadoNotch {
  id: string;
  /** ID of the intersecting part that carves this notch */
  cutterPartId: string;
  cutterPartName: string;
  /** 'half' = Half-Lap (50% depth on each intersecting beam), 'full' = Full intersection housing dado */
  mode: 'half' | 'full';
}

export interface Part {
  id: string;
  name: string;
  stockId: string;
  /**
   * Dimensions in mm:
   * - length: along local X axis (modifiable for lumber & sheets)
   * - width: along local Z axis (modifiable only for sheets; fixed for lumber)
   * - thickness: along local Y axis (fixed by StockProfile)
   */
  dimensions: {
    length: number;
    width: number;
    thickness: number;
  };
  miterLengthMode: MiterLengthMode;
  /** World coordinates [x, y, z] in mm of the part's geometric center */
  position: [number, number, number];
  /** Euler rotation [rx, ry, rz] in degrees (XYZ order) */
  rotation: [number, number, number];
  /** Selectable anchor / pivot point for rotation in 3D */
  pivot: PivotAnchor;
  /** Whether optimizer can rotate this part by 90 degrees on a sheet (ignores grain direction) */
  allowRotationInCut: boolean;
  miterStart: MiterCut;
  miterEnd: MiterCut;
  pocketHoles: PocketHoleConfig;
  dadoNotches: DadoNotch[];
  groupId: string | null;
  visible: boolean;
  locked: boolean;
  customColor?: string;
}

export interface PartGroup {
  id: string;
  name: string;
  color: string;
  visible: boolean;
  locked: boolean;
  collapsed: boolean;
}

export type WallSide = 'back' | 'left' | 'right';

export interface RoomObstacle {
  id: string;
  type: 'window' | 'door' | 'outlet' | 'radiator';
  name: string;
  wall: WallSide;
  /** Horizontal offset from wall left/back edge in mm */
  offsetX: number;
  /** Vertical offset from floor (Y=0) in mm */
  offsetY: number;
  width: number;
  height: number;
  /** Protrusion into the room in mm */
  depth: number;
}

export interface RoomEnvironment {
  enabled: boolean;
  width: number; // X axis in mm
  depth: number; // Z axis in mm
  height: number; // Y axis in mm
  showBackWall: boolean;
  showLeftWall: boolean;
  showRightWall: boolean;
  showBaseboard: boolean;
  baseboardHeight: number;
  baseboardThickness: number;
  obstacles: RoomObstacle[];
}

export interface SnapLine {
  id: string;
  start: [number, number, number];
  end: [number, number, number];
  color: string;
  label?: string;
}

export interface CollisionPair {
  id: string;
  partAId: string;
  partBId: string;
  partAName: string;
  partBName: string;
  overlapBox: {
    min: [number, number, number];
    max: [number, number, number];
    size: [number, number, number];
  };
  hasDadoAlready: boolean;
}

export interface StructuralLoadResult {
  partId: string;
  partName: string;
  isHorizontalSpan: boolean;
  /** Unsupported span length in mm */
  unsupportedSpanMm: number;
  /** Design load in kg distributed / center equivalent */
  assumedLoadKg: number;
  /** Calculated mid-span deflection in mm */
  deflectionMm: number;
  /** Maximum acceptable deflection in mm (typically L / 360 or ~0.5mm per ft) */
  allowableDeflectionMm: number;
  /** Ratio deflection / allowable (>1 means warning, >2 means severe) */
  severity: 'safe' | 'caution' | 'warning' | 'critical';
  /** Whether the beam is laid flat (weak axis) vs standing on edge (strong axis) */
  isLaidFlat: boolean;
  /** Deflection if rotated 90 deg onto its edge */
  edgewiseDeflectionMm: number;
  recommendationHe: string;
}

export interface KregRecommendation {
  woodThicknessMm: number;
  jigSettingMm: string;
  drillCollarMm: string;
  screwLengthMm: number;
  screwLengthInch: string;
  threadType: 'גסה (Coarse - לעץ רך/לבוד)' | 'עדינה (Fine - לעץ קשה כגון אלון)';
  totalScrewsForPart: number;
}

export interface CutOptimizerSettings {
  kerfMm: number;
  edgeTrimMm: number;
  defaultLumberStockLengthMm: number;
  allowNestedMiters: boolean;
  respectGrainDirection: boolean;
}

export interface CutListGroup {
  label: string; // 'A', 'B', 'C'...
  stockId: string;
  stockName: string;
  category: StockCategory;
  quantity: number;
  cutLengthMm: number;
  innerLengthMm: number;
  widthMm: number;
  thicknessMm: number;
  miterStartDeg: number;
  miterEndDeg: number;
  hasPocketHoles: boolean;
  pocketHoleCount: number;
  kregRec: KregRecommendation | null;
  dadoCount: number;
  partIds: string[];
  partNames: string[];
  allowRotationInCut: boolean;
}

export interface LumberBinCut {
  groupLabel: string;
  partName: string;
  partId: string;
  startMm: number;
  lengthMm: number;
  miterStartDeg: number;
  miterEndDeg: number;
  nestedWithPrev: boolean;
}

export interface LumberStockBar {
  barIndex: number;
  stockId: string;
  stockName: string;
  stockLengthMm: number;
  edgeTrimMm: number;
  cuts: LumberBinCut[];
  usedMm: number;
  wasteMm: number;
  efficiencyPct: number;
}

export interface SheetPlacedRect {
  groupLabel: string;
  partName: string;
  partId: string;
  xMm: number;
  yMm: number;
  widthMm: number;
  lengthMm: number;
  rotated: boolean;
}

export interface SheetStockBoard {
  boardIndex: number;
  stockId: string;
  stockName: string;
  sheetLengthMm: number;
  sheetWidthMm: number;
  edgeTrimMm: number;
  placements: SheetPlacedRect[];
  usedAreaMm2: number;
  totalAreaMm2: number;
  efficiencyPct: number;
}

export interface ToastNotice {
  id: string;
  type: 'info' | 'warning' | 'success';
  message: string;
}
