import type { AccountingSale, MoneyEntry, ReturnEntry, CostParts, AccountingLine, GoldSaleTerms } from '../types/accounting';
import type { Product, PricingSettings } from '../types';

export const roundGrams = (value: number) => Math.round(value * 1_000_000) / 1_000_000;
export const goldPurchaseCost = (weight: number, makingPercent: number) => roundGrams(weight * (1 + makingPercent / 100));
export function productGoldSale(product: Product, settings: PricingSettings): GoldSaleTerms | undefined {
  if (product.pricingMode === 'fixed' || product.weight <= 0) return undefined;
  return { makingPercent: product.customMakingChargePercent ?? settings.globalMakingChargePercent,
    profitPercent: product.customProfitPercent ?? settings.profitPercent, discountPercent: product.discountPercent };
}
export function goldSaleRevenue(weight: number, wholesalePercent: number, terms: GoldSaleTerms): number {
  return roundGrams(weight * (1 + (terms.makingPercent - wholesalePercent) / 100)
    * (1 + terms.profitPercent / 100) * (1 - terms.discountPercent / 100));
}
export function lineGoldRevenue(line: AccountingLine, skip = 0, count = line.quantity): number | null {
  if (line.weight <= 0) return 0;
  if (!line.goldSale) return line.goldRevenueGrams === undefined ? null : roundGrams(line.goldRevenueGrams * count);
  const layers = returnedGoldLayers(line, skip, count);
  if (layers.reduce((sum, layer) => sum + layer.quantity, 0) !== count || layers.some(layer => layer.unitGoldMakingPercent === undefined)) return null;
  return roundGrams(layers.reduce((sum, layer) => sum + layer.quantity * goldSaleRevenue(line.weight, layer.unitGoldMakingPercent!, line.goldSale!), 0));
}
export function lineGoldCost(line: AccountingLine): number | null {
  if (line.weight <= 0) return 0;
  if (line.overrideGoldPurchase) return roundGrams(line.overrideGoldPurchase.weight * line.quantity);
  if (line.allocations.reduce((sum, layer) => sum + layer.quantity, 0) !== line.quantity || line.allocations.some(layer => layer.unitGoldWeight === undefined)) return null;
  return roundGrams(line.allocations.reduce((sum, layer) => sum + layer.quantity * layer.unitGoldWeight!, 0));
}
export function goldReturnMovement(sale: AccountingSale, entry: ReturnEntry, previousReturns: ReturnEntry[] = []) {
  const value = entry.items.reduce((sum, item) => sum + sale.items.find(line => line.key === item.key)!.unitPrice * item.quantity, 0);
  const proceeds = entry.items.reduce((sum, item) => { const line = sale.items.find(line => line.key === item.key)!; return sum + (lineGoldRevenue(line, returnedQuantity(previousReturns, sale.id, line.key), item.quantity) || 0); }, 0);
  const goldLines = entry.items.filter(item => sale.items.find(line => line.key === item.key)!.weight > 0);
  const known = goldLines.every(item => { const line = sale.items.find(line => line.key === item.key)!; return lineGoldRevenue(line) !== null && lineGoldCost(line) !== null; });
  // Refunds reverse the same fraction of the original sale's gold proceeds.
  const revenueGrams = roundGrams(proceeds * Math.min(1, (entry.amount - entry.shippingRefund) / Math.max(1, value)));
  const costGrams = !entry.restock ? 0 : known ? roundGrams(goldLines.reduce((sum, item) => {
    const line = sale.items.find(line => line.key === item.key)!;
    return sum + returnedGoldLayers(line, returnedQuantity(previousReturns, sale.id, line.key), item.quantity).reduce((n, layer) => n + (layer.unitGoldWeight || 0) * layer.quantity, 0);
  }, 0)) : null;
  return { revenueGrams, costGrams, known };
}
export function returnedGoldLayers(line: AccountingLine, skip: number, count: number): { quantity: number; unitGoldCost?: number; unitGoldWeight?: number; unitGoldMakingPercent?: number }[] {
  const layers = line.overrideGoldPurchase ? [{ quantity: line.quantity, unitGoldCost: line.overrideGoldPurchase.costGrams, unitGoldWeight: line.overrideGoldPurchase.weight, unitGoldMakingPercent: line.overrideGoldPurchase.makingPercent }] : line.allocations;
  const result: { quantity: number; unitGoldCost?: number; unitGoldWeight?: number; unitGoldMakingPercent?: number }[] = [];
  for (const layer of layers) { const offset = Math.min(skip, layer.quantity); skip -= offset; const take = Math.min(count, layer.quantity - offset);
    if (take) { result.push({ quantity: take, unitGoldCost: layer.unitGoldCost, unitGoldWeight: layer.unitGoldWeight, unitGoldMakingPercent: layer.unitGoldMakingPercent }); count -= take; } if (!count) break; }
  return result;
}
export function saleGoldTotals(sale: AccountingSale, returns: ReturnEntry[]) {
  const lines = sale.items.filter(line => line.weight > 0);
  const known = lines.every(line => lineGoldRevenue(line) !== null && lineGoldCost(line) !== null);
  if (!sale.recognizedAt) return { revenueGrams: 0, costGrams: 0, profitGrams: 0 };
  let revenueGrams = lines.reduce((sum, line) => sum + (lineGoldRevenue(line) || 0), 0);
  let costGrams = lines.reduce((sum, line) => sum + (lineGoldCost(line) || 0), 0);
  const previous: ReturnEntry[] = [];
  for (const entry of returns.filter(entry => entry.saleId === sale.id)) {
    const movement = goldReturnMovement(sale, entry, previous); revenueGrams -= movement.revenueGrams; costGrams -= movement.costGrams || 0;
    previous.push(entry);
  }
  return { revenueGrams: roundGrams(revenueGrams), costGrams: known ? roundGrams(costGrams) : null, profitGrams: known ? roundGrams(revenueGrams - costGrams) : null };
}

