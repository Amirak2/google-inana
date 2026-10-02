import type { GoldPriceData } from '../src/types';
import { formatJalaliDateTime } from '../src/utils/persianFormatter';

export const SERVIX_GOLD_URL = 'https://servix.cc/api/v1/assets/GOLD_18_RLS';
export const GOLD_POLL_INTERVAL_MS = 60 * 60 * 1000;

export function parseServixGold(payload: unknown, previous?: GoldPriceData, now = Date.now()): GoldPriceData {
  const row = payload as Record<string, unknown> | null;
  if (!row || row.code !== 'GOLD_18_RLS' || row.quoteUnit !== 'RLS') throw new Error('Invalid gold asset or unit');
  if (!['string', 'number'].includes(typeof row.value) || String(row.value).trim() === '') throw new Error('Invalid gold value');
  const price = Math.round(Number(row.value) / 10);
  if (!Number.isFinite(price) || price < 1_000_000 || price > 1_000_000_000) throw new Error('Invalid gold price');
  const timestamp = typeof row.businessTime === 'string' ? Date.parse(row.businessTime) : NaN;
  if (!Number.isFinite(timestamp) || timestamp <= 0 || timestamp > now + 300000) throw new Error('Invalid market timestamp');
  if (previous?.source?.startsWith('Servix') && timestamp < Date.parse(previous.timestamp)) throw new Error('Regressed market timestamp');
  const day = (date: number) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tehran' }).format(date);
  const sameDay = previous?.source?.startsWith('Servix') && Number.isFinite(Date.parse(previous.timestamp)) && day(Date.parse(previous.timestamp)) === day(timestamp);
  const baseline = sameDay ? previous!.previousPrice : price;
  return {
    pricePerGram: price, currency: 'تومان', purity: '18 عیار (750)',
    timestamp: new Date(timestamp).toISOString(), jalaliTimestamp: formatJalaliDateTime(new Date(timestamp)),
    source: 'Servix — نرخ هر گرم طلای ۱۸ عیار',
    changePercent: baseline > 0 ? Math.round((price - baseline) / baseline * 10000) / 100 : 0,
    dailyHigh: sameDay ? Math.max(previous!.dailyHigh || price, price) : price,
    dailyLow: sameDay ? Math.min(previous!.dailyLow || price, price) : price,
    previousPrice: baseline, isManualOverride: false,
    status: now - timestamp <= GOLD_POLL_INTERVAL_MS ? 'live' : 'cached',
    otherMarkets: {},
  };
}
