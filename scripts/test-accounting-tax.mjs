import assert from 'node:assert/strict';
import { Store } from '../server/storage.ts';
import { createAccounting } from '../server/accounting.ts';
import { emptyCosts, returnMoneyLines, returnTaxAmount, goldSaleRevenue } from '../src/utils/accounting.ts';

const price = 127120500, tax = 2465500, net = 124655000, purchase = 109500000, profit = 15155000;
const terms = { makingPercent: 16.5, profitPercent: 7, discountPercent: 0 };
const invoiceTax = { taxableAmount: 24655000, ratePercent: 10, amount: 99999999 };
function setup(grams = false, method = 'card_to_card', quantity = 2) {
  const store = new Store({}); const acc = createAccounting(store); let sequence = 0;
  store.set('products', 'gold', { id: 'gold', title: 'طلای آزمایشی ده گرمی', weight: 10, stock: quantity, pricingMode: 'gold', images: [], ...terms });
  const mutate = (action, body, actionId = `tax-fixture-${++sequence}`) => acc.mutate(action,
    { actionId, expectedRevision: acc.snapshot().revision, date: '1405/07/13', ...body }, 'test-admin');
  mutate('purchase', { productId: 'gold', kind: 'opening', quantity,
    costs: grams ? emptyCosts() : { ...emptyCosts(), gold: 100000000, making: 9500000 },
    ...(grams ? { goldPurchase: { weight: 10, makingPercent: 9.5 } } : {}) });
  const sale = mutate('sale', { customerName: 'آزمایشی', method,
    items: [{ productId: 'gold', quantity, unitPrice: price, goldSale: terms, tax: invoiceTax }] });
  assert.equal(sale.items[0].tax.amount, tax, 'Server computes actual invoice VAT rather than trusting submitted amount');
  mutate('money', { saleId: sale.id, kind: 'receipt', method, amount: price * quantity, fee: 0, reference: 'TAX-RECEIPT', note: 'fixture' });
  if (method === 'pasargad') mutate('money', { saleId: sale.id, kind: 'settlement', method, amount: price * quantity, fee: 0, reference: 'TAX-SETTLEMENT', note: 'fixture' });
  mutate('complete', { saleId: sale.id });
  return { store, acc, mutate, sale: acc.snapshot().sales[0] };
}

// Identical tax and profit for a given invoice, irrespective of payment method.
for (const method of ['card_to_card', 'pasargad']) {
  const { acc, mutate, sale } = setup(false, method);
  let snap = acc.snapshot(); const totals = snap.totals[sale.id];
  assert.equal(totals.paid, 2 * price); assert.equal(totals.balance, 0);
  assert.equal(totals.revenue, 2 * net); assert.equal(totals.taxAmount, 2 * tax);
  assert.equal(totals.cost, 2 * purchase); assert.equal(totals.profit, 2 * profit);
  assert.equal(snap.report.profit, 2 * profit); assert.equal(snap.report.taxAmount, 2 * tax);
  assert.equal(snap.report.products[0].profit, 2 * profit);
  assert.equal(snap.report.channels.find(c => c.channel === 'instagram').profit, 2 * profit);
  assert.equal(snap.report.cashMovement, 2 * price, 'Cash retains the full received amount including VAT');
  const paidTax = mutate('money', { kind: 'tax_payment', method: 'card_to_card', amount: 2 * tax,
    reference: 'TAX-PAID', note: 'پرداخت آزمایشی مالیات' }, 'tax-idempotent-01');
  mutate('money', { kind: 'tax_payment', method: 'card_to_card', amount: 2 * tax,
    reference: 'TAX-PAID', note: 'پرداخت آزمایشی مالیات' }, 'tax-idempotent-01');
  snap = acc.snapshot(); assert.equal(snap.report.taxPayments, 2 * tax);
  assert.equal(snap.report.cashMovement, 2 * net); assert.equal(snap.report.profit, 2 * profit, 'Tax remittance must not reduce profit twice');
  mutate('money-void', { entryId: paidTax.id, reason: 'ابطال آزمایشی' });
  assert.equal(acc.snapshot().report.taxPayments, 0); assert.equal(acc.snapshot().report.cashMovement, 2 * price);
  mutate('return', { saleId: sale.id, amount: price, shippingRefund: 0, items: [{ key: '0', quantity: 1 }], restock: true,
    reference: 'TAX-RETURN-1', note: 'fixture', date: '1405/08/01' });
  snap = acc.snapshot(); assert.equal(snap.totals[sale.id].profit, profit); assert.equal(snap.totals[sale.id].taxAmount, tax);
  const firstMonth = acc.snapshot('1405/07/01', '1405/07/30');
  assert.equal(firstMonth.report.profit, 2 * profit); assert.equal(firstMonth.report.taxAmount, 2 * tax);
  const nextMonth = acc.snapshot('1405/08/01', '1405/08/30');
  assert.equal(nextMonth.report.revenue, -net); assert.equal(nextMonth.report.taxAmount, -tax);
  assert.equal(nextMonth.report.profit, -profit); assert.equal(nextMonth.report.daily[0].profit, -profit);
  assert.equal(nextMonth.report.products[0].profit, -profit);
  assert.equal(nextMonth.report.cashMovement, -price, 'Refund cash includes refunded VAT');
  assert.throws(() => mutate('costs', { saleId: sale.id, items: [{ key: '0', tax: invoiceTax }],
    packaging: 0, shippingReceived: 0, shippingPaid: 0, otherCosts: 0, reason: 'change' }), /مرجوع/);
  mutate('return', { saleId: sale.id, amount: price, shippingRefund: 0, items: [{ key: '0', quantity: 1 }], restock: true,
    reference: 'TAX-RETURN-2', note: 'fixture', date: '1405/08/02' });
  snap = acc.snapshot(); assert.equal(snap.report.profit, 0); assert.equal(snap.report.taxAmount, 0);
  assert.equal(snap.report.products[0].profit, 0); assert.equal(snap.report.cashMovement, 0);
}

