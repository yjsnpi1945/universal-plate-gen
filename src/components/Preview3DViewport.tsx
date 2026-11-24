import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { ChevronDown, ChevronUp, Grid3x3, AlertCircle } from 'lucide-react';
import type { ComputedPlate, MaterialFinish, PlateConfig } from '../types/plate';
import { createPlateExtrudeGeometry } from '../utils/stlBuilder';

interface Preview3DViewportProps {
  config: PlateConfig;
  computed: ComputedPlate;
}

type CameraPreset = 'iso' | 'top' | 'front' | 'side';

const _targetPos = new THREE.Vector3();
const _targetLookAt = new THREE.Vector3();

function detectSoftwareWebGL(): boolean {
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

function createContactShadowTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(
    size / 2,
    size / 2,
    size * 0.08,
    size / 2,
    size / 2,
    size * 0.5,
  );
  grad.addColorStop(0, 'rgba(15, 23, 42, 0.24)');
  grad.addColorStop(0.55, 'rgba(15, 23, 42, 0.09)');
  grad.addColorStop(1, 'rgba(15, 23, 42, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function getMaterialParams(finish: MaterialFinish) {
  switch (finish) {
    case 'aluminum':
      return { color: 0xd4dce6, roughness: 0.26, metalness: 0.82, edgeColor: 0x475569 };
    case 'matte-dark':
      return { color: 0x262d3a, roughness: 0.62, metalness: 0.08, edgeColor: 0x64748b };
    case 'pla-light':
    default:
      return { color: 0xe8edf4, roughness: 0.44, metalness: 0.06, edgeColor: 0x64748b };
  }
}

export const Preview3DViewport: React.FC<Preview3DViewportProps> = ({
  config,
  computed,
}) => {
  const canvasMountRef = useRef<HTMLDivElement>(null);
  const [finish, setFinish] = useState<MaterialFinish>('pla-light');
  const [wireframe, setWireframe] = useState(false);
  const [dockOpen, setDockOpen] = useState(true);
  const [webglError, setWebglError] = useState<string | null>(null);
  const [triangleCount, setTriangleCount] = useState<number>(0);

  const sceneRef = useRef<{
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    controls: OrbitControls;
    plateGroup: THREE.Group;
    plateMesh: THREE.Mesh | null;
    edgeLines: THREE.LineSegments | null;
    material: THREE.MeshStandardMaterial;
    edgeMaterial: THREE.LineBasicMaterial;
    shadowPlane: THREE.Mesh;
    keyLight: THREE.DirectionalLight;
    isSoftwareGl: boolean;
    requestRender: () => void;
    transitionTarget: {
      active: boolean;
      pos: THREE.Vector3;
      lookAt: THREE.Vector3;
    };
  } | null>(null);

  const maxDimRef = useRef(Math.max(computed.width, computed.height, 40));
  maxDimRef.current = Math.max(computed.width, computed.height, 30);

  useEffect(() => {
    const container = canvasMountRef.current;
    if (!container) return;

    const isSoftwareGl = detectSoftwareWebGL();
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        powerPreference: 'high-performance',
      });
    } catch {
      setWebglError('WebGLの初期化に失敗しました。ブラウザの3D描画設定をご確認ください。');
      return;
    }

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const width = Math.max(1, container.clientWidth);
    const height = Math.max(1, container.clientHeight);
    renderer.setSize(width, height);
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf1f5f9);
    scene.fog = new THREE.Fog(0xf1f5f9, 260, 900);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envTarget = pmremGenerator.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = envTarget.texture;
    pmremGenerator.dispose();

    const camera = new THREE.PerspectiveCamera(40, width / height, 0.5, 2000);
    const initialDist = Math.max(85, maxDimRef.current * 1.45);
    camera.position.set(initialDist * 0.72, initialDist * 0.68, initialDist * 0.82);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.08;
    controls.maxPolarAngle = Math.PI * 0.495;
    controls.minDistance = 12;
    controls.maxDistance = 800;
    controls.target.set(0, 1.5, 0);

    const hemiLight = new THREE.HemisphereLight(0xf0f6ff, 0xdbe3ee, 0.85);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff7ed, 1.35);
    keyLight.position.set(70, 120, 80);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0xdbeafe, 0.55);
    rimLight.position.set(-80, 60, -70);
    scene.add(rimLight);

    const gridHelper = new THREE.GridHelper(300, 30, 0x94a3b8, 0xcbd5e1);
    gridHelper.position.y = -0.04;
    const gridMat = gridHelper.material;
    if (Array.isArray(gridMat)) {
      gridMat.forEach((m) => {
        m.transparent = true;
        m.opacity = 0.55;
      });
    } else {
      gridMat.transparent = true;
      gridMat.opacity = 0.55;
    }
    scene.add(gridHelper);

    const shadowTex = createContactShadowTexture();
    const shadowPlaneGeo = new THREE.PlaneGeometry(1, 1);
    const shadowPlaneMat = new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.6,
    });
    const shadowPlane = new THREE.Mesh(shadowPlaneGeo, shadowPlaneMat);
    shadowPlane.rotation.x = -Math.PI / 2;
    shadowPlane.position.y = -0.02;
    scene.add(shadowPlane);

    const plateGroup = new THREE.Group();
    scene.add(plateGroup);

    const initParams = getMaterialParams('pla-light');
    const material = new THREE.MeshStandardMaterial({
      color: initParams.color,
      roughness: initParams.roughness,
      metalness: initParams.metalness,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
    });

    const edgeMaterial = new THREE.LineBasicMaterial({
      color: initParams.edgeColor,
      transparent: true,
      opacity: 0.48,
    });

    const transitionTarget = {
      active: false,
      pos: new THREE.Vector3(),
      lookAt: new THREE.Vector3(),
    };

    let frameId = 0;
    let renderBusy = false;
    let renderDirty = false;
    let disposed = false;
    let lastTime = performance.now();

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync ? gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0) : null;
      if (!sync) {
        frameId = window.setTimeout(cb, 80);
        return;
      }
      gl.flush();
      const poll = () => {
        if (disposed) {
          gl.deleteSync(sync);
          return;
        }
        const state = gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    function requestRender() {
      if (disposed) return;
      if (renderBusy) {
        renderDirty = true;
        return;
      }
      renderBusy = true;
      frameId = requestAnimationFrame((now) => {
        if (disposed) return;
        const dt = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
        lastTime = now;
        renderDirty = false;

        let needsMoreFrames = false;

        if (transitionTarget.active) {
          if (isSoftwareGl) {
            camera.position.copy(transitionTarget.pos);
            controls.target.copy(transitionTarget.lookAt);
            transitionTarget.active = false;
          } else {
            const lambda = 9;
            camera.position.set(
              THREE.MathUtils.damp(camera.position.x, transitionTarget.pos.x, lambda, dt),
              THREE.MathUtils.damp(camera.position.y, transitionTarget.pos.y, lambda, dt),
              THREE.MathUtils.damp(camera.position.z, transitionTarget.pos.z, lambda, dt),
            );
            controls.target.set(
              THREE.MathUtils.damp(controls.target.x, transitionTarget.lookAt.x, lambda, dt),
              THREE.MathUtils.damp(controls.target.y, transitionTarget.lookAt.y, lambda, dt),
              THREE.MathUtils.damp(controls.target.z, transitionTarget.lookAt.z, lambda, dt),
            );
            if (
              camera.position.distanceTo(transitionTarget.pos) < 0.08 &&
              controls.target.distanceTo(transitionTarget.lookAt) < 0.05
            ) {
              camera.position.copy(transitionTarget.pos);
              controls.target.copy(transitionTarget.lookAt);
              transitionTarget.active = false;
            } else {
              needsMoreFrames = true;
            }
          }
        }

        const controlsChanged = controls.update();
        if (controlsChanged && controls.enableDamping) {
          needsMoreFrames = true;
        }

        renderer.render(scene, camera);

        const done = () => {
          renderBusy = false;
          if (!disposed && (renderDirty || needsMoreFrames)) {
            requestRender();
          }
        };

        if (isSoftwareGl) afterDraw(done);
        else done();
      });
    }

    const handleControlsStart = () => {
      transitionTarget.active = false;
    };
    const handleControlsChange = () => requestRender();
    controls.addEventListener('start', handleControlsStart);
    controls.addEventListener('change', handleControlsChange);

    const handleContextLost = (e: Event) => {
      e.preventDefault();
      setWebglError('3D描画コンテキストが一時中断されました。');
    };
    const handleContextRestored = () => {
      setWebglError(null);
      requestRender();
    };
    renderer.domElement.addEventListener('webglcontextlost', handleContextLost);
    renderer.domElement.addEventListener('webglcontextrestored', handleContextRestored);

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry || disposed) return;
      const w = Math.max(1, Math.floor(entry.contentRect.width));
      const h = Math.max(1, Math.floor(entry.contentRect.height));
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      requestRender();
    });
    resizeObserver.observe(container);

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    sceneRef.current = {
      scene,
      camera,
      renderer,
      controls,
      plateGroup,
      plateMesh: null,
      edgeLines: null,
      material,
      edgeMaterial,
      shadowPlane,
      keyLight,
      isSoftwareGl,
      requestRender,
      transitionTarget,
    };

    requestRender();

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      resizeObserver.disconnect();
      controls.removeEventListener('start', handleControlsStart);
      controls.removeEventListener('change', handleControlsChange);
      controls.dispose();
      renderer.domElement.removeEventListener('webglcontextlost', handleContextLost);
      renderer.domElement.removeEventListener('webglcontextrestored', handleContextRestored);

      const cur = sceneRef.current;
      if (cur?.plateMesh) cur.plateMesh.geometry.dispose();
      if (cur?.edgeLines) cur.edgeLines.geometry.dispose();
      material.dispose();
      edgeMaterial.dispose();
      shadowPlaneGeo.dispose();
      shadowPlaneMat.dispose();
      shadowTex.dispose();
      gridHelper.geometry.dispose();
      if (Array.isArray(gridHelper.material)) {
        gridHelper.material.forEach((m) => m.dispose());
      } else {
        gridHelper.material.dispose();
      }
      envTarget.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
      sceneRef.current = null;
    };
  }, []);

  useEffect(() => {
    const ctx = sceneRef.current;
    if (!ctx) return;

    if (ctx.plateMesh) {
      ctx.plateGroup.remove(ctx.plateMesh);
      ctx.plateMesh.geometry.dispose();
      ctx.plateMesh = null;
    }
    if (ctx.edgeLines) {
      ctx.plateGroup.remove(ctx.edgeLines);
      ctx.edgeLines.geometry.dispose();
      ctx.edgeLines = null;
    }

    const geometry = createPlateExtrudeGeometry(computed, config.curveSegments);
    geometry.rotateX(-Math.PI / 2);
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();

    const tris = geometry.index
      ? Math.floor(geometry.index.count / 3)
      : Math.floor(geometry.attributes.position.count / 3);
    setTriangleCount(tris);

    const mesh = new THREE.Mesh(geometry, ctx.material);
    mesh.castShadow = !ctx.isSoftwareGl;
    mesh.receiveShadow = !ctx.isSoftwareGl;
    ctx.plateGroup.add(mesh);
    ctx.plateMesh = mesh;

    const edgeGeo = new THREE.EdgesGeometry(geometry, 25);
    const edgeLines = new THREE.LineSegments(edgeGeo, ctx.edgeMaterial);
    ctx.plateGroup.add(edgeLines);
    ctx.edgeLines = edgeLines;

    ctx.shadowPlane.scale.set(computed.width * 1.45, computed.height * 1.45, 1);

    const bound = Math.max(computed.width, computed.height, 40) * 0.85;
    ctx.keyLight.shadow.camera.left = -bound;
    ctx.keyLight.shadow.camera.right = bound;
    ctx.keyLight.shadow.camera.top = bound;
    ctx.keyLight.shadow.camera.bottom = -bound;
    ctx.keyLight.shadow.camera.updateProjectionMatrix();

    ctx.requestRender();
  }, [computed, config.curveSegments]);

  useEffect(() => {
    const ctx = sceneRef.current;
    if (!ctx) return;
    const params = getMaterialParams(finish);
    ctx.material.color.setHex(params.color);
    ctx.material.roughness = params.roughness;
    ctx.material.metalness = params.metalness;
    ctx.material.wireframe = wireframe;
    ctx.material.needsUpdate = true;

    ctx.edgeMaterial.color.setHex(params.edgeColor);
    ctx.edgeMaterial.opacity = wireframe ? 0.15 : 0.48;
    ctx.edgeMaterial.needsUpdate = true;

    ctx.requestRender();
  }, [finish, wireframe]);

  const applyCameraPreset = (preset: CameraPreset) => {
    const ctx = sceneRef.current;
    if (!ctx) return;
    const span = Math.max(computed.width, computed.height, 30);
    const dist = span * 1.45;
    const midY = computed.effectiveThickness / 2;

    _targetLookAt.set(0, midY, 0);
    switch (preset) {
      case 'top':
        _targetPos.set(0, dist * 1.15, 0.01);
        break;
      case 'front':
        _targetPos.set(0, midY + dist * 0.18, dist * 1.12);
        break;
      case 'side':
        _targetPos.set(dist * 1.12, midY + dist * 0.18, 0);
        break;
      case 'iso':
      default:
        _targetPos.set(dist * 0.72, dist * 0.68, dist * 0.82);
        break;
    }

    ctx.transitionTarget.pos.copy(_targetPos);
    ctx.transitionTarget.lookAt.copy(_targetLookAt);
    ctx.transitionTarget.active = true;
    ctx.requestRender();
  };

  return (
    <div className="relative w-full h-full bg-slate-100 overflow-hidden select-none">
      <div ref={canvasMountRef} className="w-full h-full" />

      {webglError && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-100 p-6 z-20">
          <div className="max-w-sm bg-white border border-slate-200 rounded-lg p-5 text-center space-y-2">
            <AlertCircle className="w-6 h-6 text-red-600 mx-auto" />
            <p className="text-sm font-medium text-slate-900">{webglError}</p>
          </div>
        </div>
      )}

      <div className="pointer-events-none absolute top-4 left-5 z-10 flex items-center gap-3 text-xs text-slate-600">
        <span>ドラッグで回転 · 右ドラッグで移動 · ホイールで拡大縮小</span>
        <span aria-hidden="true" className="text-slate-300">·</span>
        <span className="font-mono tabular-nums text-slate-500">
          {triangleCount.toLocaleString()} 三角形
        </span>
      </div>

      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center max-w-[95%]">
        <button
          type="button"
          onClick={() => setDockOpen((prev) => !prev)}
          className="mb-1.5 px-3 py-1 rounded-md bg-white border border-slate-200 text-[11px] font-medium text-slate-600 hover:text-slate-900 shadow-xs flex items-center gap-1 cursor-pointer transition-colors"
        >
          {dockOpen ? (
            <>
              <ChevronDown className="w-3.5 h-3.5" />
              コントロールを隠す
            </>
          ) : (
            <>
              <ChevronUp className="w-3.5 h-3.5" />
              コントロールを表示
            </>
          )}
        </button>

        {dockOpen && (
          <div className="bg-white border border-slate-200 rounded-lg shadow-sm px-2.5 py-1.5 flex items-center gap-1.5 overflow-x-auto">
            <div className="flex items-center gap-0.5 shrink-0">
              {(
                [
                  ['iso', 'アイソメ'],
                  ['top', '上面'],
                  ['front', '正面'],
                  ['side', '側面'],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => applyCameraPreset(id)}
                  className="h-8 px-2.5 rounded-md text-xs font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900 whitespace-nowrap cursor-pointer transition-colors"
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="w-px h-5 bg-slate-200 mx-0.5 shrink-0" />

            <div className="flex items-center gap-1 shrink-0">
              {(
                [
                  ['pla-light', 'PLA白', 'bg-slate-200 border-slate-400'],
                  ['aluminum', 'アルミ', 'bg-slate-300 border-slate-500'],
                  ['matte-dark', 'マット黒', 'bg-slate-800 border-slate-900'],
                ] as const
              ).map(([id, label, swatchClass]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setFinish(id)}
                  className={`h-8 px-2.5 rounded-md text-xs font-medium flex items-center gap-1.5 whitespace-nowrap cursor-pointer transition-colors ${
                    finish === id ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <span aria-hidden="true" className={`w-2.5 h-2.5 rounded-full border ${swatchClass}`} />
                  {label}
                </button>
              ))}
            </div>

            <div className="w-px h-5 bg-slate-200 mx-0.5 shrink-0" />

            <button
              type="button"
              onClick={() => setWireframe((prev) => !prev)}
              className={`h-8 px-2.5 rounded-md text-xs font-medium flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                wireframe ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Grid3x3 className="w-3.5 h-3.5" />
              メッシュ線
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
