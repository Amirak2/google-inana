import React, { useEffect, useRef, useState } from 'react';
import { Bell, Check, CheckCheck, Package, RefreshCw, X } from 'lucide-react';
import { useNotifications } from '../context/NotificationsContext';
import { formatToman, toPersianDigits } from '../utils/persianFormatter';
import { orderNotificationContent } from '../utils/orderNotifications';

export function NotificationCenter() {
  const { feed, isOpen, closeNotifications, loading, error, refresh, markRead, marking } = useNotifications();
  const [tab, setTab] = useState<'notifications' | 'orders'>('notifications');
  const dialog = useRef<HTMLDivElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  const closeAction = useRef(closeNotifications);
  closeAction.current = closeNotifications;

  useEffect(() => {
    if (!isOpen) return;
    setTab('notifications');
    const priorFocus = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    close.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); closeAction.current(); }
      if (event.key !== 'Tab') return;
      const items = dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], [tabindex="0"]');
      if (!items?.length) return;
      const first = items[0], last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = overflow; document.removeEventListener('keydown', onKey); if (priorFocus?.isConnected) priorFocus.focus(); };
  }, [isOpen]);

  if (!isOpen) return null;
  return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-3 sm:p-6 backdrop-blur-sm" onClick={closeNotifications}>
    <div ref={dialog} role="dialog" aria-modal="true" aria-labelledby="notifications-heading" dir="rtl" onClick={e => e.stopPropagation()}
      className="flex max-h-[85dvh] w-full max-w-xl flex-col overflow-hidden rounded-3xl border border-[#D4AF37]/35 bg-[#0A1120] text-slate-100 shadow-2xl">
      <div className="flex items-center justify-between gap-3 border-b border-slate-800 p-4 sm:p-5">
        <div className="flex items-center gap-3"><Bell className="h-5 w-5 text-[#D4AF37]" aria-hidden="true"/><div>
          <h2 id="notifications-heading" className="font-bold">اعلان‌ها و سفارش‌های من</h2>
          <p className="mt-1 text-xs text-slate-400">{toPersianDigits(feed.unreadCount)} اعلان خوانده‌نشده</p>
        </div></div>
        <button ref={close} type="button" onClick={closeNotifications} aria-label="بستن اعلان‌ها" className="rounded-xl p-2 hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-[#D4AF37]"><X className="h-5 w-5"/></button>
      </div>
      <div className="flex items-center gap-2 border-b border-slate-800 px-4 py-3">
        <button type="button" aria-pressed={tab === 'notifications'} onClick={() => setTab('notifications')} className={`rounded-xl px-3 py-2 text-sm ${tab === 'notifications' ? 'bg-[#D4AF37] font-bold text-slate-950' : 'bg-slate-800 text-slate-300'}`}>اعلان‌ها</button>
        <button type="button" aria-pressed={tab === 'orders'} onClick={() => setTab('orders')} className={`rounded-xl px-3 py-2 text-sm ${tab === 'orders' ? 'bg-[#D4AF37] font-bold text-slate-950' : 'bg-slate-800 text-slate-300'}`}>سفارش‌های من</button>
        <button type="button" onClick={() => void refresh()} disabled={loading || marking} aria-label="تازه‌سازی اعلان‌ها" className="mr-auto rounded-xl p-2 text-[#D4AF37] hover:bg-slate-800 disabled:opacity-40"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`}/></button>
      </div>
      <div className="min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-5">
        {error && <p role="alert" className="mb-3 rounded-xl border border-rose-400/30 bg-rose-500/10 p-3 text-sm text-rose-200">{error}</p>}
        {loading && !feed.notifications.length && <p role="status" className="py-8 text-center text-sm text-slate-400">در حال دریافت اعلان‌ها…</p>}
        {tab === 'notifications' ? <>
          {feed.unreadCount > 0 && <button type="button" disabled={marking} onClick={() => void markRead('all')} className="mb-4 flex items-center gap-2 text-xs text-[#E6CA65] disabled:opacity-40"><CheckCheck className="h-4 w-4"/>خواندن همهٔ اعلان‌ها</button>}
          {!loading && !feed.notifications.length && <div className="py-10 text-center"><Bell className="mx-auto mb-3 h-8 w-8 text-slate-500"/><p className="text-sm text-slate-300">هنوز اعلانی ندارید.</p><p className="mt-2 text-xs text-slate-500">پس از ثبت سفارش، پیام‌های آن را اینجا می‌بینید.</p></div>}
          <ul className="space-y-3">{feed.notifications.map(n => <li key={n.id} className={`rounded-2xl border p-4 ${n.readAt ? 'border-slate-800 bg-[#060B15]' : 'border-[#D4AF37]/35 bg-[#D4AF37]/5'}`}>
            <div className="flex items-start justify-between gap-3"><h3 className="text-sm font-bold text-white">{!n.readAt && <span aria-label="خوانده‌نشده" className="ml-2 inline-block h-2 w-2 rounded-full bg-[#D4AF37]"/>}{n.title}</h3>
              <time dateTime={n.createdAt} className="shrink-0 text-[10px] text-slate-400">{new Date(n.createdAt).toLocaleDateString('fa-IR', { timeZone: 'Asia/Tehran' })}</time>
            </div>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-slate-300">{n.message}</p>
            {n.trackingCode && <p className="mt-2 text-xs text-slate-400">کد رهگیری: <bdi className="font-mono text-[#E6CA65]">{n.trackingCode}</bdi></p>}
            <div className="mt-3 flex flex-wrap items-center gap-4">
              {!n.readAt && <button type="button" disabled={marking} onClick={() => void markRead([n.id])} className="flex items-center gap-1 text-xs text-[#E6CA65] disabled:opacity-40"><Check className="h-3.5 w-3.5"/>خواندم</button>}
              {n.orderId && <button type="button" onClick={() => { if (!n.readAt) void markRead([n.id]); setTab('orders'); }} className="text-xs text-slate-300 underline underline-offset-4">مشاهده وضعیت سفارش</button>}
            </div>
          </li>)}</ul>
          {feed.total > feed.notifications.length && <p className="mt-4 text-center text-xs text-slate-500">آخرین {toPersianDigits(feed.notifications.length)} اعلان نمایش داده می‌شود.</p>}
        </> : <>
          {!feed.orders.length && <p className="py-8 text-center text-sm text-slate-400">هنوز سفارشی با این حساب ثبت نشده است.</p>}
          <ul className="space-y-3">{feed.orders.map(order => <li key={order.id} className="rounded-2xl border border-slate-700/70 bg-[#060B15] p-4">
            <div className="flex flex-wrap items-center justify-between gap-3"><span className="flex items-center gap-2 text-[#E6CA65]"><Package className="h-4 w-4"/><bdi className="font-mono text-sm">{order.trackingCode}</bdi></span><span className="rounded-full bg-slate-800 px-3 py-1 text-xs">{order.status}</span></div>
            <p className="mt-3 text-sm leading-7 text-slate-300">{orderNotificationContent(order.status).message}</p>
            <div className="mt-3 flex flex-wrap justify-between gap-2 text-xs text-slate-400"><time dateTime={order.createdAt}>{new Date(order.createdAt).toLocaleDateString('fa-IR', { timeZone: 'Asia/Tehran' })}</time><span>{formatToman(order.totalPrice)}</span></div>
          </li>)}</ul>
        </>}
      </div>
    </div>
  </div>;
}
