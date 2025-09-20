"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ImageGenModel } from "@/hooks/replicate";

const MAX_VARIATIONS = 5;

export type PromptSubmissionMeta = {
  prompt: string;
  model: string;
  numImages: number;
  aspectRatio: "16:9" | "9:16";
};

type PromptDockProps = {
  models: readonly ImageGenModel[] | readonly string[];
  onSubmit: (formData: FormData, meta: PromptSubmissionMeta) => Promise<void> | void;
  pending?: boolean;
};

export function PromptDock({ models, onSubmit, pending = false }: PromptDockProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const promptRef = useRef<HTMLTextAreaElement>(null);
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState(models[0] ?? "");
  const [numImages, setNumImages] = useState(1);
  const [files, setFiles] = useState<File[]>([]);
  const [aspectRatio, setAspectRatio] = useState<"16:9" | "9:16">("16:9");

  const modelOptions = useMemo(() => models.map((value) => ({ value, label: value })), [models]);

  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const nextFiles = event.target.files ? Array.from(event.target.files) : [];
    setFiles(nextFiles);
  }, []);

  const handlePromptKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        formRef.current?.requestSubmit();
      }
    },
    []
  );

  const resetFileInput = useCallback(() => {
    setFiles([]);
    const node = fileInputRef.current;
    if (node) {
      node.value = "";
    }
  }, []);

  useEffect(() => {
    const node = promptRef.current;
    if (!node) {
      return;
    }

    node.style.height = "auto";
    node.style.height = `${node.scrollHeight}px`;
  }, [prompt]);

  const handleSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      const form = event.currentTarget;
      const formData = new FormData(form);
      const promptValue = String(formData.get("prompt") ?? "").trim();
      if (!promptValue) {
        return;
      }

      const modelValue = String(formData.get("model") ?? model);
      const parsedCount = Number.parseInt(String(formData.get("numImages") ?? "1"), 10);
      const count = Number.isFinite(parsedCount)
        ? Math.min(Math.max(parsedCount, 1), MAX_VARIATIONS)
        : 1;

      const aspectRatioValue = String(formData.get("aspectRatio") ?? aspectRatio);
      const normalizedAspectRatio = aspectRatioValue === "9:16" ? "9:16" : "16:9";

      formData.set("prompt", promptValue);
      formData.set("model", modelValue);
      formData.set("numImages", String(count));
      formData.set("aspectRatio", normalizedAspectRatio);

      setPrompt("");
      setFiles([]);
      resetFileInput();

      const submission = onSubmit(formData, {
        prompt: promptValue,
        model: modelValue,
        numImages: count,
        aspectRatio: normalizedAspectRatio,
      });

      if (submission instanceof Promise) {
        submission.catch((error) => {
          console.error("Prompt submission failed", error);
        });
      }
    },
    [aspectRatio, model, onSubmit, resetFileInput]
  );

  const disableSubmit = !prompt.trim();
  const buttonLabel = "Generate";

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      className="pointer-events-auto absolute bottom-6 left-1/2 flex w-full max-w-3xl -translate-x-1/2 flex-col gap-3 text-slate-200"
    >
      <div className="rounded-3xl border border-white/10 bg-slate-900/80 shadow-2xl shadow-black/50 backdrop-blur">
        <div className="flex items-end gap-4 px-4 pt-4">
          <textarea
            name="prompt"
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            onKeyDown={handlePromptKeyDown}
            ref={promptRef}
            rows={1}
            placeholder="Describe what to create…"
            className="flex-1 resize-none rounded-2xl bg-transparent text-base leading-relaxed text-white outline-none placeholder:text-slate-500"
            autoComplete="off"
          />
          <div className="flex flex-col items-end gap-1 pb-1">
            <button
              type="submit"
              disabled={disableSubmit}
              className="inline-flex items-center rounded-full bg-emerald-500 px-4 py-2 text-sm font-medium text-emerald-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-emerald-500/40"
            >
              {buttonLabel}
            </button>
            {pending ? (
              <span className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-emerald-300/80">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                Running
              </span>
            ) : null}
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-white/10 px-4 py-3 text-xs uppercase tracking-wide text-slate-400">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-medium lowercase text-slate-200 transition hover:bg-white/10"
            >
              Attach references
            </button>
            <input
              ref={fileInputRef}
              name="references"
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleFileChange}
            />
            {files.length > 0 ? (
              <span className="text-[11px] text-slate-400">
                {files.length} file{files.length === 1 ? "" : "s"} attached
              </span>
            ) : null}
          </div>
          <div className="flex items-center gap-2 text-[11px] capitalize text-slate-300">
            <label htmlFor="model" className="text-slate-400">
              Model
            </label>
            <select
              id="model"
              name="model"
              value={model}
              onChange={(event) => setModel(event.target.value as ImageGenModel | string)}
              className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-slate-100 outline-none transition hover:bg-white/10"
            >
              {modelOptions.map((option) => (
                <option key={option.value} value={option.value} className="bg-slate-900 text-slate-100">
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2 text-[11px] capitalize text-slate-300">
            <label htmlFor="aspectRatio" className="text-slate-400">
              Aspect
            </label>
            <select
              id="aspectRatio"
              name="aspectRatio"
              value={aspectRatio}
              onChange={(event) => setAspectRatio(event.target.value === "9:16" ? "9:16" : "16:9")}
              className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-slate-100 outline-none transition hover:bg-white/10"
            >
              <option value="16:9" className="bg-slate-900 text-slate-100">
                16:9 landscape
              </option>
              <option value="9:16" className="bg-slate-900 text-slate-100">
                9:16 portrait
              </option>
            </select>
          </div>
          <div className="flex items-center gap-2 text-[11px] capitalize text-slate-300">
            <label htmlFor="numImages" className="text-slate-400">
              Versions
            </label>
            <select
              id="numImages"
              name="numImages"
              value={String(numImages)}
              onChange={(event) => setNumImages(Number.parseInt(event.target.value, 10))}
              className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-slate-100 outline-none transition hover:bg-white/10"
            >
              {Array.from({ length: MAX_VARIATIONS }, (_, index) => index + 1).map((count) => (
                <option key={count} value={String(count)} className="bg-slate-900 text-slate-100">
                  {count}×
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </form>
  );
}
