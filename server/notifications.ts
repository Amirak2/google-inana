import type { Store } from './storage';
import type { NotificationFeed, Order, UserNotification } from '../src/types';
import { normalizeOrderStatus } from '../src/utils/orderWorkflow';
import { orderNotificationContent } from '../src/utils/orderNotifications';
import { queueOrderSms } from './smsOutbox';

export function createNotifications(store: Store, env: Record<string, any> = {}) {
  const recordOrder = (order: Order) => {
    if (!order.userId) return;
    const notification: UserNotification = {
      id: crypto.randomUUID(), userId: order.userId, type: 'order',
      ...orderNotificationContent(order.status), createdAt: new Date().toISOString(),
      orderId: order.id, trackingCode: order.trackingCode, status: normalizeOrderStatus(order.status),
    };
    store.set('notifications', notification.id, notification);
    queueOrderSms(store, env, order, notification);
  };

  const allForUser = (uid: string): UserNotification[] => {
    const saved = [...store.map<UserNotification>('notifications').values()].filter(n => n.userId === uid);
    const covered = new Set(saved.map(n => n.orderId));
    // Existing customers can see their current order status immediately, without
    // a write-on-read migration or fabricating historical transition events.
    for (const order of store.map<Order>('orders').values()) {
      if (order.userId !== uid || covered.has(order.id)) continue;
      saved.push({
        id: `existing:${order.id}:${order.updatedAt || order.reviewedAt || order.createdAt}:${order.status}`,
        userId: uid, type: 'order', ...orderNotificationContent(order.status),
        orderId: order.id, trackingCode: order.trackingCode, status: normalizeOrderStatus(order.status),
        createdAt: order.updatedAt || order.reviewedAt || order.createdAt,
      });
    }
    return saved.map(n => ({ ...n, readAt: store.get<{ readAt: string }>('notificationReads', JSON.stringify([uid, n.id]))?.readAt }))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
  };

  const feed = (uid: string): NotificationFeed => {
    const all = allForUser(uid);
    return {
      notifications: all.slice(0, 100), unreadCount: all.filter(n => !n.readAt).length, total: all.length,
      orders: [...store.map<Order>('orders').values()].filter(o => o.userId === uid)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map(({ id, trackingCode, status, totalPrice, createdAt, updatedAt }) => ({ id, trackingCode, status, totalPrice, createdAt, updatedAt })),
    };
  };

  const markRead = (uid: string, ids: string[] | 'all'): boolean => {
    const eligible = allForUser(uid);
    const selected = ids === 'all' ? eligible : eligible.filter(n => ids.includes(n.id));
    if (ids !== 'all' && selected.length !== new Set(ids).size) return false;
    const readAt = new Date().toISOString();
    for (const n of selected) {
      const key = JSON.stringify([uid, n.id]);
      if (!store.get('notificationReads', key)) store.set('notificationReads', key, { readAt });
    }
    return true;
  };
  return { recordOrder, feed, markRead };
}
