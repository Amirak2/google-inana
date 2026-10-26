import { PostgresStore, PostgresConflictError } from './postgresStorage';
import type { Store } from './storage';
import type { Order, UserNotification } from '../src/types';
import { normalizeOrderStatus } from '../src/utils/orderWorkflow';
import { sendSmsIr, SmsIrError, smsIrEnabled, smsIrTemplates, smsMobile, type SmsTemplate, type SmsParameter } from './smsIr';

type SmsState = 'queued' | 'waiting_template' | 'sending' | 'sent' | 'unknown' | 'failed' | 'expired' | 'superseded';
export interface OrderSms {
  id: string; userId: string; orderId: string; orderStatus: string; trackingCode: string;
  mobile: string; createdAt: number; nextAttemptAt: number; state: SmsState; attempts: number;
  claim?: string; sendingAt?: number; messageId?: number; sentAt?: number; error?: string;
}
const STATUS_KEYS: Record<string, string> = { 'در انتظار بررسی': 'created', 'تأیید شده': 'approved', 'رد شده': 'rejected', 'لغو شده': 'cancelled', 'ارسال شد': 'shipped', 'در حال آماده‌سازی': 'preparing', 'آماده تحویل': 'ready', 'تکمیل شده': 'completed' };

export function queueOrderSms(store: Store, env: Record<string, any>, order: Order, notification: UserNotification): void {
  if (!smsIrEnabled(env) || env.SMS_IR_NOTIFICATIONS_ENABLED !== 'true' || !order.userId) return;
  const user = [...store.map<any>('users').values()].find(u => u.uid === order.userId);
  // Send only to the customer's verified account number, never an arbitrary checkout phone.
  if (!user?.phoneVerified || !user.phoneNumber) return;
  let mobile: string;
  try { mobile = smsMobile(user.phoneNumber); } catch { return; }
  const id = notification.id;
  if (store.get('smsOutbox', id)) return;
  store.set('smsOutbox', id, {
    id, userId: order.userId, orderId: order.id, orderStatus: normalizeOrderStatus(order.status), trackingCode: order.trackingCode,
    mobile, state: 'queued', attempts: 0, createdAt: Date.now(), nextAttemptAt: Date.now(),
  } satisfies OrderSms);
}

function templateFor(job: OrderSms, env: Record<string, any>, templates: SmsTemplate[]): { id: number; parameters: SmsParameter[] } | null {
  let config: Record<string, number>;
  try { config = JSON.parse(env.SMS_IR_ORDER_TEMPLATES || '{}'); } catch { return null; }
  const dedicated = Number(config[STATUS_KEYS[job.orderStatus]]);
  const id = Number.isSafeInteger(dedicated) && dedicated > 0 ? dedicated : Number(config.status);
  const template = templates.find(t => t.id === id && t.status === 2);
  if (!template) return null;
  const values: Record<string, string> = { ORDER: job.trackingCode, ORDERID: job.trackingCode, STATUS: job.orderStatus };
  const parameters = template.parameters.map(p => ({ name: p.name, value: values[p.name.toUpperCase()] || '' }));
  if (!parameters.length || parameters.some(p => !p.value || p.value.length > 25)) return null;
  return { id, parameters };
}

