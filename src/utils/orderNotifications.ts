import { normalizeOrderStatus } from './orderWorkflow';

export const ORDER_SHIPPING_NOTE = 'ارسال سفارش‌ها روز دوشنبه انجام می‌شود.';

export function orderNotificationContent(status: string): { title: string; message: string } {
  switch (normalizeOrderStatus(status)) {
    case 'تأیید شده': return { title: 'سفارش شما تأیید شد', message: `تأیید سفارش شما انجام شد. ${ORDER_SHIPPING_NOTE}` };
    case 'در حال آماده‌سازی': return { title: 'سفارش در حال آماده‌سازی است', message: `سفارش شما در حال آماده‌سازی است. ${ORDER_SHIPPING_NOTE}` };
    case 'آماده تحویل': return { title: 'سفارش آماده تحویل است', message: `سفارش شما آماده تحویل است. ${ORDER_SHIPPING_NOTE}` };
    case 'ارسال شد': return { title: 'سفارش شما ارسال شد', message: 'سفارش شما ارسال شده است. از همراهی شما با اینانا سپاسگزاریم.' };
    case 'تکمیل شده': return { title: 'سفارش تکمیل شد', message: 'سفارش شما تکمیل شده است. امیدواریم از انتخاب خود لذت ببرید.' };
    case 'رد شده': return { title: 'سفارش تأیید نشد', message: 'سفارش شما تأیید نشد. برای اطلاع از جزئیات و پیگیری پرداخت با پشتیبانی اینانا تماس بگیرید.' };
    case 'لغو شده': return { title: 'سفارش لغو شد', message: 'سفارش شما لغو شده است. برای پیگیری پرداخت با پشتیبانی اینانا تماس بگیرید.' };
    default: return { title: 'سفارش شما ثبت شد', message: `سفارش شما ثبت شد و در انتظار بررسی گالری است. پس از تأیید، در همین بخش اطلاع می‌دهیم. ${ORDER_SHIPPING_NOTE}` };
  }
}
