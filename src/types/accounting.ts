export type CostParts = { gold: number; making: number; pearl: number; assembly: number; other: number };
export type AccountingSettings = { packaging: number; assembly: number };
export type PurchaseLot = {
  id: string; productId: string; title: string; quantity: number; remaining: number;
  costs: CostParts; kind: 'opening' | 'purchase'; supplier: string; reference: string;
  occurredAt: string; createdAt: string; actor: string;
};
export type CostAllocation = { lotId: string; quantity: number; unitCost: number };
export type AccountingLine = {
  key: string; productId: string; title: string; quantity: number; weight: number;
  unitPrice: number; totalPrice: number; allocations: CostAllocation[];
  overrideCosts?: CostParts; extraAssembly: number;
};
export type AccountingSale = {
  id: string; orderId: string; trackingCode: string; channel: 'site' | 'instagram';
  customerName: string; status: string; items: AccountingLine[]; totalPrice: number;
  createdAt: string; recognizedAt?: string; packaging: number; shippingReceived: number;
  shippingPaid: number; otherCosts: number; expensesAt?: string; revision: number;
  exchangeForSaleId?: string; costsLocked?: boolean;
};
export type MoneyEntry = {
  id: string; saleId?: string; kind: 'receipt' | 'settlement' | 'expense' | 'capital' | 'withdrawal' | 'opening';
  amount: number; fee: number; method: 'card_to_card' | 'pasargad';
  category: string; reference: string; note: string; occurredAt: string; actor: string;
  voidedAt?: string; voidReason?: string;
  source?: 'site';
};
export type ReturnEntry = {
  id: string; saleId: string; amount: number; shippingRefund: number;
  items: { key: string; quantity: number; recoveredCost: number }[]; restock: boolean; reference: string;
  note: string; occurredAt: string; actor: string;
};
export type AccountingAudit = { id: string; action: string; actor: string; createdAt: string; target: string; details: unknown };
export type SaleTotals = {
  revenue: number; cost: number | null; costKnown: boolean; refunded: number; paid: number;
  balance: number; pendingSettlement: number; fees: number; expenses: number; profit: number | null;
};
export type AccountingReport = {
  revenue: number; cost: number; expenses: number; profit: number | null; knownProfit: number;
  missingCosts: number; refunds: number; inventoryCost: number; unknownStock: number;
  pendingSettlement: number; receivables: number; cashMovement: number;
  purchaseAmount: number; purchaseQuantity: number; siteOrderCount: number; siteSoldQuantity: number;
  channels: { channel: string; revenue: number; profit: number | null; missingCosts: number }[];
  daily: { day: string; revenue: number; profit: number | null }[];
  products: { productId: string; title: string; revenue: number; quantity: number; profit: number | null }[];
};
export type AccountingData = {
  catalog: { id: string; title: string; weight: number; stock: number | null; held: number; knownQuantity: number; unknownQuantity: number; inventoryCost: number }[];
  revision: number; settings: AccountingSettings; purchases: PurchaseLot[]; sales: AccountingSale[];
  money: MoneyEntry[]; returns: ReturnEntry[]; audit: AccountingAudit[];
  totals: Record<string, SaleTotals>; report: AccountingReport;
};
