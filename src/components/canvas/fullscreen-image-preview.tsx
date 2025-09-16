"use client";

import { createPortal } from "react-dom";
import { useEffect, useMemo, useState } from "react";
import Image from "next/image";

import { extFromUrl, formatBytes } from "@/hooks/helpers";

export type FullscreenImagePreviewProps = {
  src: string;
  alt?: string;
  createdAt?: number; // epoch ms
  model?: string;
  onClose: () => void;
};

export function FullscreenImagePreview({ src, alt, createdAt, model, onClose }: FullscreenImagePreviewProps) {
  const [natural, setNatural] = useState<{ width: number; height: number } | null>(null);
  const [contentType, setContentType] = useState<string | null>(null);
  const [contentLength, setContentLength] = useState<number | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Attempt a HEAD request to read type/size (works for public GCS)
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(src, { method: "HEAD" });
        if (alive) {
          const ct = res.headers.get("content-type");
          const cl = res.headers.get("content-length");
          setContentType(ct);
          if (cl) setContentLength(Number(cl));
        }
      } catch (e) {
        // ignore
      }
    })();
    return () => {
      alive = false;
    };
  }, [src]);

  const ext = useMemo(() => extFromUrl(src) || (contentType ? contentType.split("/")[1] : null), [src, contentType]);
  const createdText = useMemo(() => {
    if (!createdAt) return "-";
    try {
      const d = new Date(createdAt);
      return d.toLocaleString();
    } catch {
      return String(createdAt);
    }
  }, [createdAt]);

  if (!mounted) {
    return null;
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm"
      onClick={onClose}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {/* Top-right controls: Download and Close */}
      <div className="absolute right-4 top-4 flex items-center gap-2">
        <a
          href={`/api/download?url=${encodeURIComponent(src)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-9 items-center gap-2 rounded-full bg-white/10 px-3 text-sm text-white ring-1 ring-white/20 hover:bg-white/15"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Download icon */}
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-5 w-5">
            <path d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Download
        </a>
        <button
          type="button"
          aria-label="Close"
          className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white ring-1 ring-white/20 hover:bg-white/15"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
        >
          {/* X icon */}
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-5 w-5">
            <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <div className="flex h-full w-full items-center justify-center p-6">
        <div className="relative h-[90vh] w-[95vw]" onClick={(e) => e.stopPropagation()}>
          <Image
            src={src}
            alt={alt || "image"}
            fill
            className="object-contain"
            sizes="(max-width: 1600px) 95vw, 95vw"
            priority={true}
            unoptimized
            onLoadingComplete={(img) => {
              // next/image passes HTMLImageElement
              const el = img as unknown as HTMLImageElement;
              setNatural({ width: el.naturalWidth, height: el.naturalHeight });
            }}
          />

          {/* Metadata panel */}
          <div className="pointer-events-none absolute left-0 bottom-0 m-2 rounded-lg bg-black/60 px-3 py-2 text-xs text-white ring-1 ring-white/15 backdrop-blur">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="opacity-90">{model || ""}</span>
              <span className="opacity-75">Created: {createdText}</span>
              <span className="opacity-75">
                Size: {natural ? `${natural.width}×${natural.height}px` : "-"}
              </span>
              <span className="opacity-75">{ext ? ext.toUpperCase() : ""}</span>
              <span className="opacity-75">{contentLength ? formatBytes(contentLength) : ""}</span>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
