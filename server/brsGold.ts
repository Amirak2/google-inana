import type { GoldPriceData, OtherMarketsData } from '../src/types';

export const BRS_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';

export function parseBrsGold(payload: any, previous: GoldPriceData, now = Date.now()): GoldPriceData {
  if (!Array.isArray(payload?.gold)) throw new Error('Invalid BRS response');
  const rows = payload.gold;
  const row = rows.find((item: any) => item.symbol === 'IR_GOLD_18K');
  const number = (value: unknown) => Number(String(value ?? '').replace(/,/g, ''));
  const toman = (item: any) => {
    if (!item || !['تومان', 'ریال'].includes(item.unit)) throw new Error('Invalid BRS price unit');
    const price = number(item.price) / (item.unit === 'ریال' ? 10 : 1);
    if (!Number.isFinite(price) || price <= 0) throw new Error('Invalid BRS price');
    return Math.round(price);
  };
  const price = toman(row);
  const timestamp = number(row.time_unix) * 1000;
  if (!Number.isFinite(timestamp) || timestamp <= 0 || timestamp > now + 300000) throw new Error('Invalid BRS timestamp');
  const day = (time: number) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tehran' }).format(time);
  const fresh = day(timestamp) === day(now);
  const sameDay = Number.isFinite(Date.parse(previous.timestamp)) && day(Date.parse(previous.timestamp)) === day(timestamp);
  const other: OtherMarketsData = {};
  const symbols = { gold24k: 'IR_GOLD_24K', mesghal: 'IR_GOLD_MELTED', emamiCoin: 'IR_COIN_EMAMI', halfCoin: 'IR_COIN_HALF', quarterCoin: 'IR_COIN_QUARTER' } as const;
  for (const [key, symbol] of Object.entries(symbols)) {
    const item = rows.find((entry: any) => entry.symbol === symbol);
    if (item) other[key as keyof OtherMarketsData] = toman(item);
  }
  const ounce = rows.find((item: any) => item.symbol === 'XAUUSD');
  if (ounce?.unit === 'دلار' && number(ounce.price) > 0) other.globalOunceUsd = number(ounce.price);
  const change = number(row.change_value) / (row.unit === 'ریال' ? 10 : 1);
  return {
    pricePerGram: price, currency: 'تومان', purity: '18 عیار (750)',
    timestamp: new Date(timestamp).toISOString(),
    jalaliTimestamp: `${row.date} - ${row.time}`,
    source: fresh ? 'BRS API — نرخ طلای ۱۸ عیار' : 'BRS API — آخرین نرخ دریافتی',
    status: fresh ? 'live' : 'cached', isManualOverride: false,
    previousPrice: Number.isFinite(change) ? Math.max(0, Math.round(price - change)) : price,
    changePercent: Number.isFinite(number(row.change_percent)) ? number(row.change_percent) : 0,
    dailyHigh: sameDay ? Math.max(previous.dailyHigh || price, price) : price,
    dailyLow: sameDay ? Math.min(previous.dailyLow || price, price) : price,
    otherMarkets: other,
  };
}
