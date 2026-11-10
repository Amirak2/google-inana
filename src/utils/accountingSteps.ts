import type { AccountingData, AccountingSale } from '../types/accounting';
import { lineCost, lineGoldCost } from './accounting';

type Totals = AccountingData['totals'][string];
export type SaleStepKey = 'review' | 'payment' | 'complete' | 'cost' | 'done' | 'refunded' | 'closed';
export interface SaleStep {
  key: SaleStepKey;
  label: string;
  tone: 'warning' | 'accent' | 'success' | 'muted';
  action?: { kind: 'receipt' | 'complete' | 'costs'; label: string };
}

function costsKnown(sale: AccountingSale): boolean {
  return sale.costsLocked ?? sale.items.every(line => lineCost(line) !== null || lineGoldCost(line) !== null);
}

// The one thing the owner should do next for a sale, in the order the books need it:
// receive the money, complete after delivery, then fill in any missing purchase cost.
export function saleStep(sale: AccountingSale, totals: Totals): SaleStep {
  if (['لغو شده', 'رد شده'].includes(sale.status)) return { key: 'closed', label: sale.status, tone: 'muted' };
  if (!sale.recognizedAt) {
    if (sale.status === 'در انتظار بررسی') return { key: 'review', label: 'منتظر بررسی فیش در سفارش‌ها', tone: 'warning' };
    if (totals.refunded > 0) return { key: 'refunded', label: 'بازپرداخت شده', tone: 'muted' };
    if (totals.balance > 0) return { key: 'payment', label: 'منتظر پول', tone: 'warning', action: { kind: 'receipt', label: 'ثبت دریافت پول' } };
    return { key: 'complete', label: 'پول رسید', tone: 'accent', action: { kind: 'complete', label: 'تکمیل فروش (تحویل شد)' } };
  }
  if (!costsKnown(sale)) return { key: 'cost', label: 'قیمت خرید ندارد', tone: 'warning', action: { kind: 'costs', label: 'ثبت قیمت خرید' } };
  return { key: 'done', label: 'تمام شد', tone: 'success' };
}

export function accountingTodos(data: AccountingData) {
  const counts = { payment: 0, complete: 0, cost: 0 };
  for (const sale of data.sales) {
    const key = saleStep(sale, data.totals[sale.id]).key;
    if (key === 'payment' || key === 'complete' || key === 'cost') counts[key]++;
  }
  return counts;
}
