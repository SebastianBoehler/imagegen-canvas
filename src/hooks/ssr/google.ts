"use server";

import { Storage } from "@google-cloud/storage";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import "server-only";

export type SaveImageParams = {
  imageUrl: string;
  fileName?: string;
  prompt?: string;
  contentType?: string;
  bucketName?: string;
};

export type SaveImageResult = {
  publicUrl: string;
  gcsUri: string;
  bucket: string;
  objectName: string;
};

export type DeleteImageParams = {
  bucket: string;
  objectName: string;
};

let storageSingleton: Storage | null = null;

function resolveCredentialsPath(): string {
  // Only allow root-level service-account.json
  const p = path.resolve(process.cwd(), "service-account.json");
  return p;
}

function getStorage(): Storage {
  if (storageSingleton) return storageSingleton;

  const credPath = resolveCredentialsPath();
  if (!fs.existsSync(credPath)) {
    throw new Error(
      `GCS credentials not found. Place your service account key at: ${credPath}.\n` +
        `You can create it via: gcloud iam service-accounts keys create service-account.json --iam-account=<SA_EMAIL>`
    );
  }

  storageSingleton = new Storage({
    keyFilename: credPath,
  });

  return storageSingleton;
}

function extFromContentType(ct?: string | null): string {
  if (!ct) return "png";
  const mime = ct.split(";")[0].trim().toLowerCase();
  if (mime === "image/png") return "png";
  if (mime === "image/jpeg" || mime === "image/jpg") return "jpg";
  if (mime === "image/webp") return "webp";
  if (mime === "image/gif") return "gif";
  if (mime === "image/heic") return "heic";
  return "png";
}

function extFromUrl(url: string): string | null {
  try {
    const u = new URL(url);
    const pathname = u.pathname.toLowerCase();
    const match = pathname.match(/\.([a-z0-9]{2,5})(?:$|\?)/);
    return match ? match[1] : null;
  } catch {
    const match = url.toLowerCase().match(/\.([a-z0-9]{2,5})(?:$|\?)/);
    return match ? match[1] : null;
  }
}

function slug(value: string, max = 60): string {
  const base = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
  return base.slice(0, max) || "image";
}

export async function saveImage(params: SaveImageParams): Promise<SaveImageResult> {
  const { imageUrl, prompt, fileName, contentType, bucketName } = params;

  if (typeof imageUrl !== "string" || !imageUrl) {
    throw new Error("saveImage: imageUrl is required");
  }

  const bucket = (bucketName || process.env.GCS_BUCKET || "").trim();
  if (!bucket) {
    throw new Error("GCS_BUCKET env var is required (or pass bucketName) to upload images to Google Cloud Storage");
  }

  const res = await fetch(imageUrl);
  if (!res.ok) {
    throw new Error(`Failed to fetch image (${res.status} ${res.statusText}) from ${imageUrl}`);
  }

  const ct = (contentType || res.headers.get("content-type") || "image/png").split(";")[0].trim();
  const buf = Buffer.from(await res.arrayBuffer());

  const urlExt = extFromUrl(imageUrl);
  const ctExt = extFromContentType(ct);
  const ext = urlExt || ctExt || "png";

  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  const rand = crypto.randomBytes(6).toString("hex");
  const base = fileName || (prompt ? slug(prompt) : "image");
  const objectName = `images/${y}/${m}/${d}/${base}-${rand}.${ext}`;

  const storage = getStorage();
  const b = storage.bucket(bucket);
  const file = b.file(objectName);

  await file.save(buf, {
    resumable: false,
    contentType: ct,
    public: false, // Bucket IAM will grant public read if configured
    metadata: {
      contentType: ct,
      cacheControl: "public, max-age=31536000, immutable",
    },
  });

  const publicUrl = `https://storage.googleapis.com/${encodeURIComponent(bucket)}/${objectName.split("/").map(encodeURIComponent).join("/")}`;

  return {
    publicUrl,
    gcsUri: `gs://${bucket}/${objectName}`,
    bucket,
    objectName,
  };
}

export async function deleteImage(params: DeleteImageParams): Promise<void> {
  const { bucket, objectName } = params;

  if (!bucket || !objectName) {
    throw new Error("deleteImage: bucket and objectName are required");
  }

  const storage = getStorage();
  const b = storage.bucket(bucket);
  const file = b.file(objectName);

  await file.delete({ ignoreNotFound: true });
}
