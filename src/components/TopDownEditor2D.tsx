import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Undo2,
  Redo2,
  RotateCcw,
  RefreshCw,
  SquareDashed,
  Trash2,
  Ruler,
  ZoomIn,
  ZoomOut,
  Maximize2,
} from 'lucide-react';
import type { ComputedPlate, HolePoint, PlateConfig } from '../types/plate';
import { formatMm } from '../utils/plateMath';

interface TopDownEditor2DProps {
  config: PlateConfig;
  computed: ComputedPlate;
  canUndo: boolean;
  canRedo: boolean;
  onBeginBatchPaint: () => void;
  onSetHoleRemoved: (key: string, removed: boolean) => void;
  onEndBatchPaint: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onRestoreAll: () => void;
  onInvertHoles: () => void;
  onKeepPerimeterOnly: () => void;
  onRemoveAll: () => void;
}

export const TopDownEditor2D: React.FC<TopDownEditor2DProps> = ({
  config,
  computed,
  canUndo,
  canRedo,
  onBeginBatchPaint,
  onSetHoleRemoved,
  onEndBatchPaint,
  onUndo,
  onRedo,
  onRestoreAll,
  onInvertHoles,
  onKeepPerimeterOnly,
  onRemoveAll,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [showDimensions, setShowDimensions] = useState(true);
  const [hoveredHole, setHoveredHole] = useState<HolePoint | null>(null);

  const paintModeRef = useRef<'remove' | 'restore' | null>(null);
  const panStateRef = useRef({
    active: false,
    startClientX: 0,
    startClientY: 0,
    startPanX: 0,
    startPanY: 0,
  });
  const [isPanning, setIsPanning] = useState(false);

  const baseExtent = useMemo(() => {
    const dimMargin = Math.max(computed.width, computed.height) * 0.28 + 14;
    const vw = computed.width + dimMargin * 2;
    const vh = computed.height + dimMargin * 2;
    return { vw, vh, maxSpan: Math.max(vw, vh) };
  }, [computed.width, computed.height]);

  const viewBox = useMemo(() => {
    const w = baseExtent.vw / zoom;
    const h = baseExtent.vh / zoom;
    const x = -w / 2 - pan.x;
    const y = -h / 2 - pan.y;
    return `${x} ${y} ${w} ${h}`;
  }, [baseExtent.vw, baseExtent.vh, zoom, pan.x, pan.y]);

  const unitScale = useMemo(() => baseExtent.maxSpan / (700 * zoom), [baseExtent.maxSpan, zoom]);

  const resetView = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  useEffect(() => {
    const handlePointerUp = () => {
      if (paintModeRef.current !== null) {
        paintModeRef.current = null;
        onEndBatchPaint();
      }
      if (panStateRef.current.active) {
        panStateRef.current.active = false;
        setIsPanning(false);
      }
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (!panStateRef.current.active || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const visibleW = baseExtent.vw / zoom;
      const visibleH = baseExtent.vh / zoom;
      const pxToMm = Math.max(visibleW / rect.width, visibleH / rect.height);
      const dx = (e.clientX - panStateRef.current.startClientX) * pxToMm;
      const dy = (e.clientY - panStateRef.current.startClientY) * pxToMm;
      setPan({
        x: panStateRef.current.startPanX + dx,
        y: panStateRef.current.startPanY + dy,
      });
    };

    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointermove', handlePointerMove);
    return () => {
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointermove', handlePointerMove);
    };
  }, [baseExtent.vh, baseExtent.vw, onEndBatchPaint, zoom]);

  const handleWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
    setZoom((prev) => Math.min(4.5, Math.max(0.4, Number((prev * factor).toFixed(3)))));
  }, []);

  const handleBackgroundPointerDown = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (e.button !== 0 && e.button !== 1) return;
      panStateRef.current = {
        active: true,
        startClientX: e.clientX,
        startClientY: e.clientY,
        startPanX: pan.x,
        startPanY: pan.y,
      };
      setIsPanning(true);
    },
    [pan.x, pan.y],
  );

  const handleHolePointerDown = useCallback(
    (e: React.PointerEvent, hole: HolePoint) => {
      if (e.button !== 0) return;
      e.stopPropagation();
      const nextRemoved = !hole.removed;
      paintModeRef.current = nextRemoved ? 'remove' : 'restore';
      onBeginBatchPaint();
      onSetHoleRemoved(hole.key, nextRemoved);
    },
    [onBeginBatchPaint, onSetHoleRemoved],
  );

  const handleHolePointerEnter = useCallback(
    (hole: HolePoint) => {
      setHoveredHole(hole);
      if (paintModeRef.current !== null) {
        onSetHoleRemoved(hole.key, paintModeRef.current === 'remove');
      }
    },
    [onSetHoleRemoved],
  );

  const handleHoleKeyDown = useCallback(
    (e: React.KeyboardEvent, hole: HolePoint) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onBeginBatchPaint();
        onSetHoleRemoved(hole.key, !hole.removed);
        onEndBatchPaint();
      }
    },
    [onBeginBatchPaint, onEndBatchPaint, onSetHoleRemoved],
  );

  const holeRadius = computed.effectiveHoleDiameter / 2;
  const dimOffset = Math.max(computed.width, computed.height) * 0.08 + 5;
  const arrowSize = Math.max(1.2, unitScale * 7);
  const dimFontSize = Math.max(2.0, unitScale * 11.5);
  const thinStroke = Math.max(0.12, unitScale * 1.0);
  const plateStroke = Math.max(0.2, unitScale * 1.7);

  return (
    <div
      ref={containerRef}
      onWheel={handleWheel}
      className="relative w-full h-full cad-grid-bg overflow-hidden select-none flex flex-col"
    >
      <div className="pointer-events-none absolute top-4 left-5 z-10 flex items-center gap-3 text-xs text-slate-600">
        <span>穴をクリック・ドラッグで消去 / 復元</span>
        <span aria-hidden="true" className="text-slate-300">·</span>
        <span className="hidden sm:inline text-slate-500">
          背景ドラッグで移動 / ホイールで拡大縮小
        </span>
      </div>

      <svg
        viewBox={viewBox}
        onPointerDown={handleBackgroundPointerDown}
        className={`w-full h-full flex-1 ${isPanning ? 'cursor-grabbing' : 'cursor-grab'}`}
        role="img"
        aria-label="ユニバーサルプレートの上面2D完成予想図"
      >
        <defs>
          <filter id="plate-shadow" x="-12%" y="-12%" width="124%" height="124%">
            <feDropShadow
              dx="0"
              dy={unitScale * 4}
              stdDeviation={unitScale * 5}
              floodColor="#0f172a"
              floodOpacity="0.11"
            />
          </filter>
        </defs>

        <g stroke="#cbd5e1" strokeWidth={thinStroke} strokeDasharray={`${unitScale * 6} ${unitScale * 4}`}>
          <line
            x1={-computed.width / 2 - dimOffset * 0.65}
            y1={0}
            x2={computed.width / 2 + dimOffset * 0.65}
            y2={0}
          />
          <line
            x1={0}
            y1={-computed.height / 2 - dimOffset * 0.65}
            x2={0}
            y2={computed.height / 2 + dimOffset * 0.65}
          />
        </g>

        <g filter="url(#plate-shadow)">
          {computed.shape === 'circle' ? (
            <circle
              cx={0}
              cy={0}
              r={computed.radius}
              fill="#ffffff"
              stroke="#1e293b"
              strokeWidth={plateStroke}
            />
          ) : (
            <rect
              x={-computed.width / 2}
              y={-computed.height / 2}
              width={computed.width}
              height={computed.height}
              rx={computed.cornerRadius}
              ry={computed.cornerRadius}
              fill="#ffffff"
              stroke="#1e293b"
              strokeWidth={plateStroke}
            />
          )}
        </g>

        {computed.shape === 'circle' ? (
          <circle
            cx={0}
            cy={0}
            r={Math.max(0.5, computed.radius - plateStroke * 1.4)}
            fill="none"
            stroke="#e2e8f0"
            strokeWidth={thinStroke * 0.8}
          />
        ) : (
          <rect
            x={-computed.width / 2 + plateStroke * 1.4}
            y={-computed.height / 2 + plateStroke * 1.4}
            width={Math.max(1, computed.width - plateStroke * 2.8)}
            height={Math.max(1, computed.height - plateStroke * 2.8)}
            rx={Math.max(0, computed.cornerRadius - plateStroke * 1.2)}
            ry={Math.max(0, computed.cornerRadius - plateStroke * 1.2)}
            fill="none"
            stroke="#f1f5f9"
            strokeWidth={thinStroke * 0.8}
          />
        )}

        <g>
          {computed.holes.map((hole) => {
            const isHovered = hoveredHole?.key === hole.key;
            const hitRadius = Math.max(
              holeRadius * 1.15,
              Math.min(config.pitch * 0.46, holeRadius + unitScale * 4),
            );

            return (
              <g
                key={hole.key}
                transform={`translate(${hole.x}, ${hole.y})`}
                onPointerDown={(e) => handleHolePointerDown(e, hole)}
                onPointerEnter={() => handleHolePointerEnter(hole)}
                onPointerLeave={() =>
                  setHoveredHole((cur) => (cur?.key === hole.key ? null : cur))
                }
                onKeyDown={(e) => handleHoleKeyDown(e, hole)}
                tabIndex={0}
                role="button"
                aria-pressed={!hole.removed}
                aria-label={`行${hole.row + 1} 列${hole.col + 1} の穴（${
                  hole.removed ? '消去済み・クリックで復元' : '有効・クリックで消去'
                }）`}
                className="cursor-pointer focus:outline-none"
              >
                <circle r={hitRadius} fill="transparent" />

                {hole.removed ? (
                  <>
                    <circle
                      r={holeRadius}
                      fill={isHovered ? 'rgba(37, 99, 235, 0.12)' : 'rgba(241, 245, 249, 0.4)'}
                      stroke={isHovered ? '#2563eb' : '#cbd5e1'}
                      strokeWidth={isHovered ? thinStroke * 1.6 : thinStroke}
                      strokeDasharray={`${Math.max(0.4, holeRadius * 0.55)} ${Math.max(0.35, holeRadius * 0.42)}`}
                    />
                    {isHovered && (
                      <g stroke="#2563eb" strokeWidth={thinStroke * 1.5} strokeLinecap="round">
                        <line x1={-holeRadius * 0.45} y1={0} x2={holeRadius * 0.45} y2={0} />
                        <line x1={0} y1={-holeRadius * 0.45} x2={0} y2={holeRadius * 0.45} />
                      </g>
                    )}
                  </>
                ) : (
                  <>
                    <circle
                      r={holeRadius}
                      fill={isHovered ? '#fee2e2' : '#e2e8f0'}
                      stroke={isHovered ? '#dc2626' : '#334155'}
                      strokeWidth={isHovered ? thinStroke * 1.8 : thinStroke * 1.25}
                    />
                    {!isHovered && holeRadius >= 0.8 && (
                      <g stroke="#94a3b8" strokeWidth={thinStroke * 0.65} opacity={0.65}>
                        <line x1={-holeRadius * 0.32} y1={0} x2={holeRadius * 0.32} y2={0} />
                        <line x1={0} y1={-holeRadius * 0.32} x2={0} y2={holeRadius * 0.32} />
                      </g>
                    )}
                    {isHovered && (
                      <g stroke="#dc2626" strokeWidth={thinStroke * 1.5} strokeLinecap="round">
                        <line
                          x1={-holeRadius * 0.4}
                          y1={-holeRadius * 0.4}
                          x2={holeRadius * 0.4}
                          y2={holeRadius * 0.4}
                        />
                        <line
                          x1={holeRadius * 0.4}
                          y1={-holeRadius * 0.4}
                          x2={-holeRadius * 0.4}
                          y2={holeRadius * 0.4}
                        />
                      </g>
                    )}
                  </>
                )}
              </g>
            );
          })}
        </g>

        {showDimensions && (
          <g className="pointer-events-none" fill="#1d4ed8" stroke="#2563eb" strokeWidth={thinStroke}>
            {computed.shape === 'rectangle' ? (
              <>
                <line
                  x1={-computed.width / 2}
                  y1={-computed.height / 2 - dimOffset * 0.2}
                  x2={-computed.width / 2}
                  y2={-computed.height / 2 - dimOffset * 1.15}
                  stroke="#93c5fd"
                />
                <line
                  x1={computed.width / 2}
                  y1={-computed.height / 2 - dimOffset * 0.2}
                  x2={computed.width / 2}
                  y2={-computed.height / 2 - dimOffset * 1.15}
                  stroke="#93c5fd"
                />
                <line
                  x1={-computed.width / 2}
                  y1={-computed.height / 2 - dimOffset * 0.85}
                  x2={computed.width / 2}
                  y2={-computed.height / 2 - dimOffset * 0.85}
                />
                <polygon
                  points={`${-computed.width / 2},${-computed.height / 2 - dimOffset * 0.85} ${-computed.width / 2 + arrowSize},${-computed.height / 2 - dimOffset * 0.85 - arrowSize * 0.4} ${-computed.width / 2 + arrowSize},${-computed.height / 2 - dimOffset * 0.85 + arrowSize * 0.4}`}
                  stroke="none"
                />
                <polygon
                  points={`${computed.width / 2},${-computed.height / 2 - dimOffset * 0.85} ${computed.width / 2 - arrowSize},${-computed.height / 2 - dimOffset * 0.85 - arrowSize * 0.4} ${computed.width / 2 - arrowSize},${-computed.height / 2 - dimOffset * 0.85 + arrowSize * 0.4}`}
                  stroke="none"
                />
                <text
                  x={0}
                  y={-computed.height / 2 - dimOffset * 1.08}
                  textAnchor="middle"
                  stroke="none"
                  fontSize={dimFontSize}
                  fontFamily="JetBrains Mono, monospace"
                  fontWeight={500}
                >
                  {formatMm(computed.width)} mm
                </text>

                <line
                  x1={-computed.width / 2 - dimOffset * 0.2}
                  y1={-computed.height / 2}
                  x2={-computed.width / 2 - dimOffset * 1.15}
                  y2={-computed.height / 2}
                  stroke="#93c5fd"
                />
                <line
                  x1={-computed.width / 2 - dimOffset * 0.2}
                  y1={computed.height / 2}
                  x2={-computed.width / 2 - dimOffset * 1.15}
                  y2={computed.height / 2}
                  stroke="#93c5fd"
                />
                <line
                  x1={-computed.width / 2 - dimOffset * 0.85}
                  y1={-computed.height / 2}
                  x2={-computed.width / 2 - dimOffset * 0.85}
                  y2={computed.height / 2}
                />
                <polygon
                  points={`${-computed.width / 2 - dimOffset * 0.85},${-computed.height / 2} ${-computed.width / 2 - dimOffset * 0.85 - arrowSize * 0.4},${-computed.height / 2 + arrowSize} ${-computed.width / 2 - dimOffset * 0.85 + arrowSize * 0.4},${-computed.height / 2 + arrowSize}`}
                  stroke="none"
                />
                <polygon
                  points={`${-computed.width / 2 - dimOffset * 0.85},${computed.height / 2} ${-computed.width / 2 - dimOffset * 0.85 - arrowSize * 0.4},${computed.height / 2 - arrowSize} ${-computed.width / 2 - dimOffset * 0.85 + arrowSize * 0.4},${computed.height / 2 - arrowSize}`}
                  stroke="none"
                />
                <text
                  x={-computed.width / 2 - dimOffset * 1.15}
                  y={0}
                  textAnchor="middle"
                  stroke="none"
                  fontSize={dimFontSize}
                  fontFamily="JetBrains Mono, monospace"
                  fontWeight={500}
                  transform={`rotate(-90 ${-computed.width / 2 - dimOffset * 1.15} 0)`}
                >
                  {formatMm(computed.height)} mm
                </text>
              </>
            ) : (
              <>
                <line
                  x1={-computed.radius}
                  y1={-computed.radius * 0.1}
                  x2={-computed.radius}
                  y2={-computed.radius - dimOffset * 1.1}
                  stroke="#93c5fd"
                />
                <line
                  x1={computed.radius}
                  y1={-computed.radius * 0.1}
                  x2={computed.radius}
                  y2={-computed.radius - dimOffset * 1.1}
                  stroke="#93c5fd"
                />
                <line
                  x1={-computed.radius}
                  y1={-computed.radius - dimOffset * 0.85}
                  x2={computed.radius}
                  y2={-computed.radius - dimOffset * 0.85}
                />
                <polygon
                  points={`${-computed.radius},${-computed.radius - dimOffset * 0.85} ${-computed.radius + arrowSize},${-computed.radius - dimOffset * 0.85 - arrowSize * 0.4} ${-computed.radius + arrowSize},${-computed.radius - dimOffset * 0.85 + arrowSize * 0.4}`}
                  stroke="none"
                />
                <polygon
                  points={`${computed.radius},${-computed.radius - dimOffset * 0.85} ${computed.radius - arrowSize},${-computed.radius - dimOffset * 0.85 - arrowSize * 0.4} ${computed.radius - arrowSize},${-computed.radius - dimOffset * 0.85 + arrowSize * 0.4}`}
                  stroke="none"
                />
                <text
                  x={0}
                  y={-computed.radius - dimOffset * 1.08}
                  textAnchor="middle"
                  stroke="none"
                  fontSize={dimFontSize}
                  fontFamily="JetBrains Mono, monospace"
                  fontWeight={500}
                >
                  Ø {formatMm(computed.diameter)} mm
                </text>
              </>
            )}

            <text
              x={0}
              y={computed.height / 2 + dimOffset * 0.95}
              textAnchor="middle"
              stroke="none"
              fill="#475569"
              fontSize={dimFontSize * 0.88}
              fontFamily="JetBrains Mono, monospace"
            >
              PITCH {formatMm(config.pitch)} mm · HOLE Ø{formatMm(computed.effectiveHoleDiameter)} mm · THICKNESS {formatMm(computed.effectiveThickness)} mm
            </text>
          </g>
        )}
      </svg>

      <div className="pointer-events-none absolute bottom-[72px] left-5 z-10 text-[11px] font-mono tabular-nums text-slate-600">
        {hoveredHole ? (
          <span>
            行 {hoveredHole.row + 1} · 列 {hoveredHole.col + 1} · X{' '}
            {hoveredHole.x >= 0 ? '+' : ''}
            {hoveredHole.x.toFixed(1)} mm · Y {(-hoveredHole.y) >= 0 ? '+' : ''}
            {(-hoveredHole.y).toFixed(1)} mm ·{' '}
            <strong className={hoveredHole.removed ? 'text-blue-700 font-semibold' : 'text-red-700 font-semibold'}>
              {hoveredHole.removed ? 'クリックで復元' : 'クリックで消去'}
            </strong>
          </span>
        ) : (
          <span className="text-slate-400">
            表示倍率 {Math.round(zoom * 100)}% · 単位 mm
          </span>
        )}
      </div>

      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 max-w-[95%] bg-white border border-slate-200 rounded-lg shadow-sm px-2 py-1.5 flex items-center gap-1 overflow-x-auto">
        <button
          type="button"
          onClick={onUndo}
          disabled={!canUndo}
          title="元に戻す (Ctrl+Z)"
          className="h-8 px-2.5 rounded-md text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-35 disabled:pointer-events-none flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer transition-colors"
        >
          <Undo2 className="w-3.5 h-3.5" />
          <span className="hidden md:inline">戻す</span>
        </button>
        <button
          type="button"
          onClick={onRedo}
          disabled={!canRedo}
          title="やり直す (Ctrl+Y)"
          className="h-8 px-2.5 rounded-md text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-35 disabled:pointer-events-none flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer transition-colors"
        >
          <Redo2 className="w-3.5 h-3.5" />
          <span className="hidden md:inline">やり直し</span>
        </button>

        <div className="w-px h-5 bg-slate-200 mx-1 shrink-0" />

        <button
          type="button"
          onClick={onRestoreAll}
          disabled={computed.removedHoleCount === 0}
          className="h-8 px-2.5 rounded-md text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-35 disabled:pointer-events-none flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          全復元
        </button>
        <button
          type="button"
          onClick={onInvertHoles}
          disabled={computed.totalHoleCount === 0}
          className="h-8 px-2.5 rounded-md text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-35 disabled:pointer-events-none flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          反転
        </button>
        <button
          type="button"
          onClick={onKeepPerimeterOnly}
          disabled={computed.totalHoleCount <= 4}
          className="h-8 px-2.5 rounded-md text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-35 disabled:pointer-events-none flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer transition-colors"
        >
          <SquareDashed className="w-3.5 h-3.5" />
          外周のみ
        </button>
        <button
          type="button"
          onClick={onRemoveAll}
          disabled={computed.activeHoleCount === 0}
          className="h-8 px-2.5 rounded-md text-xs font-medium text-slate-700 hover:bg-red-50 hover:text-red-700 disabled:opacity-35 disabled:pointer-events-none flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
          全消去
        </button>

        <div className="w-px h-5 bg-slate-200 mx-1 shrink-0" />

        <button
          type="button"
          onClick={() => setShowDimensions((prev) => !prev)}
          className={`h-8 px-2.5 rounded-md text-xs font-medium flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
            showDimensions ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Ruler className="w-3.5 h-3.5" />
          寸法線
        </button>

        <div className="w-px h-5 bg-slate-200 mx-1 shrink-0" />

        <button
          type="button"
          onClick={() => setZoom((z) => Math.max(0.4, Number((z / 1.2).toFixed(2))))}
          aria-label="縮小"
          className="h-8 w-8 rounded-md text-slate-600 hover:bg-slate-100 hover:text-slate-900 flex items-center justify-center shrink-0 cursor-pointer transition-colors"
        >
          <ZoomOut className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={resetView}
          title="全体表示に戻す"
          className="h-8 px-2 rounded-md text-xs font-mono tabular-nums text-slate-700 hover:bg-slate-100 flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer transition-colors"
        >
          <Maximize2 className="w-3 h-3" />
          フィット
        </button>
        <button
          type="button"
          onClick={() => setZoom((z) => Math.min(4.5, Number((z * 1.2).toFixed(2))))}
          aria-label="拡大"
          className="h-8 w-8 rounded-md text-slate-600 hover:bg-slate-100 hover:text-slate-900 flex items-center justify-center shrink-0 cursor-pointer transition-colors"
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
