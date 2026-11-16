// The order-costs form has one "total cost" box instead of packaging / shipping / other.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const source = await readFile(new URL('../src/components/AccountingDashboard.tsx', import.meta.url), 'utf8');
assert.ok(source.includes("moneyInput('otherCosts', 'هزینهٔ کل همین سفارش — تومان')"));
for (const label of ['بسته‌بندی سفارش — تومان', 'هزینهٔ ارسال دریافتی از مشتری — تومان', 'هزینهٔ واقعی ارسال پرداختی — تومان'])
  assert.ok(!source.includes(label), `"${label}" is no longer a separate box in the order form`);
assert.ok(source.includes('packaging: 0, shippingReceived: sale.shippingReceived, shippingPaid: 0, otherCosts: (sale.packaging || 0) + (sale.shippingPaid || 0) + (sale.otherCosts || 0)'), 'Older split costs open as their sum');
console.log('PASS: order costs are entered in one total box.');
