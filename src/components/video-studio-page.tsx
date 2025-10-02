"use client";

import { ChangeEvent, FormEvent, useCallback, useMemo, useRef, useState, useTransition } from "react";
import { Sidebar } from "./sidebar";
import { generateImageToVideo } from "@/hooks/ssr/replicate";

type SeedImageState =
  | { kind: "file"; file: File; previewUrl: string }
  | { kind: "frame"; dataUrl: string; previewUrl: string; sourceClipId?: string };

type VideoClip = {
  id: string;
  prompt: string;
  videoUrl: string;
  createdAt: number;
  durationSeconds: number;
  inputPreviewUrl: string;
  lastFrameDataUrl?: string | null;
};

function truncate(text: string, length: number): string {
  if (text.length <= length) {
    return text;
  }
  return `${text.slice(0, length - 1)}…`;
}

async function extractLastFrame(videoUrl: string): Promise<string | null> {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    let settled = false;

    const handleFinish = (value: string | null) => {
      if (settled) {
        return;
      }
      settled = true;
      window.clearTimeout(timeoutId);
      video.removeEventListener("error", handleError);
      video.removeEventListener("loadedmetadata", handleLoadedMetadata);
      video.removeEventListener("loadeddata", handleLoadedData);
      video.removeEventListener("seeked", handleSeeked);
      video.pause();
      video.removeAttribute("src");
      video.load();
      resolve(value);
    };

    const timeoutId = window.setTimeout(() => {
      console.warn("extractLastFrame: timed out", { videoUrl });
      handleFinish(null);
    }, 10000);

    const handleError = () => {
      console.warn("extractLastFrame: failed to load video", { videoUrl });
      handleFinish(null);
    };

    const handleSeeked = () => {
      try {
        const width = video.videoWidth || 1920;
        const height = video.videoHeight || 1080;
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext("2d");
        if (!context) {
          throw new Error("Canvas 2D context unavailable");
        }
        context.drawImage(video, 0, 0, width, height);
        const dataUrl = canvas.toDataURL("image/png");
        handleFinish(dataUrl);
      } catch (error) {
        console.error("extractLastFrame: draw failed", error);
        handleFinish(null);
      }
    };

    const handleLoadedData = () => {
      video.removeEventListener("loadedmetadata", handleLoadedMetadata);
      const duration = Number.isFinite(video.duration) ? video.duration : null;
      const target = duration ? Math.max(duration - 1 / 30, duration - 0.05) : 0;
      try {
        video.currentTime = target;
      } catch (error) {
        console.error("extractLastFrame: failed to seek", error);
        handleFinish(null);
      }
    };

    const handleLoadedMetadata = () => {
      if (video.readyState >= 2) {
        handleLoadedData();
      }
    };

    video.crossOrigin = "anonymous";
    video.preload = "auto";
    video.muted = true;
    video.playsInline = true;

    video.addEventListener("error", handleError);
    video.addEventListener("loadedmetadata", handleLoadedMetadata, { once: true });
    video.addEventListener("loadeddata", handleLoadedData, { once: true });
    video.addEventListener("seeked", handleSeeked);

    video.src = videoUrl;
  });
}

