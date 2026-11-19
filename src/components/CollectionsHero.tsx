import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { useGoldStore } from '../context/GoldStoreContext';
import type { CollectionInfo } from '../types';
import { collectionCover } from '../utils/collectionCover';
import { sizedImage } from '../utils/productImages';

/** A thin gold rule with a small diamond in the middle. */
const Ornament = ({ className = '' }: { className?: string }) => (
  <span aria-hidden="true" className={`flex items-center gap-2 ${className}`}>
    <span className="h-px w-10 bg-gradient-to-l from-[#D4AF37] to-transparent" />
    <span className="h-1.5 w-1.5 rotate-45 bg-[#D4AF37]" />
    <span className="h-px w-10 bg-gradient-to-r from-[#D4AF37] to-transparent" />
  </span>
);

function CollectionCard({ collection, index, cover, tall, onOpen }: {
  collection: CollectionInfo; index: number; cover?: string; tall?: boolean; onOpen: () => void;
}) {
  return (
    <button type="button" onClick={onOpen} aria-label={`مشاهدهٔ ${collection.titleFa}`}
      className="group flex h-full min-h-0 w-full flex-col text-right focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#D4AF37] rounded-[28px]">
      <span className={`relative block w-full overflow-hidden rounded-[28px] border border-[#D4AF37]/30 bg-white shadow-[0_18px_40px_-28px_rgba(90,66,10,0.55)] transition-[border-color,box-shadow] duration-500 group-hover:border-[#D4AF37]/70 group-hover:shadow-[0_24px_50px_-26px_rgba(90,66,10,0.7)] aspect-square sm:aspect-[4/5] lg:aspect-auto lg:flex-1 lg:min-h-0`}>
        {cover
          ? <img src={sizedImage(cover, tall ? 960 : 640)} alt="" loading={index < 2 ? 'eager' : 'lazy'} decoding="async" draggable={false} referrerPolicy="no-referrer"
              className="absolute inset-0 h-full w-full object-cover object-center transition-transform duration-[1200ms] ease-out group-hover:scale-105" />
          : <span className="absolute inset-0 flex items-center justify-center font-serif-brand text-4xl tracking-[0.2em] text-[#D4AF37]" dir="ltr">INANA</span>}
      </span>
      <span className="mt-3 block px-1 text-center">
        <span dir="ltr" className="block truncate font-serif-brand text-[10px] uppercase tracking-[0.25em] text-[#D4AF37]">{collection.name}</span>
        <span className={`mt-0.5 block truncate font-extrabold text-white ${tall ? 'text-lg sm:text-xl' : 'text-base'}`}>{collection.titleFa}</span>
        {collection.subtitleFa && <span className="mt-0.5 block truncate text-xs text-slate-400">{collection.subtitleFa}</span>}
      </span>
    </button>
  );
}

/**
 * Home page hero: the brand, then the collections as the first thing a visitor sees.
 * Phones swipe through the collections; wide screens show them as a gallery wall.
 */
