import type { Product } from '../types';

export const productAvailability = (product: Product) => Math.max(0, product.availableStock ?? product.stock ?? 0);

export function productWeightOptions(product: Product, products: Product[]): Product[] {
  if (!product.variantGroupId) return [product];
  return products.filter(item => item.variantGroupId === product.variantGroupId)
    .sort((a, b) => a.weight - b.weight || a.id.localeCompare(b.id));
}

/** Group only after filtering so a heavier option never bypasses a weight filter. */
export function groupCatalogVariants(products: Product[]): Product[] {
  const groups = new Map<string, Product>();
  for (const product of products) {
    const key = product.variantGroupId ? `group:${product.variantGroupId}` : `product:${product.id}`;
    const previous = groups.get(key);
    if (!previous || (productAvailability(product) > 0 && productAvailability(previous) === 0)
      || ((productAvailability(product) > 0) === (productAvailability(previous) > 0) && product.weight < previous.weight)) {
      groups.set(key, product);
    }
  }
  return [...groups.values()];
}
