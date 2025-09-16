"use client";

import { useCallback, useState } from "react";
import type { PointerEvent as ReactPointerEvent, SyntheticEvent } from "react";
import Image from "next/image";
import type { CanvasRenderable } from "./types";

type CanvasItemCardProps = {
  item: CanvasRenderable;
  onMove: (id: string, x: number, y: number) => void;
  onFocus: (id: string) => void;
  zIndex: number;
};

export function CanvasItemCard({ item, onMove, onFocus, zIndex }: CanvasItemCardProps) {
  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      onFocus(item.id);

      const pointerId = event.pointerId;
      const originX = item.position.x;
      const originY = item.position.y;
      const startX = event.clientX;
      const startY = event.clientY;
      const target = event.currentTarget;

      target.setPointerCapture(pointerId);
      target.classList.add("cursor-grabbing");

      const handlePointerMove = (moveEvent: PointerEvent) => {
        const deltaX = moveEvent.clientX - startX;
        const deltaY = moveEvent.clientY - startY;
        onMove(item.id, originX + deltaX, originY + deltaY);
      };

      const handlePointerUp = () => {
        window.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("pointerup", handlePointerUp);
        window.removeEventListener("pointercancel", handlePointerUp);
        target.releasePointerCapture(pointerId);
        target.classList.remove("cursor-grabbing");
      };

      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", handlePointerUp);
      window.addEventListener("pointercancel", handlePointerUp);
    },
    [item.id, item.position.x, item.position.y, onFocus, onMove]
  );

  // Dynamically size the card based on the loaded image's natural dimensions.
  const DEFAULT_SIDE = 192; // px, previous tile size
  const [size, setSize] = useState<{ width: number; height: number}>({
    width: DEFAULT_SIDE,
    height: DEFAULT_SIDE,
  });

  const handleImageLoad = useCallback((e: SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget as HTMLImageElement | null;
    const naturalWidth = img?.naturalWidth ?? DEFAULT_SIDE;
    const naturalHeight = img?.naturalHeight ?? DEFAULT_SIDE;
    if (naturalWidth <= 0 || naturalHeight <= 0) return;
    // Scale down to fit within DEFAULT_SIDE on the longer edge, preserve aspect ratio.
    const scale = Math.min(1, DEFAULT_SIDE / Math.max(naturalWidth, naturalHeight));
    const width = Math.max(1, Math.round(naturalWidth * scale));
    const height = Math.max(1, Math.round(naturalHeight * scale));
    setSize({ width, height });
  }, []);

  return (
    <div
      role="group"
      className="absolute rounded-lg overflow-hidden border border-white/10 bg-slate-900/80 shadow-xl shadow-black/40 backdrop-blur-sm cursor-grab select-none"
      style={{
        transform: `translate3d(${item.position.x}px, ${item.position.y}px, 0)`,
        zIndex,
        width: `${size.width}px`,
        height: `${size.height}px`,
      }}
      onPointerDown={handlePointerDown}
    >
      <div className="relative h-full w-full">
        {item.status === "pending" && (
          <div className="flex h-full w-full flex-col items-center justify-center gap-3 text-slate-300">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/30 border-t-transparent" />
            <p className="text-xs uppercase tracking-wide">Generating…</p>
          </div>
        )}
        {item.status === "error" && (
          <div className="flex h-full w-full flex-col items-center justify-center gap-3 text-center text-red-300">
            <p className="text-xs font-semibold">Generation failed</p>
            {item.error ? <p className="px-3 text-[10px] text-red-200/80">{item.error}</p> : null}
          </div>
        )}
        {item.status === "complete" && item.imageUrl ? (
          <Image
            src={item.imageUrl}
            alt={item.prompt}
            width={size.width}
            height={size.height}
            className="h-full w-full object-contain"
            priority={false}
            onLoad={handleImageLoad}
          />
        ) : null}
      </div>
      <div className="pointer-events-none absolute bottom-2 left-2 inline-flex max-w-[calc(100%-16px)] items-center rounded-full bg-black/50 px-3 py-1 text-[11px] font-medium text-white/80 backdrop-blur">
        <span className="truncate">{item.model}</span>
      </div>
    </div>
  );
}
