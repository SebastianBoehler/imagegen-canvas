"use server";

import Replicate from "replicate";
import { IMAGE_GEN_MODELS, MODEL_INPUT_DEFAULTS, UPSCALER_MODEL } from "@/hooks/replicate";
import { saveImage } from "@/hooks/ssr/google";

export type GenerateImagePayload = {
  prompt: string;
  model: string;
  numImages: number;
  referenceImages?: File[];
};

export type GenerateImageResponse = {
  images: string[];
};

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

function normalizeOutput(output: unknown): string[] {
  if (!output) {
    return [];
  }

  const pullUrl = (candidate: unknown): string | null => {
    if (!candidate) {
      return null;
    }

    if (typeof candidate === "string") {
      return candidate;
    }

    if (candidate instanceof URL) {
      return candidate.toString();
    }

    if (typeof candidate === "object" && candidate) {
      const value = candidate as {
        url?: string | URL | (() => string | URL);
        toString?: () => string;
      };

      if (typeof value.url === "string") {
        return value.url;
      }

      if (value.url instanceof URL) {
        return value.url.toString();
      }

      if (typeof value.url === "function") {
        try {
          const resolved = value.url();
          return resolved instanceof URL ? resolved.toString() : String(resolved);
        } catch (error) {
          console.error("Failed to resolve output url()", error);
          return null;
        }
      }

      if (typeof value.toString === "function" && value.toString !== Object.prototype.toString) {
        try {
          const result = value.toString();
          return typeof result === "string" ? result : null;
        } catch (error) {
          console.error("Failed to convert output via toString", error);
        }
      }
    }

    return null;
  };

  if (Array.isArray(output)) {
    return output
      .map((item) => {
        if (Array.isArray(item)) {
          return item.map(pullUrl).filter(Boolean);
        }

        return pullUrl(item);
      })
      .flat()
      .filter((url): url is string => Boolean(url));
  }

  const url = pullUrl(output);
  return url ? [url] : [];
}

export async function generateTextToImage(formData: FormData): Promise<GenerateImageResponse> {
  const prompt = formData.get("prompt");
  const model = formData.get("model");
  const amount = formData.get("numImages");

  if (typeof prompt !== "string" || !prompt.trim()) {
    throw new Error("Prompt is required");
  }

  if (typeof model !== "string" || !model.trim()) {
    throw new Error("Model is required");
  }

  if (!model.includes("/")) {
    throw new Error("Invalid model identifier");
  }

  const modelIdentifier = model.trim() as `${string}/${string}` | `${string}/${string}:${string}`;

  const knownModel = IMAGE_GEN_MODELS.find((candidate) => candidate === modelIdentifier);
  const preset = knownModel ? MODEL_INPUT_DEFAULTS[knownModel] ?? {} : {};

  const numImages = Number.parseInt(String(amount ?? "1"), 10);

  // for some reason, the reference files are sometimes empty
  const referenceFiles = formData.getAll("references").filter((file): file is File => file instanceof File && file.size > 0);

  const input: Record<string, unknown> = {
    ...preset,
    prompt,
    num_images: Number.isFinite(numImages) && numImages > 0 ? Math.min(numImages, 5) : 1,
  };

  console.log("Reference files", referenceFiles);
  if (referenceFiles.length > 0) {
    input.image_input = await Promise.all(
      referenceFiles.map(async (file) => {
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const base64 = buffer.toString("base64");
        const contentType = file.type || "application/octet-stream";
        return `data:${contentType};base64,${base64}`;
      })
    );
  }

  //console.log("Running replicate with input", input);
  const output = await replicate.run(modelIdentifier, { input });
  const images = normalizeOutput(output);

  if (images.length === 0) {
    console.warn("Replicate returned no image URLs");
  }

  // Upload each image to GCS and return their public URLs
  const uploaded = await Promise.all(
    images.map(async (url) => {
      try {
        const result = await saveImage({ imageUrl: url, prompt });
        return result.publicUrl;
      } catch (err) {
        console.error("Failed to upload image to GCS; falling back to original URL", err);
        return url;
      }
    })
  );

  return { images: uploaded };
}

export async function upscaleImage(imageUrl: string): Promise<string> {
  if (typeof imageUrl !== "string" || !imageUrl) {
    throw new Error("upscaleImage: imageUrl is required");
  }

  const input: Record<string, unknown> = { image: imageUrl };

  const output = await replicate.run(UPSCALER_MODEL, { input });
  const images = normalizeOutput(output);
  const first = images[0];
  if (!first) {
    throw new Error("Upscaler returned no image");
  }

  const uploaded = await saveImage({ imageUrl: first, fileName: undefined, prompt: undefined });
  return uploaded.publicUrl;
}
