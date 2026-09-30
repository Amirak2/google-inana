/** Validate the complete cart before changing any reservation. */
export function cartQuantities(items: unknown): Map<string, number> {
  if (!Array.isArray(items) || items.length < 1 || items.length > 50) throw new Error('سبد باید بین ۱ تا ۵۰ ردیف داشته باشد.');
  const quantities = new Map<string, number>();
  for (const item of items) {
    if (!item || typeof item.productId !== 'string' || item.productId.length > 120) throw new Error('شناسه محصول نامعتبر است.');
    const quantity = Number(item.quantity);
    const total = (quantities.get(item.productId) || 0) + quantity;
    if (!Number.isInteger(quantity) || quantity < 1 || total > 20) throw new Error('مجموع تعداد هر محصول باید بین ۱ تا ۲۰ باشد.');
    quantities.set(item.productId, total);
  }
  return quantities;
}

/** Truncate values, never serialized JSON; bound depth, nodes, and output bytes. */
export function boundedLogDetails(details: unknown): any {
  if (details === undefined || details === null) return undefined;
  let nodes = 0;
  const visit = (value: any, depth: number): any => {
    if (++nodes > 60 || depth > 4) return '[truncated]';
    if (typeof value === 'string') return value.slice(0, 500);
    if (value === null || typeof value === 'number' || typeof value === 'boolean') return value;
    if (Array.isArray(value)) return value.slice(0, 20).map(item => visit(item, depth + 1));
    if (typeof value === 'object') return Object.fromEntries(Object.entries(value).slice(0, 20).map(([key, item]) => [key.slice(0, 80), visit(item, depth + 1)]));
    return String(value).slice(0, 500);
  };
  const safe = visit(details, 0);
  const serialized = JSON.stringify(safe);
  return serialized.length <= 2000 ? safe : { truncated: true, summary: serialized.slice(0, 1800) };
}