export default function VideoStudioPage() {
  const [clips, setClips] = useState<VideoClip[]>([]);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [seedImage, setSeedImage] = useState<SeedImageState | null>(null);
  const [prompt, setPrompt] = useState("");
  const [duration, setDuration] = useState(10);
  const [resolution, setResolution] = useState("1080p");
  const [negativePrompt, setNegativePrompt] = useState("");
  const [enablePromptExpansion, setEnablePromptExpansion] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [chainingClipId, setChainingClipId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedClip = useMemo(() => {
    if (!selectedClipId) {
      return clips.at(-1) ?? null;
    }
    return clips.find((clip) => clip.id === selectedClipId) ?? clips.at(-1) ?? null;
  }, [clips, selectedClipId]);

  const handleFileChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      setSeedImage(null);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setSeedImage({ kind: "file", file, previewUrl: reader.result });
      }
    };
    reader.readAsDataURL(file);
  }, []);

  const resetFileInput = useCallback(() => {
    const node = fileInputRef.current;
    if (node) {
      node.value = "";
    }
  }, []);

  const handleClearSeedImage = useCallback(() => {
    resetFileInput();
    setSeedImage(null);
  }, [resetFileInput]);

  const handleSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!seedImage) {
        setErrorMessage("Add a starting image to generate a clip.");
        return;
      }

      const promptValue = prompt.trim();
      if (!promptValue) {
        setErrorMessage("Prompt is required.");
        return;
      }

      setErrorMessage(null);

      const formData = new FormData();
      formData.set("prompt", promptValue);
      formData.set("duration", String(duration));
      formData.set("resolution", resolution);
      formData.set("negative_prompt", negativePrompt);
      formData.set("enable_prompt_expansion", enablePromptExpansion ? "true" : "false");

      if (seedImage.kind === "file") {
        formData.set("image", seedImage.file);
      } else {
        formData.set("imageDataUrl", seedImage.dataUrl);
      }

      const clipId = crypto.randomUUID();
      const seedPreview = seedImage.previewUrl;

      startTransition(() => {
        (async () => {
          try {
            const response = await generateImageToVideo(formData);
            const nextClip: VideoClip = {
              id: clipId,
              prompt: promptValue,
              videoUrl: response.videoUrl,
              createdAt: Date.now(),
              durationSeconds: response.durationSeconds,
              inputPreviewUrl: seedPreview,
            };

            setClips((prev) => [...prev, nextClip]);
            setSelectedClipId(clipId);
            setPrompt("");
            setNegativePrompt("");
            if (seedImage.kind === "file") {
              resetFileInput();
            }
            setSeedImage(null);

            try {
              const frame = await extractLastFrame(response.videoUrl);
              if (frame) {
                setClips((prev) =>
                  prev.map((clip) => (clip.id === clipId ? { ...clip, lastFrameDataUrl: frame } : clip))
                );
              }
            } catch (frameError) {
              console.warn("Failed to capture last frame", frameError);
            }
          } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to generate video.";
            setErrorMessage(message);
            setClips((prev) => prev.filter((clip) => clip.id !== clipId));
          }
        })();
      });
    },
    [duration, enablePromptExpansion, negativePrompt, prompt, resetFileInput, resolution, seedImage]
  );

  const handleClipSelect = useCallback((clipId: string) => {
    setSelectedClipId(clipId);
  }, []);

  const handleChainFromClip = useCallback(
    async (clip: VideoClip) => {
      setErrorMessage(null);
      setChainingClipId(clip.id);
      try {
        let frame = clip.lastFrameDataUrl;
        if (!frame) {
          frame = await extractLastFrame(clip.videoUrl);
          if (frame) {
            setClips((prev) =>
              prev.map((item) => (item.id === clip.id ? { ...item, lastFrameDataUrl: frame } : item))
            );
          }
        }

        if (!frame) {
          setErrorMessage("Could not capture the last frame for chaining.");
          return;
        }

        setSelectedClipId(clip.id);
        setSeedImage({ kind: "frame", dataUrl: frame, previewUrl: frame, sourceClipId: clip.id });
        setPrompt("");
        setNegativePrompt("");
      } catch (error) {
        console.error("Failed to chain from clip", error);
        setErrorMessage("Chaining failed—try generating the clip again.");
      } finally {
        setChainingClipId(null);
      }
    },
    []
  );

  const hasSeedImage = Boolean(seedImage);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <main className="flex-1 overflow-y-auto p-8 lg:p-12 flex flex-col gap-8">
          <header className="flex flex-col gap-2">
            <span className="text-xs uppercase tracking-[0.3em] text-slate-400">Video workflows</span>
            <h1 className="text-3xl font-semibold">Video Studio</h1>
            <p className="text-sm text-slate-400 max-w-2xl">
              Start from an image, steer motion with prompts, and chain clips by reusing the final frame as the next
              input. Wan 2.5 handles the image-to-video lift while the timeline keeps iterations organized.
            </p>
          </header>

          {errorMessage ? (
            <div className="rounded-md border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
              {errorMessage}
            </div>
          ) : null}

          <div className="grid gap-8 lg:grid-cols-[3fr_2fr] flex-1">
            <section className="rounded-3xl border border-white/10 bg-slate-900/60 p-6 flex flex-col gap-4 min-h-[420px]">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold">Active sequence</h2>
                  <p className="text-xs uppercase tracking-wide text-slate-400">Preview</p>
                </div>
                {selectedClip ? (
                  <span className="text-xs text-slate-400">{selectedClip.durationSeconds}s · {selectedClip.prompt.length > 0 ? truncate(selectedClip.prompt, 40) : "No prompt"}</span>
                ) : null}
              </div>
              <div className="flex-1 rounded-2xl border border-white/10 bg-black/40 overflow-hidden flex items-center justify-center">
                {selectedClip ? (
                  <video
                    key={selectedClip.id}
                    src={selectedClip.videoUrl}
                    controls
                    className="h-full w-full object-contain bg-black"
                    preload="metadata"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center gap-2 text-center text-slate-500 p-12">
                    <span className="text-sm font-medium">Generate a clip to begin</span>
                    <span className="text-xs uppercase tracking-wide text-slate-600">Upload a starting frame and prompt</span>
                  </div>
                )}
              </div>
              {selectedClip ? (
                <div className="text-sm text-slate-300">
                  <p className="font-medium text-slate-200">Prompt</p>
                  <p className="mt-1 text-slate-400 leading-relaxed">{selectedClip.prompt}</p>
                </div>
              ) : null}
            </section>

            <section className="rounded-3xl border border-white/10 bg-slate-900/60 p-6 flex flex-col gap-6">
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-slate-100">Starting image</label>
                    {hasSeedImage ? (
                      <button
                        type="button"
                        onClick={handleClearSeedImage}
                        className="text-xs uppercase tracking-wide text-slate-400 hover:text-slate-200 transition"
                      >
                        Clear
                      </button>
                    ) : null}
                  </div>
                  <div className="relative overflow-hidden rounded-2xl border border-dashed border-white/15 bg-white/5">
                    {hasSeedImage ? (
                      <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={seedImage?.previewUrl}
                          alt="Seed frame preview"
                          className="h-56 w-full object-cover"
                          draggable={false}
                        />
                        {seedImage?.kind === "frame" ? (
                          <div className="absolute left-4 top-4 rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-medium text-emerald-200">
                            Chained frame
                          </div>
                        ) : null}
                      </>
                    ) : (
                      <label className="flex h-56 w-full cursor-pointer flex-col items-center justify-center gap-2 text-center text-slate-400">
                        <span className="text-sm font-medium">Upload or chain an image</span>
                        <span className="text-xs uppercase tracking-wide text-slate-500">PNG, JPG up to 10MB</span>
                        <input
                          ref={fileInputRef}
                          type="file"
                          name="image"
                          accept="image/*"
                          className="hidden"
                          onChange={handleFileChange}
                        />
                      </label>
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <label htmlFor="prompt" className="text-sm font-medium text-slate-100">
                    Prompt
                  </label>
                  <textarea
                    id="prompt"
                    name="prompt"
                    value={prompt}
                    onChange={(event) => setPrompt(event.target.value)}
                    placeholder="Describe the motion, setting, and any key beats…"
                    rows={4}
                    className="w-full resize-none rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-400/60"
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-2">
                    <label htmlFor="duration" className="text-sm font-medium text-slate-100">
                      Duration (seconds)
                    </label>
                    <input
                      id="duration"
                      name="duration"
                      type="number"
                      min={1}
                      max={60}
                      value={duration}
                      onChange={(event) => setDuration(Math.max(1, Math.min(60, Number(event.target.value) || 1)))}
                      className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/60"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label htmlFor="resolution" className="text-sm font-medium text-slate-100">
                      Resolution
                    </label>
                    <select
                      id="resolution"
                      name="resolution"
                      value={resolution}
                      onChange={(event) => setResolution(event.target.value)}
                      className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/60"
                    >
                      <option value="720p">720p</option>
                      <option value="1080p">1080p</option>
                      <option value="4k">4K</option>
                    </select>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <label htmlFor="negative_prompt" className="text-sm font-medium text-slate-100">
                    Negative prompt
                  </label>
                  <input
                    id="negative_prompt"
                    name="negative_prompt"
                    type="text"
                    value={negativePrompt}
                    onChange={(event) => setNegativePrompt(event.target.value)}
                    placeholder="Details to avoid (optional)"
                    className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-400/60"
                  />
                </div>

                <label className="flex items-center gap-3 text-sm text-slate-200">
                  <input
                    type="checkbox"
                    name="enable_prompt_expansion"
                    checked={enablePromptExpansion}
                    onChange={(event) => setEnablePromptExpansion(event.target.checked)}
                    className="h-4 w-4 rounded border-white/20 bg-black/40 text-emerald-500 focus:ring-emerald-400/60"
                  />
                  Enable prompt expansion
                </label>

                <button
                  type="submit"
                  disabled={isPending}
                  className="inline-flex items-center justify-center rounded-full bg-emerald-500 px-4 py-2 text-sm font-medium text-emerald-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-emerald-500/40"
                >
                  {isPending ? "Generating…" : "Generate clip"}
                </button>
              </form>

              <p className="text-xs text-slate-500 leading-relaxed">
                Chaining uses the final frame from the selected clip as the next starting image. Adjust the prompt or
                duration to iterate new motion passes.
              </p>
            </section>
          </div>
        </main>

        <footer className="border-t border-white/10 bg-slate-950/80 px-6 py-5">
          <div className="flex items-center justify-between pb-3">
            <div>
              <span className="text-xs uppercase tracking-[0.3em] text-slate-500">Timeline</span>
              <p className="text-sm text-slate-300">Drag horizontally to review clips. Chain variants with the plus.</p>
            </div>
          </div>
          {clips.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/15 bg-white/5 px-4 py-6 text-center text-sm text-slate-500">
              Timeline will populate after your first clip completes.
            </div>
          ) : (
            <div className="flex gap-4 overflow-x-auto pb-2">
              {clips.map((clip) => {
                const isActive = selectedClip?.id === clip.id;
                const isChaining = chainingClipId === clip.id;
                return (
                  <div
                    key={clip.id}
                    className={`min-w-[180px] rounded-2xl border px-3 py-3 transition ${
                      isActive ? "border-emerald-400/70 bg-emerald-400/10" : "border-white/10 bg-white/5 hover:bg-white/10"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => handleClipSelect(clip.id)}
                      className="flex w-full flex-col gap-2 text-left"
                    >
                      <div className="relative h-28 overflow-hidden rounded-xl border border-white/10 bg-black">
                        <video
                          src={clip.videoUrl}
                          muted
                          loop
                          playsInline
                          className="h-full w-full object-cover"
                          preload="metadata"
                        />
                        <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-white/80">
                          {clip.durationSeconds}s
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed">{truncate(clip.prompt, 70)}</p>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleChainFromClip(clip)}
                      disabled={isPending || isChaining}
                      className="mt-3 inline-flex w-full items-center justify-center rounded-full border border-white/15 bg-black/40 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-slate-200 transition hover:border-emerald-400/50 hover:text-emerald-200 disabled:cursor-not-allowed disabled:border-white/10 disabled:text-slate-500"
                    >
                      {isChaining ? "Preparing…" : "+ Chain"}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </footer>
      </div>
    </div>
  );
}
