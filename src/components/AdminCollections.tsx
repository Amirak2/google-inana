import React, { useRef, useState } from 'react';
import { useGoldStore } from '../context/GoldStoreContext';
import type { CollectionInfo } from '../types';
import { toPersianDigits } from '../utils/persianFormatter';
import { fileToProductPhoto } from '../utils/productPhoto';

const EMPTY: Partial<CollectionInfo> = { titleFa: '', name: '', subtitleFa: '', description: '', accentQuote: '', coverImage: '' };
const field = 'mt-1 w-full rounded-xl border border-slate-700 bg-[#060B14] px-3.5 py-2.5 text-white outline-none focus:border-[#D4AF37]';

/** Admin: add, edit, reorder and delete the collections shown on the home page and the collections page. */
export function AdminCollections() {
  const { collections, products, saveCollection, deleteCollection, reorderCollections } = useGoldStore();
  const [draft, setDraft] = useState<Partial<CollectionInfo> | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const picker = useRef<HTMLInputElement>(null);
  const countIn = (name?: string) => products.filter(product => product.collection === name).length;

  const run = async (work: () => Promise<unknown>, done: string) => {
    setBusy(true); setError(''); setMessage('');
    try { await work(); setMessage(done); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'انجام نشد. دوباره تلاش کنید.'); }
    finally { setBusy(false); }
  };
  const move = (index: number, step: number) => {
    const ids = collections.map(collection => collection.id);
    [ids[index], ids[index + step]] = [ids[index + step], ids[index]];
    void run(() => reorderCollections(ids), 'ترتیب کالکشن‌ها ذخیره شد.');
  };
  const pickCover = async (file?: File) => {
    if (!file || !draft) return;
    setError('');
    try { const coverImage = await fileToProductPhoto(file); setDraft(previous => ({ ...previous, coverImage })); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'عکس آماده نشد.'); }
  };
  const save = (event: React.FormEvent) => {
    event.preventDefault();
    if (!draft) return;
    void run(async () => { await saveCollection(draft); setDraft(null); }, draft.id ? 'تغییرات کالکشن ذخیره شد.' : 'کالکشن جدید ساخته شد و در سایت نمایش داده می‌شود.');
  };
  const remove = (collection: CollectionInfo) => {
    const count = countIn(collection.name);
    const note = count ? `\n${toPersianDigits(count)} محصول در این کالکشن هست؛ محصولات حذف نمی‌شوند ولی دیگر در ردیف این کالکشن دیده نمی‌شوند.` : '';
    if (!window.confirm(`کالکشن «${collection.titleFa}» حذف شود؟${note}`)) return;
    void run(() => deleteCollection(collection.id), 'کالکشن حذف شد.');
  };

  return <section aria-labelledby="admin-collections-title" className="space-y-5 text-xs">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 id="admin-collections-title" className="text-lg font-bold text-white">کالکشن‌ها</h2>
        <p className="mt-1 text-slate-400">کالکشن‌ها به همین ترتیب در صفحهٔ اصلی و صفحهٔ کالکشن‌ها نمایش داده می‌شوند. برای گذاشتن محصول در یک کالکشن، در فرم محصول کالکشن را انتخاب کنید.</p>
      </div>
      <button type="button" disabled={busy} onClick={() => { setDraft({ ...EMPTY }); setMessage(''); setError(''); }} className="rounded-xl bg-[#D4AF37] px-4 py-2.5 font-bold text-slate-950 disabled:opacity-40">+ کالکشن جدید</button>
    </div>

    {message && <p role="status" className="rounded-xl border border-emerald-500/40 bg-emerald-950/40 p-3 text-emerald-300">{message}</p>}
    {error && <p role="alert" className="rounded-xl border border-rose-500/40 bg-rose-950/40 p-3 text-rose-300">{error}</p>}

    {draft && <form onSubmit={save} className="space-y-4 rounded-2xl border border-[#D4AF37]/40 bg-[#0A1120] p-4">
      <h3 className="text-sm font-bold text-[#E6CA65]">{draft.id ? `ویرایش «${draft.titleFa}»` : 'کالکشن جدید'}</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-slate-300">نام فارسی: *
          <input required value={draft.titleFa || ''} onChange={e => setDraft({ ...draft, titleFa: e.target.value })} className={field} placeholder="مثلاً: کالکشن ماه" />
        </label>
        <label className="text-slate-300">نام انگلیسی: *
          <input required dir="ltr" value={draft.name || ''} onChange={e => setDraft({ ...draft, name: e.target.value.toUpperCase() })} className={field + ' font-serif-brand'} placeholder="INANA MOON" />
          {draft.id && <span className="mt-1 block text-[11px] text-slate-400">اگر عوضش کنید، محصولات این کالکشن هم خودکار به نام جدید منتقل می‌شوند.</span>}
        </label>
        <label className="text-slate-300 sm:col-span-2">زیرعنوان کوتاه:
          <input value={draft.subtitleFa || ''} onChange={e => setDraft({ ...draft, subtitleFa: e.target.value })} className={field} />
        </label>
        <label className="text-slate-300 sm:col-span-2">توضیح کالکشن:
          <textarea rows={3} value={draft.description || ''} onChange={e => setDraft({ ...draft, description: e.target.value })} className={field + ' resize-y'} />
        </label>
        <label className="text-slate-300 sm:col-span-2">جملهٔ کوتاه کاور (اختیاری):
          <input value={draft.accentQuote || ''} onChange={e => setDraft({ ...draft, accentQuote: e.target.value })} className={field} />
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {draft.coverImage && <img src={draft.coverImage} alt="عکس کاور کالکشن" className="h-20 w-20 rounded-xl bg-white object-cover" />}
        <input ref={picker} type="file" accept="image/*" hidden aria-label="انتخاب عکس کاور از دستگاه" onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; void pickCover(file); }} />
        <button type="button" onClick={() => picker.current?.click()} className="rounded-xl border border-[#D4AF37]/50 px-4 py-2 font-bold text-[#E6CA65]">{draft.coverImage ? 'عوض کردن عکس کاور' : 'انتخاب عکس کاور از دستگاه *'}</button>
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" onClick={() => setDraft(null)} className="rounded-xl border border-slate-700 px-4 py-2.5 text-slate-300">انصراف</button>
        <button type="submit" disabled={busy} className="rounded-xl bg-[#D4AF37] px-5 py-2.5 font-bold text-slate-950 disabled:opacity-40">{busy ? 'در حال ذخیره…' : draft.id ? 'ذخیرهٔ تغییرات' : 'ساخت کالکشن'}</button>
      </div>
    </form>}

    <ul className="space-y-2">
      {collections.map((collection, index) => <li key={collection.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-800 bg-[#0A1120] p-3">
        <img src={collection.coverImage} alt="" className="h-14 w-14 shrink-0 rounded-xl bg-white object-cover" />
        <div className="min-w-0 flex-1">
          <p className="font-bold text-white">{collection.titleFa}</p>
          <p className="mt-0.5 text-slate-400" dir="ltr">{collection.name}</p>
          <p className="mt-0.5 text-slate-400">{toPersianDigits(countIn(collection.name))} محصول</p>
        </div>
        <div className="flex w-full flex-wrap justify-end gap-1.5 sm:w-auto">
          <button type="button" disabled={busy || index === 0} aria-label={`بردن «${collection.titleFa}» به بالا`} onClick={() => move(index, -1)} className="rounded-lg border border-slate-700 px-2.5 py-2 disabled:opacity-30">↑</button>
          <button type="button" disabled={busy || index === collections.length - 1} aria-label={`بردن «${collection.titleFa}» به پایین`} onClick={() => move(index, 1)} className="rounded-lg border border-slate-700 px-2.5 py-2 disabled:opacity-30">↓</button>
          <button type="button" disabled={busy} onClick={() => { setDraft({ ...collection }); setMessage(''); setError(''); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="rounded-lg border border-[#D4AF37]/50 px-3 py-2 text-[#E6CA65]">ویرایش</button>
          <button type="button" disabled={busy} onClick={() => remove(collection)} className="rounded-lg border border-rose-700 px-3 py-2 text-rose-300">حذف</button>
        </div>
      </li>)}
      {!collections.length && <li className="rounded-2xl border border-slate-800 p-4 text-slate-400">هنوز کالکشنی نیست. با دکمهٔ «کالکشن جدید» بسازید.</li>}
    </ul>
  </section>;
}
