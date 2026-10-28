import React from 'react';

export interface IconProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
}

const baseProps = (size: number | string = 18): React.SVGProps<SVGSVGElement> => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.85,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
});

/** WoodCraft 3D Brand Mark — Isometric Mortise & Timber Cube */
export const IconWoodCraftLogo: React.FC<IconProps> = ({ size = 20, ...rest }) => (
  <svg {...baseProps(size)} {...rest}>
    <path d="M12 2.5L20.5 7.2V16.8L12 21.5L3.5 16.8V7.2L12 2.5Z" />
    <path d="M3.5 7.2L12 12L20.5 7.2" />
    <path d="M12 12V21.5" />
    <path d="M7.8 4.8L16.2 9.6" strokeOpacity="0.55" />
  </svg>
);

/** Photoshop / Illustrator Style Reference Point (Anchor / Pivot Reticle) */
export const IconPivotTarget: React.FC<IconProps> = ({ size = 18, ...rest }) => (
  <svg {...baseProps(size)} {...rest}>
    <circle cx="12" cy="12" r="6.5" />
    <circle cx="12" cy="12" r="1.6" fill="currentColor" />
    <line x1="12" y1="2" x2="12" y2="5.5" />
    <line x1="12" y1="18.5" x2="12" y2="22" />
    <line x1="2" y1="12" x2="5.5" y2="12" />
    <line x1="18.5" y1="12" x2="22" y2="12" />
  </svg>
);

/** Miter Cut (45° Angled Timber Cut - גרונג) */
export const IconMiterCut: React.FC<IconProps> = ({ size = 18, ...rest }) => (
  <svg {...baseProps(size)} {...rest}>
    <path d="M3 16H15L21 8H3V16Z" />
    <line x1="15" y1="16" x2="21" y2="8" strokeWidth="2.2" />
    <path d="M14 6L20 14" strokeDasharray="2 2" />
  </svg>
);

/** Dado / Half-Lap Notch Joint (מגרעת חצי-חצי / Dado) */
export const IconDadoJoint: React.FC<IconProps> = ({ size = 18, ...rest }) => (
  <svg {...baseProps(size)} {...rest}>
    <path d="M2.5 8H8.5V13.5H15.5V8H21.5V17H2.5V8Z" />
    <rect x="9.5" y="4" width="5" height="8" rx="0.8" strokeDasharray="2 1.5" />
  </svg>
);

/** Kreg Pocket-Hole Joinery (חורי כיס נסתרים) */
export const IconPocketHole: React.FC<IconProps> = ({ size = 18, ...rest }) => (
  <svg {...baseProps(size)} {...rest}>
    <rect x="3" y="13" width="18" height="7" rx="1" />
    <path d="M16 4V13" />
    <path d="M7 6L14.5 16.5" strokeWidth="2" />
    <ellipse cx="10.5" cy="13" rx="2.5" ry="1" />
  </svg>
);

/** Illustrator Align Start (Left / Bottom / Back Edge) */
export const IconAlignStart: React.FC<IconProps> = ({ size = 18, ...rest }) => (
  <svg {...baseProps(size)} {...rest}>
    <line x1="4" y1="3" x2="4" y2="21" strokeWidth="2.1" />
    <rect x="7" y="6" width="13" height="4.5" rx="1" />
    <rect x="7" y="13.5" width="8.5" height="4.5" rx="1" />
  </svg>
);

/** Illustrator Align Center (Horizontal / Vertical Axis Center) */
export const IconAlignCenter: React.FC<IconProps> = ({ size = 18, ...rest }) => (
  <svg {...baseProps(size)} {...rest}>
    <line x1="12" y1="2.5" x2="12" y2="21.5" strokeDasharray="2.5 2" />
    <rect x="4" y="6" width="16" height="4.5" rx="1" />
    <rect x="6.5" y="13.5" width="11" height="4.5" rx="1" />
  </svg>
);

/** Illustrator Align End (Right / Top / Front Edge) */
export const IconAlignEnd: React.FC<IconProps> = ({ size = 18, ...rest }) => (
  <svg {...baseProps(size)} {...rest}>
    <line x1="20" y1="3" x2="20" y2="21" strokeWidth="2.1" />
    <rect x="4" y="6" width="13" height="4.5" rx="1" />
    <rect x="8.5" y="13.5" width="8.5" height="4.5" rx="1" />
  </svg>
);

/** Illustrator Distribute Evenly (פיזור במרווחים שווים) */
export const IconDistributeEvenly: React.FC<IconProps> = ({
  size = 18,
  ...rest
}) => (
  <svg {...baseProps(size)} {...rest}>
    <line x1="3" y1="4" x2="3" y2="20" />
    <line x1="21" y1="4" x2="21" y2="20" />
    <rect x="7" y="6.5" width="3.5" height="11" rx="0.8" />
    <rect x="13.5" y="6.5" width="3.5" height="11" rx="0.8" />
  </svg>
);

/** Drop Flush to Workplane Floor (הנח על הרצפה - D) */
export const IconDropToFloor: React.FC<IconProps> = ({ size = 18, ...rest }) => (
  <svg {...baseProps(size)} {...rest}>
    <rect x="6" y="3.5" width="12" height="6" rx="1" />
    <path d="M12 11.5V17.5" />
    <path d="M9 15L12 18L15 15" />
    <line x1="3" y1="20.5" x2="21" y2="20.5" strokeWidth="2.1" />
  </svg>
);

/** AI CAD Blueprint Generator Icon (מחולל הנדסי) */
export const IconAiBlueprint: React.FC<IconProps> = ({ size = 18, ...rest }) => (
  <svg {...baseProps(size)} {...rest}>
    <path d="M12 3L19 7V15L12 19L5 15V7L12 3Z" />
    <path d="M5 7L12 11L19 7" />
    <path d="M12 11V19" />
    <circle cx="19" cy="4.5" r="1.5" fill="currentColor" />
    <path d="M19 2V3M19 6V7M16.5 4.5H17.5M20.5 4.5H21.5" strokeWidth="1.5" />
  </svg>
);

/** Architectural Furniture Templates Icon (תבניות מוכנות) */
export const IconTemplatesGrid: React.FC<IconProps> = ({
  size = 18,
  ...rest
}) => (
  <svg {...baseProps(size)} {...rest}>
    <rect x="3" y="4" width="18" height="4" rx="1" />
    <line x1="5.5" y1="8" x2="5.5" y2="20" strokeWidth="2" />
    <line x1="18.5" y1="8" x2="18.5" y2="20" strokeWidth="2" />
    <line x1="5.5" y1="14" x2="18.5" y2="14" />
  </svg>
);

/** Lumber Stack / Scrap Wood Icon (שאריות עץ ומלאי) */
export const IconScrapWood: React.FC<IconProps> = ({ size = 18, ...rest }) => (
  <svg {...baseProps(size)} {...rest}>
    <rect x="3" y="6" width="18" height="4.5" rx="0.8" />
    <rect x="5" y="13" width="14" height="4.5" rx="0.8" />
    <line x1="7" y1="6" x2="7" y2="10.5" />
    <line x1="15" y1="13" x2="15" y2="17.5" />
  </svg>
);
