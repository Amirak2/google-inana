import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Plus, RefreshCw, Download, Wallet, TrendingUp, Package, X, Settings, ShieldCheck, ArrowDownLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useGoldStore } from '../context/GoldStoreContext';
import { readApiResponse } from '../utils/apiResponse';
import { formatToman, toPersianDigits } from '../utils/persianFormatter';
import { accountingDay, costSum, emptyCosts, lineCost, returnedQuantity, safeCsv, latinDigits } from '../utils/accounting';
import type { AccountingData, AccountingSale, CostParts } from '../types/accounting';

const panel = 'bg-[#0A1120] border border-slate-800 rounded-2xl p-4 sm:p-5';
const inputClass = 'w-full bg-[#060B14] border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#D4AF37]';
const buttonClass = 'inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-bold border border-slate-700 text-slate-200 hover:border-[#D4AF37] disabled:opacity-50 disabled:cursor-wait';
const primary = `${buttonClass} bg-[#D4AF37] !text-slate-950 !border-[#D4AF37]`;
const moneyKinds: Record<string, string> = { receipt: 'دریافت وجه مشتری', settlement: 'تسویهٔ پاسارگاد', expense: 'هزینهٔ عمومی', capital: 'ورود سرمایه', withdrawal: 'برداشت شخصی', opening: 'ماندهٔ اولیهٔ بانک' };
const titles: Record<string, string> = { purchase: 'ثبت خرید و موجودی اولیه', 'purchase-correction': 'اصلاح قیمت خرید', 'money-void': 'ابطال ثبت اشتباه', sale: 'ثبت فروش اینستاگرام', costs: 'هزینه‌های سفارش', return: 'مرجوعی و بازپرداخت', settings: 'هزینه‌های پیش‌فرض', ...moneyKinds };
const costLabels: Record<keyof CostParts, string> = { gold: 'اصل طلای خریداری‌شده', making: 'اجرت خرید طلا', pearl: 'خرید مروارید', assembly: 'ساخت محصول آماده', other: 'سایر هزینه‌های خرید' };
const dateText = (iso: string) => toPersianDigits(accountingDay(iso));
const numberValue = (value: string) => { const normalized = latinDigits(value).replace(/[,٬\s]/g, ''); return normalized === '' ? '' : normalized; };

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block space-y-1.5 text-xs text-slate-400"><span>{label}</span>{children}</label>;
}
function NumberField({ label, value, onChange, required = true }: { key?: string; label: string; value: any; onChange: (value: any) => void; required?: boolean }) {
  return <Field label={label}><input className={inputClass} inputMode="numeric" value={value} required={required} onChange={event => onChange(numberValue(event.target.value))} /></Field>;
}
function CostFields({ value, onChange }: { value: CostParts; onChange: (value: CostParts) => void }) {
  return <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{Object.keys(costLabels).map(key => <NumberField key={key} label={`${costLabels[key]} — تومان برای هر عدد`} value={value[key]} onChange={next => onChange({ ...value, [key]: next })} />)}</div>;
}

