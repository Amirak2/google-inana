import React from 'react';
import { Heart, ShoppingBag, ArrowLeft, Trash2 } from 'lucide-react';
import { useGoldStore } from '../context/GoldStoreContext';
import { ProductCard } from './ProductCard';

export const FavoritesView: React.FC = () => {
  const { favorites, products, setActiveTab, clearFavorites } = useGoldStore();

  const favoriteProducts = products.filter((p) => favorites.includes(p.id));

  return (
    <section
      id="favorites-view-section"
      className="py-16 px-4 sm:px-6 lg:px-8 bg-[#060B15] min-h-[85vh] relative w-full max-w-full overflow-hidden"
      style={{
        background:
          'radial-gradient(ellipse at 50% 0%, rgba(18, 48, 98, 0.25) 0%, rgba(8, 15, 30, 0.6) 45%, #060B15 85%)',
      }}
    >
      {/* Subtle Top Gold Transition Line */}
      <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-[#D4AF37]/30 to-transparent pointer-events-none" />

      <div className="max-w-7xl mx-auto relative z-10">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-[#D4AF37]/20 mb-10">
          <div>
            <div className="inline-flex items-center gap-2 text-xs font-semibold text-[#E6CA65] uppercase tracking-widest mb-2 px-3.5 py-1.5 rounded-full bg-[#0B152B] border border-[#D4AF37]/35 shadow-sm">
              <Heart className="w-3.5 h-3.5 fill-rose-500 text-rose-500" />
              <span>لیست زیورآلات برگزیده</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold gold-gradient-text tracking-wide">
              علاقه‌مندی‌های شما ({favoriteProducts.length})
            </h1>
          </div>

          {favoriteProducts.length > 0 && (
            <button
              onClick={clearFavorites}
              className="flex items-center gap-1.5 text-xs text-rose-300 hover:text-rose-200 bg-rose-500/15 px-3.5 py-2 rounded-xl border border-rose-500/30 transition-colors shadow-sm"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>حذف همه علاقه‌مندی‌ها</span>
            </button>
          )}
        </div>

        {/* Content */}
        {favoriteProducts.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {favoriteProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <div className="text-center py-24 bg-[#081224]/75 border border-[#D4AF37]/25 rounded-3xl p-8 max-w-lg mx-auto shadow-md">
            <Heart className="w-12 h-12 text-slate-500 mx-auto mb-3" />
            <h2 className="text-lg font-bold text-white mb-1">
              هنوز محصولی را به علاقه‌مندی‌ها اضافه نکرده‌اید
            </h2>
            <p className="text-xs text-slate-300 mb-6 font-light leading-relaxed">
              با کلیک بر روی آیکون قلب روی هر قطعه زیورآلات، می‌توانید آن را در این بخش برای مقایسه
              و خرید بعدی ذخیره نمایید.
            </p>
            <button
              onClick={() => setActiveTab('shop')}
              className="bg-gradient-to-r from-[#D4AF37] via-[#C5A059] to-[#B38A30] text-slate-950 font-bold px-6 py-2.5 rounded-xl text-xs hover:brightness-110 transition-all flex items-center justify-center gap-2 mx-auto shadow-md"
            >
              <span>مشاهده ویترین محصولات</span>
              <ArrowLeft className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </section>
  );
};
