export type PlateShape = 'rectangle' | 'circle';
export type StlFormat = 'binary' | 'ascii';
export type MaterialFinish = 'pla-light' | 'aluminum' | 'matte-dark';
export type ViewMode = '2d' | '3d';

export interface PlateConfig {
  shape: PlateShape;
  cols: number;
  rows: number;
  pitch: number;
  holeDiameter: number;
  thickness: number;
  margin: number;
  cornerRadius: number;
  curveSegments: 32 | 64;
  stlFormat: StlFormat;
}

export interface PlatePreset {
  id: string;
  name: string;
  subtitle: string;
  values: Pick<
    PlateConfig,
    'pitch' | 'holeDiameter' | 'thickness' | 'margin' | 'cornerRadius'
  >;
}

export const PLATE_PRESETS: PlatePreset[] = [
  {
    id: 'tamiya',
    name: 'タミヤ互換',
    subtitle: '5mm / φ3.0 / t3.0',
    values: {
      pitch: 5.0,
      holeDiameter: 3.0,
      thickness: 3.0,
      margin: 5.0,
      cornerRadius: 2.0,
    },
  },
  {
    id: 'perfboard',
    name: '電子工作 2.54',
    subtitle: '2.54mm / φ1.0 / t1.6',
    values: {
      pitch: 2.54,
      holeDiameter: 1.0,
      thickness: 1.6,
      margin: 2.54,
      cornerRadius: 1.0,
    },
  },
  {
    id: 'm4-heavy',
    name: 'M4 工作',
    subtitle: '10mm / φ4.2 / t4.0',
    values: {
      pitch: 10.0,
      holeDiameter: 4.2,
      thickness: 4.0,
      margin: 8.0,
      cornerRadius: 3.0,
    },
  },
];

export const DEFAULT_PLATE_CONFIG: PlateConfig = {
  shape: 'rectangle',
  cols: 11,
  rows: 7,
  pitch: 5.0,
  holeDiameter: 3.0,
  thickness: 3.0,
  margin: 5.0,
  cornerRadius: 2.0,
  curveSegments: 32,
  stlFormat: 'binary',
};

export interface HolePoint {
  key: string;
  row: number;
  col: number;
  x: number;
  y: number;
  removed: boolean;
}

export interface ValidationIssue {
  level: 'warning' | 'error';
  message: string;
}

export interface ComputedPlate {
  shape: PlateShape;
  width: number;
  height: number;
  diameter: number;
  radius: number;
  cornerRadius: number;
  effectiveHoleDiameter: number;
  effectiveThickness: number;
  holes: HolePoint[];
  totalHoleCount: number;
  activeHoleCount: number;
  removedHoleCount: number;
  issues: ValidationIssue[];
}

export interface ExportReceipt {
  filename: string;
  sizeBytes: number;
  triangleCount: number;
  format: StlFormat;
  timestamp: number;
}
