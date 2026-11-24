import { useState } from 'react';
import { Box, CheckCircle2, Download, Grid, X } from 'lucide-react';
import type { ViewMode } from './types/plate';
import { formatBytes, formatMm } from './utils/plateMath';
import { usePlateEditor } from './hooks/usePlateEditor';
import { InspectorPanel } from './components/InspectorPanel';
import { TopDownEditor2D } from './components/TopDownEditor2D';
import { Preview3DViewport } from './components/Preview3DViewport';

export default function App() {
  const [viewMode, setViewMode] = useState<ViewMode>('2d');
  const editor = usePlateEditor();
  const { config, computed, receipt } = editor;

  return (
    <div className="h-screen w-screen flex flex-col bg-slate-50 text-slate-900 overflow-hidden">
      {/* Top Bar: Clean 3-zone contract */}
      <header className="h-14 shrink-0 bg-white border-b border-slate-200 px-5 flex items-center justify-between gap-8">
        <div className="text-base font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0">
          PlateCraft CAD
        </div>

        <div className="hidden md:flex items-center gap-2.5 text-xs font-mono tabular-nums text-slate-600 truncate">
          {computed.shape === 'rectangle' ? (
            <>
              <span>幅 {formatMm(computed.width)} mm</span>
              <span aria-hidden="true" className="text-slate-300">·</span>
              <span>高さ {formatMm(computed.height)} mm</span>
            </>
          ) : (
            <span>外径 Ø{formatMm(computed.diameter)} mm</span>
          )}
          <span aria-hidden="true" className="text-slate-300">·</span>
          <span>板厚 {formatMm(computed.effectiveThickness)} mm</span>
          <span aria-hidden="true" className="text-slate-300">·</span>
          <span>有効穴 {computed.activeHoleCount} / {computed.totalHoleCount}</span>
        </div>

        <button
          type="button"
          onClick={editor.exportStl}
          className="px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-semibold flex items-center gap-2 whitespace-nowrap shrink-0 transition-colors cursor-pointer"
        >
          <Download className="w-3.5 h-3.5" />
          STLをエクスポート
        </button>
      </header>

      {/* Main CAD Workspace */}
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-y-auto lg:overflow-hidden">
        <InspectorPanel
          config={config}
          computed={computed}
          activePresetId={editor.activePresetId}
          onUpdateConfig={editor.updateConfig}
          onApplyPreset={editor.applyPreset}
        />

        <main className="flex-1 min-w-0 min-h-[520px] lg:min-h-0 flex flex-col relative">
          <div className="h-11 shrink-0 bg-white border-b border-slate-200 px-4 flex items-center justify-between gap-4">
            <div role="tablist" aria-label="ビュー切替" className="flex items-center gap-1 p-0.5 bg-slate-100 rounded-md">
              <button
                type="button"
                role="tab"
                aria-selected={viewMode === '2d'}
                onClick={() => setViewMode('2d')}
                className={`px-3 py-1.5 rounded text-xs font-medium flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                  viewMode === '2d' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Grid className="w-3.5 h-3.5" />
                上面2D編集
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={viewMode === '3d'}
                onClick={() => setViewMode('3d')}
                className={`px-3 py-1.5 rounded text-xs font-medium flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                  viewMode === '3d' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Box className="w-3.5 h-3.5" />
                3Dプレビュー
              </button>
            </div>

            <div className="text-xs font-mono tabular-nums text-slate-500 whitespace-nowrap truncate">
              {computed.shape === 'circle' ? '円形プレート' : '四角形プレート'} · {config.cols}×{config.rows} 格子 · φ{formatMm(computed.effectiveHoleDiameter)} mm
            </div>
          </div>

          <div className="flex-1 min-h-0 relative">
            {viewMode === '2d' ? (
              <TopDownEditor2D
                config={config}
                computed={computed}
                canUndo={editor.canUndo}
                canRedo={editor.canRedo}
                onBeginBatchPaint={editor.beginPaint}
                onSetHoleRemoved={editor.setHoleRemoved}
                onEndBatchPaint={editor.endPaint}
                onUndo={editor.undo}
                onRedo={editor.redo}
                onRestoreAll={editor.restoreAll}
                onInvertHoles={editor.invertHoles}
                onKeepPerimeterOnly={editor.keepPerimeter}
                onRemoveAll={editor.removeAll}
              />
            ) : (
              <Preview3DViewport config={config} computed={computed} />
            )}
          </div>
        </main>
      </div>

      {receipt && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-5 right-5 z-50 max-w-sm bg-white border border-slate-200 rounded-lg shadow-md px-4 py-3 flex items-start gap-3"
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold text-slate-900">
              STLファイルをエクスポートしました
            </div>
            <div className="text-[11px] font-mono text-slate-600 truncate mt-0.5">
              {receipt.filename}
            </div>
            <div className="text-[11px] font-mono tabular-nums text-slate-500 mt-1">
              {receipt.format === 'binary' ? 'バイナリ' : 'ASCII'} ·{' '}
              {receipt.triangleCount.toLocaleString()} 三角形 ·{' '}
              {formatBytes(receipt.sizeBytes)}
            </div>
          </div>
          <button
            type="button"
            onClick={editor.clearReceipt}
            aria-label="通知を閉じる"
            className="text-slate-400 hover:text-slate-700 p-0.5 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
