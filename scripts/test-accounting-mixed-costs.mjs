import assert from 'node:assert/strict';
import { Store } from '../server/storage.ts';
import { createAccounting } from '../server/accounting.ts';
import { accountingDate, emptyCosts } from '../src/utils/accounting.ts';

function fixture(product) {
  const store = new Store({}); store.set('products', product.id, product);
  const accounting = createAccounting(store); let count = 0;
  const mutate = (action, body) => accounting.mutate(action, { ...body,
    actionId: `mixed-cash-check-${++count}`, expectedRevision: accounting.snapshot().revision }, 'synthetic-admin');
  return { store, accounting, mutate };
}
const terms = { makingPercent: 16.5, profitPercent: 7, discountPercent: 0 };
const month1 = '1405/06/01', month2 = '1405/07/01';
function paidSale(f, productId, quantity = 1, date = month1) {
  const sale = f.mutate('sale', { customerName: 'Synthetic', date, items: [{ productId, quantity, unitPrice: 1_000_000, goldSale: terms }] });
  f.mutate('money', { saleId: sale.id, kind: 'receipt', method: 'card_to_card', amount: 1_000_000 * quantity,
    reference: `PAY-${sale.id}`, note: 'Synthetic receipt', date });
  return sale;
}
const hybrid = fixture({ id: 'gold-pearl', title: 'Synthetic gold and pearl', weight: 1, stock: 0 });
const components = { ...emptyCosts(), pearl: 200_000, assembly: 50_000, other: 10_000 };
const lot = hybrid.mutate('purchase', { productId: 'gold-pearl', kind: 'purchase', quantity: 2,
  goldPurchase: { weight: 1, makingPercent: 9 }, costs: components, date: month1 });
assert.deepEqual(lot.costs, components);
assert.equal(lot.goldPurchase.costGrams, 1.09);
assert.equal(hybrid.accounting.snapshot(month1, '1405/06/31').report.cashMovement, -520_000);
const corrected = hybrid.mutate('purchase-correction', { purchaseId: lot.id, goldPurchase: { weight: 1, makingPercent: 8 }, reason: 'Synthetic correction' });
assert.deepEqual(corrected.costs, components, 'Old clients correcting only grams preserve cash costs');
hybrid.mutate('purchase-correction', { purchaseId: lot.id, goldPurchase: { weight: 1, makingPercent: 9 }, costs: components, reason: 'Synthetic correction' });
assert.throws(() => hybrid.mutate('purchase', { productId: 'gold-pearl', kind: 'purchase', quantity: 1,
  goldPurchase: { weight: 1, makingPercent: 9 }, costs: { ...components, pearl: -1 }, date: month1 }));
assert.equal(hybrid.store.get('products', 'gold-pearl').stock, 2, 'Bad costs do not alter inventory');
const sold = paidSale(hybrid, 'gold-pearl', 2);
hybrid.mutate('costs', { saleId: sold.id, items: [{ key: '0', extraAssembly: 100_000 }],
  packaging: 0, shippingReceived: 0, shippingPaid: 0, otherCosts: 0 });
assert.throws(() => hybrid.mutate('complete', { saleId: sold.id, date: month1 }), /ساخت/);
hybrid.store.set('orders', sold.id, { ...hybrid.store.get('orders', sold.id), status: 'تأیید شده' });
hybrid.mutate('costs', { saleId: sold.id, items: [{ key: '0', extraAssembly: 0 }],
  packaging: 0, shippingReceived: 0, shippingPaid: 0, otherCosts: 0 });
hybrid.mutate('complete', { saleId: sold.id, date: month1 });
let snap = hybrid.accounting.snapshot();
assert.equal(snap.totals[sold.id].profit, null, 'Cash components never invent a Toman gold basis');
assert.equal(snap.goldTotals[sold.id].profitGrams, 0.3005, 'Gram profit formula is unchanged');
hybrid.mutate('return', { saleId: sold.id, items: [{ key: '0', quantity: 1 }], amount: 1_000_000, shippingRefund: 0,
  restock: true, reference: 'HYBRID-RETURN', note: 'Synthetic return', date: month2 });
snap = hybrid.accounting.snapshot(month2, '1405/07/30');
assert.equal(snap.report.profit, null);
assert.equal(snap.report.knownProfit, 0, 'Unknown return is not a known million-Toman loss');
assert.equal(snap.report.missingCosts, 1);
assert.equal(snap.report.channels.find(row => row.channel === 'instagram').missingCosts, 1);
assert.equal(snap.report.channels.find(row => row.channel === 'instagram').profit, null);
assert.equal(snap.report.daily[0].profit, null);
assert.equal(snap.report.products[0].profit, null);
assert.equal(snap.report.refunds, 1_000_000);
assert.equal(snap.report.cashMovement, -1_000_000, 'Cash refund remains exact despite unknown profit');
assert.equal(snap.report.gold.profitGrams, -0.15025, 'Gold return reverses original profit');
const restored = snap.purchases.find(row => row.id.startsWith('return-'));
assert.deepEqual(restored.costs, components, 'Return retains pearl, ready assembly and other costs');
const resale = paidSale(hybrid, 'gold-pearl', 1, month2);
hybrid.mutate('complete', { saleId: resale.id, date: month2 });
assert.equal(hybrid.accounting.snapshot().sales.find(row => row.id === resale.id).items[0].allocations[0].unitCost, 260_000);

