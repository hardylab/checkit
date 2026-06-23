// apps/desktop/app/lib/use-column-layout.ts
// Drag-to-resize column widths with localStorage persistence.
//
// Usage:
//   const { width, setWidth, resizerProps } = useColumnLayout('side-rail', 240, {
//     min: 160, max: 360, side: 'left',
//   });
//   <aside style={{ flex: `0 0 ${width}px`, width: `${width}px` }}>...</aside>
//   <div {...resizerProps} data-resizer-for="side-rail" />  // resizer
//
// Widths persist under key 'checkit:layout' as `{ [columnKey]: number }`.

'use client';
import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'checkit:layout';

type Layout = Record<string, number>;

function readLayout(): Layout {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {};
}

function writeLayout(l: Layout) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(l));
  } catch {}
}

type Options = {
  min?: number;
  max?: number;
  /** 'left' = drag right to widen; 'right' = drag left to widen. */
  side: 'left' | 'right';
};

export function useColumnLayout(columnKey: string, defaultWidth: number, options: Options) {
  const { min = 160, max = 600, side } = options;
  const [width, setWidthState] = useState<number>(defaultWidth);

  // Hydrate from localStorage after mount.
  useEffect(() => {
    const l = readLayout();
    if (typeof l[columnKey] === 'number') {
      const v = l[columnKey];
      setWidthState(Math.min(max, Math.max(min, v)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columnKey, min, max]);

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const startX = e.clientX;
      const startW = width;

      const sign = side === 'left' ? 1 : -1;

      const onMove = (ev: MouseEvent) => {
        const delta = (ev.clientX - startX) * sign;
        const next = Math.round(Math.min(max, Math.max(min, startW + delta)));
        setWidthState(next);
      };

      const onUp = () => {
        // Persist via setState final value by reading computed width from
        // the resizer's previous sibling (the column element).
        const resizer = document.querySelector<HTMLElement>(`[data-resizer-for="${columnKey}"]`);
        // Two layouts:
        //   side='left': resizer comes AFTER the column → column is resizer.previousElementSibling
        //   side='right': resizer comes BEFORE the column → column is resizer.nextElementSibling
        const sibling = side === 'left'
          ? resizer?.previousElementSibling
          : resizer?.nextElementSibling;
        const finalW = sibling instanceof HTMLElement ? sibling.offsetWidth : width;
        const clamped = Math.round(Math.min(max, Math.max(min, finalW)));
        const l = readLayout();
        l[columnKey] = clamped;
        writeLayout(l);
        setWidthState(clamped);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
      };

      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    },
    [width, min, max, side, columnKey]
  );

  return {
    width,
    resizerProps: {
      onMouseDown,
      'data-resizer-for': columnKey,
    },
  };
}