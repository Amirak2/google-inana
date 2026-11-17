import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { offersLockColor, defaultLockColor, featuresWithoutLock, isLockColor, LOCK_COLORS } from '../src/utils/lockColor.ts';

const silver = { features: ['کیفیت: 3A+', 'قفل: نقره‌ای', 'سایز: ۵'] };
const gold = { features: ['قفل: استیل ضد زنگ طلایی'] };
const thread = { features: ['قفل: تی با نخ'] };
const none = { features: ['وزن: ۰٫۳'] };
assert.deepEqual(LOCK_COLORS, ['نقره‌ای', 'طلایی']);
assert.equal(offersLockColor(silver), true);
assert.equal(offersLockColor(gold), true);
assert.equal(offersLockColor(thread), false, 'A thread T-bar clasp has no colour to choose');
assert.equal(offersLockColor(none), false);
assert.equal(defaultLockColor(silver), 'نقره‌ای');
assert.equal(defaultLockColor(gold), 'طلایی', 'The product\'s own clasp colour is preselected');
assert.deepEqual(featuresWithoutLock(silver), ['کیفیت: 3A+', 'سایز: ۵'], 'The fixed clasp line is replaced by the choice');
assert.deepEqual(featuresWithoutLock(thread), thread.features);
assert.ok(isLockColor('طلایی') && !isLockColor('قرمز') && !isLockColor(undefined));

// The chosen colour travels with the order and is checked on the server.
const server = await readFile(new URL('../server.ts', import.meta.url), 'utf8');
assert.match(server, /isLockColor\(requested\?\.lockColor\) \? requested\.lockColor : defaultLockColor\(product\)/);
const cart = await readFile(new URL('../src/components/CartDrawer.tsx', import.meta.url), 'utf8');
assert.ok(cart.includes('lockColor: item.lockColor || defaultLockColor(item.product)'), 'The order request carries the clasp colour');
const admin = await readFile(new URL('../src/components/AdminDashboard.tsx', import.meta.url), 'utf8');
assert.ok(admin.includes('قفل ${it.lockColor}'), 'The admin order list shows the clasp colour');

// Photo arrows on the product page and in the large view.
const modal = await readFile(new URL('../src/components/ProductDetailModal.tsx', import.meta.url), 'utf8');
assert.ok(modal.includes('<PhotoArrows count={images.length} index={selectedImageIndex} onChange={setSelectedImageIndex} />'));
const arrows = await readFile(new URL('../src/components/PhotoArrows.tsx', import.meta.url), 'utf8');
assert.ok(arrows.includes('(index + step + count) % count'), 'Arrows wrap around from the last photo to the first');
console.log('PASS: clasp colour choice (silver / gold) reaches the order; photo arrows page through the gallery.');
