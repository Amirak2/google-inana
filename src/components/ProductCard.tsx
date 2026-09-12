import React from 'react';
import { motion } from 'motion/react';
import { Heart, Eye, ShoppingBag, Sparkles } from 'lucide-react';
import { Product } from '../types';
import { useGoldStore } from '../context/GoldStoreContext';
import { formatToman, formatWeight } from '../utils/persianFormatter';
import { calculateProductPrice } from '../utils/pricingEngine';

interface ProductCardProps {
  product: Product;
  onQuickView?: (product: Product) => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product, onQuickView }) => {
  const { goldPrice, settings, addToCart, toggleFavorite, isFavorite, setQuickViewProduct } =
    useGoldStore();

  const favorite = isFavorite(product.id);

  // Dynamic live calculation
  const priceBreakdown = calculateProductPrice(product, goldPrice.pricePerGram, settings);
  const finalPrice = priceBreakdown.finalPrice;

  const handleQuickView = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onQuickView) onQuickView(product);
    else setQuickViewProduct(product);
  };

  const handleAddToCart = (e: React.MouseEvent) => {
    e.stopPropagation();
    addToCart(product, 1);
  };

  const handleToggleFavorite = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleFavorite(product.id);
  };

  return (
    <motion.div
      id={`product-card-${product.id}`}
      onClick={handleQuickView}
      whileHover={{ y: -7 }}
      transition={{ type: 'spring', stiffness: 340, damping: 24 }}
      className="group relative flex flex-col luxury-glass-card rounded-2xl overflow-hidden cursor-pointer transition-colors duration-500 hover:border-[#D4AF37]/50 border border-[#D4AF37]/15 hover:shadow-[0_24px_50px_-12px_rgba(2,6,23,0.9),0_0_35px_rgba(212,175,55,0.2)] w-full min-w-0"
    >
      {/* Luxury Golden Crest Top Border Accent on Hover */}
      <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-[#D4AF37] to-transparent opacity-0 group-hover:opacity-100 transition-all duration-700 transform scale-x-0 group-hover:scale-x-100 z-30 pointer-events-none" />

      {/* Image Container with Luxury Shimmer & Cinematic Zoom */}
      <div className="relative aspect-[4/5] w-full overflow-hidden bg-[#070E1C]">
        <img
          src={product.images?.[0] || 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=800&q=80'}
          alt={product.title}
          loading="lazy"
          className="w-full h-full object-cover object-center transition-transform duration-700 ease-[cubic-bezier(0.2,0.8,0.2,1)] group-hover:scale-108 group-hover:brightness-105"
          referrerPolicy="no-referrer"
          onError={(e) => {
            (e.target as HTMLImageElement).src =
              'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=800&q=80';
          }}
        />

        {/* Diagonal Specular Gold Light Sheen Sweep on Hover */}
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none overflow-hidden">
          <div className="w-[200%] h-full bg-gradient-to-r from-transparent via-white/15 to-transparent transform -skew-x-25 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-out" />
        </div>

        {/* Subtle Ambient Radial Gold Glow in Center on Hover */}
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none bg-[radial-gradient(circle_at_center,rgba(212,175,55,0.12)_0%,transparent_70%)]" />

        {/* Vignette Depth Gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#060B15] via-transparent to-transparent opacity-75" />

        {/* Top Badges */}
        <div className="absolute top-3 right-3 left-3 flex items-center justify-between z-10">
          <div className="flex flex-col gap-1 items-start">
            {product.isNewArrival && (
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#D4AF37] text-slate-950 shadow-sm flex items-center gap-1">
                <Sparkles className="w-2.5 h-2.5" />
                <span>جدید</span>
              </span>
            )}
            {product.discountPercent > 0 && (
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-600 text-white shadow-sm">
                ٪{product.discountPercent} تخفیف
              </span>
            )}
          </div>

          {/* Favorite Button */}
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={handleToggleFavorite}
            className={`p-2 rounded-full backdrop-blur-md transition-colors ${
              favorite
                ? 'bg-rose-500 text-white shadow-[0_0_12px_rgba(244,63,94,0.5)]'
                : 'bg-[#060B15]/70 text-slate-200 hover:text-white hover:bg-[#060B15]'
            }`}
            title="افزودن به علاقه‌مندی‌ها"
          >
            <Heart className={`w-4 h-4 ${favorite ? 'fill-current' : ''}`} />
          </motion.button>
        </div>

        {/* Quick View Hover Action Pill (Desktop) */}
        <div className="absolute bottom-3 left-3 right-3 z-10 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-2.5 group-hover:translate-y-0 hidden sm:flex items-center justify-center gap-2">
          <button
            onClick={handleQuickView}
            className="flex-1 flex items-center justify-center gap-2 bg-[#060B15]/90 backdrop-blur-md border border-[#D4AF37]/50 text-slate-100 hover:text-[#D4AF37] hover:border-[#D4AF37] hover:bg-[#0B152B] py-2 rounded-xl text-xs font-semibold transition-all shadow-lg"
          >
            <Eye className="w-3.5 h-3.5 text-[#D4AF37]" />
            <span>مشاهده جزئیات اثر</span>
          </button>
        </div>
      </div>

      {/* Product Information */}
      <div className="p-4 sm:p-5 flex flex-col flex-1 justify-between bg-gradient-to-b from-[#0A1325] to-[#060B15] transition-colors duration-500 group-hover:from-[#0D1830] group-hover:to-[#070D1B]">
        <div>
          {/* Category & Collection with Sparkle accent */}
          <div className="flex items-center justify-between text-[11px] text-slate-300 mb-1.5">
            <span className="text-[#D4AF37] font-semibold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#D4AF37] opacity-60 group-hover:opacity-100 transition-opacity" />
              {product.collection}
            </span>
            <span className="bg-slate-800/80 px-2 py-0.5 rounded text-[10px] text-slate-200 border border-slate-700/50">
              {product.purity}
            </span>
          </div>

          {/* Product Title */}
          <h3 className="text-sm sm:text-base font-bold text-white line-clamp-1 group-hover:text-[#F5E8C7] transition-colors duration-300">
            {product.title}
          </h3>

          {/* Weight & Pre-set Making Charge Details */}
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-slate-200 mt-2.5 bg-[#0B152B] p-2 rounded-xl border border-slate-700/80 group-hover:border-[#D4AF37]/25 transition-colors duration-300">
            <div className="flex items-center gap-1">
              <span className="text-slate-400 text-[11px]">وزن:</span>
              <span className="font-bold text-white">{formatWeight(product.weight)}</span>
            </div>
            <span className="text-slate-600">|</span>
            <div className="flex items-center gap-1">
              <span className="text-slate-400 text-[11px]">اجرت:</span>
              <span className="font-semibold text-[#D4AF37]">
                {priceBreakdown.effectiveMakingChargePercent}٪
              </span>
            </div>
            <span className="text-slate-600">|</span>
            <div className="flex items-center gap-1">
              <span className="text-slate-400 text-[11px]">سود:</span>
              <span className="font-semibold text-emerald-400">۷٪</span>
            </div>
          </div>
        </div>

        {/* Dynamic Computed Price & Action Button Footer */}
        <div className="mt-4 pt-3 border-t border-slate-700/80 group-hover:border-slate-700 flex items-center justify-between transition-colors duration-300">
          <div className="flex flex-col">
            <span className="text-[10px] text-slate-300 font-light">قیمت محاسبه‌شده روز:</span>
            <span className="text-sm sm:text-base font-bold text-white gold-gradient-text tracking-tight group-hover:brightness-115 transition-all">
              {formatToman(finalPrice)}
            </span>
          </div>

          {/* Add to Cart quick icon with spring response */}
          {product.availableStock !== undefined && product.availableStock <= 0 ? (
            <span className="text-[10px] text-rose-400 bg-rose-500/20 px-2 py-1 rounded-lg font-medium border border-rose-500/30">
              ناموجود
            </span>
          ) : (
            <motion.button
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.92 }}
              onClick={handleAddToCart}
              className="p-2.5 rounded-xl bg-[#1A315C] hover:bg-[#D4AF37] text-[#D4AF37] hover:text-slate-950 border border-[#D4AF37]/40 hover:border-transparent transition-colors shadow-sm"
              title="افزودن به سبد خرید"
            >
              <ShoppingBag className="w-4 h-4" />
            </motion.button>
          )}
        </div>
      </div>
    </motion.div>
  );
};
