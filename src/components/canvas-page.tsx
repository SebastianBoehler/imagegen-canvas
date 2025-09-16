"use client";

import { useCallback, useState } from "react";
import { IMAGE_GEN_MODELS } from "@/hooks/replicate";
import { generateTextToImage } from "@/hooks/ssr/replicate";
import { Sidebar } from "./sidebar";
import { CanvasWorkspace } from "./canvas/workspace";
import type { PromptSubmissionMeta } from "./prompt/prompt-dock";
import { PromptDock } from "./prompt/prompt-dock";

type CanvasItemStatus = "pending" | "complete" | "error";

type CanvasItem = {
  id: string;
  prompt: string;
  model: string;
  imageUrl: string | null;
  status: CanvasItemStatus;
  error: string | null;
  position: { x: number; y: number };
  createdAt: number;
};

const INITIAL_OFFSET = { x: 160, y: 120 };
const ITEM_SPACING = 32;

function clampImageCount(count: number) {
  if (Number.isNaN(count) || count < 1) {
    return 1;
  }

  if (count > 5) {
    return 5;
  }

  return count;
}

export default function CanvasPage() {
  const [items, setItems] = useState<CanvasItem[]>([]);
  const [activeRequests, setActiveRequests] = useState(0);

  const handleMoveItem = useCallback((id: string, x: number, y: number) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, position: { x, y } } : item))
    );
  }, []);

  const bringItemToFront = useCallback((id: string) => {
    setItems((prev) => {
      const targetIndex = prev.findIndex((item) => item.id === id);
      if (targetIndex === -1) {
        return prev;
      }

      const next = [...prev];
      const [target] = next.splice(targetIndex, 1);
      next.push(target);
      return next;
    });
  }, []);

  const handleRetryItem = useCallback(async (id: string) => {
    let snapshot: CanvasItem | undefined;
    setItems((prev) => {
      const next = prev.map((item) => {
        if (item.id === id) {
          snapshot = item;
          return { ...item, status: "pending" as CanvasItemStatus, error: null, imageUrl: null };
        }
        return item;
      });
      return next;
    });

    if (!snapshot) return;

    setActiveRequests((c) => c + 1);
    try {
      const formData = new FormData();
      formData.set("prompt", snapshot.prompt);
      formData.set("model", snapshot.model);
      formData.set("numImages", "1");

      const response = await generateTextToImage(formData);
      const url = response.images[0] ?? null;

      setItems((prev) =>
        prev.map((item) =>
          item.id === id
            ? url
              ? { ...item, imageUrl: url, status: "complete" as CanvasItemStatus, error: null }
              : { ...item, status: "error" as CanvasItemStatus, error: "Retry returned no image" }
            : item
        )
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to retry generation";
      setItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, status: "error" as CanvasItemStatus, error: message } : item))
      );
    } finally {
      setActiveRequests((c) => Math.max(c - 1, 0));
    }
  }, []);

  const handlePromptSubmit = useCallback(
    async (formData: FormData, meta: PromptSubmissionMeta) => {
      const safeCount = clampImageCount(meta.numImages);
      const now = Date.now();
      const placeholderIds: string[] = [];

      setItems((prev) => {
        const next = [...prev];
        for (let index = 0; index < safeCount; index += 1) {
          const id = crypto.randomUUID();
          placeholderIds.push(id);
          next.push({
            id,
            prompt: meta.prompt,
            model: meta.model,
            imageUrl: null,
            status: "pending",
            error: null,
            position: {
              x: INITIAL_OFFSET.x + index * ITEM_SPACING,
              y: INITIAL_OFFSET.y + index * ITEM_SPACING,
            },
            createdAt: now + index,
          });
        }
        return next;
      });

      formData.set("numImages", String(safeCount));
      setActiveRequests((count) => count + 1);

      try {
        const response = await generateTextToImage(formData);
        const idToIndex = new Map(placeholderIds.map((id, index) => [id, index] as const));

        setItems((prev) =>
          prev.map((item) => {
            const imageIndex = idToIndex.get(item.id);
            if (imageIndex === undefined) {
              return item;
            }

            const url = response.images[imageIndex] ?? null;
            if (!url) {
              return {
                ...item,
                status: "error",
                error: "Generation returned no image",
              };
            }

            return {
              ...item,
              imageUrl: url,
              status: "complete",
              error: null,
            };
          })
        );
      } catch (error) {
        console.error("Failed to generate image", error);
        const fallbackMessage =
          error instanceof Error ? error.message : "Failed to generate image";

        const placeholderSet = new Set(placeholderIds);
        setItems((prev) =>
          prev.map((item) =>
            placeholderSet.has(item.id)
              ? {
                  ...item,
                  status: "error",
                  error: fallbackMessage,
                }
              : item
          )
        );
      } finally {
        setActiveRequests((count) => Math.max(count - 1, 0));
      }
    },
    []
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex">
      <Sidebar />
      <div className="flex-1 relative overflow-hidden">
        <CanvasWorkspace
          items={items}
          onMove={handleMoveItem}
          onFocus={bringItemToFront}
          onRetry={handleRetryItem}
        />
        <PromptDock
          models={IMAGE_GEN_MODELS}
          onSubmit={handlePromptSubmit}
          pending={activeRequests > 0}
        />
      </div>
    </div>
  );
}