export const emptyCosts = (): CostParts => ({ gold: 0, making: 0, pearl: 0, assembly: 0, other: 0 });
export const costSum = (costs: CostParts): number => Object.values(costs).reduce((sum, value) => sum + value, 0);
export function lineCost(line: AccountingLine): number | null {
  if (line.overrideGoldPurchase || line.allocations.some(layer => layer.unitGoldCost !== undefined)) return null;
  if (line.overrideCosts) return (costSum(line.overrideCosts) + line.extraAssembly) * line.quantity;
  if (line.allocations.reduce((sum, allocation) => sum + allocation.quantity, 0) !== line.quantity) return null;
  return line.allocations.reduce((sum, allocation) => sum + allocation.quantity * allocation.unitCost, 0) + line.extraAssembly * line.quantity;
}
export function returnedQuantity(returns: ReturnEntry[], saleId: string, key: string): number {
  return returns.filter(entry => entry.saleId === saleId).reduce((sum, entry) => sum + entry.items.filter(item => item.key === key).reduce((n, item) => n + item.quantity, 0), 0);
}
export function returnedCostLayers(line: AccountingLine, skip: number, quantity: number, purchaseCosts?: (lotId: string) => CostParts | undefined): { quantity: number; unitCost: number; costs: CostParts }[] {
  const layers = line.overrideCosts
    ? [{ quantity: line.quantity, unitCost: costSum(line.overrideCosts), costs: line.overrideCosts }]
    : line.allocations.map(layer => ({ ...layer, costs: purchaseCosts?.(layer.lotId) || { ...emptyCosts(), other: layer.unitCost } }));
  const result: { quantity: number; unitCost: number; costs: CostParts }[] = [];
  for (const layer of layers) {
    const offset = Math.min(skip, layer.quantity); skip -= offset;
    const count = Math.min(quantity, layer.quantity - offset);
    if (count) {
      result.push({ quantity: count, unitCost: layer.unitCost + line.extraAssembly,
        costs: { ...layer.costs, assembly: layer.costs.assembly + line.extraAssembly } });
      quantity -= count;
    }
    if (!quantity) break;
  }
  return result;
}
export function returnCost(sale: AccountingSale, entry: ReturnEntry): number | null {
  if (!entry.restock) return 0;
  let sum = 0;
  for (const item of entry.items) {
    const line = sale.items.find(line => line.key === item.key)!;
    const cost = lineCost(line);
    if (cost === null) return null;
    sum += item.recoveredCost;
  }
  return sum;
}
export function saleTotals(sale: AccountingSale, money: MoneyEntry[], returns: ReturnEntry[]) {
  const entries = money.filter(entry => entry.saleId === sale.id && !entry.voidedAt);
  const refunds = returns.filter(entry => entry.saleId === sale.id);
  const paid = entries.filter(entry => entry.kind === 'receipt').reduce((sum, entry) => sum + entry.amount, 0);
  const refunded = refunds.reduce((sum, entry) => sum + entry.amount, 0);
  const merchandiseRefund = refunds.reduce((sum, entry) => sum + entry.amount - entry.shippingRefund, 0);
  const fees = entries.reduce((sum, entry) => sum + entry.fee, 0);
  const gateway = entries.filter(entry => entry.kind === 'receipt' && entry.method === 'pasargad').reduce((sum, entry) => sum + entry.amount - entry.fee, 0);
  const settledGross = entries.filter(entry => entry.kind === 'settlement').reduce((sum, entry) => sum + entry.amount + entry.fee, 0);
  const costs = sale.items.map(lineCost);
  const known = costs.every(cost => cost !== null);
  const originalCost = costs.reduce<number>((sum, cost) => sum + (cost || 0), 0);
  const recovered = refunds.map(entry => returnCost(sale, entry));
  const cost = sale.recognizedAt ? (known && recovered.every(value => value !== null) ? originalCost - recovered.reduce<number>((sum, value) => sum + (value || 0), 0) : null) : 0;
  const revenue = sale.recognizedAt ? sale.totalPrice - merchandiseRefund : 0;
  const expenses = (sale.expensesAt ? sale.packaging + sale.shippingPaid + sale.otherCosts - sale.shippingReceived + refunds.reduce((sum, entry) => sum + entry.shippingRefund, 0) : 0) + fees;
  return { revenue, cost, costKnown: known, refunded, paid,
    balance: sale.totalPrice + sale.shippingReceived - paid,
    pendingSettlement: Math.max(0, gateway - settledGross), fees, expenses,
    profit: cost === null ? null : revenue - cost - expenses };
}
export function latinDigits(value: string): string {
  return value.replace(/[۰-۹]/g, digit => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit))).replace(/[٠-٩]/g, digit => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)));
}
export function accountingDay(iso = new Date().toISOString()): string {
  const parts = new Intl.DateTimeFormat('en-US-u-ca-persian', { timeZone: 'Asia/Tehran', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find(part => part.type === type)?.value || '';
  return `${get('year')}/${get('month')}/${get('day')}`;
}
export function normalizeAccountingDay(value: string): string {
  const match = /^(1[34]\d{2})[/-](\d{1,2})[/-](\d{1,2})$/.exec(latinDigits(value).trim());
  if (!match || Number(match[2]) < 1 || Number(match[2]) > 12 || Number(match[3]) < 1 || Number(match[3]) > 31) throw new Error('تاریخ را به صورت شمسی، مانند ۱۴۰۵/۰۷/۱۳ وارد کنید.');
  return `${match[1]}/${match[2].padStart(2, '0')}/${match[3].padStart(2, '0')}`;
}
export function accountingDate(value?: string): string {
  if (!value) return new Date().toISOString();
  const day = normalizeAccountingDay(value);
  const year = Number(day.slice(0, 4));
  // Search this Persian year using ICU; avoids approximating leap years.
  const start = Date.UTC(year + 621, 2, 18, 8, 30);
  for (let offset = 0; offset < 370; offset++) {
    const iso = new Date(start + offset * 86400000).toISOString();
    if (accountingDay(iso) === day) return iso;
  }
  throw new Error('تاریخ شمسی معتبر نیست.');
}
export function safeCsv(value: unknown): string {
  let text = String(value ?? '');
  if (typeof value !== 'number' && /^[\s]*[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}
