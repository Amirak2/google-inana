import sharp from 'sharp';

// Cards request small widths; everything else gets the largest size.
export const IMAGE_WIDTHS = [480, 960, 1600] as const;
const CACHE_LIMIT_BYTES = 64 * 1024 * 1024;
const cache = new Map<string, { data: Buffer; contentType: string }>();
let cachedBytes = 0;

export function imageWidth(value: unknown): number {
  const requested = Number(value);
  return IMAGE_WIDTHS.find(width => width >= requested) ?? IMAGE_WIDTHS[IMAGE_WIDTHS.length - 1];
}

// Public product photos are stored as uploaded (often multi-megabyte PNG/JPEG).
// Serve a resized WebP when the browser accepts it, keeping the original as a fallback.
// Link-preview crawlers (Instagram, WhatsApp) need a plain JPEG whatever they say they
// accept; `format: 'jpeg'` serves one on a white background.
export async function optimizeImage(key: string, data: Buffer, contentType: string, accept = '', width = imageWidth(undefined), format?: 'jpeg') {
  if (contentType === 'image/gif' || (!format && !accept.includes('image/webp'))) return { data, contentType };
  const cacheKey = `${key}\0${width}\0${format || 'webp'}`;
  const hit = cache.get(cacheKey);
  if (hit) return hit;
  let result = { data, contentType };
  try {
    // Tolerate minor JPEG corruption the way browsers do (some catalog photos have it).
    const resized = sharp(data, { limitInputPixels: 40_000_000, failOn: 'none' }).rotate().resize({ width, withoutEnlargement: true });
    if (format === 'jpeg') {
      result = { data: await resized.flatten({ background: '#ffffff' }).jpeg({ quality: 82 }).toBuffer(), contentType: 'image/jpeg' };
    } else {
      const webp = await resized.webp({ quality: 80 }).toBuffer();
      if (webp.length < data.length) result = { data: webp, contentType: 'image/webp' };
    }
  } catch {
    // Unreadable images are served unchanged rather than failing the request.
  }
  cache.set(cacheKey, result);
  cachedBytes += result.data.length;
  for (const [oldKey, oldValue] of cache) {
    if (cachedBytes <= CACHE_LIMIT_BYTES) break;
    cache.delete(oldKey);
    cachedBytes -= oldValue.data.length;
  }
  return result;
}
