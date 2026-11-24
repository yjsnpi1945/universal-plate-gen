import type {
  ComputedPlate,
  HolePoint,
  PlateConfig,
  ValidationIssue,
} from '../types/plate';

export function holeKey(row: number, col: number): string {
  return `${row}:${col}`;
}

export function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

export function computePlateGeometry(
  config: PlateConfig,
  removedHoles: Set<string>,
): ComputedPlate {
  const cols = Math.round(clampNumber(config.cols, 1, 40));
  const rows = Math.round(clampNumber(config.rows, 1, 40));
  const pitch = clampNumber(config.pitch, 1.0, 50.0);
  const margin = clampNumber(config.margin, 0.8, 50.0);
  const thickness = clampNumber(config.thickness, 0.4, 50.0);
  const requestedHoleDiameter = clampNumber(config.holeDiameter, 0.4, 40.0);

  const issues: ValidationIssue[] = [];

  const hasMultipleHoles = cols > 1 || rows > 1;
  const maxByPitch = hasMultipleHoles ? Math.max(0.4, pitch - 0.25) : 40.0;
  const maxByMargin = Math.max(0.4, margin * 2 - 0.3);
  const maxSafeDiameter = Math.min(maxByPitch, maxByMargin);

  let effectiveHoleDiameter = requestedHoleDiameter;
  if (requestedHoleDiameter > maxSafeDiameter) {
    effectiveHoleDiameter = Number(maxSafeDiameter.toFixed(2));
    issues.push({
      level: 'error',
      message: `穴径がピッチまたは余白に対して大きすぎるため、安全上限（φ${effectiveHoleDiameter.toFixed(2)} mm）に制限しています。`,
    });
  } else {
    const holeGap = pitch - requestedHoleDiameter;
    const edgeWall = margin - requestedHoleDiameter / 2;
    if (hasMultipleHoles && holeGap < 0.8) {
      issues.push({
        level: 'warning',
        message: `隣り合う穴の間の肉厚が ${holeGap.toFixed(2)} mm と薄いため、3Dプリント時の強度低下に注意してください。`,
      });
    }
    if (edgeWall < 0.8) {
      issues.push({
        level: 'warning',
        message: `外周までの肉厚が ${edgeWall.toFixed(2)} mm と薄くなっています。余白を増やすことを推奨します。`,
      });
    }
  }

  const holeRadius = effectiveHoleDiameter / 2;

  let width: number;
  let height: number;
  let diameter: number;
  let radius: number;
  let cornerRadius = 0;

  if (config.shape === 'circle') {
    const maxCount = Math.max(cols, rows);
    diameter = (maxCount - 1) * pitch + margin * 2;
    radius = diameter / 2;
    width = diameter;
    height = diameter;
  } else {
    width = (cols - 1) * pitch + margin * 2;
    height = (rows - 1) * pitch + margin * 2;
    diameter = Math.max(width, height);
    radius = diameter / 2;
    const maxAllowedCorner = Math.max(0, Math.min(width, height) / 2 - 0.2);
    cornerRadius = clampNumber(config.cornerRadius, 0, maxAllowedCorner);
  }

  const holes: HolePoint[] = [];
  let cornerCollisionDetected = false;

  const rawEdgeWall = Math.max(0.15, margin - holeRadius);
  const minCircleWall = Math.min(rawEdgeWall * 0.92, Math.max(0.35, rawEdgeWall * 0.45));

  for (let r = 0; r < rows; r++) {
    const y = (r - (rows - 1) / 2) * pitch;
    for (let c = 0; c < cols; c++) {
      const x = (c - (cols - 1) / 2) * pitch;

      if (config.shape === 'circle') {
        const distFromCenter = Math.hypot(x, y);
        if (distFromCenter + holeRadius > radius - minCircleWall + 1e-6) {
          continue;
        }
      } else if (cornerRadius > 0.01) {
        const innerX = width / 2 - cornerRadius;
        const innerY = height / 2 - cornerRadius;
        const absX = Math.abs(x);
        const absY = Math.abs(y);
        if (absX > innerX && absY > innerY) {
          const distToFilletCenter = Math.hypot(absX - innerX, absY - innerY);
          if (distToFilletCenter + holeRadius > cornerRadius - 0.3) {
            cornerCollisionDetected = true;
            if (distToFilletCenter + holeRadius > cornerRadius - 0.15) {
              continue;
            }
          }
        }
      }

      const key = holeKey(r, c);
      holes.push({
        key,
        row: r,
        col: c,
        x,
        y,
        removed: removedHoles.has(key),
      });
    }
  }

  if (cornerCollisionDetected) {
    issues.push({
      level: 'warning',
      message: '角丸半径が大きいため、四隅付近の外形に干渉する穴を自動調整しています。',
    });
  }

  let activeHoleCount = 0;
  for (const h of holes) {
    if (!h.removed) activeHoleCount++;
  }

  return {
    shape: config.shape,
    width,
    height,
    diameter,
    radius,
    cornerRadius,
    effectiveHoleDiameter,
    effectiveThickness: thickness,
    holes,
    totalHoleCount: holes.length,
    activeHoleCount,
    removedHoleCount: holes.length - activeHoleCount,
    issues,
  };
}

export function formatMm(value: number): string {
  return Number.isInteger(value) ? value.toFixed(1) : value.toFixed(2).replace(/0$/, '');
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
