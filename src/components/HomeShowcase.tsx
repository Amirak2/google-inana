import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { useGoldStore } from '../context/GoldStoreContext';
import { ProductCard } from './ProductCard';
import { DEFAULT_CATALOG_FILTERS, filterCatalogProducts, sortCatalogProducts } from '../utils/catalogFilters';
import { productAvailability } from '../utils/productVariants';
import type { Product } from '../types';

const ROW_SIZE = 8;

// The homepage shows a short, browsable sample: the newest pieces, then one swipeable
// row per collection with a link to the full collection. The complete catalog lives on
// the shop page, so visitors reach the trust sections below without endless scrolling.
export const HomeShowcase: React.FC = () => {
  const { products, collections, goldPrice, settings, openCatalog } = useGoldStore();
  const browsable = sortCatalogProducts(filterCatalogProducts(products, DEFAULT_CATALOG_FILTERS), 'newest', goldPrice.pricePerGram, settings);
  const inStock = browsable.filter(product => productAvailability(product) > 0);
  const show = (filters: Parameters<typeof openCatalog>[0]) => { openCatalog(filters); window.scrollTo({ top: 0, behavior: 'smooth' }); };

  const rows: { key: string; title: string; items: Product[]; open: () => void }[] = [
    { key: 'new', title: 'تازه‌ها', items: inStock.slice(0, ROW_SIZE), open: () => show({ sortBy: 'newest' }) },
    ...collections.map(collection => ({
      key: collection.id,
      title: collection.titleFa,
      items: browsable.filter(product => product.collection === collection.name).slice(0, ROW_SIZE),
      open: () => show({ selectedCollection: collection.name }),
    })),
  ].filter(row => row.items.length > 0);

  return (
    <section id="home-showcase" className="inana-glass-backdrop w-full max-w-full py-10 sm:py-14">
      <div className="max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8 space-y-10 sm:space-y-12">
        <nav aria-label="کالکشن‌ها" className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
          {collections.map(collection => (
            <button key={collection.id} type="button" onClick={() => show({ selectedCollection: collection.name })}
              className="shrink-0 min-h-10 px-4 rounded-full border border-[#D4AF37]/35 bg-[#0B152B] text-sm text-[#E6CA65] hover:border-[#D4AF37] transition-colors">
              {collection.titleFa}
            </button>
          ))}
        </nav>

        {rows.map(row => (
          <div key={row.key}>
            <div className="flex items-baseline justify-between gap-3 mb-4">
              <h2 className="text-lg sm:text-2xl font-extrabold gold-gradient-text">{row.title}</h2>
              <button type="button" onClick={row.open} className="shrink-0 inline-flex items-center gap-1 text-sm text-[#D4AF37] hover:underline">
                همه <ArrowLeft className="w-4 h-4" />
              </button>
            </div>
            <div className="flex gap-3 sm:gap-4 overflow-x-auto snap-x snap-mandatory pb-2 -mx-3.5 px-3.5 sm:mx-0 sm:px-0 [scrollbar-width:none]">
              {row.items.map(product => (
                <div key={product.id} className="snap-start shrink-0 w-[44vw] max-w-[220px] sm:w-56">
                  <ProductCard product={product} />
                </div>
              ))}
            </div>
          </div>
        ))}

        <button type="button" onClick={() => show({})}
          className="w-full min-h-12 rounded-2xl border border-[#D4AF37]/50 text-[#D4AF37] font-bold hover:bg-[#D4AF37]/10 transition-colors">
          مشاهده همهٔ محصولات{browsable.length > 0 && ` (${browsable.length.toLocaleString('fa-IR')})`}
        </button>
      </div>
    </section>
  );
};
