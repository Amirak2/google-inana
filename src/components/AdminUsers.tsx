import React, { useCallback, useEffect, useState } from 'react';
import { RotateCcw, Search, ShieldCheck, Users } from 'lucide-react';
import { getAuthHeaders } from '../utils/authHelper';
import { readApiResponse } from '../utils/apiResponse';
import { formatToman, toPersianDigits } from '../utils/persianFormatter';
import { latinDigits } from '../utils/accounting';
import type { UserProfile } from '../types';

interface AdminUser extends UserProfile {
  phoneVerified: boolean;
  ordersCount: number;
  paidOrdersCount: number;
  paidTotal: number;
  lastOrderAt: string | null;
}

const dateText = (iso?: string | null) => iso ? new Date(iso).toLocaleDateString('fa-IR', { timeZone: 'Asia/Tehran' }) : '—';
const normalize = (value = '') => latinDigits(value).toLowerCase().replace(/ي/g, 'ی').replace(/ك/g, 'ک').trim();

// Read-only list of registered accounts for the shop owner.
export const AdminUsers: React.FC = () => {
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'customers' | 'buyers' | 'admins'>('all');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const response = await fetch('/api/admin/users', { headers: getAuthHeaders(), credentials: 'same-origin', cache: 'no-store' });
      const data = await readApiResponse<{ users: AdminUser[] }>(response, 'دریافت فهرست کاربران انجام نشد.');
      setUsers(data.users);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'ارتباط با سرور برقرار نشد.');
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const all = users || [];
  const customers = all.filter(user => user.role !== 'admin');
  const buyers = customers.filter(user => user.paidOrdersCount > 0);
  const admins = all.filter(user => user.role === 'admin');
  const filters = [
    { id: 'all', label: 'همه', count: all.length },
    { id: 'customers', label: 'مشتری‌ها', count: customers.length },
    { id: 'buyers', label: 'خریدکرده‌ها', count: buyers.length },
    { id: 'admins', label: 'مدیرها', count: admins.length },
  ] as const;
  const pool = filter === 'customers' ? customers : filter === 'buyers' ? buyers : filter === 'admins' ? admins : all;
  const q = normalize(query);
  const visible = q ? pool.filter(user => [user.displayName, user.phoneNumber, user.username, user.address].some(text => normalize(text || '').includes(q))) : pool;

  return (
    <div dir="rtl" className="space-y-4 text-slate-200" aria-label="فهرست کاربران">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-bold text-[#D4AF37]"><Users className="w-5 h-5" />کاربران سایت</h2>
        <button type="button" onClick={() => void load()} disabled={loading}
          className="min-h-11 inline-flex items-center gap-2 rounded-xl border border-slate-700 px-3 text-xs font-bold text-slate-200 hover:border-[#D4AF37] disabled:opacity-50">
          <RotateCcw className="w-4 h-4" />{loading ? 'در حال دریافت…' : 'تازه‌سازی'}
        </button>
      </div>

      {error && <p role="alert" className="rounded-xl border border-rose-500/40 bg-rose-950/40 p-3 text-sm text-rose-300">{error}</p>}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {filters.map(item => (
          <button type="button" key={item.id} aria-pressed={filter === item.id} onClick={() => setFilter(item.id)}
            className={`rounded-2xl border p-3 text-right transition-colors ${filter === item.id ? 'border-[#D4AF37] bg-[#D4AF37]/10' : 'border-slate-800 bg-[#0A1120] hover:border-slate-600'}`}>
            <span className="block text-xs text-slate-400">{item.label}</span>
            <strong className="block mt-1 text-xl text-white">{toPersianDigits(item.count)}</strong>
          </button>
        ))}
      </div>

      <div className="relative">
        <input type="text" value={query} onChange={event => setQuery(event.target.value)} aria-label="جست‌وجوی کاربران" placeholder="نام یا شماره موبایل…"
          className="w-full min-h-11 bg-[#060B14] border border-slate-700 focus:border-[#D4AF37] rounded-xl pr-10 pl-4 text-sm text-white outline-none" />
        <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
      </div>

      {users === null && !error && <p role="status" className="text-center py-10 text-xs text-slate-400">در حال دریافت فهرست کاربران…</p>}
      {users !== null && !visible.length && <p className="rounded-2xl border border-slate-800 bg-[#0A1120] p-6 text-center text-sm text-slate-400">کاربری با این جست‌وجو و فیلتر پیدا نشد.</p>}

      <div className="grid gap-3 lg:grid-cols-2">
        {visible.map(user => (
          <article key={user.uid} className="rounded-2xl border border-slate-800 bg-[#0A1120] p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <strong className="block text-white break-words">{user.displayName || 'بدون نام'}</strong>
                {user.phoneNumber
                  ? <a href={`tel:${user.phoneNumber}`} dir="ltr" className="inline-block mt-1 font-mono text-sm text-[#E6CA65] hover:underline">{user.phoneNumber}</a>
                  : <span className="block mt-1 text-xs text-slate-500">شماره موبایل ثبت نشده</span>}
              </div>
              <span className={`shrink-0 inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs ${user.role === 'admin' ? 'bg-[#D4AF37]/15 text-[#E6CA65]' : 'bg-slate-800 text-slate-300'}`}>
                {user.role === 'admin' && <ShieldCheck className="w-3.5 h-3.5" />}{user.role === 'admin' ? 'مدیر' : 'مشتری'}
              </span>
            </div>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
              <div><dt className="text-slate-400">تاریخ عضویت</dt><dd className="mt-0.5 text-slate-100">{dateText(user.createdAt)}</dd></div>
              <div><dt className="text-slate-400">آخرین سفارش</dt><dd className="mt-0.5 text-slate-100">{dateText(user.lastOrderAt)}</dd></div>
              <div><dt className="text-slate-400">تعداد سفارش</dt><dd className="mt-0.5 text-slate-100">{toPersianDigits(user.ordersCount)}{user.ordersCount !== user.paidOrdersCount && ` (${toPersianDigits(user.paidOrdersCount)} تأییدشده)`}</dd></div>
              <div><dt className="text-slate-400">جمع خرید تأییدشده</dt><dd className="mt-0.5 text-[#F5E8C7]">{user.paidTotal ? formatToman(user.paidTotal) : '—'}</dd></div>
            </dl>
            {user.address && <p className="border-t border-slate-800 pt-2 text-xs text-slate-300"><span className="text-slate-400">نشانی: </span>{user.address}</p>}
          </article>
        ))}
      </div>
    </div>
  );
};
