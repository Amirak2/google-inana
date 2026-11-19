import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { calculateProductPrice, priceBeforeDiscount } from '../src/utils/pricingEngine.ts';
import { cleanFeatures } from '../src/utils/productFeatures.ts';

// Old price shown struck through next to the discounted one.
const fixed = { pricingMode: 'fixed', fixedPrice: 3_900_000, discountPercent: 15 };
const fixedBreakdown = calculateProductPrice(fixed, 24_000_000);
assert.equal(fixedBreakdown.finalPrice, 3_315_000);
assert.equal(priceBeforeDiscount(fixed, fixedBreakdown), 3_900_000);
const gold = { pricingMode: 'gold', weight: 0.05, discountPercent: 15 };
const goldBreakdown = calculateProductPrice(gold, 24_000_000, { globalMakingChargePercent: 16.5, profitPercent: 7, fixedCost: 0 });
const goldFull = calculateProductPrice({ ...gold, discountPercent: 0 }, 24_000_000, { globalMakingChargePercent: 16.5, profitPercent: 7, fixedCost: 0 });
assert.equal(priceBeforeDiscount(gold, goldBreakdown), goldFull.finalPrice, 'The struck-through price is the normal price');
assert.equal(priceBeforeDiscount({ ...fixed, discountPercent: 0 }, calculateProductPrice({ ...fixed, discountPercent: 0 }, 1)), null, 'No discount, no struck-through price');
for (const file of ['ProductCard', 'ProductDetailModal', 'CartDrawer']) {
  const src = await readFile(new URL(`../src/components/${file}.tsx`, import.meta.url), 'utf8');
  assert.ok(src.includes('aria-label="قیمت قبل از تخفیف"'), `${file} shows the old price`);
}

// Features and benefits come from the admin, not from fixed text.
assert.deepEqual(cleanFeatures([' کیفیت: 3A+ ', '', 'قفل: نقره‌ای', '   ']), ['کیفیت: 3A+', 'قفل: نقره‌ای']);
assert.deepEqual(cleanFeatures(undefined), []);
const admin = await readFile(new URL('../src/components/AdminDashboard.tsx', import.meta.url), 'utf8');
assert.ok(admin.includes('ویژگی‌ها و مزایا (هر ویژگی در یک خط)'), 'The admin product form has a features box');
assert.ok(!admin.includes("'دست‌ساز با پرداخت آینه‌ای'"), 'New products no longer get made-up features');
const server = await readFile(new URL('../server.ts', import.meta.url), 'utf8');
assert.ok(server.includes('features: cleanFeatures(req.body.features),') && server.includes('features: req.body.features !== undefined ? cleanFeatures(req.body.features) : productsList[index].features'));

// No white fade over product photos.
const card = await readFile(new URL('../src/components/ProductCard.tsx', import.meta.url), 'utf8');
assert.ok(!card.includes('bg-gradient-to-t from-[#060B15] via-transparent to-transparent opacity-75'));
console.log('PASS: struck-through old price on discounts, admin-written features, no fade over product photos.');

// The product page does not show the making charge or the price formula.
const productPage = await readFile(new URL('../src/components/ProductDetailModal.tsx', import.meta.url), 'utf8');
assert.ok(!productPage.includes('درصد اجرت') && !productPage.includes('ریز فرمول قیمت‌گذاری') && !productPage.includes('اجرت ساخت ('), 'Making charge and formula stay private');
console.log('PASS: product page hides the making charge and the price formula.');
