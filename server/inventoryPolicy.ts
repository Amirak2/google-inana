import type { Store } from './storage';
import type { Order, Product } from '../src/types';

const MINUTE = 60000;
type HoldWindow = { until: number; nextAllowedAt: number; revision: number };
function deny(message: string): never { throw Object.assign(new Error(message), { statusCode: 429 }); }

export function createInventoryPolicy(store: Store) {
  function assertCapacity(uid: string, requested: Map<string, number>, replacingReservation?: string) {
    store.get('inventoryHolds', uid);
    const held = new Map(requested);
    const add = (id: string, quantity: number) => held.set(id, (held.get(id) || 0) + quantity);
    for (const [id, list] of store.map<any[]>('reservations')) {
      for (const r of list) if (r.userId === `usr_${uid}` && r.expiresAt > Date.now() && (r.reservationId || `cart_${r.userId}`) !== replacingReservation) add(id, r.quantity);
    }
    for (const order of store.map<Order>('orders').values()) {
      if (order.userId === uid && order.status === 'در انتظار بررسی' && !order.inventoryReleased) for (const item of order.items) add(item.productId, item.quantity);
    }
    if (held.size > 3 || [...held.values()].reduce((sum, quantity) => sum + quantity, 0) > 6) deny('تا تأیید پرداخت، حداکثر ۳ نوع محصول و مجموع ۶ عدد را می‌توانید نگه دارید. برای خرید بیشتر با پشتیبانی تماس بگیرید.');
  }
  function touchOwner(uid: string, window?: HoldWindow) {
    const current = window || store.get<HoldWindow>('inventoryHolds', uid);
    store.set('inventoryHolds', uid, { ...current, revision: (current?.revision || 0) + 1 });
  }
  function reserveDeadline(uid: string, requestedUntil: number, existingUntil?: number) {
    const now = Date.now();
    const previous = store.get<HoldWindow>('inventoryHolds', uid);
    let window = previous;
    if (!window?.until || now >= window.nextAllowedAt) window = { until: now + 30 * MINUTE, nextAllowedAt: now + 45 * MINUTE, revision: previous?.revision || 0 };
    const until = Math.min(requestedUntil, existingUntil || Infinity);
    if (now >= window.until || until > window.until) deny('مهلت نگه‌داشتن موجودی تمام شده است. رزرو قابل تمدید نامحدود نیست؛ کمی بعد دوباره تلاش کنید.');
    return { until, window };
  }
  function assertOrderLimit(uid: string, creatingQuote = false) {
    store.get('inventoryHolds', uid); // Validate per-owner absence/updates at commit.
    const pending = [...store.map<Order>('orders').values()].filter(order => order.userId === uid && order.status === 'در انتظار بررسی');
    const activeQuotes = creatingQuote ? [...store.map<any>('quotes').values()].filter(quote => quote.userId === uid && quote.expiresAt > Date.now()).length : 0;
    if (pending.length + activeQuotes >= 2) deny('سقف دو سفارش یا پیش‌فاکتور پرداخت شما پر شده است. ابتدا موارد قبلی را تکمیل یا با پشتیبانی پیگیری کنید.');
  }
  return { assertCapacity, reserveDeadline, assertOrderLimit, touchOwner };
}

export function expireUnreviewedInventory(store: Store, products: Product[], orders: Order[], holdHours = 24) {
  const now = Date.now();
  for (const order of orders) {
    if (order.status !== 'در انتظار بررسی' || order.inventoryReleased) continue;
    const expiry = order.inventoryHoldExpiresAt ? Date.parse(order.inventoryHoldExpiresAt) : Date.parse(order.createdAt) + holdHours * 3600000;
    if (!Number.isFinite(expiry) || expiry > now) continue;
    store.get('orders', order.id);
    for (const item of order.items) {
      const product = products.find(p => p.id === item.productId);
      if (product?.stock !== undefined) { product.stock += item.quantity; store.set('products', product.id, product); }
    }
    order.inventoryReleased = true;
    order.paymentReviewRequired = true;
    order.inventoryHoldExpiredAt = new Date(now).toISOString();
    store.set('orders', order.id, order);
  }
}
