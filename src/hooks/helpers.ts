export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "-";
  const units = ["B", "KB", "MB", "GB"] as const;
  let value = bytes;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i += 1;
  }
  return `${value.toFixed(value < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
}

export function extFromUrl(url: string): string | null {
  try {
    const u = new URL(url);
    const m = u.pathname.toLowerCase().match(/\.([a-z0-9]{2,5})(?:$|\?)/);
    return m ? m[1] : null;
  } catch {
    const m = url.toLowerCase().match(/\.([a-z0-9]{2,5})(?:$|\?)/);
    return m ? m[1] : null;
  }
}
