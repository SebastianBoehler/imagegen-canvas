"use client";

import { useEffect, useRef, useState } from "react";
import { CanvasItemCard } from "./item-card";
import type { CanvasRenderable } from "./types";

type CanvasWorkspaceProps = {
  items: CanvasRenderable[];
  onMove: (id: string, x: number, y: number) => void;
  onFocus: (id: string) => void;
  onRetry?: (id: string) => void;
  onUpscale?: (id: string) => void;
};

export function CanvasWorkspace({ items, onMove, onFocus, onRetry, onUpscale }: CanvasWorkspaceProps) {
  const DEFAULT_SIDE = 192; // keep in sync with item-card sizing baseline
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [canvasSize, setCanvasSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const cr = entry.contentRect;
        setCanvasSize({ width: Math.ceil(cr.width), height: Math.ceil(cr.height) });
      }
    });
    ro.observe(el);
    return () => {
      ro.disconnect();
    };
  }, []);

  return (
    <section className="relative h-full w-full overflow-hidden bg-[radial-gradient(circle_at_top,#1f2937,#0f172a)]">
      <div
        className="absolute inset-0 bg-[linear-gradient(transparent_95%,rgba(255,255,255,0.08)_95%),linear-gradient(90deg,transparent_95%,rgba(255,255,255,0.08)_95%)] bg-[size:80px_80px] opacity-20"
        aria-hidden
      />
      <div ref={containerRef} className="relative h-full w-full">
        {/* Link lines between derived items and their parents */}
        <svg
          className="absolute inset-0 pointer-events-none"
          width={canvasSize.width || 1}
          height={canvasSize.height || 1}
          viewBox={`0 0 ${canvasSize.width || 1} ${canvasSize.height || 1}`}
          preserveAspectRatio="none"
        >
          {items.map((child) => {
            if (!child.parentId) return null;
            const parent = items.find((p) => p.id === child.parentId);
            if (!parent) return null;
            const x1 = parent.position.x + DEFAULT_SIDE / 2;
            const y1 = parent.position.y + DEFAULT_SIDE / 2;
            const x2 = child.position.x + DEFAULT_SIDE / 2;
            const y2 = child.position.y + DEFAULT_SIDE / 2;
            return (
              <line
                key={`${parent.id}->${child.id}`}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="rgba(255,255,255,0.35)"
                strokeWidth={2}
                vectorEffect="non-scaling-stroke"
              />
            );
          })}
        </svg>

        {items.map((item, index) => (
          <CanvasItemCard
            key={item.id}
            item={item}
            onMove={onMove}
            onFocus={onFocus}
            onRetry={onRetry}
            onUpscale={onUpscale}
            zIndex={index + 1}
          />
        ))}
      </div>
    </section>
  );
}