type Dependencies = { load?: typeof PostgresStore.load; fetch?: typeof fetch; now?: () => number };
/** Claims are durable before sending. Unknown delivery is never automatically resent. */
export async function flushOrderSms(env: Record<string, any>, deps: Dependencies = {}): Promise<void> {
  if (!smsIrEnabled(env) || env.SMS_IR_NOTIFICATIONS_ENABLED !== 'true') return;
  const load = deps.load || PostgresStore.load, now = deps.now || Date.now;
  const initial = await load(false, false, ['smsOutbox']);
  let candidates: OrderSms[];
  try { candidates = [...initial.map<OrderSms>('smsOutbox').values()].filter(j => ['queued', 'waiting_template', 'sending'].includes(j.state) && j.nextAttemptAt <= now()).sort((a, b) => a.createdAt - b.createdAt).slice(0, 20); }
  finally { await initial.release(); }
  if (!candidates.length) return;
  let templates: SmsTemplate[];
  try { templates = await smsIrTemplates(env, deps.fetch); } catch { return; }
  for (const candidate of candidates) {
    let selected: OrderSms | undefined;
    let template: ReturnType<typeof templateFor>;
    for (let attempt = 0; attempt < 4; attempt++) {
      const store = await load(true, false, ['smsOutbox', 'orders', 'users']);
      try {
        const job = store.get<OrderSms>('smsOutbox', candidate.id);
        if (!job || !['queued', 'waiting_template', 'sending'].includes(job.state) || job.nextAttemptAt > now()) break;
        if (job.state === 'sending') {
          if (now() - (job.sendingAt || 0) >= 120000) { job.state = 'unknown'; job.error = 'interrupted_delivery'; store.set('smsOutbox', job.id, job); await store.commit(); }
          break;
        }
        const order = store.get<Order>('orders', job.orderId);
        const userEntry = [...store.map<any>('users').entries()].find(([, u]) => u.uid === job.userId);
        const user = userEntry ? store.get<any>('users', userEntry[0]) : undefined;
        if (now() - job.createdAt > 7 * 86400000) job.state = 'expired';
        else if (!order || order.userId !== job.userId || normalizeOrderStatus(order.status) !== job.orderStatus) job.state = 'superseded';
        else if (!user?.phoneVerified || user.phoneNumber !== job.mobile) { job.state = 'failed'; job.error = 'recipient_changed'; }
        else {
          template = templateFor(job, env, templates);
          if (!template) { job.state = 'waiting_template'; job.nextAttemptAt = now() + 300000; job.error = 'template_not_approved_or_configured'; }
          else { job.state = 'sending'; job.claim = crypto.randomUUID(); job.sendingAt = now(); job.attempts++; job.nextAttemptAt = now() + 120000; selected = structuredClone(job); }
        }
        store.set('smsOutbox', job.id, job);
        await store.commit(); break;
      } catch (error) { selected = undefined; if (!(error instanceof PostgresConflictError) || attempt === 3) throw error; }
      finally { await store.release(); }
    }
    if (!selected || !template) continue;
    let messageId: number | undefined, error: SmsIrError | undefined;
    try { messageId = await sendSmsIr(env, selected.mobile, template.id, template.parameters, deps.fetch); }
    catch (e) { error = e instanceof SmsIrError ? e : new SmsIrError('delivery_unknown', true); }
    for (let attempt = 0; attempt < 4; attempt++) {
      const store = await load(true, false, ['smsOutbox']);
      try {
        const job = store.get<OrderSms>('smsOutbox', selected.id);
        if (!job || job.state !== 'sending' || job.claim !== selected.claim) break;
        if (messageId) { job.state = 'sent'; job.messageId = messageId; job.sentAt = now(); delete job.error; }
        else { job.state = error?.ambiguous ? 'unknown' : job.attempts >= 5 ? 'failed' : 'queued'; job.error = error?.code || 'delivery_unknown'; job.nextAttemptAt = now() + Math.min(3600000, 60000 * 2 ** job.attempts); }
        store.set('smsOutbox', job.id, job); await store.commit(); break;
      } catch (e) { if (!(e instanceof PostgresConflictError) || attempt === 3) throw e; }
      finally { await store.release(); }
    }
  }
}

export function startSmsScheduler(env: Record<string, any>): () => void {
  let running = false;
  const tick = async () => { if (running) return; running = true; try { await flushOrderSms(env); } catch { console.error('SMS outbox update failed'); } finally { running = false; } };
  void tick(); const timer = setInterval(() => { void tick(); }, 30000); timer.unref();
  return () => clearInterval(timer);
}
