import assert from 'node:assert/strict';
import { PEARL_PRODUCTS } from '../src/data/seedData.ts';
import { calculateProductPrice, DEFAULT_SETTINGS } from '../src/utils/pricingEngine.ts';

const products = [
  ['p3', 7_000_000, 1],
  ['class10', 10_000_000, 1],
  ['p9', 3_000_000, 2],
];
for (const [sku, expectedPrice, expectedStock] of products) {
  const product = PEARL_PRODUCTS.find((candidate) => candidate.sku === sku);
  assert.ok(product);
  assert.equal(product.stock, expectedStock);
  for (const goldRate of [0, 15_000_000, 30_000_000]) {
    const price = calculateProductPrice(product, goldRate, DEFAULT_SETTINGS);
    assert.equal(price.finalPrice, expectedPrice);
    assert.equal(price.baseGoldValue, 0);
    assert.equal(price.makingChargeAmount, 0);
    assert.equal(price.profitAmount, 0);
    assert.equal(price.taxAmount, 0);
  }
}

console.log('PASS: pearl prices remain fixed regardless of gold rate, without making charge, profit or tax.');
