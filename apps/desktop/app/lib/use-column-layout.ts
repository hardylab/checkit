// apps/desktop/app/lib/use-column-layout.ts
// Drag-to-resize column widths with localStorage persistence.
//
// Usage:
//   const sideRailRef = useRef<HTMLDivElement>(null);
//   const { width, resizerProps } = useColumnLayout({
//     columnRef: sideRailRef,
//     columnKey: 'side-rail',
//     defaultWidth: 240,
//     min: 160, max: 360, side: 'left',
//   });
//   <aside ref={sideRailRef} style={{ width: `${width}px` }}>...</aside>
//   <div {...resizerProps} data-resizer-for="side-rail" />
//
// Widths persist under localStorage key 'checkit:layout' as
// `{ [columnKey]: number }`. The hook never queries the DOM — the
// caller passes the column ref directly.

'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';

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
  columnRef: RefObject<HTMLElement | null>;
  columnKey: string;
  defaultWidth: number;
  min?: number;
  max?: number;
  /** 'left' = drag right to widen; 'right' = drag left to widen. */
  side: 'left' | 'right';
};

export function useColumnLayout(options: Options) {
  const { columnRef, columnKey, defaultWidth, min = 160, max = 600, side } = options;
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
      // Track the latest computed width in a closure-scoped variable
      // so onUp can read it synchronously (React batches state updates,
      // so the DOM offsetWidth is one render behind).
      let lastW = startW;

      const onMove = (ev: MouseEvent) => {
        const delta = (ev.clientX - startX) * sign;
        const next = Math.round(Math.min(max, Math.max(min, startW + delta)));
        lastW = next;
        setWidthState(next);
      };

      const onUp = () => {
        const clamped = Math.round(Math.min(max, Math.max(min, lastW)));
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