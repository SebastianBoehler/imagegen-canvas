import { NextRequest, NextResponse } from "next/server";

// Only allow downloads from your configured bucket on storage.googleapis.com
function isAllowedUrl(url: URL, bucket: string | undefined): boolean {
  if (!bucket) return false;
  const hostOk = url.hostname === "storage.googleapis.com";
  const pathOk = url.pathname.startsWith(`/${bucket}/`);
  return hostOk && pathOk;
}

export async function GET(req: NextRequest) {
  try {
    const urlParam = req.nextUrl.searchParams.get("url");
    const bucket = process.env.GCS_BUCKET;

    if (!urlParam) {
      return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
    }

    let target: URL;
    try {
      target = new URL(urlParam);
    } catch {
      return NextResponse.json({ error: "Invalid url parameter" }, { status: 400 });
    }

    if (!isAllowedUrl(target, bucket)) {
      return NextResponse.json({ error: "URL not permitted" }, { status: 400 });
    }

    const res = await fetch(target.toString());
    if (!res.ok || !res.body) {
      return NextResponse.json({ error: `Failed to fetch resource (${res.status})` }, { status: 502 });
    }

    // Derive filename
    const cd = res.headers.get("content-disposition") || "";
    const match = cd.match(/filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i);
    let filename: string | null = null;
    if (match) {
      filename = decodeURIComponent(match[1] || match[2]);
    }
    if (!filename) {
      const parts = target.pathname.split("/");
      filename = parts[parts.length - 1] || "image";
    }

    const contentType = res.headers.get("content-type") || "application/octet-stream";

    const headers = new Headers();
    headers.set("content-type", contentType);
    headers.set("cache-control", "public, max-age=31536000, immutable");
    headers.set("content-disposition", `attachment; filename="${filename}"`);

    return new NextResponse(res.body, { status: 200, headers });
  } catch (error) {
    console.error("/api/download error", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