export const CollectionsHero: React.FC = () => {
  const { collections, products, openCatalog, setActiveTab } = useGoldStore();
  const open = (name: string) => { openCatalog({ selectedCollection: name }); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const go = (tab: 'collections' | 'shop') => { setActiveTab(tab); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const wall = collections.slice(0, 5);
  const loading = collections.length === 0;

  return (
    <section id="inana-luxury-hero" aria-labelledby="inana-hero-title"
      className="relative w-full overflow-hidden bg-[#050A14] pt-24 pb-10 sm:pt-32 sm:pb-16 lg:pb-20">
      {/* Soft gold light and a faint dot pattern behind everything; nothing is laid over the photos. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 inana-pattern-bg opacity-60 [mask-image:linear-gradient(to_bottom,black,transparent_75%)]" />
      <div aria-hidden="true" className="pointer-events-none absolute -top-40 left-1/2 h-[520px] w-[820px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(212,175,55,0.18),transparent)]" />

      <div className="relative mx-auto grid max-w-7xl grid-cols-1 items-center gap-5 sm:gap-8 px-4 sm:px-6 lg:grid-cols-12 lg:gap-12 lg:px-8">
        {/* Brand */}
        <div className="flex flex-col items-center text-center lg:col-span-4">
          <img src="/inana-logo-gold.png" alt="لوگوی اینانا گلد" width={88} height={88} draggable={false}
            className="hidden object-contain sm:block sm:h-20 sm:w-20" />
          <h1 id="inana-hero-title" dir="ltr" className="sm:mt-4 whitespace-nowrap font-serif-brand text-[clamp(26px,7vw,52px)] lg:text-[34px] xl:text-[40px] font-bold uppercase leading-none tracking-[0.22em] lg:tracking-[0.18em] -mr-[0.22em] lg:-mr-[0.18em] gold-gradient-text">
            INANA GOLD
          </h1>
          <Ornament className="mt-3 sm:mt-4" />
          <p className="mt-3 sm:mt-4 text-base font-medium text-[#F5E8C7] sm:text-lg">گالری اینانا برای زنان توانا</p>
          <div className="mt-6 hidden flex-wrap justify-center gap-3 lg:flex">
            <button id="hero-cta-collections" type="button" onClick={() => go('collections')}
              className="group inline-flex items-center gap-2.5 rounded-full bg-gradient-to-r from-[#D4AF37] via-[#C5A059] to-[#B38A30] px-7 py-3.5 text-sm font-bold text-slate-950 transition-all hover:brightness-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D4AF37]">
              <span>مشاهده مجموعه‌ها</span>
              <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
            </button>
            <button type="button" onClick={() => go('shop')}
              className="inline-flex items-center rounded-full border border-[#D4AF37]/50 px-6 py-3.5 text-sm font-bold text-[#E6CA65] transition-colors hover:border-[#D4AF37]">
              ویترین زیورآلات
            </button>
          </div>
        </div>

        {/* Collections */}
        <div className="lg:col-span-8">
          {/* Phones and tablets: a heading, then swipe; the next collection peeks in from the side. */}
          <div className="mb-3 flex items-center justify-between lg:hidden">
            <h2 className="text-lg font-extrabold text-white">کالکشن‌ها</h2>
            <button type="button" onClick={() => go('collections')} className="flex items-center gap-1 text-sm font-bold text-[#D4AF37]">
              همه <ArrowLeft className="h-4 w-4" />
            </button>
          </div>
          <ul aria-label="کالکشن‌ها" className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:-mx-6 sm:px-6 lg:hidden">
            {loading
              ? [0, 1].map(key => <li key={key} className="w-[62%] shrink-0 sm:w-[46%]"><span className="block aspect-square animate-pulse rounded-[28px] bg-[#0B152B]" /></li>)
              : collections.map((collection, index) => (
                <li key={collection.id} className="w-[62%] shrink-0 snap-start sm:w-[46%]">
                  <CollectionCard collection={collection} index={index} cover={collectionCover(collection, products)} onOpen={() => open(collection.name)} />
                </li>
              ))}
          </ul>

          {/* Wide screens: a gallery wall, the first collection large. */}
          <ul aria-label="کالکشن‌ها" className={`hidden h-[600px] gap-5 lg:grid ${wall.length >= 4 ? 'grid-cols-3 grid-rows-2' : wall.length === 3 ? 'grid-cols-2 grid-rows-2' : 'grid-cols-2 grid-rows-1'}`}>
            {(loading ? [] : wall).map((collection, index) => (
              <li key={collection.id} className={`min-h-0 ${index === 0 && wall.length >= 3 ? 'row-span-2' : ''} ${wall.length === 4 && index === 1 ? 'col-span-2' : ''}`}>
                <CollectionCard collection={collection} index={index} tall={index === 0} cover={collectionCover(collection, products)} onOpen={() => open(collection.name)} />
              </li>
            ))}
          </ul>

          <div className="mt-6 flex justify-center lg:hidden">
            <button id="hero-cta-collections-mobile" type="button" onClick={() => go('collections')}
              className="group inline-flex items-center gap-2.5 rounded-full bg-gradient-to-r from-[#D4AF37] via-[#C5A059] to-[#B38A30] px-7 py-3.5 text-sm font-bold text-slate-950 transition-all hover:brightness-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D4AF37]">
              <span>مشاهده مجموعه‌ها</span>
              <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};
