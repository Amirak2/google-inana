import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, ZoomIn, ZoomOut } from 'lucide-react';
import { toPersianDigits } from '../utils/persianFormatter';
import { PhotoArrows } from './PhotoArrows';
import { sizedImage } from '../utils/productImages';

interface ProductImageViewerProps {
  src: string;
  title: string;
  onClose: () => void;
  count?: number;
  index?: number;
  onIndexChange?: (index: number) => void;
  /** All photos of the product, shown as a strip of thumbnails at the bottom. */
  images?: string[];
}

export function ProductImageViewer({ src, title, onClose, count = 1, index = 0, onIndexChange, images = [] }: ProductImageViewerProps) {
  const strip = useRef<HTMLDivElement>(null);
  const touchStart = useRef<number | null>(null);
  const go = (next: number) => { setZoom(1); onIndexChange?.(next); };
  const dialogRef = useRef<HTMLDialogElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    const dialog = dialogRef.current!;
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    dialog.showModal();
    dialog.querySelector<HTMLButtonElement>('button')?.focus();
    document.body.style.overflow = 'hidden';
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, []);

  useEffect(() => {
    const scroller = scrollRef.current;
    if (scroller) {
      scroller.scrollLeft = (scroller.scrollWidth - scroller.clientWidth) / 2;
      scroller.scrollTop = (scroller.scrollHeight - scroller.clientHeight) / 2;
    }
  }, [zoom, src]);

  useEffect(() => {
    strip.current?.querySelector<HTMLElement>('[aria-current="true"]')?.scrollIntoView?.({ block: 'nearest', inline: 'center', behavior: 'smooth' });
  }, [index]);

  // Keyboard paging; in right-to-left reading the left arrow key is "next".
  useEffect(() => {
    if (!onIndexChange || count < 2) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      event.preventDefault();
      setZoom(1);
      onIndexChange((index + (event.key === 'ArrowLeft' ? 1 : -1) + count) % count);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [count, index, onIndexChange]);

  return createPortal(
    <dialog ref={dialogRef} aria-label={`نمای بزرگ تصویر ${title}`} dir="rtl"
      onCancel={event => { event.preventDefault(); onClose(); }}
      className="fixed inset-0 m-0 h-[100dvh] max-h-none w-full max-w-none border-0 bg-slate-950 p-0 text-white backdrop:bg-slate-950/80">
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/15 px-3 py-3 sm:px-6">
          <p className="min-w-0 truncate text-sm sm:text-base">{title}</p>
          <button type="button" aria-label="بستن نمای بزرگ تصویر" onClick={onClose}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-[#D4AF37]">
            <X className="h-6 w-6" />
          </button>
        </div>
        <div className="relative min-h-0 flex-1 flex flex-col">
        {onIndexChange && <PhotoArrows size="lg" count={count} index={index} onChange={go} />}
        <div ref={scrollRef} dir="ltr" className="min-h-0 flex-1 overflow-auto overscroll-contain"
          onTouchStart={event => { touchStart.current = zoom === 1 && event.touches.length === 1 ? event.touches[0].clientX : null; }}
          onTouchEnd={event => {
            const start = touchStart.current; touchStart.current = null;
            if (start === null || !onIndexChange || count < 2) return;
            const moved = event.changedTouches[0].clientX - start;
            if (Math.abs(moved) > 50) go((index + (moved > 0 ? 1 : -1) + count) % count);
          }}
          onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
          <div className="flex items-center justify-center" style={{ width: `${zoom * 100}%`, height: `${zoom * 100}%` }}>
            <img src={src} alt={`نمای بزرگ ${title}`} referrerPolicy="no-referrer" draggable={false}
              className="h-full w-full object-contain p-3 sm:p-6"
              onError={event => { event.currentTarget.onerror = null; event.currentTarget.src = 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=800&q=85'; }} />
          </div>
        </div>
        </div>
        {onIndexChange && images.length > 1 && (
          <div ref={strip} role="group" aria-label="همهٔ عکس‌ها" className="flex shrink-0 justify-start gap-2 overflow-x-auto border-t border-white/15 px-3 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:justify-center">
            {images.map((image, position) => (
              <button key={position} type="button" aria-label={`نمایش عکس ${toPersianDigits(position + 1)}`} aria-current={position === index ? 'true' : undefined}
                onClick={() => go(position)}
                className={`h-14 w-14 sm:h-16 sm:w-16 shrink-0 overflow-hidden rounded-lg bg-white border-2 transition-opacity focus-visible:outline-2 focus-visible:outline-[#D4AF37] ${position === index ? 'border-[#D4AF37] opacity-100' : 'border-transparent opacity-60 hover:opacity-100'}`}>
                <img src={sizedImage(image, 480)} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        )}
        <div className="flex shrink-0 items-center justify-center gap-4 border-t border-white/15 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <button type="button" aria-label="بزرگ‌تر کردن تصویر" disabled={zoom >= 3} onClick={() => setZoom(value => Math.min(3, value + 0.5))}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 disabled:opacity-30"><ZoomIn className="h-5 w-5" /></button>
          <output aria-live="polite" className="w-16 text-center text-sm">{toPersianDigits(zoom * 100)}٪</output>
          <button type="button" aria-label="کوچک‌تر کردن تصویر" disabled={zoom <= 1} onClick={() => setZoom(value => Math.max(1, value - 0.5))}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 disabled:opacity-30"><ZoomOut className="h-5 w-5" /></button>
        </div>
      </div>
    </dialog>, document.body
  );
}
