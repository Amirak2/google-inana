import React, { useRef, useState } from 'react';
import { toPersianDigits } from '../utils/persianFormatter';
import { fileToProductPhoto, isUploadedPhoto } from '../utils/productPhoto';

const MAX_PHOTOS = 8;

export function AdminProductGallery({ images, onChange }: { images: string[]; onChange: (images: string[]) => void }) {
  const picker = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const move = (index: number, target: number) => {
    const next = [...images];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };
  const addFiles = async (files: File[]) => {
    setError('');
    const kept = images.filter(image => image.trim());
    const room = MAX_PHOTOS - kept.length;
    if (files.length > room) setError(`هر محصول حداکثر ${toPersianDigits(MAX_PHOTOS)} عکس می‌گیرد؛ فقط ${toPersianDigits(Math.max(room, 0))} عکس اضافه شد.`);
    setBusy(true);
    const added: string[] = [];
    for (const file of files.slice(0, Math.max(room, 0))) {
      try { added.push(await fileToProductPhoto(file)); }
      catch (reason) { setError(`«${file.name}»: ${reason instanceof Error ? reason.message : 'عکس آماده نشد.'}`); }
    }
    setBusy(false);
    if (added.length) onChange([...kept, ...added]);
  };
  return <fieldset className="space-y-3">
    <legend className="mb-2 text-sm font-semibold text-slate-300">گالری تصاویر محصول</legend>
    <p className="text-xs text-slate-400">تصویر اول، عکس اصلی ویترین است. هر تصویر را جداگانه جابه‌جا یا حذف کنید. عکس‌های انتخاب‌شده با ذخیرهٔ محصول روی سایت نگه‌داری می‌شوند.</p>
    {images.map((image, index) => <div key={index} className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-700 p-3">
      {image && <img src={image} alt={`پیش‌نمایش تصویر ${toPersianDigits(index + 1)}`} className="h-14 w-14 rounded-lg bg-white object-contain" />}
      {isUploadedPhoto(image)
        ? <p className="min-w-0 flex-1 text-xs text-slate-300">تصویر {toPersianDigits(index + 1)}{index === 0 ? ' (اصلی)' : ''}<span className="mt-1 block text-emerald-300">عکس انتخاب شد؛ با ذخیرهٔ محصول بارگذاری می‌شود.</span></p>
        : <label className="min-w-0 flex-1 text-xs text-slate-300">
          تصویر {toPersianDigits(index + 1)}{index === 0 ? ' (اصلی)' : ''}
          <input aria-label={`آدرس تصویر ${toPersianDigits(index + 1)}`} type="text" dir="ltr" value={image}
            onChange={event => onChange(images.map((url, position) => position === index ? event.target.value : url))}
            className="mt-1 w-full rounded-lg border border-slate-700 bg-[#060B14] px-3 py-2 text-white" placeholder="https://..." />
        </label>}
      <div className="flex w-full justify-end gap-2 text-xs sm:w-auto">
        <button type="button" disabled={index === 0} aria-label={`جابه‌جایی تصویر ${toPersianDigits(index + 1)} به قبل`} onClick={() => move(index, index - 1)} className="rounded-lg border border-slate-700 p-2 disabled:opacity-30">↑</button>
        <button type="button" disabled={index === images.length - 1} aria-label={`جابه‌جایی تصویر ${toPersianDigits(index + 1)} به بعد`} onClick={() => move(index, index + 1)} className="rounded-lg border border-slate-700 p-2 disabled:opacity-30">↓</button>
        <button type="button" onClick={() => onChange(images.filter((_, position) => position !== index))} className="rounded-lg border border-rose-700 p-2 text-rose-300">حذف تصویر {toPersianDigits(index + 1)}</button>
      </div>
    </div>)}
    {error && <p role="alert" className="text-xs text-rose-300">{error}</p>}
    <input ref={picker} type="file" accept="image/*" multiple hidden aria-label="انتخاب عکس از دستگاه"
      onChange={event => { const files: File[] = Array.from(event.target.files || []); event.target.value = ''; void addFiles(files); }} />
    <div className="flex flex-wrap gap-2">
      <button type="button" disabled={busy || images.filter(image => image.trim()).length >= MAX_PHOTOS} onClick={() => picker.current?.click()} className="rounded-xl bg-[#D4AF37] px-4 py-2 text-xs font-bold text-[#060B14] disabled:opacity-30">{busy ? 'در حال آماده‌سازی عکس…' : 'انتخاب عکس از دستگاه'}</button>
      <button type="button" disabled={images.length >= MAX_PHOTOS} onClick={() => onChange([...images, ''])} className="rounded-xl border border-[#D4AF37]/40 px-4 py-2 text-xs text-[#E6CA65] disabled:opacity-30">افزودن با آدرس تصویر</button>
    </div>
  </fieldset>;
}
