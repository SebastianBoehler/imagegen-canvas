export const IMAGE_GEN_MODELS = [
  "google/imagen-4-ultra",
  "google/nano-banana",
  "leonardoai/lucid-origin",
  "bytedance/seedream-4",
  "black-forest-labs/flux-1.1-pro",
  "black-forest-labs/flux-krea-dev",
  "ideogram-ai/ideogram-v3-quality",
  "luma/photon",
] as const satisfies readonly `${string}/${string}`[];

export type ImageGenModel = (typeof IMAGE_GEN_MODELS)[number];

export const UPSCALER_MODEL = "daanelson/real-esrgan-a100:f94d7ed4a1f7e1ffed0d51e4089e4911609d5eeee5e874ef323d2c7562624bed";

export const MODEL_INPUT_DEFAULTS: Partial<Record<ImageGenModel, Record<string, unknown>>> = {
  "google/nano-banana": {
    output_format: "png",
    //always horizontal no aspect ratio support
  },
  "leonardoai/lucid-origin": {
    style: "none",
    contrast: "medium",
    aspect_ratio: "16:9",
    prompt_enhance: false,
    generation_mode: "ultra",
  },
  "bytedance/seedream-4": {
    //size: "custom",
    // width: 4096,
    // height: 2304,
    aspect_ratio: "16:9",
    size: "4K",
    //sequential_image_generation: "auto",
    //max_images: 15 //for sequential generation,
    //image_input: [].
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
  "black-forest-labs/flux-krea-dev": {
    go_fast: false,
    guidance: 2.5,
    megapixels: "1",
    aspect_ratio: "16:9",
    output_format: "png",
    output_quality: 100,
    prompt_strength: 0.8,
    num_inference_steps: 35, // max 50
    disable_safety_checker: true,
  },
  "ideogram-ai/ideogram-v3-quality": {
    aspect_ratio: "16:9",
  },
  "luma/photon": {
    aspect_ratio: "16:9",
  },
};

export const MODEL_COMMERCIAL_OK = new Set([
  "google/imagen-4-ultra",
  "google/nano-banana",
  "black-forest-labs/flux-1.1-pro",
  "leonardoai/lucid-origin",
  "bytedance/seedream-4",
  "ideogram-ai/ideogram-v3-quality",
]);