export function AccountingDashboard() {
  const { isAdmin, currentUser } = useAuth();
  const { refreshProducts } = useGoldStore();
  const [data, setData] = useState<AccountingData | null>(null);
  const products = data?.catalog || [];
  const [catalogSearch, setCatalogSearch] = useState('');
  const [lastSynced, setLastSynced] = useState('');
  const today = accountingDay();
  const [from, setFrom] = useState(`${today.slice(0, 7)}/01`);
  const [to, setTo] = useState(today);
  const [channel, setChannel] = useState('');
  const [filterDraft, setFilterDraft] = useState({ from: `${today.slice(0, 7)}/01`, to: today, channel: '' });
  const [section, setSection] = useState('sales');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [dialog, setDialog] = useState<string | null>(null);
  const [draft, setDraft] = useState<any>({});
  const [actionTarget, setActionTarget] = useState('');
  const retryIds = useRef(new Map<string, string>());
  const requestCounter = useRef(0);
  const mounted = useRef(true);
  const identity = useRef(currentUser?.uid);
  identity.current = currentUser?.uid;
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const load = useCallback(async (quiet = false) => {
    if (!isAdmin) return;
    const counter = ++requestCounter.current; const uid = currentUser?.uid;
    if (!quiet) { setLoading(true); setError(''); setData(null); }
    try {
      const synced = await fetch('/api/admin/accounting/sync-site', { method: 'POST', credentials: 'same-origin' });
      await readApiResponse(synced, 'همگام‌سازی سفارش‌های سایت انجام نشد.');
      const query = new URLSearchParams({ from, to, channel });
      const response = await fetch(`/api/admin/accounting?${query}`, { credentials: 'same-origin', cache: 'no-store' });
      const result = await readApiResponse<AccountingData>(response, 'دریافت حسابداری انجام نشد.');
      if (mounted.current && counter === requestCounter.current && uid === identity.current) { setData(result); setLastSynced(new Date().toISOString()); }
    } catch (failure) {
      if (mounted.current && counter === requestCounter.current) setError((failure as Error).message);
    } finally { if (mounted.current && counter === requestCounter.current) setLoading(false); }
  }, [isAdmin, currentUser?.uid, from, to, channel]);
  useEffect(() => { if (isAdmin) void load(); else { requestCounter.current++; setData(null); setDialog(null); retryIds.current.clear(); } }, [isAdmin, load]);
  useEffect(() => {
    if (!isAdmin || busy || dialog || loading) return;
    const refresh = () => { if (document.visibilityState === 'visible') void load(true); };
    const interval = window.setInterval(refresh, 30000);
    window.addEventListener('focus', refresh); document.addEventListener('visibilitychange', refresh);
    return () => { window.clearInterval(interval); window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh); };
  }, [isAdmin, busy, dialog, loading, load]);
  useEffect(() => { const listener = (event: KeyboardEvent) => { if (event.key === 'Escape' && !busy) setDialog(null); }; window.addEventListener('keydown', listener); return () => window.removeEventListener('keydown', listener); }, [busy]);
  useEffect(() => {
    if (!dialog) return;
    const previous = document.activeElement as HTMLElement;
    const modal = document.querySelector<HTMLElement>('[aria-labelledby="accounting-dialog-title"]');
    const targets = () => Array.from(modal?.querySelectorAll<HTMLElement>('input:not([disabled]),select:not([disabled]),button:not([disabled])') || []);
    targets()[0]?.focus();
    const trap = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const controls = targets(); const first = controls[0]; const last = controls.at(-1);
      if (!controls.length) { event.preventDefault(); return; }
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    modal?.addEventListener('keydown', trap);
    return () => { modal?.removeEventListener('keydown', trap); if (previous?.isConnected) previous.focus(); };
  }, [dialog, !!data]);

  function open(kind: string, sale?: AccountingSale, productId?: string) {
    setError(''); setSuccess(''); setActionTarget(sale?.id || '');
    if (kind === 'purchase') setDraft({ productId: productId || products[0]?.id || '', kind: 'opening', quantity: String(productId ? Math.max(1, products.find(product => product.id === productId)?.unknownQuantity || 1) : 1), costs: emptyCosts(), supplier: '', reference: '', date: today });
    else if (kind === 'sale') setDraft({ customerName: '', customerPhone: '', customerAddress: '', method: 'card_to_card', date: today, exchangeForSaleId: '', items: [{ productId: products[0]?.id || '', quantity: '1', unitPrice: '' }] });
    else if (kind === 'settings') setDraft({ ...data!.settings });
    else if (kind === 'costs' && sale) setDraft({ packaging: sale.packaging, shippingReceived: sale.shippingReceived, shippingPaid: sale.shippingPaid, otherCosts: sale.otherCosts,
      expensesDate: sale.expensesAt ? accountingDay(sale.expensesAt) : '', recognizedDate: sale.recognizedAt ? accountingDay(sale.recognizedAt) : '', reason: '',
      items: sale.items.map(line => ({ key: line.key, costs: line.overrideCosts || emptyCosts(), enterCosts: !!line.overrideCosts, extraAssembly: line.extraAssembly })) });
    else if (kind === 'return' && sale) setDraft({ amount: '', shippingRefund: 0, restock: true, reference: '', note: '', date: today,
      items: sale.recognizedAt ? sale.items.map(line => ({ key: line.key, quantity: '0' })) : [] });
    else setDraft({ amount: sale ? (kind === 'settlement' ? data!.totals[sale.id].pendingSettlement : Math.max(0, data!.totals[sale.id].balance)) : '', fee: 0,
      method: kind === 'settlement' ? 'pasargad' : 'card_to_card', reference: '', note: moneyKinds[kind], category: '', date: today });
    setDialog(kind);
  }
  const edit = (key: string, value: any) => setDraft((previous: any) => ({ ...previous, [key]: value }));
  async function perform(action: string, payload: any, close = true) {
    if (busy || !data || !isAdmin) return;
    setBusy(true); setError(''); setSuccess('');
    const uid = currentUser?.uid;
    const signature = JSON.stringify({ action, payload });
    const actionId = retryIds.current.get(signature) || crypto.randomUUID();
    retryIds.current.set(signature, actionId);
    try {
      const response = await fetch(`/api/admin/accounting/${action}`, { method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...payload, actionId, expectedRevision: data.revision }) });
      await readApiResponse(response, 'ثبت حسابداری انجام نشد.');
      retryIds.current.delete(signature);
      if (!mounted.current || uid !== identity.current) return;
      if (close) setDialog(null);
      setSuccess('ثبت با موفقیت انجام شد.');
      await Promise.all([load(), refreshProducts()]);
    } catch (failure) { if (mounted.current) { setError((failure as Error).message); } }
    finally { if (mounted.current) setBusy(false); }
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    try {
      const n = (value: any) => { if (String(value).trim() === '' || !/^\d+$/.test(String(value))) throw new Error('مبلغ و تعداد را با عدد صحیح وارد کنید.'); return Number(value); };
      const convertCosts = (value: CostParts) => Object.fromEntries(Object.entries(value).map(([key, value]) => [key, n(value)]));
      if (dialog === 'purchase') await perform('purchase', { ...draft, quantity: n(draft.quantity), costs: convertCosts(draft.costs) });
      else if (dialog === 'purchase-correction') await perform('purchase-correction', { purchaseId: actionTarget, costs: convertCosts(draft.costs), reason: draft.reason });
      else if (dialog === 'money-void') await perform('money-void', { entryId: actionTarget, reason: draft.reason });
      else if (dialog === 'sale') await perform('sale', { ...draft, items: draft.items.map((item: any) => ({ ...item, quantity: n(item.quantity), unitPrice: n(item.unitPrice) })) });
      else if (dialog === 'settings') await perform('settings', { packaging: n(draft.packaging), assembly: n(draft.assembly) });
      else if (dialog === 'costs') await perform('costs', { ...draft, saleId: actionTarget,
        packaging: n(draft.packaging), shippingReceived: n(draft.shippingReceived), shippingPaid: n(draft.shippingPaid), otherCosts: n(draft.otherCosts),
        items: draft.items.map((item: any) => ({ key: item.key, ...(item.enterCosts && !selectedSale?.costsLocked ? { costs: convertCosts(item.costs) } : {}), extraAssembly: n(item.extraAssembly) })) });
      else if (dialog === 'return') await perform('return', { ...draft, saleId: actionTarget, amount: n(draft.amount), shippingRefund: n(draft.shippingRefund),
        items: draft.items.map((item: any) => ({ ...item, quantity: n(item.quantity) })).filter((item: any) => item.quantity > 0) });
      else if (dialog) await perform('money', { ...draft, kind: dialog, ...(actionTarget ? { saleId: actionTarget } : {}), amount: n(draft.amount), fee: n(draft.fee) });
    } catch (failure) { setError((failure as Error).message); }
  }
  function exportCsv() {
    if (!data) return;
    const report = data.report;
    const rows: unknown[][] = [['گزارش حسابداری اینانا', from, to, channel || 'همهٔ کانال‌ها'], ['فروش خالص', report.revenue], ['هزینهٔ کالای فروخته‌شدهٔ دارای قیمت خرید', report.cost], ['هزینه‌های ثبت‌شده', report.expenses], ['سود خالص', report.profit ?? 'اطلاعات خرید ناقص'], [],
      ['کد سفارش', 'کانال', 'تاریخ سفارش', 'تاریخ تکمیل', 'فروش خالص کل عمر سفارش', 'هزینهٔ کالا', 'هزینهٔ سفارش', 'سود کل عمر سفارش', 'دریافت', 'بازپرداخت', 'ماندهٔ تسویهٔ پاسارگاد']];
    for (const sale of data.sales.filter(sale => (!channel || sale.channel === channel))) {
      const totals = data.totals[sale.id]; rows.push([sale.trackingCode, sale.channel === 'site' ? 'سایت' : 'اینستاگرام', accountingDay(sale.createdAt), sale.recognizedAt ? accountingDay(sale.recognizedAt) : '', totals.revenue, totals.cost ?? 'ناقص', totals.expenses, totals.profit ?? 'ناقص', totals.paid, totals.refunded, totals.pendingSettlement]);
    }
    rows.push([], ['روز شمسی', 'فروش خالص بازه', 'سود خالص روز']);
    for (const row of report.daily) rows.push([row.day, row.revenue, row.profit ?? 'ناقص']);
    rows.push([], ['محصول', 'تعداد خالص بازه', 'فروش خالص بازه', 'سود کالا پیش از هزینهٔ سفارش']);
    for (const row of report.products) rows.push([row.title, row.quantity, row.revenue, row.profit ?? 'ناقص']);
    rows.push([], ['خرید جدید ثبت‌شدهٔ کل کسب‌وکار در بازه', report.purchaseAmount, 'تعداد', report.purchaseQuantity], ['سفارش سایت در بازه', report.siteOrderCount], ['تعداد فروش خالص تکمیل‌شدهٔ سایت', report.siteSoldQuantity], [], ['محصولات فعلی سایت', 'شناسه', 'وزن', 'موجودی سایت', 'در سفارش فعال', 'تعداد بدون قیمت خرید', 'ارزش موجودی دارای قیمت خرید']);
    for (const product of products) rows.push([product.title, product.id, product.weight, product.stock ?? 'ثبت نشده', product.held, product.unknownQuantity, product.inventoryCost]);
    const blob = new Blob(['\uFEFF', rows.map(row => row.map(safeCsv).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = `inana-accounting-${today.replaceAll('/', '-')}.csv`; anchor.click(); URL.revokeObjectURL(url);
  }
  if (!isAdmin) return null;
  const selectedSale = data?.sales.find(sale => sale.id === actionTarget);
  const moneyInput = (key: string, label: string) => <NumberField label={label} value={draft[key]} onChange={next => edit(key, next)} />;
  const textInput = (key: string, label: string, required = false) => <Field label={label}><input className={inputClass} value={draft[key] || ''} required={required} maxLength={500} onChange={event => edit(key, event.target.value)} /></Field>;
  const productSelect = (value: string, change: (value: string) => void) => <Field label="محصول و گزینهٔ وزن"><select className={inputClass} value={value} onChange={event => change(event.target.value)} required>{products.map(product => <option key={product.id} value={product.id}>{product.title} — {toPersianDigits(product.weight)} گرم — موجودی {toPersianDigits(product.stock ?? 0)}</option>)}</select></Field>;
  const updateLine = (index: number, field: string, value: any) => edit('items', draft.items.map((item: any, i: number) => i === index ? { ...item, [field]: value } : item));

  return <div dir="rtl" className="space-y-5 text-slate-200" aria-label="حسابداری خصوصی ادمین">
    <div className={`${panel} flex flex-col sm:flex-row gap-4 justify-between`}>
      <div><div className="flex items-center gap-2 text-[#D4AF37]"><ShieldCheck size={20} /><h2 className="text-xl font-bold">حسابداری و سود اینانا</h2></div><p className="mt-2 text-xs text-slate-400">خرید، فروش سایت و اینستاگرام، هزینه‌ها و مرجوعی — همهٔ مبالغ به تومان</p></div>
      <div className="flex flex-wrap gap-2"><button className={buttonClass} onClick={() => open('settings')} disabled={!data || busy}><Settings size={15} />هزینه‌های پیش‌فرض</button><button className={buttonClass} onClick={() => void load()} disabled={busy || loading}><RefreshCw size={15} />تازه‌سازی</button><button className={buttonClass} onClick={exportCsv} disabled={!data}><Download size={15} />خروجی اکسل CSV</button></div>
    </div>
    {!dialog && error && <div role="alert" className="bg-red-950/40 border border-red-800 rounded-xl p-3 text-sm text-red-300">{error}<button className={`${buttonClass} mr-3`} onClick={() => void load()}>تازه‌سازی</button></div>}
    {success && <div role="status" className="bg-emerald-950/40 rounded-xl p-3 text-sm text-emerald-300">{success}</div>}
    <p className="text-xs text-slate-400 leading-7">محصولات و سفارش‌های سایت خودکار همگام می‌شوند. دریافت وجه پس از تأیید پرداخت در مدیریت سایت ثبت می‌شود؛ کارمزد و تسویهٔ واقعی بانک را وارد کنید.{lastSynced && ` آخرین همگام‌سازی: ${new Date(lastSynced).toLocaleTimeString('fa-IR', { timeZone: 'Asia/Tehran' })}`}</p>
    <div className={`${panel} grid grid-cols-1 sm:grid-cols-3 gap-3`}>
      <Field label="از تاریخ شمسی"><input className={inputClass} value={filterDraft.from} placeholder="۱۴۰۵/۰۷/۰۱" onChange={event => setFilterDraft(previous => ({ ...previous, from: event.target.value }))} /></Field>
      <Field label="تا تاریخ شمسی"><input className={inputClass} value={filterDraft.to} placeholder="۱۴۰۵/۰۷/۳۰" onChange={event => setFilterDraft(previous => ({ ...previous, to: event.target.value }))} /></Field>
      <Field label="کانال فروش"><select className={inputClass} value={filterDraft.channel} onChange={event => setFilterDraft(previous => ({ ...previous, channel: event.target.value }))}><option value="">همهٔ کانال‌ها و هزینه‌های عمومی</option><option value="site">سایت</option><option value="instagram">اینستاگرام</option></select></Field>
      <button className={buttonClass} disabled={busy || loading} onClick={() => { setFrom(filterDraft.from); setTo(filterDraft.to); setChannel(filterDraft.channel); }}>اعمال بازه و کانال</button>
    </div>
    {loading && <p role="status" className="text-xs text-slate-400">در حال دریافت حسابداری…</p>}
    {data && <>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">{[
        { label: 'فروش خالص بازه', value: formatToman(data.report.revenue), icon: Wallet },
        { label: 'سود خالص بازه', value: data.report.profit === null ? 'قیمت خرید ناقص است' : formatToman(data.report.profit), icon: TrendingUp },
        { label: 'ارزش موجودی دارای قیمت خرید', value: formatToman(data.report.inventoryCost), icon: Package },
        { label: 'منتظر تسویهٔ پاسارگاد', value: formatToman(data.report.pendingSettlement), icon: ArrowDownLeft },
      ].map(card => <div key={card.label} className={panel}><div className="flex justify-between text-xs text-slate-400"><span>{card.label}</span><card.icon size={18} className="text-[#D4AF37]" /></div><p className="text-lg font-bold mt-4 text-white">{card.value}</p></div>)}</div>
      {(data.report.missingCosts > 0 || data.report.unknownStock > 0) && <div className="rounded-xl border border-amber-600/40 bg-amber-950/30 p-4 text-xs text-amber-200 leading-7">
        {toPersianDigits(data.report.missingCosts)} فروش این بازه و {toPersianDigits(data.report.unknownStock)} عدد موجودی، قیمت خرید کامل ندارند. ابتدا موجودی اولیه و هزینه‌های سفارش را ثبت کنید؛ سود قطعی تا تکمیل قیمت خرید نمایش داده نمی‌شود.
      </div>}
      <div className="flex flex-wrap gap-2">
        <button className={primary} disabled={busy} onClick={() => open('purchase')}><Plus size={16} />خرید / موجودی اولیه</button>
        <button className={buttonClass} disabled={busy} onClick={() => open('sale')}><Plus size={16} />فروش اینستاگرام</button>
        <button className={buttonClass} disabled={busy} onClick={() => open('expense')}>هزینهٔ عمومی</button>
        <button className={buttonClass} disabled={busy} onClick={() => open('capital')}>ورود سرمایه</button>
        <button className={buttonClass} disabled={busy} onClick={() => open('withdrawal')}>برداشت شخصی</button>
        <button className={buttonClass} disabled={busy} onClick={() => open('opening')}>ماندهٔ اولیهٔ بانک</button>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">{[['sales', 'فروش‌ها'], ['catalog', 'محصولات سایت'], ['purchases', 'خرید و موجودی'], ['money', 'دریافت و پرداخت'], ['reports', 'گزارش‌ها'], ['audit', 'تاریخچهٔ ثبت‌ها']].map(([key, label]) => <button key={key} className={section === key ? primary : buttonClass} onClick={() => setSection(key)}>{label}</button>)}</div>
      {section === 'catalog' && <div className="space-y-3">
        <p className="text-xs text-slate-400 leading-7">{toPersianDigits(products.length)} محصول از فهرست فعلی سایت. افزودن و ویرایش محصول در مدیریت سایت، این فهرست را هم به‌روز می‌کند. خرید جدید در حسابداری موجودی سایت را افزایش می‌دهد و فروش سایت و اینستاگرام از همان موجودی کم می‌شود.</p>
        <input aria-label="جست‌وجوی محصولات حسابداری" placeholder="نام یا شناسهٔ محصول" className={inputClass} value={catalogSearch} onChange={event => setCatalogSearch(event.target.value)} />
        {!products.length && <p className={panel}>محصولی در سایت ثبت نشده است.</p>}
        {products.filter(product => `${product.title} ${product.id}`.includes(catalogSearch)).map(product => <article className={panel} key={product.id}>
          <div className="flex flex-wrap justify-between gap-3"><h3 className="font-bold text-white">{product.title}</h3><span className="text-xs text-slate-400">{toPersianDigits(product.weight)} گرم</span></div>
          <div className="flex flex-wrap gap-4 mt-3 text-xs"><span>موجودی سایت: {product.stock === null ? 'ثبت نشده' : toPersianDigits(product.stock)}</span><span>در سفارش فعال: {toPersianDigits(product.held)}</span><span className={product.unknownQuantity > 0 ? 'text-amber-200' : 'text-emerald-300'}>بدون قیمت خرید: {toPersianDigits(product.unknownQuantity)}</span><span>ارزش موجودی دارای قیمت خرید: {formatToman(product.inventoryCost)}</span></div>
          <button className={`${buttonClass} mt-3`} disabled={busy} onClick={() => open('purchase', undefined, product.id)}>ثبت خرید / قیمت موجودی</button>
        </article>)}
      </div>}
      {section === 'sales' && <div className="space-y-3">
        <input aria-label="جست‌وجوی فروش" placeholder="نام مشتری یا کد سفارش" className={inputClass} value={search} onChange={event => setSearch(event.target.value)} />
        <p className="text-xs text-slate-500">سود هر کارت، مجموع کل عمر همان سفارش است. گزارش بالای صفحه بر اساس تاریخ رویدادهای بازه محاسبه می‌شود.</p>
        {!data.sales.length && <div className={panel}>هنوز سفارشی ثبت نشده است. سفارش‌های سایت خودکار در این فهرست قرار می‌گیرند.</div>}
        {data.sales.filter(sale => (!channel || sale.channel === channel) && `${sale.customerName} ${sale.trackingCode}`.includes(search)).map(sale => {
          const totals = data.totals[sale.id];
          return <article key={sale.id} className={panel}>
            <div className="flex flex-wrap justify-between gap-3"><div><h3 className="font-bold text-white">{sale.customerName} <span className="text-xs text-[#D4AF37] mr-2">{sale.trackingCode}</span></h3><p className="text-xs text-slate-400 mt-2">{sale.channel === 'site' ? 'سایت' : 'اینستاگرام'} · {dateText(sale.createdAt)} · {sale.status}</p>{sale.exchangeForSaleId && <p className="text-xs text-slate-500 mt-1">تعویض مرتبط با {data.sales.find(previous => previous.id === sale.exchangeForSaleId)?.trackingCode || sale.exchangeForSaleId}</p>}</div><div className="text-left text-xs"><p>فروش: {formatToman(sale.totalPrice)}</p><p className="mt-2 text-emerald-300">سود: {!sale.recognizedAt ? 'پس از تکمیل فروش' : totals.profit === null ? 'قیمت خرید ناقص' : formatToman(totals.profit)}</p></div></div>
            <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-400 mt-4"><span>دریافت: {formatToman(totals.paid)}</span><span>بازپرداخت: {formatToman(totals.refunded)}</span><span>مانده: {formatToman(totals.balance)}</span><span>تسویهٔ درگاه: {formatToman(totals.pendingSettlement)}</span></div>
            <div className="text-xs text-slate-500 space-y-1 mt-3">{sale.items.map(line => <p key={line.key}>{line.title} × {toPersianDigits(line.quantity)} — هزینهٔ خرید کل: {lineCost(line) === null ? 'ثبت نشده' : formatToman(lineCost(line))}</p>)}</div>
            <div className="flex flex-wrap gap-2 mt-4">
              <button className={buttonClass} disabled={busy} onClick={() => open('costs', sale)}>ثبت / مشاهدهٔ هزینه‌ها</button>
              <button className={buttonClass} disabled={busy || totals.balance <= 0 || ['لغو شده', 'رد شده'].includes(sale.status)} onClick={() => open('receipt', sale)}>دریافت وجه</button>
              <button className={buttonClass} disabled={busy || totals.pendingSettlement <= 0} onClick={() => open('settlement', sale)}>تسویهٔ پاسارگاد</button>
              {!sale.recognizedAt && <button className={buttonClass} disabled={busy || totals.balance > 0 || totals.refunded > 0 || ['لغو شده', 'رد شده'].includes(sale.status)} onClick={() => void perform('complete', { saleId: sale.id, date: today })}>تکمیل فروش پس از تحویل</button>}
              <button className={buttonClass} disabled={busy || totals.paid <= totals.refunded} onClick={() => open('return', sale)}>مرجوعی / بازپرداخت</button>
            </div>
          </article>;
        })}
      </div>}
      {section === 'purchases' && <div className="space-y-3"><p className="text-xs text-slate-400">موجودی اولیه فقط هزینهٔ کالاهای موجود را ثبت می‌کند. خرید جدید، تعداد موجودی فروشگاه را هم افزایش می‌دهد. قیمت خرید هر قطعه در همان نوبت خرید حفظ می‌شود.</p>{!data.purchases.length && <p className={panel}>هنوز قیمت خریدی ثبت نشده است.</p>}{data.purchases.map(lot => <div className={panel} key={lot.id}><div className="flex flex-wrap justify-between gap-2"><strong>{lot.title}</strong><span className="text-xs text-slate-400">{dateText(lot.occurredAt)} · {lot.kind === 'purchase' ? 'خرید جدید' : lot.supplier === 'برگشت سالم از مشتری' ? 'برگشت سالم' : 'موجودی اولیه'}</span></div><p className="text-sm mt-3">خرید هر عدد: {formatToman(costSum(lot.costs))} · تعداد: {toPersianDigits(lot.quantity)} · باقی‌مانده: {toPersianDigits(lot.remaining)}</p><p className="text-xs text-slate-500 mt-2">{lot.supplier} {lot.reference && `· فاکتور ${lot.reference}`}</p>{lot.remaining === lot.quantity && !lot.id.startsWith('return-') && <button className={`${buttonClass} mt-3`} disabled={busy} onClick={() => { setActionTarget(lot.id); setDraft({ costs: lot.costs, reason: '' }); setError(''); setDialog('purchase-correction'); }}>اصلاح قیمت خرید</button>}</div>)}</div>}
      {section === 'money' && <div className="space-y-3"><p className="text-xs text-slate-400">دریافت پاسارگاد تا ثبت تسویه، وجه منتظر تسویه محسوب می‌شود. کارمزد واقعی را یک‌بار، هنگام دریافت یا تسویه وارد کنید.</p>{[...data.money].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)).map(entry => <div key={entry.id} className={panel}><div className="flex flex-wrap justify-between gap-2"><strong>{moneyKinds[entry.kind]} {entry.voidedAt && <span className="text-red-300">— باطل‌شده</span>}</strong><span>{formatToman(entry.amount)}</span></div><p className="text-xs text-slate-400 mt-2">{dateText(entry.occurredAt)} · {entry.method === 'pasargad' ? 'پاسارگاد' : 'حساب بانکی / کارت‌به‌کارت'} · {entry.reference}</p><p className="text-xs mt-2">{entry.note} {entry.fee > 0 && `· کارمزد ${formatToman(entry.fee)}`}</p>{entry.voidedAt ? <p className="text-xs text-slate-500 mt-2">دلیل ابطال: {entry.voidReason}</p> : <button className={`${buttonClass} mt-3`} disabled={busy} onClick={() => { setActionTarget(entry.id); setDraft({ reason: '' }); setError(''); setDialog('money-void'); }}>ابطال ثبت اشتباه</button>}</div>)}{data.returns.map(entry => <div key={entry.id} className={panel}><strong>بازپرداخت مشتری: {formatToman(entry.amount)}</strong><p className="text-xs text-slate-400 mt-2">{dateText(entry.occurredAt)} · {entry.reference} · {entry.note}</p></div>)}</div>}
      {section === 'reports' && <div className="space-y-4">
        <div className={`${panel} grid sm:grid-cols-2 gap-4 text-sm`}><p>تعداد سفارش‌های سایت در بازه: {toPersianDigits(data.report.siteOrderCount)}</p><p>تعداد خالص کالاهای فروخته‌شدهٔ سایت: {toPersianDigits(data.report.siteSoldQuantity)}</p><p>خرید جدید ثبت‌شدهٔ کل کسب‌وکار در بازه: {formatToman(data.report.purchaseAmount)}</p><p>تعداد خرید جدید: {toPersianDigits(data.report.purchaseQuantity)}</p></div>
        <div className={`${panel} grid sm:grid-cols-3 gap-4 text-sm`}><p>هزینه‌های خالص بازه: {formatToman(data.report.expenses)}</p><p>بازپرداخت‌های بازه: {formatToman(data.report.refunds)}</p><p>ماندهٔ دریافت مشتری‌ها: {formatToman(data.report.receivables)}</p>{!channel && <p>خالص دریافت و پرداخت ثبت‌شده: {formatToman(data.report.cashMovement)}</p>}</div>
        <div className={panel}><h3 className="font-bold mb-3">تفکیک کانال فروش</h3>{data.report.channels.filter(row => !channel || row.channel === channel).map(row => <p key={row.channel} className="text-sm leading-8">{row.channel === 'site' ? 'سایت' : 'اینستاگرام'} — فروش {formatToman(row.revenue)} — سود {row.profit === null ? 'خرید ناقص' : formatToman(row.profit)}</p>)}<p className="text-xs text-slate-500 mt-2">هزینه‌های عمومی در سود کل منظور می‌شوند؛ گزارش هر کانال شامل هزینه‌های همان سفارش‌هاست.</p></div>
        <div className={panel}><h3 className="font-bold mb-3">گزارش روزانه</h3><div className="overflow-x-auto"><table className="w-full text-right text-xs"><thead className="text-slate-400"><tr><th className="p-2">تاریخ شمسی</th><th className="p-2">فروش خالص</th><th className="p-2">سود خالص</th></tr></thead><tbody>{data.report.daily.map(row => <tr key={row.day} className="border-t border-slate-800"><td className="p-2">{toPersianDigits(row.day)}</td><td className="p-2">{formatToman(row.revenue)}</td><td className="p-2">{row.profit === null ? 'خرید ناقص' : formatToman(row.profit)}</td></tr>)}</tbody></table></div></div>
        <div className={panel}><h3 className="font-bold mb-3">سود کالا پیش از هزینه‌های سفارش</h3>{data.report.products.map(row => <p key={row.productId} className="text-xs leading-8">{row.title} — تعداد خالص {toPersianDigits(row.quantity)} — فروش {formatToman(row.revenue)} — سود {row.profit === null ? 'خرید ناقص' : formatToman(row.profit)}</p>)}</div>
      </div>}
      {section === 'audit' && <div className="space-y-2">{data.audit.map(entry => <div className={panel} key={entry.id}><p className="text-sm">{titles[entry.action] || entry.action}</p><p className="text-xs text-slate-400 mt-2">{dateText(entry.createdAt)} · {entry.actor} · {data.sales.find(sale => sale.id === entry.target)?.trackingCode || entry.target}</p></div>)}</div>}
    </>}
    {dialog && data && <div className="fixed inset-0 z-[100] bg-black/75 p-3 sm:p-6 flex items-center justify-center" onClick={event => { if (event.target === event.currentTarget && !busy) setDialog(null); }}>
      <div role="dialog" aria-modal="true" aria-labelledby="accounting-dialog-title" className="bg-[#0A1120] border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[90dvh] overflow-y-auto p-4 sm:p-6">
        <div className="flex justify-between gap-3 mb-5"><div><h3 id="accounting-dialog-title" className="font-bold text-lg text-white">{titles[dialog]}</h3>{selectedSale && <p className="text-xs text-slate-400 mt-1">{selectedSale.customerName} · {selectedSale.trackingCode}</p>}</div><button className={buttonClass} aria-label="بستن فرم حسابداری" disabled={busy} onClick={() => setDialog(null)}><X size={16} /></button></div>
        <form onSubmit={submit} className="space-y-4">
          {dialog === 'settings' && <><p className="text-xs text-slate-400">این مقادیر برای ثبت‌های جدید هستند. مبلغ سفارش‌های قبلی حفظ می‌شود.</p>{moneyInput('packaging', 'هزینهٔ بسته‌بندی هر سفارش — تومان')}{moneyInput('assembly', 'هزینهٔ ساخت هر گردنبند مروارید — تومان')}</>}
          {dialog === 'purchase-correction' && <><CostFields value={draft.costs} onChange={value => edit('costs', value)} />{textInput('reason', 'دلیل اصلاح قیمت خرید', true)}<p className="text-xs text-slate-400">فقط خریدی که هنوز در فروش مصرف نشده قابل اصلاح است. سابقهٔ قیمت قبلی حفظ می‌شود.</p></>}
          {dialog === 'money-void' && <><p className="text-sm text-amber-200">این کار فقط ثبت اشتباه را از محاسبات خارج می‌کند و وجهی جابه‌جا نمی‌کند. برای پولی که واقعاً به مشتری پس داده‌ای، «مرجوعی / بازپرداخت» را ثبت کن.</p>{textInput('reason', 'دلیل ابطال ثبت اشتباه', true)}</>}
          {dialog === 'purchase' && <>
            {productSelect(draft.productId, next => edit('productId', next))}
            <Field label="نوع ثبت"><select className={inputClass} value={draft.kind} onChange={event => edit('kind', event.target.value)}><option value="opening">موجودی اولیه — بدون افزایش تعداد سایت</option><option value="purchase">خرید جدید — افزایش تعداد سایت</option></select></Field>
            <p className="text-xs text-slate-400">قیمت‌ها برای هر عدد هستند. برای قطعات با قیمت خرید متفاوت، ثبت جدا انجام دهید. برای سفارش‌های قدیمیِ فروخته‌شده، هزینه را در کارت همان سفارش وارد کنید.</p>
            {moneyInput('quantity', 'تعداد قطعه')}
            <CostFields value={draft.costs} onChange={value => edit('costs', value)} />
            <button type="button" className={buttonClass} onClick={() => edit('costs', { ...draft.costs, assembly: data.settings.assembly })}>استفاده از هزینهٔ ثابت ساخت برای محصول آماده</button>
            {textInput('supplier', 'تأمین‌کننده')}{textInput('reference', 'شماره فاکتور خرید')}
          </>}
          {dialog === 'sale' && <>
            {textInput('customerName', 'نام مشتری', true)}{textInput('customerPhone', 'شماره تماس')}{textInput('customerAddress', 'نشانی')}
            {draft.items.map((item: any, index: number) => <div key={index} className={`${panel} space-y-3`}>
              {productSelect(item.productId, next => updateLine(index, 'productId', next))}
              <div className="grid sm:grid-cols-2 gap-3"><NumberField label="تعداد" value={item.quantity} onChange={next => updateLine(index, 'quantity', next)} /><NumberField label="قیمت نهایی فروش هر عدد پس از تخفیف — تومان" value={item.unitPrice} onChange={next => updateLine(index, 'unitPrice', next)} /></div>
              {draft.items.length > 1 && <button type="button" className={buttonClass} onClick={() => edit('items', draft.items.filter((_: any, i: number) => i !== index))}>حذف این ردیف</button>}
            </div>)}
            <button type="button" className={buttonClass} onClick={() => edit('items', [...draft.items, { productId: products[0]?.id || '', quantity: '1', unitPrice: '' }])}>افزودن کالا</button>
            <Field label="تعویض مرتبط با مرجوعی قبلی (اختیاری)"><select className={inputClass} value={draft.exchangeForSaleId} onChange={event => edit('exchangeForSaleId', event.target.value)}><option value="">فروش مستقل</option>{data.sales.filter(sale => data.returns.some(entry => entry.saleId === sale.id)).map(sale => <option key={sale.id} value={sale.id}>{sale.trackingCode} — {sale.customerName}</option>)}</select></Field>
            <p className="text-xs text-slate-400">این فروش از موجودی مشترک سایت کم می‌شود. سپس هزینه‌ها و دریافت وجه را در کارت فروش ثبت کنید؛ پس از تحویل، فروش را تکمیل کنید.</p>
          </>}
          {dialog === 'costs' && selectedSale && <>
            {selectedSale.items.map((line, index) => <div key={line.key} className={`${panel} space-y-3`}><strong className="text-sm">{line.title} × {toPersianDigits(line.quantity)}</strong>
              <p className="text-xs text-slate-400">{lineCost(line) === null ? 'قیمت خرید ثبت نشده؛ برای سفارش قدیمی یا ساخت بعد از سفارش، هزینه‌های هر عدد را وارد کنید.' : `هزینهٔ خرید ثبت‌شده: ${formatToman(lineCost(line))}`}</p>
              {!selectedSale.costsLocked && !line.allocations.length && <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={draft.items[index].enterCosts} onChange={event => updateLine(index, 'enterCosts', event.target.checked)} />ورود مستقیم هزینهٔ خرید هر عدد</label>}
              {draft.items[index].enterCosts && !selectedSale.costsLocked && <CostFields value={draft.items[index].costs} onChange={value => updateLine(index, 'costs', value)} />}
              <NumberField label="ساخت بعد از سفارش — تومان برای هر عدد (اگر قبلاً در خرید منظور نشده)" value={draft.items[index].extraAssembly} onChange={next => updateLine(index, 'extraAssembly', next)} />
              {!selectedSale.costsLocked && <button type="button" className={buttonClass} onClick={() => updateLine(index, 'extraAssembly', data.settings.assembly)}>استفاده از هزینهٔ ثابت ساخت</button>}
            </div>)}
            <div className="grid sm:grid-cols-2 gap-3">{moneyInput('packaging', 'بسته‌بندی سفارش — تومان')}{moneyInput('shippingReceived', 'هزینهٔ ارسال دریافتی از مشتری — تومان')}{moneyInput('shippingPaid', 'هزینهٔ واقعی ارسال پرداختی — تومان')}{moneyInput('otherCosts', 'سایر هزینه‌های همین سفارش — تومان')}</div>
            {textInput('expensesDate', 'تاریخ شمسی پرداخت هزینه‌ها (اختیاری؛ پیش‌فرض تاریخ تکمیل فروش)')}
            {selectedSale.recognizedAt && textInput('recognizedDate', 'تاریخ واقعی تکمیل فروش — شمسی')}
            {selectedSale.recognizedAt && selectedSale.costsLocked && textInput('reason', 'دلیل اصلاح هزینه‌های سفارش', true)}
            <p className="text-xs text-slate-400">قیمت خرید فروش قطعی حفظ می‌شود. هزینهٔ ساخت محصول آماده و ساخت بعد از سفارش را دوبار وارد نکنید.</p>
          </>}
          {dialog === 'return' && selectedSale && <>
            {moneyInput('amount', 'مبلغ واقعی بازپرداخت — تومان')}{moneyInput('shippingRefund', 'بخش مربوط به بازپرداخت هزینهٔ ارسال — تومان')}
            {selectedSale.recognizedAt ? <>{selectedSale.items.map((line, index) => <NumberField key={line.key} label={`${line.title} — تعداد مرجوعی (باقی‌مانده ${toPersianDigits(line.quantity - returnedQuantity(data.returns, selectedSale.id, line.key))})`} value={draft.items[index].quantity} onChange={next => updateLine(index, 'quantity', next)} />)}<label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={draft.restock} onChange={event => edit('restock', event.target.checked)} />کالا سالم دریافت شده و به موجودی قابل فروش برگردد</label></> : <p className="text-xs text-amber-200">سفارش هنوز تحویل نشده است. این ثبت فقط بازپرداخت وجه است؛ موجودی با لغو سفارش در بخش سفارش‌ها آزاد می‌شود.</p>}
            {textInput('reference', 'شماره پیگیری واقعی بازپرداخت', true)}{textInput('note', 'دلیل مرجوعی یا بازپرداخت', true)}
          </>}
          {Object.keys(moneyKinds).includes(dialog) && <>
            {moneyInput('amount', dialog === 'settlement' ? 'مبلغ خالص واریزشده به بانک — تومان' : 'مبلغ — تومان')}
            {['receipt', 'settlement'].includes(dialog) && <>{moneyInput('fee', 'کارمزد واقعی همین رویداد — تومان')}<Field label="روش پرداخت"><select className={inputClass} value={draft.method} disabled={dialog === 'settlement'} onChange={event => edit('method', event.target.value)}><option value="card_to_card">کارت‌به‌کارت</option><option value="pasargad">درگاه پاسارگاد</option></select></Field>{textInput('reference', 'شماره پیگیری واقعی تراکنش', true)}<p className="text-xs text-slate-400">پس از بررسی رسید یا گزارش بانک ثبت کنید. مبلغ تسویه، خالص واریزی است و کارمزد را دوباره منظور نکنید.</p></>}
            {dialog === 'expense' && <>{textInput('category', 'دستهٔ هزینه، مثل تبلیغات')}<p className="text-xs text-slate-400">هزینهٔ عمومی را اینجا ثبت کنید. هزینهٔ خرید کالا، ساخت و بسته‌بندیِ ثبت‌شده در سفارش را دوباره وارد نکنید.</p></>}
            {textInput('note', 'شرح', true)}
            {['capital', 'withdrawal', 'opening'].includes(dialog) && <p className="text-xs text-slate-400">این ثبت گردش پول را تغییر می‌دهد و در سود کسب‌وکار منظور نمی‌شود.</p>}
          </>}
          {!['costs', 'settings', 'purchase-correction', 'money-void'].includes(dialog) && textInput('date', 'تاریخ شمسی، مانند ۱۴۰۵/۰۷/۱۳', true)}
          {error && <div role="alert" className="bg-red-950/40 text-red-300 p-3 rounded-xl text-xs">{error}<button type="button" className={`${buttonClass} mr-2`} onClick={() => void load()} disabled={busy}>تازه‌سازی اطلاعات</button></div>}
          <div className="flex gap-2 pt-3"><button type="submit" className={primary} disabled={busy || loading}>{busy ? 'در حال ثبت…' : 'ثبت و ذخیره'}</button><button type="button" className={buttonClass} disabled={busy} onClick={() => setDialog(null)}>انصراف</button></div>
        </form>
      </div>
    </div>}
  </div>;
}
