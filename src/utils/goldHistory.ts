import type { GoldHistoryPoint } from '../types';

export async function loadGoldHistory(range: string, signal?: AbortSignal, fetcher: typeof fetch = fetch): Promise<GoldHistoryPoint[]> {
  const response = await fetcher(`/api/gold-history?range=${encodeURIComponent(range)}`, { signal, cache: 'no-store' });
  if (!response.ok) throw new Error('دریافت تاریخچه قیمت انجام نشد. دوباره تلاش کنید.');
  const data = await response.json();
  if (!Array.isArray(data.points) || data.points.some((point: GoldHistoryPoint) =>
    !point || typeof point.price !== 'number' || !Number.isFinite(point.price) || point.price <= 0
    || typeof point.time !== 'string' || typeof point.date !== 'string'
  )) throw new Error('داده‌های تاریخچه قیمت معتبر نیست.');
  return data.points;
}
