import assert from 'node:assert/strict';
import { saleStep, accountingTodos } from '../src/utils/accountingSteps.ts';

const line = (extra = {}) => ({ key: '0', productId: 'p', title: 'کالا', quantity: 1, weight: 0, unitPrice: 1000, totalPrice: 1000, allocations: [], extraAssembly: 0, ...extra });
const sale = (extra = {}) => ({ id: 's', orderId: 's', trackingCode: 'T', channel: 'site', customerName: 'م', status: 'تأیید شده', totalPrice: 1000, createdAt: '2026-11-01T00:00:00Z',
  items: [line()], packaging: 0, shippingReceived: 0, shippingPaid: 0, otherCosts: 0, revision: 0, ...extra });
const totals = (extra = {}) => ({ balance: 1000, refunded: 0, paid: 0, profit: null, ...extra });

assert.equal(saleStep(sale({ status: 'لغو شده' }), totals()).key, 'closed');
assert.equal(saleStep(sale({ status: 'رد شده' }), totals()).action, undefined, 'Closed sales offer no action');
assert.equal(saleStep(sale({ status: 'در انتظار بررسی' }), totals()).key, 'review', 'Unreviewed site orders are handled in the orders panel');
assert.equal(saleStep(sale(), totals()).action.kind, 'receipt', 'Unpaid: record the payment first');
assert.equal(saleStep(sale(), totals({ balance: 0, paid: 1000 })).action.kind, 'complete', 'Paid: complete after delivery');
assert.equal(saleStep(sale(), totals({ balance: 0, paid: 1000, refunded: 200 })).key, 'refunded', 'Refunded before delivery cannot be completed');
const recognized = { recognizedAt: '2026-11-02T00:00:00Z' };
assert.equal(saleStep(sale({ ...recognized, costsLocked: false }), totals({ balance: 0 })).action.kind, 'costs', 'Completed without purchase cost: fill it in');
assert.equal(saleStep(sale({ ...recognized, costsLocked: true }), totals({ balance: 0 })).key, 'done');
assert.equal(saleStep(sale({ ...recognized, items: [line({ overrideCosts: { gold: 0, making: 0, pearl: 600, assembly: 0, other: 0 } })] }), totals({ balance: 0 })).key, 'done', 'Older sales without the lock flag use their line costs');

const data = { sales: [sale({ id: 'a' }), sale({ id: 'b' }), sale({ id: 'c', ...recognized, costsLocked: false }), sale({ id: 'd', status: 'لغو شده' })],
  totals: { a: totals(), b: totals({ balance: 0, paid: 1000 }), c: totals({ balance: 0 }), d: totals() } };
assert.deepEqual(accountingTodos(data), { payment: 1, complete: 1, cost: 1 });
console.log('PASS: each sale gets one next step (payment, completion, purchase cost) and the home to-do counts match.');
