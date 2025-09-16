"use client";

import { CanvasItemCard } from "./item-card";
import type { CanvasRenderable } from "./types";

type CanvasWorkspaceProps = {
  items: CanvasRenderable[];
  onMove: (id: string, x: number, y: number) => void;
  onFocus: (id: string) => void;
  onRetry?: (id: string) => void;
};

export function CanvasWorkspace({ items, onMove, onFocus, onRetry }: CanvasWorkspaceProps) {
  return (
    <section className="relative h-full w-full overflow-hidden bg-[radial-gradient(circle_at_top,#1f2937,#0f172a)]">
      <div
        className="absolute inset-0 bg-[linear-gradient(transparent_95%,rgba(255,255,255,0.08)_95%),linear-gradient(90deg,transparent_95%,rgba(255,255,255,0.08)_95%)] bg-[size:80px_80px] opacity-20"
        aria-hidden
      />
      <div className="relative h-full w-full">
        {items.map((item, index) => (
          <CanvasItemCard
            key={item.id}
            item={item}
            onMove={onMove}
            onFocus={onFocus}
            onRetry={onRetry}
            zIndex={index + 1}
          />
        ))}
      </div>
    </section>
  );
}
