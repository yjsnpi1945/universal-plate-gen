import * as THREE from 'three';
import { STLExporter } from 'three/addons/exporters/STLExporter.js';
import type { ComputedPlate, ExportReceipt, PlateConfig } from '../types/plate';

/**
 * Builds a watertight, manifold Three.js ExtrudeGeometry in real mm units.
 * Coordinate convention:
 *   - XY plane is the plate top/bottom face (centered at X=0, Y=0)
 *   - +Z is thickness [0, effectiveThickness] (3D printer Z-up, bottom resting at Z=0)
 *   - 2D top-down SVG +Y (down) maps to -Y in Z-up space so orientation is never mirrored.
 */
export function createPlateExtrudeGeometry(
  computed: ComputedPlate,
  curveSegments: number,
): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape();

  if (computed.shape === 'circle') {
    shape.absarc(0, 0, computed.radius, 0, Math.PI * 2, false);
  } else {
    const hw = computed.width / 2;
    const hh = computed.height / 2;
    const r = Math.min(computed.cornerRadius, hw - 0.05, hh - 0.05);

    if (r > 0.01) {
      shape.moveTo(-hw + r, -hh);
      shape.lineTo(hw - r, -hh);
      shape.absarc(hw - r, -hh + r, r, -Math.PI / 2, 0, false);
      shape.lineTo(hw, hh - r);
      shape.absarc(hw - r, hh - r, r, 0, Math.PI / 2, false);
      shape.lineTo(-hw + r, hh);
      shape.absarc(-hw + r, hh - r, r, Math.PI / 2, Math.PI, false);
      shape.lineTo(-hw, -hh + r);
      shape.absarc(-hw + r, -hh + r, r, Math.PI, Math.PI * 1.5, false);
    } else {
      shape.moveTo(-hw, -hh);
      shape.lineTo(hw, -hh);
      shape.lineTo(hw, hh);
      shape.lineTo(-hw, hh);
      shape.closePath();
    }
  }

  const holeRadius = computed.effectiveHoleDiameter / 2;
  for (const hole of computed.holes) {
    if (hole.removed) continue;
    const holePath = new THREE.Path();
    holePath.absarc(hole.x, -hole.y, holeRadius, 0, Math.PI * 2, true);
    shape.holes.push(holePath);
  }

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: computed.effectiveThickness,
    bevelEnabled: false,
    curveSegments,
    steps: 1,
  });

  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();

  return geometry;
}

export function exportPlateToStl(
  computed: ComputedPlate,
  config: PlateConfig,
): ExportReceipt {
  const geometry = createPlateExtrudeGeometry(computed, config.curveSegments);
  const mesh = new THREE.Mesh(geometry);
  mesh.updateMatrixWorld(true);

  const exporter = new STLExporter();
  const isBinary = config.stlFormat === 'binary';
  const result = exporter.parse(mesh, { binary: isBinary });

  const triangleCount = geometry.index
    ? Math.floor(geometry.index.count / 3)
    : Math.floor(geometry.attributes.position.count / 3);

  let blob: Blob;
  if (isBinary) {
    const view = result as DataView;
    const bytes = new Uint8Array(view.byteLength);
    bytes.set(new Uint8Array(view.buffer, view.byteOffset, view.byteLength));
    blob = new Blob([bytes.buffer], { type: 'application/octet-stream' });
  } else {
    blob = new Blob([result as string], { type: 'text/plain;charset=utf-8' });
  }

  const shapeLabel = computed.shape === 'circle' ? 'circle' : 'rect';
  const filename = `universal_plate_${shapeLabel}_${config.cols}x${config.rows}_p${config.pitch}_t${config.thickness}.stl`;

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);

  window.setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1500);

  geometry.dispose();

  return {
    filename,
    sizeBytes: blob.size,
    triangleCount,
    format: config.stlFormat,
    timestamp: Date.now(),
  };
}
