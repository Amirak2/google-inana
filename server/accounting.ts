import crypto from 'node:crypto';
import type { Store } from './storage';
import type { Order, Product } from '../src/types';
import { isApprovedOrderStatus, normalizeOrderStatus } from '../src/utils/orderWorkflow';
import type { AccountingSale, AccountingLine, AccountingSettings, AccountingData, PurchaseLot, MoneyEntry, ReturnEntry, CostParts, AccountingAudit } from '../src/types/accounting';
import { emptyCosts, costSum, lineCost, saleTotals, returnedQuantity, returnedCostLayers, accountingDate, accountingDay, normalizeAccountingDay } from '../src/utils/accounting';

export const ACCOUNTING_BUCKETS = ['accountingMeta', 'accountingPurchases', 'accountingSales', 'accountingMoney', 'accountingReturns', 'accountingAudit', 'accountingActions'];
function fail(message: string, statusCode = 400): never { throw Object.assign(new Error(message), { statusCode }); }
function money(value: unknown, label: string, optional = false): number {
  if (optional && value === undefined) return 0;
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0 || value > 1_000_000_000_000) fail(`${label} باید مبلغ صحیح و غیرمنفی به تومان باشد.`);
  return value as number;
}
function quantity(value: unknown): number {
  if (!Number.isSafeInteger(value) || (value as number) < 1 || (value as number) > 10000) fail('تعداد باید بین ۱ تا ۱۰٬۰۰۰ باشد.');
  return value as number;
}
function text(value: unknown, label: string, required = false): string {
  if (value !== undefined && typeof value !== 'string') fail(`${label} نامعتبر است.`);
  const result = String(value || '').trim();
  if (result.length > 500 || (required && !result)) fail(`${label} را وارد کنید (حداکثر ۵۰۰ حرف).`);
  return result;
}
function costs(value: any): CostParts {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('جزئیات هزینهٔ خرید را وارد کنید.');
  const result = emptyCosts();
  for (const key of Object.keys(result)) result[key] = money(value[key], 'هزینهٔ خرید');
  if (!Number.isSafeInteger(costSum(result)) || costSum(result) > 1_000_000_000_000) fail('جمع هزینهٔ خرید بیش از حد مجاز است.');
  return result;
}
function date(value: unknown): string {
  try { return accountingDate(value === undefined ? undefined : text(value, 'تاریخ')); }
  catch (error) { return fail((error as Error).message); }
}