// Fabrication is a cost of goods; its bank payment is an independent dated event.
const assembly = fixture({ id: 'fabricated', title: 'Synthetic pearl item', weight: 0, pricingMode: 'fixed', stock: 1 });
assembly.mutate('purchase', { productId: 'fabricated', kind: 'opening', quantity: 1, costs: emptyCosts(), date: month1 });
const assembled = paidSale(assembly, 'fabricated');
const costBody = { saleId: assembled.id, packaging: 0, shippingReceived: 0, shippingPaid: 0, otherCosts: 0 };
assembly.mutate('costs', { ...costBody, items: [{ key: '0', extraAssembly: 100_000 }] });
assert.equal(assembly.accounting.snapshot(month1, '1405/06/31').report.cashMovement, 1_000_000, 'Legacy payment status is not guessed');
assert.throws(() => assembly.mutate('costs', { ...costBody, items: [{ key: '0', extraAssembly: 100_000, extraAssemblyPaid: true }] }), /تاریخ/);
assert.throws(() => assembly.mutate('costs', { ...costBody, items: [{ key: '0', extraAssemblyPaid: 'yes', extraAssemblyDate: month1 }] }), /وضعیت/);
assembly.mutate('costs', { ...costBody, items: [{ key: '0', extraAssembly: 100_000, extraAssemblyPaid: true, extraAssemblyDate: month1 }] });
assert.equal(assembly.accounting.snapshot(month1, '1405/06/31').report.cashMovement, 900_000);
assembly.mutate('complete', { saleId: assembled.id, date: month1 });
assert.equal(assembly.accounting.snapshot().totals[assembled.id].profit, 900_000, 'Assembly is charged once to profit');
assembly.mutate('costs', { ...costBody, reason: 'Synthetic actual payment date', items: [{ key: '0', extraAssembly: 100_000, extraAssemblyPaid: true, extraAssemblyDate: month2 }] });
assert.equal(assembly.accounting.snapshot(month1, '1405/06/31').report.cashMovement, 1_000_000);
assert.equal(assembly.accounting.snapshot(month2, '1405/07/30').report.cashMovement, -100_000);
assert.equal(assembly.accounting.snapshot().totals[assembled.id].profit, 900_000, 'Payment date does not rewrite cost of goods');
assembly.mutate('costs', { ...costBody, reason: 'Synthetic unpaid correction', items: [{ key: '0', extraAssembly: 100_000, extraAssemblyPaid: false }] });
assert.equal(assembly.accounting.snapshot().report.cashMovement, 1_000_000);

// Old gold sale completed before the reporting month; direct mixed basis is supported.
const legacy = fixture({ id: 'legacy-gold', title: 'Synthetic legacy gold', weight: 1, stock: 0 });
legacy.accounting.syncOrder({ id: 'legacy-order', trackingCode: 'LEGACY', customerName: 'Synthetic', status: 'تکمیل شده',
  createdAt: accountingDate(month1), totalPrice: 1_000_000,
  items: [{ productId: 'legacy-gold', productTitle: 'Synthetic', quantity: 1, weight: 1, unitPrice: 1_000_000, totalPrice: 1_000_000 }] });
legacy.mutate('costs', { saleId: 'legacy-order', items: [{ key: '0', goldPurchase: { weight: 1, makingPercent: 9 },
  costs: components, goldRevenueGrams: 1.15025 }], packaging: 0, shippingReceived: 0, shippingPaid: 0, otherCosts: 0 });
assert.deepEqual(legacy.accounting.snapshot().sales[0].items[0].overrideCosts, components);
legacy.mutate('money', { saleId: 'legacy-order', kind: 'receipt', method: 'card_to_card', amount: 1_000_000, reference: 'LEGACY-PAY', note: 'Synthetic', date: month1 });
legacy.mutate('return', { saleId: 'legacy-order', items: [{ key: '0', quantity: 1 }], amount: 1_000_000, shippingRefund: 0,
  restock: true, reference: 'LEGACY-RETURN', note: 'Synthetic', date: month2 });
assert.equal(legacy.accounting.snapshot(month2, '1405/07/30').report.profit, null);
assert.deepEqual(legacy.accounting.snapshot().purchases[0].costs, components);
const pending = fixture({ id: 'pending-gold', title: 'Synthetic pending gold', weight: 1, stock: 1 });
const pendingSale = pending.mutate('sale', { customerName: 'Synthetic', items: [{ productId: 'pending-gold', quantity: 1, unitPrice: 1_000_000 }], date: month1 });
const pendingBody = { saleId: pendingSale.id, packaging: 0, shippingReceived: 0, shippingPaid: 0, otherCosts: 0 };
pending.mutate('costs', { ...pendingBody, items: [{ key: '0', costs: { ...components, gold: 800_000, making: 72_000 } }] });
pending.mutate('costs', { ...pendingBody, items: [{ key: '0', goldPurchase: { weight: 1, makingPercent: 9 } }] });
assert.deepEqual(pending.accounting.snapshot().sales[0].items[0].overrideCosts, components, 'Entering gram basis keeps only independent cash components');
console.log('PASS: mixed gram/cash purchases and corrections, FIFO/restock/resale, dated paid assembly and unknown Toman return reports');
