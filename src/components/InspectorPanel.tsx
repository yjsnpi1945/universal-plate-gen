import React from 'react';
import {
  AlertTriangle,
  Circle,
  Square,
  AlertCircle,
  Minus,
  Plus,
} from 'lucide-react';
import {
  PLATE_PRESETS,
  type ComputedPlate,
  type PlateConfig,
  type PlatePreset,
} from '../types/plate';
import { clampNumber, formatMm } from '../utils/plateMath';

interface InspectorPanelProps {
  config: PlateConfig;
  computed: ComputedPlate;
  activePresetId: string | null;
  onUpdateConfig: (patch: Partial<PlateConfig>) => void;
  onApplyPreset: (preset: PlatePreset) => void;
}

interface DimensionControlProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  disabled?: boolean;
  onChange: (next: number) => void;
}

function DimensionControl({
  label,
  value,
  min,
  max,
  step,
  unit = 'mm',
  disabled = false,
  onChange,
}: DimensionControlProps) {
  return (
    <div className={disabled ? 'opacity-45 pointer-events-none' : ''}>
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <label className="text-xs font-medium text-slate-700 whitespace-nowrap">
          {label}
        </label>
        <div className="flex items-center gap-1">
          <input
            type="number"
            value={Number(value.toFixed(2))}
            min={min}
            max={max}
            step={step}
            disabled={disabled}
            onChange={(e) => {
              const parsed = parseFloat(e.target.value);
              if (!Number.isNaN(parsed)) {
                onChange(clampNumber(parsed, min, max));
              }
            }}
            className="w-[72px] px-2 py-1 text-right text-xs font-mono tabular-nums text-slate-900 bg-slate-50 border border-slate-200 rounded focus:outline-none focus:border-blue-600 focus:bg-white transition-colors"
          />
          <span className="text-[11px] font-mono text-slate-400 w-6">
            {unit}
          </span>
        </div>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={clampNumber(value, min, max)}
        disabled={disabled}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full cad-slider"
      />
    </div>
  );
}

interface CountStepperProps {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (next: number) => void;
}

