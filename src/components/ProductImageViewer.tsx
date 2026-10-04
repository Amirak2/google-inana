import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, ZoomIn, ZoomOut } from 'lucide-react';
import { toPersianDigits } from '../utils/persianFormatter';

interface ProductImageViewerProps {
  src: string;
  title: string;
  onClose: () => void;
}

export function ProductImageViewer({ src, title, onClose }: ProductImageViewerProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    const dialog = dialogRef.current!;
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    dialog.showModal();
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
  }, [zoom]);

  return createPortal(
    <dialog ref={dialogRef} aria-label={`نمای بزرگ تصویر ${title}`} dir="rtl"
      onCancel={event => { event.preventDefault(); onClose(); }}
      className="fixed inset-0 m-0 h-[100dvh] max-h-none w-full max-w-none border-0 bg-slate-950/95 p-0 text-white backdrop:bg-slate-950/80">
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/15 px-3 py-3 sm:px-6">
          <p className="min-w-0 truncate text-sm sm:text-base">{title}</p>
          <button type="button" autoFocus aria-label="بستن نمای بزرگ تصویر" onClick={onClose}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-[#D4AF37]">
            <X className="h-6 w-6" />
          </button>
        </div>
        <div ref={scrollRef} dir="ltr" className="min-h-0 flex-1 overflow-auto overscroll-contain"
          onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
          <div className="flex items-center justify-center" style={{ width: `${zoom * 100}%`, height: `${zoom * 100}%` }}>
            <img src={src} alt={`نمای بزرگ ${title}`} referrerPolicy="no-referrer" draggable={false}
              className="h-full w-full object-contain p-3 sm:p-6"
              onError={event => { event.currentTarget.onerror = null; event.currentTarget.src = 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=800&q=85'; }} />
          </div>
        </div>
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
