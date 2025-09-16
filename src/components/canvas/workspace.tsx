"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent } from "react";
import { CanvasItemCard } from "./item-card";
import type { CanvasRenderable } from "./types";

type CanvasWorkspaceProps = {
  items: CanvasRenderable[];
  onMove: (id: string, x: number, y: number) => void;
  onFocus: (id: string) => void;
  onRetry?: (id: string) => void;
  onUpscale?: (id: string) => void;
  onDelete?: (id: string) => void;
};

const MIN_SCALE = 0.4;
const MAX_SCALE = 2.5;
const ZOOM_SENSITIVITY = 0.0012;

type ViewportState = {
  scale: number;
  offset: { x: number; y: number };
};

export function CanvasWorkspace({ items, onMove, onFocus, onRetry, onUpscale, onDelete }: CanvasWorkspaceProps) {
  const DEFAULT_SIDE = 192; // keep in sync with item-card sizing baseline
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [canvasSize, setCanvasSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const [viewport, setViewport] = useState<ViewportState>({ scale: 1, offset: { x: 0, y: 0 } });
  const viewportRef = useRef(viewport);
  const panState = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originOffset: { x: number; y: number };
  } | null>(null);
  const [isPanning, setIsPanning] = useState(false);

  useEffect(() => {
    viewportRef.current = viewport;
  }, [viewport]);

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

  const clampScale = useCallback((value: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, value)), []);

  const handleWheel = useCallback(
    (event: ReactWheelEvent<HTMLDivElement>) => {
      const container = containerRef.current;
      if (!container) return;

      const { deltaY, deltaX, ctrlKey, metaKey, shiftKey, clientX, clientY } = event;
      event.preventDefault();

      const shouldZoom = !shiftKey || ctrlKey || metaKey;

      if (shouldZoom) {
        const zoomFactor = Math.exp(-deltaY * ZOOM_SENSITIVITY);
        const rect = container.getBoundingClientRect();
        const pointerX = clientX - rect.left;
        const pointerY = clientY - rect.top;

        setViewport((prev) => {
          const nextScale = clampScale(prev.scale * zoomFactor);
          if (nextScale === prev.scale) {
            return prev;
          }

          const worldX = (pointerX - prev.offset.x) / prev.scale;
          const worldY = (pointerY - prev.offset.y) / prev.scale;

          return {
            scale: nextScale,
            offset: {
              x: pointerX - worldX * nextScale,
              y: pointerY - worldY * nextScale,
            },
          };
        });

        return;
      }

      setViewport((prev) => ({
        scale: prev.scale,
        offset: {
          x: prev.offset.x - deltaX,
          y: prev.offset.y - deltaY,
        },
      }));
    },
    [clampScale]
  );

  const handlePanMove = useCallback((moveEvent: PointerEvent) => {
    const state = panState.current;
    if (!state || moveEvent.pointerId !== state.pointerId) return;
    moveEvent.preventDefault();
    const dx = moveEvent.clientX - state.startX;
    const dy = moveEvent.clientY - state.startY;
    setViewport((prev) => ({
      scale: prev.scale,
      offset: {
        x: state.originOffset.x + dx,
        y: state.originOffset.y + dy,
      },
    }));
  }, []);

  const endPan = useCallback(() => {
    setIsPanning(false);
    panState.current = null;
    window.removeEventListener("pointermove", handlePanMove);
    window.removeEventListener("pointerup", endPan);
    window.removeEventListener("pointercancel", endPan);
  }, [handlePanMove]);

  const handleCanvasPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("[data-item-card]")) {
        return;
      }

      if (event.button !== 0 && event.button !== 1) {
        return;
      }

      event.preventDefault();
      const { clientX, clientY, pointerId } = event;
      const currentViewport = viewportRef.current;

      if (panState.current) {
        return;
      }

      panState.current = {
        pointerId,
        startX: clientX,
        startY: clientY,
        originOffset: { ...currentViewport.offset },
      };

      setIsPanning(true);

      window.addEventListener("pointermove", handlePanMove);
      window.addEventListener("pointerup", endPan);
      window.addEventListener("pointercancel", endPan);
    },
    [endPan, handlePanMove]
  );

  useEffect(() => {
    return () => {
      window.removeEventListener("pointermove", handlePanMove);
      window.removeEventListener("pointerup", endPan);
      window.removeEventListener("pointercancel", endPan);
    };
  }, [endPan, handlePanMove]);

  const transformStyle = {
    transform: `translate3d(${viewport.offset.x}px, ${viewport.offset.y}px, 0) scale(${viewport.scale})`,
    transformOrigin: "0 0",
  } as const;

  return (
    <section className="relative h-full w-full overflow-hidden bg-[radial-gradient(circle_at_top,#1f2937,#0f172a)]">
      <div
        className="absolute inset-0 bg-[linear-gradient(transparent_95%,rgba(255,255,255,0.08)_95%),linear-gradient(90deg,transparent_95%,rgba(255,255,255,0.08)_95%)] bg-[size:80px_80px] opacity-20"
        aria-hidden
      />
      <div
        ref={containerRef}
        className={`relative h-full w-full ${isPanning ? "cursor-grabbing" : "cursor-grab"}`}
        onWheel={handleWheel}
        onPointerDown={handleCanvasPointerDown}
      >
        <div className="absolute inset-0" style={transformStyle}>
          {/* Link lines between derived items and their parents */}
          <svg
            className="absolute inset-0 pointer-events-none"
            width={canvasSize.width || 1}
            height={canvasSize.height || 1}
            viewBox={`0 0 ${canvasSize.width || 1} ${canvasSize.height || 1}`}
            preserveAspectRatio="none"
            style={{ overflow: "visible" }}
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
              onDelete={onDelete}
              zIndex={index + 1}
              scale={viewport.scale}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
