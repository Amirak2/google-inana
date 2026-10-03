import type { Product, PricingSettings } from '../types';
import { calculateProductPrice } from './pricingEngine';
import { groupCatalogVariants } from './productVariants';

export const CATALOG_SORTS = ['newest', 'bestseller', 'price-asc', 'price-desc', 'weight-asc', 'weight-desc'] as const;
export type CatalogSort = typeof CATALOG_SORTS[number];
export interface CatalogFilters {
  selectedCategory: string | null;
  selectedCollection: string | null;
  searchQuery: string;
  selectedLetter: string | null;
  maxWeight: number | null;
  onlyInStock: boolean;
  sortBy: CatalogSort;
}
export const DEFAULT_CATALOG_FILTERS: CatalogFilters = {
  selectedCategory: null, selectedCollection: null, searchQuery: '',
  selectedLetter: null, maxWeight: null, onlyInStock: false, sortBy: 'newest',
};

export function normalizeCatalogFilters(input: { [K in keyof CatalogFilters]?: unknown } = {}): CatalogFilters {
  const selectedCategory = typeof input.selectedCategory === 'string' && input.selectedCategory ? input.selectedCategory : null;
  const selectedCollection = typeof input.selectedCollection === 'string' && input.selectedCollection ? input.selectedCollection : null;
  const letter = typeof input.selectedLetter === 'string' ? input.selectedLetter.toUpperCase() : '';
  return {
    selectedCategory, selectedCollection,
    searchQuery: typeof input.searchQuery === 'string' ? input.searchQuery : '',
    selectedLetter: (selectedCategory === 'حروف انگلیسی' || selectedCollection === 'INANA LETTERS') && /^[A-Z]$/.test(letter) ? letter : null,
    maxWeight: typeof input.maxWeight === 'number' && Number.isFinite(input.maxWeight) && input.maxWeight > 0 ? input.maxWeight : null,
    onlyInStock: input.onlyInStock === true,
    sortBy: CATALOG_SORTS.includes(input.sortBy as CatalogSort) ? input.sortBy as CatalogSort : 'newest',
  };
}

export function normalizeCatalogText(text: string): string {
  return text.normalize('NFKC').replace(/[يى]/g, 'ی').replace(/ك/g, 'ک')
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '').replace(/[\u200C\u200D]/g, ' ')
    .replace(/[۰-۹]/g, digit => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
    .replace(/[٠-٩]/g, digit => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
    .replace(/\s+/g, ' ').trim().toLowerCase();
}

export function filterCatalogProducts(products: Product[], filters: CatalogFilters): Product[] {
  const query = normalizeCatalogText(filters.searchQuery);
  return groupCatalogVariants(products.filter(product => {
    if (query && ![product.title, product.titleEn, product.category, product.collection, product.sku, product.letter]
      .some(text => text && normalizeCatalogText(text).includes(query))) return false;
    if (filters.selectedCategory && product.category !== filters.selectedCategory) return false;
    if (filters.selectedCollection && product.collection !== filters.selectedCollection) return false;
    if (filters.selectedLetter && product.letter?.toUpperCase() !== filters.selectedLetter) return false;
    if (filters.maxWeight !== null && product.pricingMode !== 'fixed' && product.weight > filters.maxWeight) return false;
    return !filters.onlyInStock || (product.availableStock ?? product.stock ?? 0) > 0;
  }));
}

export function sortCatalogProducts(products: Product[], sort: CatalogSort, goldPrice: number, settings: PricingSettings): Product[] {
  return [...products].sort((a, b) => {
    switch (sort) {
      case 'newest': return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      case 'bestseller': return Number(b.isBestSeller) - Number(a.isBestSeller);
      case 'price-asc': return calculateProductPrice(a, goldPrice, settings).finalPrice - calculateProductPrice(b, goldPrice, settings).finalPrice;
      case 'price-desc': return calculateProductPrice(b, goldPrice, settings).finalPrice - calculateProductPrice(a, goldPrice, settings).finalPrice;
      case 'weight-asc': return a.weight - b.weight;
      case 'weight-desc': return b.weight - a.weight;
    }
  });
}

/** Category counts respect the other filters, but not the category or its nested letter. */
export function catalogCategoryCounts(products: Product[], filters: CatalogFilters): Map<string, number> {
  const counts = new Map<string, number>();
  for (const product of filterCatalogProducts(products, { ...filters, selectedCategory: null, selectedLetter: null })) {
    counts.set(product.category, (counts.get(product.category) || 0) + 1);
  }
  return counts;
}

/** A null ceiling means unlimited; slider bounds reflect the selected catalog's gold. */
export function catalogWeightBounds(products: Product[], filters: CatalogFilters) {
  const weights = products.filter(product => product.pricingMode !== 'fixed' && Number.isFinite(product.weight) && product.weight > 0
    && (!filters.selectedCategory || product.category === filters.selectedCategory)
    && (!filters.selectedCollection || product.collection === filters.selectedCollection)).map(product => product.weight);
  if (!weights.length) return null;
  if (filters.maxWeight !== null) weights.push(filters.maxWeight);
  const min = Math.floor(Math.min(...weights) * 1000) / 1000;
  const max = Math.ceil(Math.max(...weights) * 1000) / 1000;
  return { min, max: Math.max(max, min + 0.001), step: 0.001 };
}
