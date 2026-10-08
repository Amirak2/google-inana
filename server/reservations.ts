import type { Store } from './storage';
import type { Product } from '../src/types';
import { cartQuantities } from './checkoutSafety';
import { createInventoryPolicy } from './inventoryPolicy';

export interface StockReservation {
  productId: string;
  quantity: number;
  userId: string;
  reservationId?: string;
  expiresAt: number;
}
export function createReservationEngine(store: Store, products: () => Product[]) {
  const stockReservations: Map<string, StockReservation[]> = store.map('reservations');

  function cleanExpiredReservations(): void {
    const now = Date.now();
    for (const [pId, resList] of stockReservations.entries()) {
      // Retire draft holds created by old clients; only checkout quotes reserve stock.
      const valid = resList.filter((r) => r.expiresAt > now && !r.userId.startsWith('anon_') && r.reservationId?.startsWith('quote_'));
      if (valid.length === 0) stockReservations.delete(pId);
      else stockReservations.set(pId, valid);
    }
  }

  function getReservedStock(productId: string, excludeReservationId?: string): number {
    cleanExpiredReservations();
    const list = stockReservations.get(productId) || [];
    return list
      .filter((r) => !excludeReservationId || (r.reservationId || `cart_${r.userId}`) !== excludeReservationId)
      .reduce((sum, r) => sum + r.quantity, 0);
  }

  function getAvailableStock(product: Product, excludeReservationId?: string): number {
    store.get('products', product.id); // Include the authoritative inventory row in commit validation.
    const baseStock = product.stock !== undefined ? product.stock : 5;
    const reserved = getReservedStock(product.id, excludeReservationId);
    return Math.max(0, baseStock - reserved);
  }

  function reserveCart(items: unknown, owner: string, expiresAt: number, reservationId: string, replaceId = reservationId) {
    const quantities = cartQuantities(items);
    const policy = createInventoryPolicy(store);
    policy.assertCapacity(owner.replace(/^usr_/, ''), quantities, replaceId);
    for (const [id, quantity] of quantities) {
      const product = products().find(p => p.id === id);
      if (!product || getAvailableStock(product, replaceId) < quantity) throw new Error('موجودی یکی از محصولات سبد کافی نیست. لطفاً سبد را بررسی کنید.');
    }
    for (const [id, list] of stockReservations) {
      const remaining = list.filter(r => (r.reservationId || `cart_${r.userId}`) !== replaceId);
      if (remaining.length) stockReservations.set(id, remaining); else stockReservations.delete(id);
    }
    for (const [id, quantity] of quantities) {
      stockReservations.set(id, [...(stockReservations.get(id) || []), { productId: id, quantity, userId: owner, reservationId, expiresAt }]);
    }
    policy.touchOwner(owner.replace(/^usr_/, ''));
  }
  cleanExpiredReservations();
  return { stockReservations, getAvailableStock, reserveCart };
}