// Rate-free gram profit equals the agreed example; VAT does not become gold profit.
{
  const { acc, mutate, sale, store } = setup(true, 'card_to_card', 1);
  let snap = acc.snapshot(); assert.equal(snap.goldTotals[sale.id].profitGrams, 1.5155);
  assert.equal(snap.totals[sale.id].profit, null, 'No invented Toman purchase rate for a gram-only purchase');
  assert.equal(snap.report.taxAmount, tax);
  store.set('market', 'gold', { pricePerGram: 99999999 });
  assert.equal(acc.snapshot().goldTotals[sale.id].profitGrams, 1.5155);
  mutate('return', { saleId: sale.id, amount: price, shippingRefund: 0, items: [{ key: '0', quantity: 1 }], restock: true,
    reference: 'GRAM-TAX-RETURN', note: 'fixture', date: '1405/08/01' });
  snap = acc.snapshot(); assert.equal(snap.goldTotals[sale.id].profitGrams, 0);
  assert.equal(snap.report.gold.inventoryCostGrams, 10.95);
  assert.equal(acc.snapshot('1405/08/01', '1405/08/30').report.profit, null, 'Unknown cash basis survives next-period taxable return');
}

// Shipping is not mistaken for merchandise VAT; refunds preserve net revenue.
{
  const { sale } = setup();
  const partial = { amount: price / 2 + 10000, shippingRefund: 10000, items: [{ key: '0', quantity: 1 }] };
  assert.equal(returnTaxAmount(sale, partial), tax / 2);
  assert.equal(returnMoneyLines(sale, partial)[0].net, net / 2);
  const mixed = { items: [{ key: 'a', unitPrice: 110, tax: { amount: 10 } }, { key: 'b', unitPrice: 109, tax: { amount: 9 } }] };
  const refund = { amount: 219, shippingRefund: 0, items: [{ key: 'a', quantity: 1 }, { key: 'b', quantity: 1 }] };
  assert.equal(returnTaxAmount(mixed, refund), 19);
  assert.deepEqual(returnMoneyLines(mixed, refund).map(line => line.net), [100, 100]);
  const tiny = { items: Array.from({ length: 10 }, (_, i) => ({ key: String(i), unitPrice: 2, tax: { amount: 1 } })) };
  const tinyLines = returnMoneyLines(tiny, { amount: 1, shippingRefund: 0, items: tiny.items.map(line => ({ key: line.key, quantity: 1 })) });
  assert.equal(tinyLines.reduce((n, line) => n + line.gross, 0), 1);
  assert.ok(tinyLines.every(line => line.gross >= 0 && line.tax >= 0 && line.net >= 0));
}

// Safe corrections keep gross receipts, preserve history and validate tax input.
{
  const { acc, mutate, sale, store } = setup(false, 'card_to_card', 1);
  const costs = { saleId: sale.id, packaging: 0, shippingReceived: 0, shippingPaid: 0, otherCosts: 0, reason: 'اصلاح فاکتور' };
  for (const invalid of [null, { taxableAmount: -1, ratePercent: 10 }, { taxableAmount: price, ratePercent: 10 }, { taxableAmount: 1.5, ratePercent: 10 }, { taxableAmount: 5, ratePercent: 101 }]) {
    assert.throws(() => mutate('costs', { ...costs, items: [{ key: '0', tax: invalid }] }));
    assert.equal(acc.snapshot().totals[sale.id].taxAmount, tax);
  }
  mutate('costs', { ...costs, items: [{ key: '0', tax: { taxableAmount: 24655000, ratePercent: 9 } }] });
  let snap = acc.snapshot(); assert.equal(snap.totals[sale.id].paid, price); assert.equal(snap.totals[sale.id].balance, 0);
  assert.equal(snap.totals[sale.id].taxAmount, 2218950, 'Historical invoice rate stays recorded');
  acc.syncSiteOrders(); assert.equal(acc.snapshot().totals[sale.id].taxAmount, 2218950, 'Sync cannot overwrite an audited correction');
  assert.ok(snap.audit.some(entry => entry.action === 'جزئیات اصلاح هزینه' && entry.details.before.items[0].tax.amount === tax));
  const old = structuredClone(store.get('orders', sale.id)); old.id = 'legacy-no-tax'; old.trackingCode = 'LEGACY-TAX'; old.items = old.items.map(({tax, ...line}) => line);
  acc.syncOrder(old); assert.equal(acc.snapshot().sales.find(line => line.id === old.id).items[0].tax, undefined, 'No retroactive tax guessed from gross amount');
}
assert.equal(goldSaleRevenue(10, 9.5, terms), 11.5155);
console.log('PASS: 10g gold example, 10% fee/profit VAT, payment-method independence, net revenues, tax remittance, partial/full next-period refunds, gram profit and audited legacy corrections.');

