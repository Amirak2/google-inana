import crypto from 'node:crypto';
import { PostgresStore, PostgresConflictError } from './postgresStorage';
import { GOLD_POLL_INTERVAL_MS, SERVIX_GOLD_URL, parseServixGold } from './servixGold';
import type { GoldHistoryPoint, GoldPriceData } from '../src/types';

type Poll = { token: string; attemptedAt: number; completedAt?: number; success?: boolean };
type Dependencies = { load?: typeof PostgresStore.load; fetch?: typeof globalThis.fetch; now?: () => number };

/** Commit the hourly claim BEFORE network I/O. A restart or another replica cannot spend the same hour's quota twice. */
export async function refreshServixGold(env: Record<string, any>, deps: Dependencies = {}): Promise<boolean> {
  const key = env.SERVIX_API_KEY?.trim();
  if (!key) return false;
  const load = deps.load || PostgresStore.load;
  const now = deps.now || Date.now;
  const token = crypto.randomUUID();
  const attemptedAt = now();
  let claimed = false;
  for (let attempt = 0; attempt < 4; attempt++) {
    const store = await load(true, false, ['market']);
    try {
      const poll = store.get<Poll>('market', 'servixPoll');
      if (poll && attemptedAt - poll.attemptedAt < GOLD_POLL_INTERVAL_MS) return false;
      store.set('market', 'servixPoll', { token, attemptedAt });
      const previous = store.get<GoldPriceData>('market', 'gold');
      if (previous?.isManualOverride) store.set('market', 'gold', { ...previous, isManualOverride: false, status: 'cached' });
      await store.commit();
      claimed = true;
      break;
    } catch (error) {
      if (!(error instanceof PostgresConflictError) || attempt === 3) throw error;
    } finally { await store.release(); }
  }
  if (!claimed) return false;
  let payload: unknown;
  let received = false;
  try {
    const response = await (deps.fetch || globalThis.fetch)(SERVIX_GOLD_URL, {
      headers: { 'X-API-Key': key, Accept: 'application/json', 'User-Agent': 'InanaGold/1.0' },
      signal: AbortSignal.timeout(10000), redirect: 'error',
    });
    if (!response.ok) throw new Error('Provider rejected request');
    payload = await response.json();
    received = true;
  } catch { /* Preserve the last accepted price and the committed one-hour cooldown. */ }
  for (let attempt = 0; attempt < 4; attempt++) {
    const store = await load(true, false, ['market']);
    try {
      const poll = store.get<Poll>('market', 'servixPoll');
      if (poll?.token !== token) return false;
      const previous = store.get<GoldPriceData>('market', 'gold');
      let next: GoldPriceData | undefined = previous ? { ...previous, isManualOverride: false, status: 'cached' } : undefined;
      let success = false;
      if (received) {
        try { next = parseServixGold(payload, previous, now()); success = true; } catch { /* Invalid assets/units/times never replace a price. */ }
      }
      if (next) store.set('market', 'gold', next);
      store.set('market', 'servixPoll', { ...poll, completedAt: now(), success });
      store.set('market', 'fetchedAt', attemptedAt);
      if (success && next) {
        store.set('market', 'provider', 'servix');
        // Chart points represent actual market observations, never synthetic hourly samples.
        const timestamp = Date.parse(next.timestamp);
        const history = store.get<(GoldHistoryPoint & { timestamp: number })[]>('market', 'hourlyHistory') || [];
        if (!history.some(point => point.timestamp === timestamp && point.price === next!.pricePerGram)) {
          store.set('market', 'hourlyHistory', history.filter(point => point.timestamp >= now() - 25 * GOLD_POLL_INTERVAL_MS).concat({
            timestamp, price: next.pricePerGram, isEstimated: false,
            time: new Date(timestamp).toLocaleTimeString('fa-IR', { timeZone: 'Asia/Tehran', hour: '2-digit', minute: '2-digit' }),
            date: new Intl.DateTimeFormat('fa-IR-u-ca-persian', { timeZone: 'Asia/Tehran', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(timestamp)),
          }).sort((a, b) => a.timestamp - b.timestamp));
        }
      }
      await store.commit();
      if (!success) console.warn('Servix gold refresh failed; retained last price, next attempt in one hour.');
      return success;
    } catch (error) {
      if (!(error instanceof PostgresConflictError) || attempt === 3) throw error;
    } finally { await store.release(); }
  }
  return false;
}

export function startGoldScheduler(env: Record<string, any>): () => void {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try { await refreshServixGold(env); }
    catch { console.error('Gold scheduler could not persist its update.'); }
    finally { running = false; }
  };
  void tick();
  // The durable claim enforces one upstream request per hour; this timer also recovers after restarts.
  const timer = setInterval(() => { void tick(); }, 60000);
  timer.unref();
  return () => clearInterval(timer);
}
