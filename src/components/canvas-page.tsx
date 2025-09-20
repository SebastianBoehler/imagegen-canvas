"use client";

import { useCallback, useState } from "react";
import { IMAGE_GEN_MODELS, UPSCALER_MODEL } from "@/hooks/replicate";
import { generateTextToImage, upscaleImage } from "@/hooks/ssr/replicate";
import { deleteImage } from "@/hooks/ssr/google";
import { Sidebar } from "./sidebar";
import { CanvasWorkspace } from "./canvas/workspace";
import type { PromptAttachedReference, PromptSubmissionMeta } from "./prompt/prompt-dock";
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
  aspectRatio: "16:9" | "9:16";
  createdAt: number;
  parentId?: string;
  storage?: {
    bucket: string;
    objectName: string;
  };
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
  const [attachedReferences, setAttachedReferences] = useState<PromptAttachedReference[]>([]);

  const handleMoveItem = useCallback((id: string, x: number, y: number) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, position: { x, y } } : item))
    );
  }, []);

  const handleUpscaleItem = useCallback(async (id: string) => {
    // Find source item
    const source = items.find((it) => it.id === id);
    if (!source || !source.imageUrl) return;

    // Create a new placeholder item near the source
    const newId = crypto.randomUUID();
    const now = Date.now();
    const placeholder = {
      id: newId,
      prompt: `${source.prompt} (upscaled ${source.model})`,
      model: UPSCALER_MODEL,
      imageUrl: null,
      status: "pending" as CanvasItemStatus,
      error: null as string | null,
      position: { x: source.position.x + 48, y: source.position.y + 48 },
      aspectRatio: source.aspectRatio,
      createdAt: now,
      parentId: source.id,
      storage: undefined,
    } satisfies CanvasItem;

    setItems((prev) => [...prev, placeholder]);
    setActiveRequests((c) => c + 1);

    try {
      const upscaledUrl = await upscaleImage(source.imageUrl);
      setItems((prev) =>
        prev.map((item) =>
          item.id === newId
            ? {
                ...item,
                imageUrl: upscaledUrl.url,
                status: "complete" as CanvasItemStatus,
                error: null,
                storage: upscaledUrl.storage,
              }
            : item
        )
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to upscale image";
      setItems((prev) =>
        prev.map((item) =>
          item.id === newId ? { ...item, status: "error" as CanvasItemStatus, error: message, storage: undefined } : item
        )
      );
    } finally {
      setActiveRequests((c) => Math.max(c - 1, 0));
    }
  }, [items]);

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
          return {
            ...item,
            status: "pending" as CanvasItemStatus,
            error: null,
            imageUrl: null,
            storage: undefined,
          };
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
      formData.set("aspectRatio", snapshot.aspectRatio);

      const response = await generateTextToImage(formData);
      const first = response.images[0];
      const url = first?.url ?? null;

      setItems((prev) =>
        prev.map((item) =>
          item.id === id
            ? url
              ? {
                  ...item,
                  imageUrl: url,
                  status: "complete" as CanvasItemStatus,
                  error: null,
                  storage: first?.storage,
                }
              : {
                  ...item,
                  status: "error" as CanvasItemStatus,
                  error: "Retry returned no image",
                  storage: undefined,
                }
            : item
        )
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to retry generation";
      setItems((prev) =>
        prev.map((item) =>
          item.id === id
            ? { ...item, status: "error" as CanvasItemStatus, error: message, storage: undefined }
            : item
        )
      );
    } finally {
      setActiveRequests((c) => Math.max(c - 1, 0));
    }
  }, []);

  const handleAttachReference = useCallback(
    (id: string) => {
      const source = items.find((item) => item.id === id);
      if (!source || !source.imageUrl) {
        console.warn("attachReference: source image unavailable", { id });
        return;
      }

      setAttachedReferences((prev) => {
        if (prev.some((reference) => reference.id === id)) {
          return prev;
        }

        return [
          ...prev,
          {
            id,
            sourceItemId: id,
            remoteUrl: source.imageUrl,
            previewUrl: source.imageUrl,
            label: source.prompt,
          },
        ];
      });
    },
    [items]
  );

  const handleRemoveReference = useCallback((referenceId: string) => {
    setAttachedReferences((prev) => prev.filter((reference) => reference.id !== referenceId));
  }, []);

  const handleClearReferences = useCallback(() => {
    setAttachedReferences([]);
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
            aspectRatio: meta.aspectRatio,
            createdAt: now + index,
            parentId: meta.referenceSourceIds[0] ?? undefined,
            storage: undefined,
          });
        }
        return next;
      });

      formData.set("numImages", String(safeCount));
      formData.set("aspectRatio", meta.aspectRatio);
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

            const result = response.images[imageIndex];
            const url = result?.url ?? null;
            if (!url) {
              return {
                ...item,
                status: "error",
                error: "Generation returned no image",
                storage: undefined,
              };
            }

            return {
              ...item,
              imageUrl: url,
              status: "complete",
              error: null,
              storage: result?.storage,
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
                  storage: undefined,
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

  const handleDeleteItem = useCallback(async (id: string) => {
    let targetStorage: CanvasItem["storage"] | undefined;
    setItems((prev) => {
      const next: CanvasItem[] = [];
      for (const item of prev) {
        if (item.id === id) {
          targetStorage = item.storage;
          continue;
        }
        next.push(item);
      }
      return next;
    });

    if (targetStorage) {
      try {
        await deleteImage(targetStorage);
      } catch (error) {
        console.error("Failed to delete image from storage", error);
      }
    }
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex">
      <Sidebar />
      <div className="flex-1 relative overflow-hidden">
        <CanvasWorkspace
          items={items}
          onMove={handleMoveItem}
          onFocus={bringItemToFront}
          onRetry={handleRetryItem}
          onUpscale={handleUpscaleItem}
          onDelete={handleDeleteItem}
          onAttachReference={handleAttachReference}
        />
        <PromptDock
          models={IMAGE_GEN_MODELS}
          onSubmit={handlePromptSubmit}
          pending={activeRequests > 0}
          attachedReferences={attachedReferences}
          onRemoveReference={handleRemoveReference}
          onClearReferences={handleClearReferences}
        />
      </div>
    </div>
  );
}
