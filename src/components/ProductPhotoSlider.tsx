import React, { useEffect, useRef } from 'react';
import { ZoomIn } from 'lucide-react';
import { toPersianDigits } from '../utils/persianFormatter';
import { sizedImage } from '../utils/productImages';
import { PhotoArrows } from './PhotoArrows';

const FALLBACK = 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=800&q=85';

/**
 * Product photos as a swipeable strip: one photo fills the stage and the next one peeks in
 * from the side. Swiping, the arrows and the thumbnails all move the same index; tapping a
 * photo opens the large view at that photo.
 */
type SliderProps = { images: string[]; title: string; index: number; onChange: (index: number) => void; onOpen: () => void; light: boolean };

export const ProductPhotoSlider: React.FC<SliderProps> = ({ images, title, index, onChange, onOpen, light }) => {
  const scroller = useRef<HTMLDivElement>(null);
  const slides = useRef<(HTMLButtonElement | null)[]>([]);
  const fromSwipe = useRef(false);
  const first = useRef(true);
  const many = images.length > 1;

  // Swiping: the photo that is mostly in view becomes the current one.
  useEffect(() => {
    const root = scroller.current;
    if (!root || !many || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const seen = slides.current.indexOf(entry.target as HTMLButtonElement);
        if (seen >= 0 && seen !== index) { fromSwipe.current = true; onChange(seen); }
      }
    }, { root, threshold: 0.6 });
    slides.current.forEach(slide => slide && observer.observe(slide));
    return () => observer.disconnect();
  }, [images, index, many, onChange]);

  // Arrows, thumbnails or the large view changed the photo: slide it into place.
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    if (fromSwipe.current) { fromSwipe.current = false; return; }
    const root = scroller.current, slide = slides.current[index];
    if (!root || !slide) return;
    // Measured on screen, so it works the same in right-to-left layout.
    const box = root.getBoundingClientRect(), photo = slide.getBoundingClientRect();
    root.scrollBy?.({ left: photo.left + photo.width / 2 - (box.left + box.width / 2), behavior: 'smooth' });
  }, [index]);

  return <div className="relative">
    <div ref={scroller} aria-label={`عکس‌های ${title}`} role="group"
      className="flex snap-x snap-mandatory gap-2 overflow-x-auto overscroll-x-contain scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {images.map((image, position) => (
        <button key={`${position}-${image.slice(-24)}`} ref={element => { slides.current[position] = element; }} type="button"
          aria-label={position === index ? `بزرگ‌نمایی تصویر ${title}` : `بزرگ‌نمایی تصویر ${toPersianDigits(position + 1)} از ${title}`} aria-haspopup="dialog"
          aria-current={position === index ? 'true' : undefined}
          onClick={() => { if (position !== index) onChange(position); onOpen(); }}
          className={`relative flex shrink-0 snap-center items-center justify-center overflow-hidden rounded-2xl border border-[#D4AF37]/25 cursor-zoom-in focus-visible:outline-2 focus-visible:outline-[#D4AF37] h-[min(42dvh,340px)] sm:h-[420px] lg:h-auto lg:aspect-[4/5] ${many ? 'w-[86%] lg:w-full' : 'w-full'} ${light ? 'bg-white' : 'bg-[#0B152B]'}`}>
          <img src={position === index ? image : sizedImage(image, 960)} alt={`${title}، تصویر ${toPersianDigits(position + 1)}`}
            loading={position === 0 ? 'eager' : 'lazy'} decoding="async" draggable={false} referrerPolicy="no-referrer"
            className="h-full w-full object-contain object-center"
            onError={event => { event.currentTarget.onerror = null; event.currentTarget.src = FALLBACK; }} />
          {position === index && <span className="absolute bottom-2 right-2 flex items-center gap-1 rounded-full bg-slate-950/80 px-2 py-1 text-xs text-white">
            <ZoomIn className="h-4 w-4" /> بزرگ‌نمایی
          </span>}
        </button>
      ))}
    </div>
    <PhotoArrows count={images.length} index={index} onChange={onChange} />
  </div>;
};
