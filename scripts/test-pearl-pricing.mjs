import assert from 'node:assert/strict';
import { PEARL_PRODUCTS } from '../src/data/seedData.ts';
import { calculateProductPrice, DEFAULT_SETTINGS } from '../src/utils/pricingEngine.ts';

const pearl = PEARL_PRODUCTS.find((product) => product.sku === 'p3');
assert.ok(pearl);
assert.equal(pearl.stock, 1);

const products = [
  [pearl, 7_000_000],
  [PEARL_PRODUCTS.find((product) => product.sku === 'class10'), 10_000_000],
];
for (const [product, expectedPrice] of products) {
  assert.ok(product);
  assert.equal(product.stock, 1);
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
