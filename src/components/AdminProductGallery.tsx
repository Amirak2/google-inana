import React from 'react';
import { toPersianDigits } from '../utils/persianFormatter';

export function AdminProductGallery({ images, onChange }: { images: string[]; onChange: (images: string[]) => void }) {
  const move = (index: number, target: number) => {
    const next = [...images];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };
  return <fieldset className="space-y-3">
    <legend className="mb-2 text-sm font-semibold text-slate-300">گالری تصاویر محصول</legend>
    <p className="text-xs text-slate-400">تصویر اول، عکس اصلی ویترین است. هر تصویر را جداگانه ویرایش، جابه‌جا یا حذف کنید.</p>
    {images.map((image, index) => <div key={index} className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-700 p-3">
      {image && <img src={image} alt={`پیش‌نمایش تصویر ${toPersianDigits(index + 1)}`} className="h-14 w-14 rounded-lg bg-white object-contain" />}
      <label className="min-w-0 flex-1 text-xs text-slate-300">
        تصویر {toPersianDigits(index + 1)}{index === 0 ? ' (اصلی)' : ''}
        <input aria-label={`آدرس تصویر ${toPersianDigits(index + 1)}`} type="text" dir="ltr" value={image}
          onChange={event => onChange(images.map((url, position) => position === index ? event.target.value : url))}
          className="mt-1 w-full rounded-lg border border-slate-700 bg-[#060B14] px-3 py-2 text-white" placeholder="https://..." />
      </label>
      <div className="flex w-full justify-end gap-2 text-xs sm:w-auto">
        <button type="button" disabled={index === 0} aria-label={`جابه‌جایی تصویر ${toPersianDigits(index + 1)} به قبل`} onClick={() => move(index, index - 1)} className="rounded-lg border border-slate-700 p-2 disabled:opacity-30">↑</button>
        <button type="button" disabled={index === images.length - 1} aria-label={`جابه‌جایی تصویر ${toPersianDigits(index + 1)} به بعد`} onClick={() => move(index, index + 1)} className="rounded-lg border border-slate-700 p-2 disabled:opacity-30">↓</button>
        <button type="button" onClick={() => onChange(images.filter((_, position) => position !== index))} className="rounded-lg border border-rose-700 p-2 text-rose-300">حذف تصویر {toPersianDigits(index + 1)}</button>
      </div>
    </div>)}
    <button type="button" disabled={images.length >= 8} onClick={() => onChange([...images, ''])} className="rounded-xl border border-[#D4AF37]/40 px-4 py-2 text-xs text-[#E6CA65] disabled:opacity-30">افزودن تصویر</button>
  </fieldset>;
}
