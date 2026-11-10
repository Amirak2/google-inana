export const ORDER_STATUSES = ['در انتظار بررسی', 'تأیید شده', 'در حال آماده‌سازی', 'آماده تحویل', 'ارسال شد', 'تکمیل شده', 'رد شده', 'لغو شده'] as const;
export type CanonicalOrderStatus = typeof ORDER_STATUSES[number];

export function canArchiveOrder(status: string): boolean {
  return ['تکمیل شده', 'رد شده', 'لغو شده'].includes(normalizeOrderStatus(status));
}

export function normalizeOrderStatus(status: string): string {
  if (status === 'تایید شده') return 'تأیید شده';
  if (status === 'تأیید شد و در حال ساخت') return 'در حال آماده‌سازی';
  return status;
}

// A completed sale can only be cancelled explicitly; other terminal states may
// be reopened after the existing transactional availability check.
export function canTransitionOrderStatus(from: string, to: string): boolean {
  const current = normalizeOrderStatus(from);
  const next = normalizeOrderStatus(to);
  return ORDER_STATUSES.includes(next as CanonicalOrderStatus)
    && (current !== 'تکمیل شده' || next === current || next === 'لغو شده');
}

// A completed sale is reversed through an accounting return, so the admin menu
// offers no cancel option that the server would refuse.
export function orderStatusOptions(current: string): readonly string[] {
  if (normalizeOrderStatus(current) === 'تکمیل شده') return ['تکمیل شده'];
  return ORDER_STATUSES.filter(next => canTransitionOrderStatus(current, next));
}

export function isApprovedOrderStatus(status: string): boolean {
  return ['تأیید شده', 'در حال آماده‌سازی', 'آماده تحویل', 'ارسال شد'].includes(normalizeOrderStatus(status));
}