function CountStepper({
  label,
  value,
  min,
  max,
  onChange,
}: CountStepperProps) {
  return (
    <div className="flex-1 min-w-0">
      <label className="block text-xs font-medium text-slate-600 mb-1.5 whitespace-nowrap">
        {label}
      </label>
      <div className="flex items-center border border-slate-200 rounded-md bg-white overflow-hidden focus-within:border-blue-600">
        <button
          type="button"
          onClick={() => onChange(clampNumber(value - 1, min, max))}
          disabled={value <= min}
          aria-label={`${label}を減らす`}
          className="h-9 w-8 flex items-center justify-center text-slate-500 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-35 transition-colors shrink-0 cursor-pointer"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>
        <input
          type="number"
          min={min}
          max={max}
          step={1}
          value={value}
          onChange={(e) => {
            const parsed = parseInt(e.target.value, 10);
            if (!Number.isNaN(parsed)) {
              onChange(clampNumber(parsed, min, max));
            }
          }}
          className="w-full h-9 text-center text-sm font-mono font-medium tabular-nums text-slate-900 bg-transparent focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
        <button
          type="button"
          onClick={() => onChange(clampNumber(value + 1, min, max))}
          disabled={value >= max}
          aria-label={`${label}を増やす`}
          className="h-9 w-8 flex items-center justify-center text-slate-500 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-35 transition-colors shrink-0 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

export const InspectorPanel: React.FC<InspectorPanelProps> = ({
  config,
  computed,
  activePresetId,
  onUpdateConfig,
  onApplyPreset,
}) => {
  const maxCornerRadius =
    config.shape === 'rectangle'
      ? Math.max(0, Number((Math.min(computed.width, computed.height) / 2 - 0.5).toFixed(1)))
      : 0;

  return (
    <aside className="w-full lg:w-[316px] shrink-0 bg-white border-b lg:border-b-0 lg:border-r border-slate-200 flex flex-col lg:h-full lg:overflow-y-auto">
      <section className="px-5 py-4 border-b border-slate-200">
        <div className="flex items-baseline justify-between mb-2.5">
          <h2 className="text-xs font-semibold text-slate-900 tracking-tight">
            規格プリセット
          </h2>
          <span className="text-[11px] text-slate-400">
            {activePresetId ? 'プリセット適用中' : 'カスタム寸法'}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {PLATE_PRESETS.map((preset) => {
            const isActive = activePresetId === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => onApplyPreset(preset)}
                className={`px-2 py-2 rounded-md border text-left transition-colors cursor-pointer ${
                  isActive
                    ? 'border-blue-600 bg-blue-50/70 text-blue-900'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <div className="text-[11px] font-semibold leading-tight truncate">
                  {preset.name}
                </div>
                <div className="text-[10px] font-mono tabular-nums text-slate-500 mt-0.5 truncate">
                  {preset.subtitle}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <section className="px-5 py-4 border-b border-slate-200 space-y-4">
        <div>
          <h2 className="text-xs font-semibold text-slate-900 mb-2.5">
            プレート形状
          </h2>
          <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-lg">
            <button
              type="button"
              onClick={() => onUpdateConfig({ shape: 'rectangle' })}
              className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-md text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                config.shape === 'rectangle'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Square className="w-3.5 h-3.5" />
              四角形
            </button>
            <button
              type="button"
              onClick={() => onUpdateConfig({ shape: 'circle' })}
              className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-md text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                config.shape === 'circle'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Circle className="w-3.5 h-3.5" />
              円形（格子配置）
            </button>
          </div>
        </div>

        <div>
          <div className="flex items-baseline justify-between mb-2">
            <h2 className="text-xs font-semibold text-slate-900">
              縦横の穴数
            </h2>
            <span className="text-[11px] font-mono tabular-nums text-slate-500">
              配置 {computed.totalHoleCount}穴 · 有効 {computed.activeHoleCount}穴
            </span>
          </div>
          <div className="flex items-center gap-3">
            <CountStepper
              label="横の穴数 (X)"
              value={config.cols}
              min={1}
              max={40}
              onChange={(cols) => onUpdateConfig({ cols })}
            />
            <CountStepper
              label="縦の穴数 (Y)"
              value={config.rows}
              min={1}
              max={40}
              onChange={(rows) => onUpdateConfig({ rows })}
            />
          </div>
          {config.shape === 'circle' && (
            <p className="text-[11px] text-slate-500 mt-2 leading-relaxed">
              直径 {formatMm(computed.diameter)} mm の円内に収まる格子穴を自動配置します。
            </p>
          )}
        </div>
      </section>

      <section className="px-5 py-4 border-b border-slate-200 space-y-3.5">
        <h2 className="text-xs font-semibold text-slate-900">
          詳細寸法 (mm)
        </h2>

        <DimensionControl
          label="穴ピッチ（中心間隔）"
          value={config.pitch}
          min={2.0}
          max={25.0}
          step={0.02}
          onChange={(pitch) => onUpdateConfig({ pitch })}
        />

        <DimensionControl
          label="穴の直径 (φ)"
          value={config.holeDiameter}
          min={0.6}
          max={15.0}
          step={0.1}
          onChange={(holeDiameter) => onUpdateConfig({ holeDiameter })}
        />

        <DimensionControl
          label="板厚 (Z)"
          value={config.thickness}
          min={0.6}
          max={20.0}
          step={0.2}
          onChange={(thickness) => onUpdateConfig({ thickness })}
        />

        <DimensionControl
          label="外周余白（穴中心〜端）"
          value={config.margin}
          min={1.2}
          max={25.0}
          step={0.1}
          onChange={(margin) => onUpdateConfig({ margin })}
        />

        <DimensionControl
          label="角丸半径 (R)"
          value={config.shape === 'rectangle' ? config.cornerRadius : 0}
          min={0}
          max={Math.max(10, Math.min(25, maxCornerRadius))}
          step={0.5}
          disabled={config.shape === 'circle'}
          onChange={(cornerRadius) => onUpdateConfig({ cornerRadius })}
        />
      </section>

      <section className="px-5 py-4 border-b border-slate-200">
        <h2 className="text-xs font-semibold text-slate-900 mb-2.5">
          外形寸法サマリー
        </h2>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
          {config.shape === 'rectangle' ? (
            <>
              <div className="flex justify-between items-baseline border-b border-slate-100 pb-1">
                <dt className="text-slate-500">幅 (X)</dt>
                <dd className="font-mono font-medium tabular-nums text-slate-900">
                  {formatMm(computed.width)} mm
                </dd>
              </div>
              <div className="flex justify-between items-baseline border-b border-slate-100 pb-1">
                <dt className="text-slate-500">高さ (Y)</dt>
                <dd className="font-mono font-medium tabular-nums text-slate-900">
                  {formatMm(computed.height)} mm
                </dd>
              </div>
            </>
          ) : (
            <>
              <div className="flex justify-between items-baseline border-b border-slate-100 pb-1">
                <dt className="text-slate-500">外径 (Ø)</dt>
                <dd className="font-mono font-medium tabular-nums text-slate-900">
                  {formatMm(computed.diameter)} mm
                </dd>
              </div>
              <div className="flex justify-between items-baseline border-b border-slate-100 pb-1">
                <dt className="text-slate-500">半径 (R)</dt>
                <dd className="font-mono font-medium tabular-nums text-slate-900">
                  {formatMm(computed.radius)} mm
                </dd>
              </div>
            </>
          )}
          <div className="flex justify-between items-baseline">
            <dt className="text-slate-500">板厚 (Z)</dt>
            <dd className="font-mono font-medium tabular-nums text-slate-900">
              {formatMm(computed.effectiveThickness)} mm
            </dd>
          </div>
          <div className="flex justify-between items-baseline">
            <dt className="text-slate-500">消去済み</dt>
            <dd className="font-mono font-medium tabular-nums text-slate-900">
              {computed.removedHoleCount} 穴
            </dd>
          </div>
        </dl>

        {computed.issues.length > 0 && (
          <div className="mt-3 space-y-2">
            {computed.issues.map((issue, idx) => (
              <div
                key={idx}
                className={`flex items-start gap-2 p-2.5 rounded-md border text-[11px] leading-relaxed ${
                  issue.level === 'error'
                    ? 'bg-red-50 border-red-200 text-red-800'
                    : 'bg-amber-50 border-amber-200 text-amber-900'
                }`}
              >
                {issue.level === 'error' ? (
                  <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-red-600" />
                ) : (
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-600" />
                )}
                <span>{issue.message}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="px-5 py-4 space-y-3">
        <h2 className="text-xs font-semibold text-slate-900">
          STL 出力設定
        </h2>

        <div>
          <span className="block text-[11px] font-medium text-slate-500 mb-1.5">
            ファイル形式（実寸 1 unit = 1 mm / Z-up）
          </span>
          <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-lg">
            <button
              type="button"
              onClick={() => onUpdateConfig({ stlFormat: 'binary' })}
              className={`py-1.5 px-2.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                config.stlFormat === 'binary'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              バイナリ STL
            </button>
            <button
              type="button"
              onClick={() => onUpdateConfig({ stlFormat: 'ascii' })}
              className={`py-1.5 px-2.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                config.stlFormat === 'ascii'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              ASCII STL
            </button>
          </div>
        </div>

        <div>
          <span className="block text-[11px] font-medium text-slate-500 mb-1.5">
            円弧・穴の分割精度
          </span>
          <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-lg">
            <button
              type="button"
              onClick={() => onUpdateConfig({ curveSegments: 32 })}
              className={`py-1.5 px-2.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                config.curveSegments === 32
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              標準 (32分割)
            </button>
            <button
              type="button"
              onClick={() => onUpdateConfig({ curveSegments: 64 })}
              className={`py-1.5 px-2.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                config.curveSegments === 64
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              高精細 (64分割)
            </button>
          </div>
        </div>
      </section>
    </aside>
  );
};
