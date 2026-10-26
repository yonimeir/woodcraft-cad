import { Part, PartGroup, RoomEnvironment } from '../types/woodcraft';

export interface ProjectTemplate {
  id: string;
  name: string;
  description: string;
  badge: string;
  parts: Part[];
  groups: PartGroup[];
  room?: Partial<RoomEnvironment>;
}

const defaultPivot = { x: 0 as const, y: 0 as const, z: 0 as const };
const noMiter = { enabled: false, angle: 45, axis: 'z' as const };
const noPocket = {
  enabled: false,
  ends: 'both' as const,
  face: 'bottom' as const,
  holesPerEdge: 2,
};

function makePart(
  partial: Partial<Part> & {
    id: string;
    name: string;
    stockId: string;
    dimensions: { length: number; width: number; thickness: number };
    position: [number, number, number];
  }
): Part {
  return {
    rotation: [0, 0, 0],
    pivot: { ...defaultPivot },
    miterLengthMode: 'outer',
    allowRotationInCut: false,
    miterStart: { ...noMiter },
    miterEnd: { ...noMiter },
    pocketHoles: { ...noPocket },
    dadoNotches: [],
    groupId: null,
    visible: true,
    locked: false,
    ...partial,
  };
}

export const STARTER_TEMPLATES: ProjectTemplate[] = [
  {
    id: 'workbench-table',
    name: 'שולחן עבודה / אוכל מסיבי',
    description:
      'שולחן נגרים קלאסי (160×80 ס"מ, גובה 76 ס"מ) עם 4 רגלי 10×10, קושרות אורן 5×10 בחיבורי Kreg ללא חפיפות, מדף בירץ\' תחתון ופלטת בוצ\'ר עליונה.',
    badge: 'מומלץ להתחלה',
    groups: [
      {
        id: 'grp-legs',
        name: 'רגלי השולחן (4 יח\')',
        color: '#f59e0b',
        visible: true,
        locked: false,
        collapsed: false,
      },
      {
        id: 'grp-aprons',
        name: 'מסגרת קושרות (Kreg)',
        color: '#10b981',
        visible: true,
        locked: false,
        collapsed: false,
      },
      {
        id: 'grp-tops',
        name: 'משטחים ופלטות',
        color: '#38bdf8',
        visible: true,
        locked: false,
        collapsed: false,
      },
    ],
    parts: [
      // 4 Vertical Legs (90x90, length 732mm, sitting cleanly on floor Y=0..732)
      // Outer X span: -700..+700 (centers at +-655, inner faces at +-610)
      // Outer Z span: -350..+350 (centers at +-305, inner faces at +-260)
      makePart({
        id: 'leg-fl',
        name: 'רגל קדמית-שמאלית',
        stockId: 'pine-10x10',
        dimensions: { length: 732, width: 90, thickness: 90 },
        position: [-655, 366, 305],
        rotation: [0, 0, 90],
        groupId: 'grp-legs',
      }),
      makePart({
        id: 'leg-fr',
        name: 'רגל קדמית-ימנית',
        stockId: 'pine-10x10',
        dimensions: { length: 732, width: 90, thickness: 90 },
        position: [655, 366, 305],
        rotation: [0, 0, 90],
        groupId: 'grp-legs',
      }),
      makePart({
        id: 'leg-bl',
        name: 'רגל אחורית-שמאלית',
        stockId: 'pine-10x10',
        dimensions: { length: 732, width: 90, thickness: 90 },
        position: [-655, 366, -305],
        rotation: [0, 0, 90],
        groupId: 'grp-legs',
      }),
      makePart({
        id: 'leg-br',
        name: 'רגל אחורית-ימנית',
        stockId: 'pine-10x10',
        dimensions: { length: 732, width: 90, thickness: 90 },
        position: [655, 366, -305],
        rotation: [0, 0, 90],
        groupId: 'grp-legs',
      }),

      // Upper Aprons (exact inner span between legs: X=1220mm, Z=520mm)
      makePart({
        id: 'apron-front',
        name: 'קושרת קדמית עליונה',
        stockId: 'pine-5x10',
        dimensions: { length: 1220, width: 95, thickness: 45 },
        position: [0, 684.5, 305],
        rotation: [90, 0, 0],
        pocketHoles: { enabled: true, ends: 'both', face: 'back', holesPerEdge: 2 },
        groupId: 'grp-aprons',
      }),
      makePart({
        id: 'apron-back',
        name: 'קושרת אחורית עליונה',
        stockId: 'pine-5x10',
        dimensions: { length: 1220, width: 95, thickness: 45 },
        position: [0, 684.5, -305],
        rotation: [90, 0, 0],
        pocketHoles: { enabled: true, ends: 'both', face: 'front', holesPerEdge: 2 },
        groupId: 'grp-aprons',
      }),
      makePart({
        id: 'apron-left',
        name: 'קושרת צד שמאל',
        stockId: 'pine-5x10',
        dimensions: { length: 520, width: 95, thickness: 45 },
        position: [-655, 684.5, 0],
        rotation: [90, 90, 0],
        pocketHoles: { enabled: true, ends: 'both', face: 'back', holesPerEdge: 2 },
        groupId: 'grp-aprons',
      }),
      makePart({
        id: 'apron-right',
        name: 'קושרת צד ימין',
        stockId: 'pine-5x10',
        dimensions: { length: 520, width: 95, thickness: 45 },
        position: [655, 684.5, 0],
        rotation: [90, 90, 0],
        pocketHoles: { enabled: true, ends: 'both', face: 'front', holesPerEdge: 2 },
        groupId: 'grp-aprons',
      }),

      // Lower stretchers for shelf (Y top = 180 + 47.5 = 227.5mm)
      makePart({
        id: 'stretcher-front',
        name: 'קושרת מדף קדמית',
        stockId: 'pine-5x10',
        dimensions: { length: 1220, width: 95, thickness: 45 },
        position: [0, 180, 305],
        rotation: [90, 0, 0],
        pocketHoles: { enabled: true, ends: 'both', face: 'back', holesPerEdge: 2 },
        groupId: 'grp-aprons',
      }),
      makePart({
        id: 'stretcher-back',
        name: 'קושרת מדף אחורית',
        stockId: 'pine-5x10',
        dimensions: { length: 1220, width: 95, thickness: 45 },
        position: [0, 180, -305],
        rotation: [90, 0, 0],
        pocketHoles: { enabled: true, ends: 'both', face: 'front', holesPerEdge: 2 },
        groupId: 'grp-aprons',
      }),

      // Lower Birch Shelf (fits strictly between the 4 legs: 1220 x 520mm, resting on top of stretchers at Y=236)
      makePart({
        id: 'shelf-bottom',
        name: 'מדף תחתון בירץ\' 17 מ"מ',
        stockId: 'sheet-birch-17',
        dimensions: { length: 1220, width: 520, thickness: 17 },
        position: [0, 236, 0],
        rotation: [0, 0, 0],
        groupId: 'grp-tops',
      }),

      // Butcher Block Top (resting on top of legs Y=732 + 14 = 746)
      makePart({
        id: 'table-top',
        name: 'פלטת שולחן עליונה (בוצ\'ר 28 מ"מ)',
        stockId: 'sheet-pine-28',
        dimensions: { length: 1600, width: 800, thickness: 28 },
        position: [0, 746, 0],
        rotation: [0, 0, 0],
        groupId: 'grp-tops',
      }),
    ],
  },

  {
    id: 'garden-bench-miters',
    name: 'ספסל גינה עם מסגרת גרונג 45° ושלבים',
    description:
      'ספסל מעוצב באורך 140 ס"מ הכולל מסגרת היקפית בחיתוכי גרונג 45° מלאים (4 דפנות), שלבי ישיבה מאלון במרווחים שווים, ורגלי אורן מסיביות.',
    badge: 'גרונג + מרווחים',
    groups: [
      {
        id: 'grp-bench-frame',
        name: 'מסגרת גרונג 45° ורגליים',
        color: '#f59e0b',
        visible: true,
        locked: false,
        collapsed: false,
      },
      {
        id: 'grp-bench-slats',
        name: 'שלבי ישיבה (אלון)',
        color: '#10b981',
        visible: true,
        locked: false,
        collapsed: false,
      },
    ],
    parts: [
      // 4 Legs (90x90, height 420mm, sitting inside the mitered apron box)
      // Outer apron box is 1400mm (X: -700..+700) by 460mm (Z: -230..+230)
      // Aprons are 45mm thick -> inner box is X: -655..+655, Z: -185..+185
      // Legs (90x90) sit snugly against inner corners at X: +-610, Z: +-140
      makePart({
        id: 'b-leg-1',
        name: 'רגל ספסל קדמית-שמאל',
        stockId: 'pine-10x10',
        dimensions: { length: 420, width: 90, thickness: 90 },
        position: [-610, 210, 140],
        rotation: [0, 0, 90],
        groupId: 'grp-bench-frame',
      }),
      makePart({
        id: 'b-leg-2',
        name: 'רגל ספסל קדמית-ימין',
        stockId: 'pine-10x10',
        dimensions: { length: 420, width: 90, thickness: 90 },
        position: [610, 210, 140],
        rotation: [0, 0, 90],
        groupId: 'grp-bench-frame',
      }),
      makePart({
        id: 'b-leg-3',
        name: 'רגל ספסל אחורית-שמאל',
        stockId: 'pine-10x10',
        dimensions: { length: 420, width: 90, thickness: 90 },
        position: [-610, 210, -140],
        rotation: [0, 0, 90],
        groupId: 'grp-bench-frame',
      }),
      makePart({
        id: 'b-leg-4',
        name: 'רגל ספסל אחורית-ימין',
        stockId: 'pine-10x10',
        dimensions: { length: 420, width: 90, thickness: 90 },
        position: [610, 210, -140],
        rotation: [0, 0, 90],
        groupId: 'grp-bench-frame',
      }),

      // Complete 4-sided Mitered perimeter frame (Front, Back, Left, Right)
      makePart({
        id: 'b-frame-front',
        name: 'מסגרת קדמית (גרונג 45°)',
        stockId: 'pine-5x10',
        dimensions: { length: 1400, width: 95, thickness: 45 },
        position: [0, 372.5, 207.5],
        rotation: [90, 0, 0],
        miterStart: { enabled: true, angle: 45, axis: 'z' },
        miterEnd: { enabled: true, angle: 45, axis: 'z' },
        groupId: 'grp-bench-frame',
      }),
      makePart({
        id: 'b-frame-back',
        name: 'מסגרת אחורית (גרונג 45°)',
        stockId: 'pine-5x10',
        dimensions: { length: 1400, width: 95, thickness: 45 },
        position: [0, 372.5, -207.5],
        rotation: [90, 0, 0],
        miterStart: { enabled: true, angle: 45, axis: 'z' },
        miterEnd: { enabled: true, angle: 45, axis: 'z' },
        groupId: 'grp-bench-frame',
      }),
      makePart({
        id: 'b-frame-left',
        name: 'מסגרת צד שמאל (גרונג 45°)',
        stockId: 'pine-5x10',
        dimensions: { length: 370, width: 95, thickness: 45 },
        position: [-677.5, 372.5, 0],
        rotation: [90, 90, 0],
        miterStart: { enabled: true, angle: 45, axis: 'z' },
        miterEnd: { enabled: true, angle: 45, axis: 'z' },
        groupId: 'grp-bench-frame',
      }),
      makePart({
        id: 'b-frame-right',
        name: 'מסגרת צד ימין (גרונג 45°)',
        stockId: 'pine-5x10',
        dimensions: { length: 370, width: 95, thickness: 45 },
        position: [677.5, 372.5, 0],
        rotation: [90, 90, 0],
        miterStart: { enabled: true, angle: 45, axis: 'z' },
        miterEnd: { enabled: true, angle: 45, axis: 'z' },
        groupId: 'grp-bench-frame',
      }),

      // 4 Oak slats spaced evenly across top (Y = 420 + 10 = 430)
      makePart({
        id: 'b-slat-1',
        name: 'שלב אלון 1 (קדמי)',
        stockId: 'oak-2x10',
        dimensions: { length: 1400, width: 100, thickness: 20 },
        position: [0, 430, 180],
        rotation: [0, 0, 0],
        groupId: 'grp-bench-slats',
      }),
      makePart({
        id: 'b-slat-2',
        name: 'שלב אלון 2',
        stockId: 'oak-2x10',
        dimensions: { length: 1400, width: 100, thickness: 20 },
        position: [0, 430, 60],
        rotation: [0, 0, 0],
        groupId: 'grp-bench-slats',
      }),
      makePart({
        id: 'b-slat-3',
        name: 'שלב אלון 3',
        stockId: 'oak-2x10',
        dimensions: { length: 1400, width: 100, thickness: 20 },
        position: [0, 430, -60],
        rotation: [0, 0, 0],
        groupId: 'grp-bench-slats',
      }),
      makePart({
        id: 'b-slat-4',
        name: 'שלב אלון 4 (אחורי)',
        stockId: 'oak-2x10',
        dimensions: { length: 1400, width: 100, thickness: 20 },
        position: [0, 430, -180],
        rotation: [0, 0, 0],
        groupId: 'grp-bench-slats',
      }),
    ],
  },

  {
    id: 'niche-bookshelf-room',
    name: 'ספריית מדפים מותאמת לחדר (כולל קירות וחלון)',
    description:
      'יחידת מדפים מודולרית מפלטות בירץ\' 17 מ"מ המתוכננת בצמוד לקיר חדר עם חלון ושקע חשמל (ללא חפיפת דפנות).',
    badge: 'תכנון סביבתי + פלטות',
    room: {
      enabled: true,
      width: 2800,
      depth: 2200,
      height: 2500,
      showBackWall: true,
      showLeftWall: true,
      showRightWall: false,
      showBaseboard: true,
    },
    groups: [
      {
        id: 'grp-shelf-sides',
        name: 'דפנות ספרייה',
        color: '#38bdf8',
        visible: true,
        locked: false,
        collapsed: false,
      },
      {
        id: 'grp-shelf-boards',
        name: 'מדפים אופקיים',
        color: '#a855f7',
        visible: true,
        locked: false,
        collapsed: false,
      },
    ],
    parts: [
      // Left Vertical Side Panel (Birch 17mm, height 1800, depth 350)
      // At X = -450, inner face is at -450 + 8.5 = -441.5
      makePart({
        id: 'sh-side-l',
        name: 'דופן שמאלית (בירץ\' 17)',
        stockId: 'sheet-birch-17',
        dimensions: { length: 1800, width: 350, thickness: 17 },
        position: [-450, 900, -910],
        rotation: [0, 0, 90],
        groupId: 'grp-shelf-sides',
      }),
      // Right Vertical Side Panel
      // At X = +450, inner face is at +450 - 8.5 = +441.5 (exact clear span = 883mm)
      makePart({
        id: 'sh-side-r',
        name: 'דופן ימנית (בירץ\' 17)',
        stockId: 'sheet-birch-17',
        dimensions: { length: 1800, width: 350, thickness: 17 },
        position: [450, 900, -910],
        rotation: [0, 0, 90],
        groupId: 'grp-shelf-sides',
      }),
      // 4 Internal Shelves (length 880mm so they sit cleanly between the sides with zero collision)
      ...[120, 560, 1000, 1440].map((yPos, idx) =>
        makePart({
          id: `sh-board-${idx + 1}`,
          name: `מדף בירץ' מפלס ${idx + 1}`,
          stockId: 'sheet-birch-17',
          dimensions: { length: 880, width: 350, thickness: 17 },
          position: [0, yPos, -910],
          rotation: [0, 0, 0],
          pocketHoles: {
            enabled: true,
            ends: 'both',
            face: 'bottom',
            holesPerEdge: 3,
          },
          groupId: 'grp-shelf-boards',
        })
      ),
      // Top Cap Board resting cleanly on top of the two side panels (Y = 1800 + 8.5 = 1808.5, length = 917mm)
      makePart({
        id: 'sh-board-5',
        name: 'גג הספרייה העליון',
        stockId: 'sheet-birch-17',
        dimensions: { length: 917, width: 350, thickness: 17 },
        position: [0, 1808.5, -910],
        rotation: [0, 0, 0],
        groupId: 'grp-shelf-boards',
      }),
    ],
  },

  {
    id: 'structural-span-and-lap-demo',
    name: 'הדגמת עומסים (מפתח 3 מטר) + מגרעות חצי-חצי',
    description:
      'מדגים את מנוע בדיקת השקיעה ההנדסי (קורת אלון 2×10 על רגליים במרחק 3 מטר שמתריעה על כפיפה) לצד צלב קורות עם מגרעת חצי-חצי (Half-Lap) דינמית.',
    badge: 'בדיקת עומסים + CSG',
    groups: [
      {
        id: 'grp-span-test',
        name: 'גשר אלון 3 מטר (בדיקת שקיעה)',
        color: '#ef4444',
        visible: true,
        locked: false,
        collapsed: false,
      },
      {
        id: 'grp-halflap-test',
        name: 'צלב קורות במגרעת חצי-חצי',
        color: '#22c55e',
        visible: true,
        locked: false,
        collapsed: false,
      },
    ],
    parts: [
      makePart({
        id: 'span-leg-l',
        name: 'רגל תמיכה שמאלית (מפתח 3 מ\')',
        stockId: 'pine-10x10',
        dimensions: { length: 700, width: 90, thickness: 90 },
        position: [-1450, 350, -350],
        rotation: [0, 0, 90],
        groupId: 'grp-span-test',
      }),
      makePart({
        id: 'span-leg-r',
        name: 'רגל תמיכה ימנית (מפתח 3 מ\')',
        stockId: 'pine-10x10',
        dimensions: { length: 700, width: 90, thickness: 90 },
        position: [1450, 350, -350],
        rotation: [0, 0, 90],
        groupId: 'grp-span-test',
      }),
      makePart({
        id: 'span-oak-beam',
        name: 'קורת אלון 2×10 במפתח 3 מטר',
        stockId: 'oak-2x10',
        dimensions: { length: 3000, width: 100, thickness: 20 },
        position: [0, 710, -350],
        rotation: [0, 0, 0],
        groupId: 'grp-span-test',
      }),
      makePart({
        id: 'lap-beam-a',
        name: 'קורת צלב אורכית (עם מגרעת חצי-חצי)',
        stockId: 'pine-5x10',
        dimensions: { length: 1000, width: 95, thickness: 45 },
        position: [0, 22.5, 300],
        rotation: [0, 0, 0],
        dadoNotches: [
          {
            id: 'dado-init-1',
            cutterPartId: 'lap-beam-b',
            cutterPartName: 'קורת צלב רוחבית',
            mode: 'half',
          },
        ],
        groupId: 'grp-halflap-test',
      }),
      makePart({
        id: 'lap-beam-b',
        name: 'קורת צלב רוחבית',
        stockId: 'pine-5x10',
        dimensions: { length: 1000, width: 95, thickness: 45 },
        position: [0, 22.5, 300],
        rotation: [0, 90, 0],
        groupId: 'grp-halflap-test',
      }),
    ],
  },
];
