// Customers choose the clasp colour of necklaces and bracelets that have a metal clasp.
import type { Product } from '../types';

export const LOCK_COLORS = ['نقره‌ای', 'طلایی'] as const;
export type LockColor = typeof LOCK_COLORS[number];

const LOCK_FEATURE = /^\s*قفل\s*:/;

// Products whose features list a silver or gold metal clasp ("قفل: نقره‌ای",
// "قفل: استیل ضد زنگ طلایی"). A thread T-bar clasp has no colour to choose.
export function offersLockColor(product: Pick<Product, 'features'>) {
  const lock = (product.features || []).find(feature => LOCK_FEATURE.test(feature));
  return !!lock && /نقره|طلا/.test(lock) && !/نخ/.test(lock);
}

// The colour the product comes with, used as the preselected choice.
export function defaultLockColor(product: Pick<Product, 'features'>): LockColor {
  const lock = (product.features || []).find(feature => LOCK_FEATURE.test(feature)) || '';
  return /طلا/.test(lock) ? 'طلایی' : 'نقره‌ای';
}

// Features shown on the product page, without the fixed clasp line when the customer chooses it.
export function featuresWithoutLock(product: Pick<Product, 'features'>) {
  return offersLockColor(product) ? (product.features || []).filter(feature => !LOCK_FEATURE.test(feature)) : (product.features || []);
}

export function isLockColor(value: unknown): value is LockColor {
  return typeof value === 'string' && (LOCK_COLORS as readonly string[]).includes(value);
}
