export const IMAGE_GEN_MODELS = [
  "google/imagen-4-ultra",
  "google/nano-banana",
  "leonardoai/lucid-origin",
  "bytedance/seedream-4",
  "black-forest-labs/flux-1.1-pro",
] as const satisfies readonly `${string}/${string}`[];

export type ImageGenModel = (typeof IMAGE_GEN_MODELS)[number];

export const MODEL_INPUT_DEFAULTS: Partial<Record<ImageGenModel, Record<string, unknown>>> = {
  "google/nano-banana": {
    output_format: "png",
  },
  "leonardoai/lucid-origin": {
    style: "none",
    contrast: "medium",
    aspect_ratio: "16:9",
    prompt_enhance: true,
    generation_mode: "ultra",
  },
  "bytedance/seedream-4": {
    size: "custom",
    width: 2048, // max 4096
    height: 2048, // max 4096
  },
  "google/imagen-4-ultra": {
    output_format: "png",
    safety_filter_level: "block_only_high",
    aspect_ratio: "16:9",
  },
  "black-forest-labs/flux-1.1-pro": {
    output_format: "png",
    aspect_ratio: "16:9",
    safety_tolerance: 6, // highest tolerance
  },
};
