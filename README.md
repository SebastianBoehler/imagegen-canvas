# ImageGen Canvas

An experimental canvas UI for orchestrating AI-assisted image generation. Arrange generations spatially, iterate with prompts, attach reference images, and compare multiple versions on a persistent canvas.

![ImageGen Canvas screenshot](images/screenshot.png)
![ImageGen Canvas screenshot 2](images/screenshot1.png)

The app uses a collaborative workspace metaphor:

- A left-aligned sidebar for workspace actions.
- A bottom-centered prompt dock for conversational generation.
- A canvas where each generation is a draggable card that keeps the image’s native aspect ratio (no cropping).

## Features

- Draggable image cards on a spatial canvas (`src/components/canvas/`).
- Dynamic card sizing to the image’s aspect ratio (no cropping, scaled to fit a cap).
- Multi-version generation (1–5 outputs per prompt).
- Model selection with sensible per-model defaults (`src/hooks/replicate.ts`).
- Attach one or more reference images; they are sent as base64 data URIs to the model.
- Status UI: pending spinner, error message surfaces.
- Per-card model label overlay.
- Keyboard UX: Enter to submit, Shift+Enter for a new line.
- Full-resolution image preview with metadata overlay (created time, pixel size, type, file size) and a Download button (via `/api/download`).
- Retry button on failed generations.
- Right-click item menu with “Upscale ×4” (uses Replicate upscaler) and creates a new derived item.
- Visual linking: derived items (e.g., upscales) are connected to their base image with a line that stays attached while moving.
- Google Cloud Storage (GCS) integration: generated images are uploaded to a GCS bucket and served via `https://storage.googleapis.com/<bucket>/<object>`.

See the evolving roadmap in `agents.md`.

## Quick start

Prereqs:

- Node 18+ (recommended)
- [Bun](https://bun.sh) 1.1+
- A Replicate API token

1) Install deps

```bash
bun install
```

2) Configure environment

Create `.env.local` in the project root with your Replicate token and GCS bucket name:

```bash
REPLICATE_API_TOKEN=your_replicate_api_token_here
GCS_BUCKET=your_public_bucket_name
```

3) Run the app

```bash
bun dev
```

Then open http://localhost:3000

## Usage

- Type a prompt in the bottom dock, choose a model and number of versions, then press Enter.
- Optionally attach reference images via “Attach references”.
- New items appear on the canvas slightly offset and are draggable.
- When the image finishes, the card resizes to the native aspect ratio and shows the full image (no cropping). The longest edge is capped for readability.
- Right-click on a completed image to open the context menu, then choose “Upscale ×4” to generate a higher-resolution version via Replicate. A new card is added and visually linked to the original.
- Hover an item and click the eye icon to open the full-resolution preview; use Download in the top-right to save the image.

## Configuration

Models and default inputs are defined in `src/hooks/replicate.ts`:

- `IMAGE_GEN_MODELS`: list of selectable models (e.g. `black-forest-labs/flux-1.1-pro`).
- `MODEL_INPUT_DEFAULTS`: per-model default inputs (e.g. aspect ratio, output format, etc.).

The server-side generation handler lives in `src/hooks/ssr/replicate.ts` and uses the Replicate SDK. Reference files are read and sent as base64 `data:` URLs. Upscaling uses the configured `UPSCALER_MODEL` (see `src/hooks/replicate.ts`).

Image delivery is allowed via Next Image configuration in `next.config.ts` (remote patterns for `replicate.com`, `replicate.delivery`, and `storage.googleapis.com`).

Card sizing behavior is controlled in `src/components/canvas/item-card.tsx` (`DEFAULT_SIDE` cap). Increase it for larger on-canvas previews.

## Google Cloud Storage

This project uploads generated images to a Google Cloud Storage bucket and returns public URLs for display.

- Place your service account key file at the project root as `service-account.json` (this file is git-ignored).
- Set `GCS_BUCKET` in `.env.local` to the name of your bucket.
- The server uses `@google-cloud/storage` and reads credentials from `./service-account.json` only.
- Next Image is configured to allow `storage.googleapis.com`.

Notes:

- For local dev, a public-read bucket is simplest. If you switch to a private bucket later, you can use signed URLs or proxy reads via an API route.

## Tech stack

- Next.js 15 (App Router)
- React 19
- Tailwind CSS v4
- Replicate Node SDK
- Google Cloud Storage (`@google-cloud/storage`)

## Scripts

```bash
bun dev      # start dev server (Turbopack)
bun run build  # build (Turbopack)
bun start    # run production server
bun run lint   # lint
```

## Deploy

On platforms like Vercel, set `REPLICATE_API_TOKEN` and `GCS_BUCKET` as environment variables. You must also provide a `service-account.json` to the runtime (e.g., via a secure file mount or adjust the code to read credentials from an environment variable). The image remote patterns in `next.config.ts` cover Replicate and Google Cloud Storage.

## Roadmap / Ideas

See `agents.md` for upcoming ideas such as canvas zoom, richer right-click menus (download, edit, copy prompt, delete), variant linking/graph views, and persistence.

## Troubleshooting

- Blank images: ensure `REPLICATE_API_TOKEN` is set and valid.
- Images not loading: verify `next.config.ts` `images.remotePatterns` and that the URL host matches Replicate.
- 429/limits: Replicate rate limiting may apply; reduce concurrent generations.