export function createAccounting(store: Store) {
  const list = <T>(bucket: string): T[] => [...store.map<T>(bucket).values()];
  const revision = () => store.get<{ revision: number }>('accountingMeta', 'revision')?.revision || 0;
  const settings = (): AccountingSettings => store.get('accountingMeta', 'settings') || { packaging: 0, assembly: 0 };
  function touch() { store.set('accountingMeta', 'revision', { revision: revision() + 1 }); }
  function audit(action: string, actor: string, target: string, details: unknown) {
    const entry: AccountingAudit = { id: crypto.randomUUID(), action, actor, target, details: structuredClone(details), createdAt: new Date().toISOString() };
    store.set('accountingAudit', entry.id, entry);
  }
  function findSale(id: string): AccountingSale {
    return structuredClone(store.get<AccountingSale>('accountingSales', id) || fail('ثبت مالی سفارش یافت نشد.', 404));
  }
  function allocate(sale: AccountingSale) {
    if (!sale.recognizedAt) return;
    for (const line of sale.items) {
      if (line.overrideCosts || line.allocations.length) continue;
      const lots = list<PurchaseLot>('accountingPurchases').filter(lot => lot.productId === line.productId && lot.remaining > 0 && accountingDay(lot.occurredAt) <= accountingDay(sale.recognizedAt!))
        .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt) || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
      if (lots.reduce((sum, lot) => sum + lot.remaining, 0) < line.quantity) continue;
      let needed = line.quantity;
      for (const original of lots) {
        if (!needed) break;
        const lot = structuredClone(original);
        const count = Math.min(needed, lot.remaining);
        if (lot.costs.assembly && line.extraAssembly) fail('هزینهٔ ساخت در خرید محصول آماده ثبت شده است؛ ساخت بعد از سفارش را صفر کنید.', 409);
        line.allocations.push({ lotId: lot.id, quantity: count, unitCost: costSum(lot.costs) });
        lot.remaining -= count; needed -= count;
        store.set('accountingPurchases', lot.id, lot);
      }
    }
    sale.costsLocked = sale.items.every(line => lineCost(line) !== null);
  }
  function syncSiteReceipt(order: Order, sale: AccountingSale) {
    if (sale.channel !== 'site' || order.id.startsWith('instagram-') || order.paymentReviewRequired
      || (!isApprovedOrderStatus(order.status) && normalizeOrderStatus(order.status) !== 'تکمیل شده')
      || !['card_to_card', 'online'].includes(order.paymentMethod || '')) return;
    const id = `site-payment:${order.id}`;
    // A voided automatic receipt stays voided. Synchronization never reverses an admin correction.
    if (store.get('accountingMoney', id)) return;
    const receipts = list<MoneyEntry>('accountingMoney').filter(entry => entry.saleId === sale.id && entry.kind === 'receipt');
    if (receipts.some(entry => entry.voidedAt)) return;
    const received = receipts.filter(entry => !entry.voidedAt)
      .reduce((sum, entry) => sum + entry.amount, 0);
    const amount = Math.max(0, sale.totalPrice - received);
    if (!Number.isSafeInteger(amount) || !amount) return;
    const entry: MoneyEntry = { id, saleId: sale.id, kind: 'receipt', amount, fee: 0,
      method: order.paymentMethod === 'online' ? 'pasargad' : 'card_to_card', category: '',
      reference: order.paymentTrackingNumber || `SITE-${order.trackingCode}`, source: 'site',
      note: 'دریافت خودکار بر اساس تأیید پرداخت سفارش در مدیریت سایت',
      occurredAt: order.paymentDate || order.reviewedAt || order.updatedAt || order.createdAt, actor: 'system' };
    store.set('accountingMoney', id, entry); touch();
    audit('دریافت خودکار سفارش سایت', 'system', sale.id, entry);
  }
  function syncOrder(order: Order, actor = 'system', channel: 'site' | 'instagram' = order.id.startsWith('instagram-') ? 'instagram' : 'site') {
    const previous = store.get<AccountingSale>('accountingSales', order.id);
    const sale: AccountingSale = previous ? structuredClone(previous) : {
      id: order.id, orderId: order.id, trackingCode: order.trackingCode, channel,
      customerName: order.customerName, status: order.status, totalPrice: order.totalPrice || 0,
      createdAt: order.createdAt,
      items: order.items.map((item, index) => ({ key: String(index), productId: item.productId, title: item.productTitle,
        quantity: item.quantity, weight: item.weight, unitPrice: item.unitPrice, totalPrice: item.totalPrice,
        allocations: [], extraAssembly: 0 })),
      packaging: settings().packaging, shippingReceived: 0, shippingPaid: 0, otherCosts: 0, revision: 0,
    };
    sale.status = order.status;
    if (!sale.recognizedAt && order.status === 'تکمیل شده') {
      assertStatusChange(order, 'تکمیل شده');
      sale.recognizedAt = order.reviewedAt || order.updatedAt || order.createdAt;
      sale.expensesAt ||= sale.recognizedAt;
      allocate(sale);
    }
    syncSiteReceipt(order, sale);
    if (JSON.stringify(sale) === JSON.stringify(previous)) return sale;
    sale.revision++;
    store.set('accountingSales', sale.id, sale);
    // Independent checkouts touch only their own snapshot; financial mutations
    // and cost allocation use the revision guard without serializing new orders.
    if (sale.recognizedAt) touch();
    audit(previous ? 'تغییر وضعیت فروش' : 'ثبت سفارش در حسابداری', actor, sale.id, { status: sale.status, channel: sale.channel });
    return sale;
  }
  function syncSiteOrders(actor = 'system') {
    const orders = list<Order>('orders').sort((a, b) => (a.reviewedAt || a.createdAt).localeCompare(b.reviewedAt || b.createdAt));
    for (const order of orders) syncOrder(order, actor);
    return { count: orders.filter(order => !order.id.startsWith('instagram-')).length };
  }
  function assertStatusChange(order: Order, next: string) {
    const sale = store.get<AccountingSale>('accountingSales', order.id);
    if (sale && !sale.recognizedAt && (next !== order.status || next === 'تکمیل شده')
      && !['لغو شده', 'رد شده'].includes(next)
      && list<ReturnEntry>('accountingReturns').some(entry => entry.saleId === sale.id)) {
      fail('وجه این سفارش پیش از تحویل بازپرداخت شده است؛ سفارش را لغو کنید و برای خرید مجدد یک سفارش جدید ثبت کنید.', 409);
    }
    if (sale?.recognizedAt && next !== order.status && list<ReturnEntry>('accountingReturns').some(entry => entry.saleId === sale.id)) fail('فروش مرجوع‌شده قابل فعال‌سازی مجدد نیست؛ برای تعویض یک فروش جدید ثبت کنید.', 409);
    if (sale?.recognizedAt && ['لغو شده', 'رد شده'].includes(next)) fail('برای فروش تکمیل‌شده، مرجوعی و بازپرداخت را از بخش حسابداری ثبت کنید.', 409);
  }
  function mutate(action: string, body: any, actor: string) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) fail('درخواست نامعتبر است.');
    const actionId = text(body.actionId, 'شناسهٔ ثبت', true);
    if (!/^[a-zA-Z0-9_-]{8,100}$/.test(actionId)) fail('شناسهٔ ثبت نامعتبر است.');
    const { expectedRevision: _expected, ...payload } = body;
    const hash = crypto.createHash('sha256').update(JSON.stringify({ action, payload })).digest('hex');
    const previous = store.get<{ hash: string; result: any }>('accountingActions', actionId);
    if (previous) {
      if (previous.hash !== hash) fail('این شناسه قبلاً برای ثبت دیگری استفاده شده است.', 409);
      return previous.result;
    }
    if (body.expectedRevision !== revision()) fail('اطلاعات حسابداری تغییر کرده است. فهرست را تازه کنید و دوباره ثبت کنید.', 409);
    let result: any;
    if (action === 'settings') {
      const next = { packaging: money(body.packaging, 'بسته‌بندی'), assembly: money(body.assembly, 'ساخت') };
      store.set('accountingMeta', 'settings', next); result = next;
    } else if (action === 'purchase-correction') {
      const id = text(body.purchaseId, 'خرید', true);
      const previous = store.get<PurchaseLot>('accountingPurchases', id);
      if (!previous) fail('خرید یافت نشد.', 404);
      if (previous.remaining !== previous.quantity || id.startsWith('return-')) fail('هزینهٔ خرید مصرف‌شده یا برگشتی قابل اصلاح نیست.', 409);
      const reason = text(body.reason, 'دلیل اصلاح', true);
      const next = { ...previous, costs: costs(body.costs) };
      store.set('accountingPurchases', id, next);
      audit('اصلاح قیمت خرید', actor, id, { before: previous, after: next, reason }); result = next;
    } else if (action === 'money-void') {
      const id = text(body.entryId, 'ثبت مالی', true);
      const previous = store.get<MoneyEntry>('accountingMoney', id);
      if (!previous) fail('ثبت مالی یافت نشد.', 404);
      if (previous.voidedAt) fail('ثبت قبلاً باطل شده است.', 409);
      const reason = text(body.reason, 'دلیل ابطال', true);
      if (previous.saleId && previous.kind === 'receipt') {
        const sale = findSale(previous.saleId);
        const remaining = list<MoneyEntry>('accountingMoney').filter(entry => entry.id !== id);
        const totals = saleTotals(sale, remaining, list('accountingReturns'));
        if (totals.paid < totals.refunded) fail('این دریافت پشتوانهٔ بازپرداخت است و قابل ابطال نیست.', 409);
        if (previous.method === 'pasargad') {
          const gateway = remaining.filter(entry => entry.saleId === sale.id && !entry.voidedAt && entry.kind === 'receipt' && entry.method === 'pasargad').reduce((sum, entry) => sum + entry.amount - entry.fee, 0);
          const settled = remaining.filter(entry => entry.saleId === sale.id && !entry.voidedAt && entry.kind === 'settlement').reduce((sum, entry) => sum + entry.amount + entry.fee, 0);
          if (gateway < settled) fail('ابتدا ثبت اشتباه تسویهٔ مرتبط را اصلاح کنید.', 409);
        }
      }
      result = { ...previous, voidedAt: new Date().toISOString(), voidReason: reason };
      store.set('accountingMoney', id, result);
    } else if (action === 'sync') {
      result = syncSiteOrders(actor);
    } else if (action === 'purchase') {
      const product = store.get<Product>('products', text(body.productId, 'محصول', true));
      if (!product) fail('محصول یافت نشد.', 404);
      if (!['opening', 'purchase'].includes(body.kind)) fail('نوع خرید نامعتبر است.');
      const count = quantity(body.quantity);
      const componentCosts = costs(body.costs);
      if (body.kind === 'opening') {
        const held = list<Order>('orders').filter(order => order.status !== 'تکمیل شده' && !['لغو شده', 'رد شده'].includes(order.status) && !order.inventoryReleased)
          .reduce((sum, order) => sum + order.items.filter(item => item.productId === product.id).reduce((n, item) => n + item.quantity, 0), 0);
        const available = (product.stock || 0) + held;
        const known = list<PurchaseLot>('accountingPurchases').filter(lot => lot.productId === product.id).reduce((sum, lot) => sum + lot.remaining, 0);
        if (count + known > available) fail('تعداد موجودی اولیه بیش از موجودی ثبت‌شدهٔ کالا است. برای خرید جدید، نوع «خرید جدید» را انتخاب کنید.', 409);
      } else {
        if (product.stock === undefined) fail('ابتدا موجودی عددی محصول را مشخص کنید.');
        store.set('products', product.id, { ...product, stock: product.stock + count });
      }
      const lot: PurchaseLot = { id: crypto.randomUUID(), productId: product.id, title: product.title,
        quantity: count, remaining: count, costs: componentCosts, kind: body.kind,
        supplier: text(body.supplier, 'تأمین‌کننده'), reference: text(body.reference, 'شماره فاکتور'),
        occurredAt: date(body.date), createdAt: new Date().toISOString(), actor };
      store.set('accountingPurchases', lot.id, lot);
      result = lot;
    } else if (action === 'sale') {
      if (!Array.isArray(body.items) || body.items.length < 1 || body.items.length > 100) fail('بین ۱ تا ۱۰۰ ردیف کالا انتخاب کنید.');
      const requested = new Map<string, number>();
      const items = body.items.map((item: any) => {
        const product = store.get<Product>('products', text(item.productId, 'محصول', true));
        if (!product) fail('محصول یافت نشد.', 404);
        const count = quantity(item.quantity); const unitPrice = money(item.unitPrice, 'قیمت فروش');
        requested.set(product.id, (requested.get(product.id) || 0) + count);
        return { productId: product.id, productTitle: product.title, productImage: product.images?.[0] || '', weight: product.weight,
          unitPrice, quantity: count, totalPrice: unitPrice * count, goldPriceAtOrder: 0, makingChargePercent: 0 };
      });
      for (const [id, count] of requested) {
        const product = store.get<Product>('products', id)!;
        const reserved = (store.get<any[]>('reservations', id) || []).filter(entry => entry.expiresAt > Date.now()).reduce((sum, entry) => sum + entry.quantity, 0);
        if (product.stock === undefined || product.stock - reserved < count) fail('موجودی آزاد کالا برای این فروش کافی نیست.', 409);
      }
      const orderDate = date(body.date);
      const id = `instagram-${crypto.randomUUID()}`;
      const order: Order = { id, trackingCode: `IG-${crypto.randomUUID().slice(0, 12)}`, customerName: text(body.customerName, 'نام مشتری', true),
        customerPhone: text(body.customerPhone, 'شماره تماس'), customerAddress: text(body.customerAddress, 'نشانی'), contactMethod: 'phone',
        items, totalPrice: items.reduce((sum, item) => sum + item.totalPrice, 0), totalWeight: items.reduce((sum, item) => sum + item.weight * item.quantity, 0),
        goldPriceAtCheckout: 0, status: 'تأیید شده', paymentMethod: body.method === 'pasargad' ? 'online' : 'card_to_card',
        reviewedAt: orderDate, createdAt: orderDate, inventoryReleased: false };
      for (const [productId, count] of requested) {
        const product = store.get<Product>('products', productId)!;
        store.set('products', productId, { ...product, stock: product.stock! - count });
      }
      store.set('orders', order.id, order); store.set('trackingCodes', order.trackingCode, order.id);
      const sale = syncOrder(order, actor, 'instagram');
      if (body.exchangeForSaleId) {
        const exchanged = findSale(text(body.exchangeForSaleId, 'فروش مرجوعی', true));
        if (!list<ReturnEntry>('accountingReturns').some(entry => entry.saleId === exchanged.id)) fail('ابتدا مرجوعی فروش قبلی را ثبت کنید.');
        sale.exchangeForSaleId = exchanged.id; store.set('accountingSales', sale.id, sale);
      }
      result = sale;
    } else if (action === 'costs') {
      const sale = findSale(text(body.saleId, 'فروش', true));
      const before = structuredClone(sale);
      if (!Array.isArray(body.items) || body.items.length > sale.items.length) fail('جزئیات هزینه نامعتبر است.');
      const returns = list<ReturnEntry>('accountingReturns').filter(entry => entry.saleId === sale.id);
      if (returns.length) fail('هزینهٔ فروش مرجوع‌شده قابل تغییر نیست؛ هزینهٔ اصلاحی را جدا ثبت کنید.', 409);
      if (body.recognizedDate && sale.recognizedAt) sale.recognizedAt = date(body.recognizedDate);
      for (const update of body.items) {
        const line = sale.items.find(item => item.key === update.key);
        if (!line) fail('ردیف سفارش یافت نشد.');
        if (update.costs !== undefined) {
          if (line.allocations.length || sale.costsLocked) fail('قیمت خرید ثبت‌شدهٔ فروش قطعی قابل جایگزینی نیست.', 409);
          line.overrideCosts = costs(update.costs);
        }
        if (update.extraAssembly !== undefined) {
          const next = money(update.extraAssembly, 'ساخت بعد از سفارش');
          if (sale.costsLocked && next !== line.extraAssembly) fail('هزینهٔ ساخت فروش قطعی قابل جایگزینی نیست.', 409);
          const baseAssembly = line.overrideCosts?.assembly || line.allocations.reduce((sum, allocation) => sum + (store.get<PurchaseLot>('accountingPurchases', allocation.lotId)?.costs.assembly || 0) * allocation.quantity, 0);
          if (baseAssembly && next) fail('هزینهٔ ساخت قبلاً در خرید ثبت شده است؛ دوباره وارد نکنید.');
          line.extraAssembly = next;
        }
      }
      sale.packaging = money(body.packaging, 'بسته‌بندی'); sale.shippingReceived = money(body.shippingReceived, 'ارسال دریافتی');
      sale.shippingPaid = money(body.shippingPaid, 'ارسال پرداختی'); sale.otherCosts = money(body.otherCosts, 'سایر هزینه‌ها');
      if (body.expensesDate) sale.expensesAt = date(body.expensesDate);
      if (before.recognizedAt && before.costsLocked && !text(body.reason, 'دلیل اصلاح')) fail('دلیل اصلاح هزینه‌های فروش قطعی را وارد کنید.');
      allocate(sale); sale.revision++;
      store.set('accountingSales', sale.id, sale);
      audit('جزئیات اصلاح هزینه', actor, sale.id, { before, after: sale, reason: text(body.reason, 'دلیل اصلاح') });
      result = sale;
    } else if (action === 'complete') {
      const sale = findSale(text(body.saleId, 'فروش', true));
      const order = store.get<Order>('orders', sale.orderId);
      if (!order || order.inventoryReleased || ['رد شده', 'لغو شده'].includes(order.status)) fail('سفارش فعال با موجودی نگه‌داشته‌شده لازم است.', 409);
      if (sale.recognizedAt) fail('فروش قبلاً تکمیل شده است.', 409);
      assertStatusChange(order, 'تکمیل شده');
      const totals = saleTotals(sale, list('accountingMoney'), list('accountingReturns'));
      if (totals.paid - totals.refunded < sale.totalPrice + sale.shippingReceived) fail('ابتدا دریافت کامل وجه را ثبت کنید.', 409);
      const occurredAt = date(body.date);
      const completed = { ...order, status: 'تکمیل شده' as const, reviewedAt: occurredAt, updatedAt: new Date().toISOString() };
      store.set('orders', order.id, completed); result = syncOrder(completed, actor, sale.channel);
    } else if (action === 'money') {
      if (!['receipt', 'settlement', 'expense', 'capital', 'withdrawal', 'opening'].includes(body.kind)) fail('نوع دریافت یا پرداخت نامعتبر است.');
      if (!['pasargad', 'card_to_card'].includes(body.method)) fail('روش پرداخت نامعتبر است.');
      const amount = money(body.amount, 'مبلغ'); const fee = money(body.fee, 'کارمزد', true);
      if (!amount || fee > amount) fail('مبلغ باید مثبت باشد و کارمزد از مبلغ بیشتر نباشد.');
      const reference = text(body.reference, 'شماره پیگیری', ['receipt', 'settlement'].includes(body.kind));
      if (reference && list<MoneyEntry>('accountingMoney').some(entry => !entry.voidedAt && entry.kind === body.kind && entry.method === body.method && entry.reference === reference)) fail('این شماره پیگیری قبلاً ثبت شده است.', 409);
      const saleId = body.saleId ? text(body.saleId, 'فروش', true) : undefined;
      if (['receipt', 'settlement'].includes(body.kind)) {
        if (!saleId) fail('سفارش را انتخاب کنید.');
        const sale = findSale(saleId);
        const totals = saleTotals(sale, list('accountingMoney'), list('accountingReturns'));
        if (body.kind === 'receipt' && amount > Math.max(0, totals.balance)) fail('مبلغ دریافت بیش از ماندهٔ سفارش است.', 409);
        if (body.kind === 'receipt' && (['لغو شده', 'رد شده'].includes(sale.status) || totals.refunded)) fail('برای سفارش لغوشده یا مرجوع‌شده دریافت جدید ثبت نکنید.', 409);
        if (body.kind === 'settlement' && (body.method !== 'pasargad' || amount + fee > totals.pendingSettlement)) fail('مبلغ و کارمزد تسویه بیش از مبلغ منتظر تسویهٔ پاسارگاد است.', 409);
      } else if (saleId || fee || body.method !== 'card_to_card') fail('هزینه و سرمایه را بدون سفارش و کارمزد، در حساب بانکی ثبت کنید.');
      const entry: MoneyEntry = { id: crypto.randomUUID(), saleId, kind: body.kind, amount, fee, method: body.method,
        category: text(body.category, 'دسته'), reference, note: text(body.note, 'شرح', true), occurredAt: date(body.date), actor };
      store.set('accountingMoney', entry.id, entry); result = entry;
    } else if (action === 'return') {
      const sale = findSale(text(body.saleId, 'فروش', true));
      const previousReturns = list<ReturnEntry>('accountingReturns');
      const totals = saleTotals(sale, list('accountingMoney'), previousReturns);
      const amount = money(body.amount, 'بازپرداخت'); const shippingRefund = money(body.shippingRefund, 'بازپرداخت ارسال', true);
      if (amount > totals.paid - totals.refunded || amount < shippingRefund) fail('بازپرداخت باید در محدودهٔ وجه دریافت‌شده باشد.', 409);
      const previousShipping = previousReturns.filter(entry => entry.saleId === sale.id).reduce((sum, entry) => sum + entry.shippingRefund, 0);
      if (shippingRefund + previousShipping > sale.shippingReceived) fail('بازپرداخت ارسال بیش از هزینهٔ ارسال دریافتی است.');
      if (typeof body.restock !== 'boolean' || !Array.isArray(body.items) || body.items.length > sale.items.length) fail('جزئیات مرجوعی نامعتبر است.');
      if (sale.recognizedAt && !sale.items.every(item => lineCost(item) !== null)) fail('پیش از مرجوعی، هزینهٔ خرید فروش را تکمیل کنید.', 409);
      const selected = new Set<string>();
      const items = body.items.map((item: any) => {
        const line = sale.items.find(line => line.key === item.key);
        if (!line || selected.has(item.key)) fail('ردیف مرجوعی نامعتبر یا تکراری است.');
        selected.add(item.key); const count = quantity(item.quantity);
        if (count + returnedQuantity(previousReturns, sale.id, line.key) > line.quantity) fail('تعداد مرجوعی بیش از تعداد باقی‌مانده است.', 409);
        const layers = returnedCostLayers(line, returnedQuantity(previousReturns, sale.id, line.key), count);
        return { key: line.key, quantity: count, recoveredCost: body.restock ? layers.reduce((sum, layer) => sum + layer.quantity * layer.unitCost, 0) : 0 };
      });
      if (sale.recognizedAt && (!items.length || !amount)) fail('برای مرجوعی فروش، کالا و مبلغ بازپرداخت را وارد کنید.');
      if (!sale.recognizedAt && items.length) fail('برای سفارش تحویل‌نشده فقط بازپرداخت وجه ثبت کنید؛ لغو سفارش موجودی را آزاد می‌کند.');
      if (!amount) fail('مبلغ بازپرداخت باید مثبت باشد.');
      const entry: ReturnEntry = { id: crypto.randomUUID(), saleId: sale.id, amount, shippingRefund, items,
        restock: body.restock, reference: text(body.reference, 'پیگیری بازپرداخت', true), note: text(body.note, 'شرح مرجوعی', true), occurredAt: date(body.date), actor };
      if (previousReturns.some(previous => previous.reference === entry.reference)) fail('این پیگیری بازپرداخت قبلاً ثبت شده است.', 409);
      if (sale.recognizedAt && accountingDay(entry.occurredAt) < accountingDay(sale.recognizedAt)) fail('تاریخ مرجوعی نباید پیش از تکمیل فروش باشد.');
      for (const item of items) {
        if (!entry.restock) continue;
        const line = sale.items.find(line => line.key === item.key)!;
        const product = store.get<Product>('products', line.productId);
        if (!product || product.stock === undefined) fail('برای برگشت به موجودی، محصول با موجودی عددی لازم است.', 409);
        store.set('products', product.id, { ...product, stock: product.stock + item.quantity });
        // The returned piece becomes a new cost lot; fabrication remains in its cost.
        const layers = returnedCostLayers(line, returnedQuantity(previousReturns, sale.id, line.key), item.quantity,
          lotId => store.get<PurchaseLot>('accountingPurchases', lotId)?.costs);
        for (const [index, layer] of layers.entries()) {
          const lot: PurchaseLot = { id: `return-${entry.id}-${line.key}-${index}`, productId: product.id, title: line.title,
            quantity: layer.quantity, remaining: layer.quantity, costs: layer.costs, kind: 'opening',
            supplier: 'برگشت سالم از مشتری', reference: entry.reference, occurredAt: entry.occurredAt, createdAt: new Date().toISOString(), actor };
          store.set('accountingPurchases', lot.id, lot);
        }
      }
      store.set('accountingReturns', entry.id, entry);
      if (sale.recognizedAt && sale.items.every(line => returnedQuantity([...previousReturns, entry], sale.id, line.key) === line.quantity)) {
        const order = store.get<Order>('orders', sale.orderId);
        if (order) store.set('orders', order.id, { ...order, status: 'لغو شده', inventoryReleased: true, updatedAt: new Date().toISOString() });
        sale.status = 'لغو شده'; store.set('accountingSales', sale.id, sale);
      }
      result = entry;
    } else fail('عملیات حسابداری یافت نشد.', 404);
    touch(); audit(action, actor, result?.id || body.saleId || '', body);
    store.set('accountingActions', actionId, { hash, result });
    return result;
  }

  function snapshot(from = '', to = '', channel = ''): AccountingData {
    try {
      if (from) { from = normalizeAccountingDay(from); accountingDate(from); }
      if (to) { to = normalizeAccountingDay(to); accountingDate(to); }
    } catch (error) { fail((error as Error).message); }
    if (from && to && from > to) fail('شروع بازه باید پیش از پایان باشد.');
    if (channel && !['site', 'instagram'].includes(channel)) fail('کانال فروش نامعتبر است.');
    const inRange = (iso: string) => { const day = accountingDay(iso); return (!from || day >= from) && (!to || day <= to); };
    const purchases = list<PurchaseLot>('accountingPurchases').sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
    const sales = list<AccountingSale>('accountingSales').sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const allEntries = list<MoneyEntry>('accountingMoney');
    const entries = allEntries.filter(entry => !entry.voidedAt); const returns = list<ReturnEntry>('accountingReturns');
    const selected = sales.filter(sale => !channel || sale.channel === channel);
    const totals = Object.fromEntries(sales.map(sale => [sale.id, saleTotals(sale, entries, returns)]));
    const daily = new Map<string, { day: string; revenue: number; profit: number | null }>();
    const byProduct = new Map<string, { productId: string; title: string; revenue: number; quantity: number; profit: number | null }>();
    const channelSummary = ['site', 'instagram'].map(name => ({ channel: name, revenue: 0, profit: 0 as number | null, missingCosts: 0 }));
    let revenue = 0, cost = 0, expenses = 0, refunds = 0, missingCosts = 0, knownProfit = 0;
    function add(iso: string, sale: AccountingSale | undefined, r: number, c: number | null, e: number) {
      const day = accountingDay(iso); const row = daily.get(day) || { day, revenue: 0, profit: 0 };
      row.revenue += r; row.profit = row.profit === null || c === null ? null : row.profit + r - c - e; daily.set(day, row);
      revenue += r; cost += c || 0; expenses += e;
      if (c !== null) knownProfit += r - c - e;
      if (sale) {
        const summary = channelSummary.find(summary => summary.channel === sale.channel)!;
        summary.revenue += r; summary.profit = summary.profit === null || c === null ? null : summary.profit + r - c - e;
      }
    }
    for (const sale of selected) {
      const lines = sale.items.map(lineCost);
      if (sale.recognizedAt && inRange(sale.recognizedAt)) {
        const known = lines.every(value => value !== null);
        if (!known) { missingCosts++; channelSummary.find(summary => summary.channel === sale.channel)!.missingCosts++; }
        add(sale.recognizedAt, sale, sale.totalPrice, known ? lines.reduce<number>((sum, value) => sum + (value || 0), 0) : null, 0);
        for (const line of sale.items) {
          const row = byProduct.get(line.productId) || { productId: line.productId, title: line.title, revenue: 0, quantity: 0, profit: 0 };
          const c = lineCost(line); row.revenue += line.totalPrice; row.quantity += line.quantity;
          row.profit = row.profit === null || c === null ? null : row.profit + line.totalPrice - c;
          byProduct.set(line.productId, row);
        }
      }
      if (sale.expensesAt && inRange(sale.expensesAt)) add(sale.expensesAt, sale, 0, 0, sale.packaging + sale.shippingPaid + sale.otherCosts - sale.shippingReceived);
      for (const entry of entries.filter(entry => entry.saleId === sale.id && inRange(entry.occurredAt))) if (entry.fee) add(entry.occurredAt, sale, 0, 0, entry.fee);
      for (const entry of returns.filter(entry => entry.saleId === sale.id && inRange(entry.occurredAt))) {
        refunds += entry.amount;
        const recoveredCost = entry.items.reduce((sum, item) => sum + item.recoveredCost, 0);
        add(entry.occurredAt, sale, sale.recognizedAt ? -(entry.amount - entry.shippingRefund) : 0, -recoveredCost, sale.expensesAt ? entry.shippingRefund : 0);
        let allocatedRefund = 0;
        const returnedValue = entry.items.reduce((sum, item) => { const line = sale.items.find(line => line.key === item.key)!; return sum + line.unitPrice * item.quantity; }, 0);
        for (const [index, item] of entry.items.entries()) {
          const line = sale.items.find(line => line.key === item.key)!;
          const row = byProduct.get(line.productId) || { productId: line.productId, title: line.title, revenue: 0, quantity: 0, profit: 0 };
          const refund = index === entry.items.length - 1 ? entry.amount - entry.shippingRefund - allocatedRefund : Math.round((entry.amount - entry.shippingRefund) * line.unitPrice * item.quantity / Math.max(1, returnedValue));
          allocatedRefund += refund;
          row.revenue -= refund; row.quantity -= item.quantity;
          if (row.profit !== null) row.profit -= refund - item.recoveredCost;
          byProduct.set(line.productId, row);
        }
      }
    }
    for (const entry of entries) if (entry.kind === 'expense' && inRange(entry.occurredAt) && !channel) add(entry.occurredAt, undefined, 0, 0, entry.amount);
    let cashMovement = 0;
    if (!channel) {
      for (const entry of entries.filter(entry => inRange(entry.occurredAt))) {
        if (['capital', 'opening', 'settlement'].includes(entry.kind)) cashMovement += entry.amount;
        if (entry.kind === 'receipt' && entry.method === 'card_to_card') cashMovement += entry.amount - entry.fee;
        if (['expense', 'withdrawal'].includes(entry.kind)) cashMovement -= entry.amount;
      }
      cashMovement -= purchases.filter(lot => lot.kind === 'purchase' && inRange(lot.occurredAt)).reduce((sum, lot) => sum + costSum(lot.costs) * lot.quantity, 0);
      cashMovement -= returns.filter(entry => inRange(entry.occurredAt)).reduce((sum, entry) => sum + entry.amount, 0);
      cashMovement -= sales.filter(sale => sale.expensesAt && inRange(sale.expensesAt)).reduce((sum, sale) => sum + sale.packaging + sale.shippingPaid + sale.otherCosts, 0);
    }
    const catalog = list<Product>('products').map(product => {
      const held = list<Order>('orders').filter(order => order.status !== 'تکمیل شده' && !['لغو شده', 'رد شده'].includes(order.status) && !order.inventoryReleased)
        .reduce((sum, order) => sum + order.items.filter(item => item.productId === product.id).reduce((n, item) => n + item.quantity, 0), 0);
      const known = purchases.filter(lot => lot.productId === product.id).reduce((sum, lot) => sum + lot.remaining, 0);
      return { id: product.id, title: product.title, weight: product.weight, stock: product.stock ?? null, held,
        knownQuantity: known, unknownQuantity: Math.max(0, (product.stock || 0) + held - known),
        inventoryCost: purchases.filter(lot => lot.productId === product.id).reduce((sum, lot) => sum + lot.remaining * costSum(lot.costs), 0) };
    });
    const unknownStock = catalog.reduce((sum, product) => sum + product.unknownQuantity, 0);
    const periodPurchases = purchases.filter(lot => lot.kind === 'purchase' && inRange(lot.occurredAt));
    return { catalog, revision: revision(), settings: settings(), purchases, sales, money: allEntries, returns,
      audit: list<AccountingAudit>('accountingAudit').sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 200), totals,
      report: { revenue, cost, expenses, profit: missingCosts ? null : revenue - cost - expenses, knownProfit, missingCosts, refunds,
        inventoryCost: purchases.reduce((sum, lot) => sum + lot.remaining * costSum(lot.costs), 0), unknownStock,
        pendingSettlement: selected.reduce((sum, sale) => sum + totals[sale.id].pendingSettlement, 0),
        receivables: selected.filter(sale => !['لغو شده', 'رد شده'].includes(sale.status)).reduce((sum, sale) => sum + Math.max(0, totals[sale.id].balance), 0),
        purchaseAmount: periodPurchases.reduce((sum, lot) => sum + lot.quantity * costSum(lot.costs), 0),
        purchaseQuantity: periodPurchases.reduce((sum, lot) => sum + lot.quantity, 0),
        siteOrderCount: sales.filter(sale => sale.channel === 'site' && inRange(sale.createdAt)).length,
        siteSoldQuantity: sales.filter(sale => sale.channel === 'site' && sale.recognizedAt && inRange(sale.recognizedAt)).reduce((sum, sale) => sum + sale.items.reduce((n, line) => n + line.quantity, 0), 0)
          - returns.filter(entry => entry.items.length && inRange(entry.occurredAt) && sales.find(sale => sale.id === entry.saleId)?.channel === 'site').reduce((sum, entry) => sum + entry.items.reduce((n, item) => n + item.quantity, 0), 0),
        cashMovement, channels: channelSummary, daily: [...daily.values()].sort((a, b) => b.day.localeCompare(a.day)), products: [...byProduct.values()] } };
  }
  return { syncOrder, syncSiteOrders, assertStatusChange, mutate, snapshot };
}
