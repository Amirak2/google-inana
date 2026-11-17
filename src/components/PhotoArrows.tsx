import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { toPersianDigits } from '../utils/persianFormatter';

// Left and right arrows over a product photo. The site reads right to left, so the
// left arrow goes to the next photo and the right arrow to the previous one; both wrap around.
export function PhotoArrows({ count, index, onChange, size = 'md' }: { count: number; index: number; onChange: (index: number) => void; size?: 'md' | 'lg' }) {
  if (count < 2) return null;
  const go = (step: number) => onChange((index + step + count) % count);
  const button = `absolute top-1/2 -translate-y-1/2 z-10 flex items-center justify-center rounded-full bg-slate-950/70 text-white border border-[#D4AF37]/40 shadow-lg backdrop-blur-sm hover:bg-slate-950/90 hover:text-[#E6CA65] focus-visible:outline-2 focus-visible:outline-[#D4AF37] ${size === 'lg' ? 'h-12 w-12' : 'h-9 w-9 sm:h-10 sm:w-10'}`;
  const icon = size === 'lg' ? 'h-7 w-7' : 'h-5 w-5';
  return <>
    <button type="button" aria-label="عکس قبلی" onClick={event => { event.stopPropagation(); go(-1); }} className={`${button} right-2`}>
      <ChevronRight className={icon} />
    </button>
    <button type="button" aria-label="عکس بعدی" onClick={event => { event.stopPropagation(); go(1); }} className={`${button} left-2`}>
      <ChevronLeft className={icon} />
    </button>
    <span aria-live="polite" className="pointer-events-none absolute top-2 left-1/2 -translate-x-1/2 z-10 rounded-full bg-slate-950/70 px-2.5 py-0.5 text-[11px] text-white">
      {toPersianDigits(index + 1)} از {toPersianDigits(count)}
    </span>
  </>;
}
