"use server";

import Replicate from "replicate";
import { IMAGE_GEN_MODELS, MODEL_INPUT_DEFAULTS, UPSCALER_MODEL, TEXT_GEN_MODEL } from "@/hooks/replicate";
import { saveImage } from "@/hooks/ssr/google";

export type GenerateImagePayload = {
  prompt: string;
  model: string;
  numImages: number;
  referenceImages?: File[];
};

export type GeneratedImage = {
  url: string;
  storage?: {
    bucket: string;
    objectName: string;
  };
};

export type GenerateImageResponse = {
  images: GeneratedImage[];
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

export async function optimizePrompt(userPrompt: string): Promise<string> {
  if (!userPrompt || !userPrompt.trim()) {
    throw new Error("Prompt is required for optimization");
  }

  const systemPrompt = `You are an expert at crafting detailed, effective prompts for AI image generation models. Given a user's input prompt, enhance it to be more descriptive, specific, and optimized for high-quality image generation. Focus on:

- Adding relevant visual details (lighting, composition, style, mood)
- Improving clarity and specificity
- Maintaining the user's original intent
- Keeping it concise (max 150 words)
- For realistic image add information about the camera angle and the camera distance, lens type etc
- Using terminology that works well with image generation models

Return ONLY the improved JSON formatted prompt, without any explanation or preamble.`;

  const input = {
    top_p: 1,
    prompt: `${systemPrompt}\n\nUser prompt: "${userPrompt.trim()}"\n\nImproved prompt:`,
    max_tokens: 1024,
    temperature: 0.7,
    presence_penalty: 0,
    frequency_penalty: 0,
  };

  let optimizedText = "";

  try {
    for await (const event of replicate.stream(TEXT_GEN_MODEL, { input })) {
      optimizedText += event.toString();
    }

    const cleaned = optimizedText.trim();

    // Return optimized prompt or fall back to original if empty
    return cleaned.length > 0 ? cleaned : userPrompt.trim();
  } catch (error) {
    console.error("Failed to optimize prompt, using original", error);
    return userPrompt.trim();
  }
}

export async function generateTextToImage(formData: FormData): Promise<GenerateImageResponse> {
  const prompt = formData.get("prompt");
  const model = formData.get("model");
  const amount = formData.get("numImages");
  const aspectRatioValue = formData.get("aspectRatio");

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
  const clampedCount = Number.isFinite(numImages) && numImages > 0 ? Math.min(numImages, 5) : 1;
  const selectedAspectRatio =
    typeof aspectRatioValue === "string" && (aspectRatioValue === "16:9" || aspectRatioValue === "9:16") ? (aspectRatioValue as "16:9" | "9:16") : undefined;

  const referenceEntries = formData.getAll("references");
  const referenceFiles = referenceEntries.filter((file): file is File => file instanceof File && file.size > 0);
  const referenceUrls = formData.getAll("referenceUrls").filter((value): value is string => typeof value === "string" && value.length > 0);

  const input: Record<string, unknown> = {
    ...preset,
    prompt: prompt.trim(),
  };

  if (knownModel === "black-forest-labs/flux-krea-dev") {
    input.num_outputs = clampedCount;
  } else {
    input.num_images = clampedCount;
  }

  console.log("Reference files", referenceFiles, "Reference urls", referenceUrls);

  const normalizedReferences: string[] = [];

  if (referenceFiles.length > 0) {
    const fileInputs = await Promise.all(
      referenceFiles.map(async (file) => {
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const base64 = buffer.toString("base64");
        const contentType = file.type || "application/octet-stream";
        return `data:${contentType};base64,${base64}`;
      })
    );
    normalizedReferences.push(...fileInputs);
  }

  if (referenceUrls.length > 0) {
    for (const url of referenceUrls) {
      try {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Reference fetch failed with status ${response.status}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const contentType = response.headers.get("content-type") || "application/octet-stream";
        normalizedReferences.push(`data:${contentType};base64,${buffer.toString("base64")}`);
      } catch (error) {
        console.error("Failed to fetch reference URL", { url, error });
      }
    }
  }

  if (normalizedReferences.length > 0) {
    input.image_input = normalizedReferences;
  }

  if (selectedAspectRatio) {
    input.aspect_ratio = selectedAspectRatio;
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
        const result = await saveImage({ imageUrl: url, prompt: prompt.trim() });
        return {
          url: result.publicUrl,
          storage: { bucket: result.bucket, objectName: result.objectName },
        } satisfies GeneratedImage;
      } catch (err) {
        console.error("Failed to upload image to GCS; falling back to original URL", err);
        return { url } satisfies GeneratedImage;
      }
    })
  );

  return { images: uploaded };
}

export async function upscaleImage(imageUrl: string, scale: number = 4): Promise<GeneratedImage> {
  if (typeof imageUrl !== "string" || !imageUrl) {
    throw new Error("upscaleImage: imageUrl is required");
  }

  //TODO: auto set scale to max supported
  // Input image of dimensions (1536, 2816, 3) has a total number of pixels 4325376 greater than the max size that fits in GPU memory on this hardware, 2096704. Resize input image and try again.

  const input: Record<string, unknown> = { image: imageUrl, scale };

  const output = await replicate.run(UPSCALER_MODEL, { input });
  const images = normalizeOutput(output);
  const first = images[0];
  if (!first) {
    throw new Error("Upscaler returned no image");
  }

  try {
    const uploaded = await saveImage({ imageUrl: first, fileName: undefined, prompt: undefined });
    return {
      url: uploaded.publicUrl,
      storage: { bucket: uploaded.bucket, objectName: uploaded.objectName },
    } satisfies GeneratedImage;
  } catch (err) {
    console.error("Failed to upload upscaled image to GCS; falling back to original URL", err);
    return { url: first } satisfies GeneratedImage;
  }
}
