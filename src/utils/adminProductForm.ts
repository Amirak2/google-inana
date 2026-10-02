import type { Product } from '../types';

export type ProductUpdates = Partial<Product> & { expectedStock?: number };
const editableFields = ['title', 'titleEn', 'slug', 'category', 'collection', 'pricingMode', 'fixedPrice', 'weight', 'purity', 'customMakingChargePercent', 'customProfitPercent', 'additionalCost', 'stoneCost', 'discountPercent', 'images', 'description', 'features', 'dimensions', 'sku', 'stock', 'isNewArrival', 'isBestSeller', 'isFeatured', 'letter'] as const;

export function changedProductFields(original: Product, draft: Partial<Product>): ProductUpdates {
  const updates: ProductUpdates = {};
  for (const field of editableFields) {
    if (draft[field] !== undefined && JSON.stringify(draft[field]) !== JSON.stringify(original[field])) {
      (updates as Record<string, unknown>)[field] = draft[field];
    }
  }
  if (updates.stock !== undefined) updates.expectedStock = original.stock;
  return updates;
}

export function numberOrDefault(value: unknown, fallback: number): number {
  if (value === undefined || value === null || value === '') return fallback;
  const number = Number(value);
  if (!Number.isFinite(number)) throw new Error('مقدار عددی معتبر وارد کنید.');
  return number;
}
