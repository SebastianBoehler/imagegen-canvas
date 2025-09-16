"use client";

import { useCallback, useState } from "react";
import type { PointerEvent as ReactPointerEvent, SyntheticEvent } from "react";
import Image from "next/image";
import type { CanvasRenderable } from "./types";
import { FullscreenImagePreview } from "./fullscreen-image-preview";

type CanvasItemCardProps = {
  item: CanvasRenderable;
  onMove: (id: string, x: number, y: number) => void;
  onFocus: (id: string) => void;
  zIndex: number;
  onRetry?: (id: string) => void;
  onUpscale?: (id: string) => void;
};

export function CanvasItemCard({ item, onMove, onFocus, zIndex, onRetry, onUpscale }: CanvasItemCardProps) {
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

  const [isPreviewOpen, setPreviewOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null);

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
    <>
      <div
      role="group"
      className="group absolute rounded-lg overflow-hidden border border-white/10 bg-slate-900/80 shadow-xl shadow-black/40 backdrop-blur-sm cursor-grab select-none"
      style={{
        transform: `translate3d(${item.position.x}px, ${item.position.y}px, 0)`,
        zIndex,
        width: `${size.width}px`,
        height: `${size.height}px`,
      }}
      onPointerDown={handlePointerDown}
      onContextMenu={(e) => {
        e.preventDefault();
        onFocus(item.id);
        setMenuPos({ x: e.clientX, y: e.clientY });
      }}
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
            <button
              type="button"
              className="mt-1 inline-flex items-center rounded-md bg-red-500/20 px-3 py-1.5 text-xs font-medium text-red-100 ring-1 ring-inset ring-red-400/40 hover:bg-red-500/25"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onRetry?.(item.id);
              }}
            >
              Retry
            </button>
          </div>
        )}
        {item.status === "complete" && item.imageUrl ? (
          <>
            <Image
              src={item.imageUrl}
              alt={item.prompt}
              width={size.width}
              height={size.height}
              className="h-full w-full object-contain"
              priority={false}
              onLoad={handleImageLoad}
            />
            {/* Hover overlay with eye icon */}
            <div className="pointer-events-none absolute inset-0 transition-colors duration-150 group-hover:bg-black/15">
              <button
                type="button"
                aria-label="View full resolution"
                title="View full resolution"
                className="pointer-events-auto absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white/90 shadow ring-1 ring-white/20 backdrop-blur hover:bg-black/70"
                onPointerDown={(e) => {
                  e.stopPropagation();
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  setPreviewOpen(true);
                }}
              >
                {/* Eye icon (Heroicons style) */}
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-5 w-5">
                  <path
                    d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7Z"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </div>
          </>
        ) : null}
      </div>
      <div className="pointer-events-none absolute bottom-2 left-2 inline-flex max-w-[calc(100%-16px)] items-center rounded-full bg-black/50 px-3 py-1 text-[11px] font-medium text-white/80 backdrop-blur">
        <span className="truncate">{item.model}</span>
      </div>
      </div>

      {/* Context menu */}
      {menuPos ? (
        <div
          className="fixed inset-0 z-[9998]"
          onClick={() => setMenuPos(null)}
          onContextMenu={(e) => {
            // prevent nested native context menu while ours is open
            e.preventDefault();
            setMenuPos(null);
          }}
        >
          <div
            className="absolute min-w-40 rounded-md border border-white/10 bg-slate-900/95 p-1 text-sm text-slate-100 shadow-xl backdrop-blur"
            style={{ left: menuPos.x, top: menuPos.y }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="block w-full rounded px-3 py-2 text-left hover:bg-white/10"
              onClick={() => {
                setMenuPos(null);
                onUpscale?.(item.id);
              }}
            >
              Upscale
            </button>
          </div>
        </div>
      ) : null}

      {/* Fullscreen preview modal */}
      {isPreviewOpen && item.imageUrl ? (
        <FullscreenImagePreview
          src={item.imageUrl}
          alt={item.prompt}
          createdAt={item.createdAt}
          model={item.model}
          onClose={() => setPreviewOpen(false)}
        />
      ) : null}
    </>
  );
}
