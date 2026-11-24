import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DEFAULT_PLATE_CONFIG,
  PLATE_PRESETS,
  type ExportReceipt,
  type PlateConfig,
  type PlatePreset,
} from '../types/plate';
import { computePlateGeometry, holeKey } from '../utils/plateMath';
import { exportPlateToStl } from '../utils/stlBuilder';

const MAX_HISTORY = 50;

function setsEqual(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false;
  for (const k of a) if (!b.has(k)) return false;
  return true;
}

export function usePlateEditor() {
  const [config, setConfig] = useState<PlateConfig>(DEFAULT_PLATE_CONFIG);
  const [removedHoles, setRemovedHoles] = useState<Set<string>>(() => new Set());
  const [past, setPast] = useState<Set<string>[]>([]);
  const [future, setFuture] = useState<Set<string>[]>([]);
  const [receipt, setReceipt] = useState<ExportReceipt | null>(null);

  const batchSnapRef = useRef<Set<string> | null>(null);
  const removedRef = useRef(removedHoles);
  removedRef.current = removedHoles;

  const computed = useMemo(
    () => computePlateGeometry(config, removedHoles),
    [config, removedHoles],
  );

  const activePresetId = useMemo(() => {
    const found = PLATE_PRESETS.find((p) => {
      const v = p.values;
      const ok =
        Math.abs(config.pitch - v.pitch) < 0.005 &&
        Math.abs(config.holeDiameter - v.holeDiameter) < 0.005 &&
        Math.abs(config.thickness - v.thickness) < 0.005 &&
        Math.abs(config.margin - v.margin) < 0.005;
      return ok && (config.shape === 'circle' || Math.abs(config.cornerRadius - v.cornerRadius) < 0.005);
    });
    return found ? found.id : null;
  }, [config]);

  const commitRemoved = useCallback((next: Set<string>) => {
    const prev = removedRef.current;
    if (setsEqual(prev, next)) return;
    setPast((p) => [...p.slice(-(MAX_HISTORY - 1)), new Set(prev)]);
    setFuture([]);
    setRemovedHoles(next);
  }, []);

  const beginPaint = useCallback(() => {
    batchSnapRef.current = new Set(removedRef.current);
  }, []);

  const setHoleRemoved = useCallback((key: string, removed: boolean) => {
    setRemovedHoles((prev) => {
      if (removed === prev.has(key)) return prev;
      const next = new Set(prev);
      if (removed) next.add(key);
      else next.delete(key);
      return next;
    });
  }, []);

  const endPaint = useCallback(() => {
    const snap = batchSnapRef.current;
    batchSnapRef.current = null;
    if (snap && !setsEqual(snap, removedRef.current)) {
      setPast((p) => [...p.slice(-(MAX_HISTORY - 1)), snap]);
      setFuture([]);
    }
  }, []);

  const undo = useCallback(() => {
    setPast((p) => {
      if (!p.length) return p;
      const prev = p[p.length - 1];
      setFuture((f) => [new Set(removedRef.current), ...f]);
      setRemovedHoles(prev);
      return p.slice(0, -1);
    });
  }, []);

  const redo = useCallback(() => {
    setFuture((f) => {
      if (!f.length) return f;
      const [next, ...rest] = f;
      setPast((p) => [...p.slice(-(MAX_HISTORY - 1)), new Set(removedRef.current)]);
      setRemovedHoles(next);
      return rest;
    });
  }, []);

  const restoreAll = useCallback(() => commitRemoved(new Set()), [commitRemoved]);

  const invertHoles = useCallback(() => {
    const next = new Set<string>();
    for (const h of computed.holes) if (!h.removed) next.add(h.key);
    commitRemoved(next);
  }, [commitRemoved, computed.holes]);

  const keepPerimeter = useCallback(() => {
    const valid = new Set(computed.holes.map((h) => h.key));
    const next = new Set<string>();
    for (const h of computed.holes) {
      const edge =
        computed.shape === 'rectangle'
          ? h.row === 0 || h.row === config.rows - 1 || h.col === 0 || h.col === config.cols - 1
          : !(
              valid.has(holeKey(h.row - 1, h.col)) &&
              valid.has(holeKey(h.row + 1, h.col)) &&
              valid.has(holeKey(h.row, h.col - 1)) &&
              valid.has(holeKey(h.row, h.col + 1))
            );
      if (!edge) next.add(h.key);
    }
    commitRemoved(next);
  }, [commitRemoved, computed.holes, computed.shape, config.cols, config.rows]);

  const removeAll = useCallback(() => {
    commitRemoved(new Set(computed.holes.map((h) => h.key)));
  }, [commitRemoved, computed.holes]);

  const updateConfig = useCallback((patch: Partial<PlateConfig>) => {
    setConfig((prev) => {
      const next = { ...prev, ...patch };
      if (patch.cols !== undefined || patch.rows !== undefined) {
        setRemovedHoles((cur) => {
          const pruned = new Set<string>();
          for (const k of cur) {
            const [r, c] = k.split(':').map(Number);
            if (r >= 0 && r < next.rows && c >= 0 && c < next.cols) pruned.add(k);
          }
          return pruned.size === cur.size ? cur : pruned;
        });
      }
      return next;
    });
  }, []);

  const applyPreset = useCallback((preset: PlatePreset) => {
    setConfig((prev) => ({ ...prev, ...preset.values }));
  }, []);

  const exportStl = useCallback(() => {
    setReceipt(exportPlateToStl(computed, config));
  }, [computed, config]);

  useEffect(() => {
    if (!receipt) return;
    const t = window.setTimeout(() => setReceipt(null), 5500);
    return () => window.clearTimeout(t);
  }, [receipt]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [redo, undo]);

  return {
    config,
    computed,
    activePresetId,
    receipt,
    clearReceipt: () => setReceipt(null),
    canUndo: past.length > 0,
    canRedo: future.length > 0,
    beginPaint,
    setHoleRemoved,
    endPaint,
    undo,
    redo,
    restoreAll,
    invertHoles,
    keepPerimeter,
    removeAll,
    updateConfig,
    applyPreset,
    exportStl,
  };
}
