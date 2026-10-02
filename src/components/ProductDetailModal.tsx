import React, { useState } from 'react';
import {
  X,
  Heart,
  ShoppingBag,
  Sparkles,
  Info,
  Send,
  Link,
} from 'lucide-react';
import { Product } from '../types';
import { useGoldStore } from '../context/GoldStoreContext';
import { formatToman, formatWeight, toPersianDigits } from '../utils/persianFormatter';
import { calculateProductPrice } from '../utils/pricingEngine';
import { productPath } from '../utils/siteRoutes';

interface ProductDetailModalProps {
  product: Product | null;
  onClose: () => void;
}

export const ProductDetailModal: React.FC<ProductDetailModalProps> = ({ product, onClose }) => {
  const { goldPrice, settings, addToCart, toggleFavorite, isFavorite } = useGoldStore();

  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [showFormulaBreakdown, setShowFormulaBreakdown] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [linkMessage, setLinkMessage] = useState('');

  if (!product) return null;

  const favorite = isFavorite(product.id);
  const isFixed = product.pricingMode === 'fixed';
  const priceReady = isFixed ? (product.fixedPrice ?? 0) > 0 : goldPrice.pricePerGram > 0;
  const priceBreakdown = calculateProductPrice(product, goldPrice.pricePerGram, settings);
  const finalPrice = priceBreakdown.finalPrice;

  const handleAddToCart = () => {
    if (!priceReady) return;
    addToCart(product, quantity);
    onClose();
  };

  const images =
    product.images && product.images.length > 0
      ? product.images
      : [
          'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=800&q=85',
        ];

  // Telegram direct support message
  const telegramUrl = `https://t.me/estella_shopee?text=${encodeURIComponent(
    `با سلام. من مایل به ثبت سفارش/استعلام محصول «${product.title}» با کد ${product.sku}${isFixed ? '' : ` به وزن ${product.weight} گرم`} و قیمت ${formatToman(
      finalPrice
    )} از گالری اینانا هستم.`
  )}`;

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="product-detail-title" className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-6 bg-slate-950/80 backdrop-blur-xl animate-in fade-in duration-300">
      <div
        id="product-detail-modal-card"
        className="relative w-full max-w-4xl bg-[#060B15] border border-[#D4AF37]/40 rounded-2xl sm:rounded-3xl overflow-hidden shadow-[0_20px_70px_rgba(0,0,0,0.9)] my-auto text-slate-100 max-h-[calc(100dvh-1rem)] sm:max-h-[92dvh] flex flex-col min-w-0"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header Bar */}
        <div className="flex shrink-0 items-center justify-between gap-2 p-3 sm:p-5 border-b border-[#D4AF37]/25 bg-[#0A1224]">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span className="px-2.5 py-1 rounded-full bg-[#0B152B] text-[#E6CA65] border border-[#D4AF37]/35 text-xs font-semibold">
              {product.collection}
            </span>
            <span className="text-xs text-slate-400">کد محصول: {product.sku}</span>
          </div>

          <div className="flex items-center gap-2">
          <button type="button" title="کپی لینک محصول" aria-label="کپی لینک محصول" className="flex items-center gap-1 p-2 text-xs text-[#E6CA65]" onClick={async () => {
            try {
              await navigator.clipboard.writeText(new URL(productPath(product.id), window.location.origin).href);
              setLinkMessage('لینک کپی شد');
            } catch { setLinkMessage('لینک را از نوار آدرس کپی کنید'); }
          }}><Link className="w-4 h-4 shrink-0" /><span className="hidden sm:inline">{linkMessage || 'کپی لینک'}</span></button>
          <span className="sr-only" role="status">{linkMessage}</span>
          <button
            onClick={onClose}
            className="p-2 rounded-full text-slate-400 hover:text-white hover:bg-[#0B152B] transition-colors"
            title="بستن"
            aria-label="بستن جزئیات محصول"
          >
            <X className="w-5 h-5" />
          </button>
          </div>
        </div>

        <div className="lg:hidden shrink-0 px-3 pt-3 pb-2 border-b border-[#D4AF37]/15">
          <h1 id="product-detail-title" className="text-lg font-extrabold text-white leading-7">{product.title}</h1>
          <p className="mt-1 text-base font-bold text-[#E6CA65]">{priceReady ? formatToman(finalPrice) : 'در حال دریافت نرخ...'}</p>
        </div>

        {/* Scrollable Content Body */}
        <div id="product-detail-content" className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 sm:p-6 lg:p-8 grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-8 items-start">
          {/* Product photo gallery */}
          <div className="lg:col-span-5 flex flex-col gap-4">
            {/* Main Stage Image */}
            <div className={`relative h-[min(32dvh,280px)] sm:h-[360px] lg:h-auto lg:aspect-[4/5] rounded-2xl overflow-hidden ${isFixed ? 'bg-white' : 'bg-[#0B152B]'} border border-[#D4AF37]/25 group`}>
              <img
                src={images[selectedImageIndex] || images[0]}
                alt={product.title}
                className="w-full h-full object-contain object-center"
                referrerPolicy="no-referrer"
                onError={(e) => {
                  (e.target as HTMLImageElement).src =
                    'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=800&q=85';
                }}
              />

            </div>

            {/* Thumbnails */}
            {images.length > 1 && (
              <div className="flex items-center gap-3 overflow-x-auto pb-2">
                {images.map((img, idx) => (
                  <button
                    key={idx}
                    type="button"
                    aria-label={`نمایش تصویر ${toPersianDigits(idx + 1)} از ${product.title}`}
                    aria-pressed={selectedImageIndex === idx}
                    onClick={() => {
                      setSelectedImageIndex(idx);
                    }}
                    className={`relative w-12 h-12 sm:w-16 sm:h-16 rounded-xl overflow-hidden border-2 transition-all flex-shrink-0 ${
                      selectedImageIndex === idx
                        ? 'border-[#D4AF37] scale-105 shadow-[0_0_12px_rgba(212,175,55,0.45)]'
                        : 'border-[#D4AF37]/20 opacity-60 hover:opacity-100'
                    }`}
                  >
                    <img
                      src={img}
                      alt={`تصویر ${toPersianDigits(idx + 1)} از ${product.title}`}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Details & Pricing Column (7 Cols) */}
          <div className="lg:col-span-7 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs text-[#E6CA65] font-semibold">{product.category}</span>
                <span className="text-slate-500">•</span>
                <span className="text-xs text-slate-300">{product.purity}{isFixed ? '' : ' (استاندارد ۷۵۰)'}</span>
              </div>

              <h2 className="hidden lg:block text-3xl font-extrabold text-white mb-4">
                {product.title}
              </h2>

              {/* Live Gold Calculation Notice Banner */}
              <div className="bg-[#0A1224] border border-[#D4AF37]/30 rounded-2xl p-3.5 mb-6 flex items-center justify-between text-xs shadow-sm">
                <div className="flex items-center gap-2 text-slate-200">
                  <Sparkles className="w-4 h-4 text-[#D4AF37]" />
                  <span>{isFixed ? 'قیمت این محصول ثابت است و به نرخ طلا وابسته نیست.' : 'قیمت این محصول با توجه به قیمت روز طلا محاسبه شده است.'}</span>
                </div>
                {!isFixed && <span className="text-[#E6CA65] font-bold">
                  نرخ ۱۸ عیار: {priceReady ? formatToman(goldPrice.pricePerGram) : 'در حال دریافت...'}
                </span>}
              </div>

              {/* Key Specs Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                {!isFixed && <div className="bg-[#081224] border border-[#D4AF37]/20 p-3 rounded-xl text-center">
                  <span className="text-[11px] text-slate-400 block">وزن طلا</span>
                  <span className="text-sm font-bold text-white mt-1 block">
                    {formatWeight(product.weight, true)}
                  </span>
                </div>}
                <div className="bg-[#081224] border border-[#D4AF37]/20 p-3 rounded-xl text-center">
                  <span className="text-[11px] text-slate-400 block">{isFixed ? 'کیفیت' : 'عیار قطعه'}</span>
                  <span className="text-sm font-bold text-white mt-1 block">{product.purity}</span>
                </div>
                {!isFixed && <div className="bg-[#081224] border border-[#D4AF37]/20 p-3 rounded-xl text-center">
                  <span className="text-[11px] text-slate-400 block">درصد اجرت</span>
                  <span className="text-sm font-bold text-[#E6CA65] mt-1 block">
                    {priceBreakdown.effectiveMakingChargePercent}٪
                  </span>
                </div>}
                <div className="bg-[#081224] border border-[#D4AF37]/20 p-3 rounded-xl text-center">
                  <span className="text-[11px] text-slate-400 block">وضعیت موجودی</span>
                  <span
                    className={`text-sm font-bold mt-1 block ${
                      product.stock > 0 ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {product.stock > 0 ? `${toPersianDigits(product.stock)} عدد موجود` : 'سفارشی'}
                  </span>
                </div>
              </div>

              {/* Description */}
              <p className="text-sm text-slate-300 leading-relaxed mb-6 font-light">
                {product.description}
              </p>

              {/* Features List */}
              {product.features && product.features.length > 0 && (
                <div className="mb-6">
                  <span className="text-xs font-bold text-white block mb-2">ویژگی‌ها و مزایا:</span>
                  <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-300">
                    {product.features.map((f, idx) => (
                      <li key={idx} className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#D4AF37]" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Price Breakdown Drawer Toggle */}
              {!isFixed && <div className="mb-6">
                <button
                  type="button"
                  onClick={() => setShowFormulaBreakdown(!showFormulaBreakdown)}
                  className="flex items-center gap-1.5 text-xs text-[#D4AF37] hover:underline"
                >
                  <Info className="w-3.5 h-3.5" />
                  <span>
                    {showFormulaBreakdown ? 'بستن ریز محاسبات قیمت' : 'مشاهده ریز فرمول قیمت‌گذاری'}
                  </span>
                </button>

                {showFormulaBreakdown && (
                  <div className="mt-3 p-4 rounded-2xl bg-[#13254A] border border-slate-700/80 text-xs space-y-2 animate-in fade-in duration-200">
                    <div className="flex justify-between text-slate-200">
                      <span>ارزش طلای خام ({formatWeight(product.weight)}):</span>
                      <span className="font-bold">{formatToman(priceBreakdown.baseGoldValue)}</span>
                    </div>
                    <div className="flex justify-between text-slate-200">
                      <span>
                        اجرت ساخت ({priceBreakdown.effectiveMakingChargePercent}٪):
                      </span>
                      <span className="font-bold">{formatToman(priceBreakdown.makingChargeAmount)}</span>
                    </div>
                    <div className="flex justify-between text-slate-200">
                      <span>سود فروشنده ({priceBreakdown.profitPercent}٪):</span>
                      <span className="font-bold">{formatToman(priceBreakdown.profitAmount)}</span>
                    </div>
                    {priceBreakdown.discountPercent > 0 && (
                      <div className="flex justify-between text-emerald-400 bg-emerald-500/15 p-2 rounded-lg border border-emerald-500/30">
                        <span>تخفیف ویژه گالری ({priceBreakdown.discountPercent}٪):</span>
                        <span className="font-bold">- {formatToman(priceBreakdown.discountAmount)}</span>
                      </div>
                    )}
                    {priceBreakdown.stoneCost > 0 && (
                      <div className="flex justify-between text-slate-200">
                        <span>ارزش سنگ و مخراج‌کاری:</span>
                        <span className="font-bold">{formatToman(priceBreakdown.stoneCost)}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>}
            </div>

            <div className="flex flex-wrap items-center gap-4 border-t border-[#D4AF37]/20 pt-3 text-xs">
              <a href={telegramUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sky-400">
                <Send className="h-4 w-4" /> سفارش و استعلام در تلگرام
              </a>
              <button type="button" onClick={() => toggleFavorite(product.id)}
                aria-label={favorite ? `حذف ${product.title} از علاقه‌مندی‌ها` : `افزودن ${product.title} به علاقه‌مندی‌ها`}
                aria-pressed={favorite} className={`inline-flex items-center gap-1.5 ${favorite ? 'text-rose-400' : 'text-slate-300'}`}>
                <Heart className={`h-4 w-4 ${favorite ? 'fill-current' : ''}`} /> {favorite ? 'ذخیره شد' : 'افزودن به علاقه‌مندی'}
              </button>
            </div>
          </div>
        </div>

        <div id="product-purchase-bar" className="shrink-0 border-t border-[#D4AF37]/30 bg-[#0A1224] px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:p-5">
          <div className="flex items-center justify-between gap-3 mb-2">
            <div className="min-w-0">
              <span className="text-[11px] text-slate-400">{isFixed ? 'قیمت ثابت' : 'قیمت روز'}{quantity > 1 ? ` / ${toPersianDigits(quantity)} عدد` : ''}</span>
              <p className="text-base sm:text-xl font-extrabold text-[#E6CA65]">{priceReady ? formatToman(finalPrice * quantity) : 'در حال دریافت نرخ...'}</p>
            </div>
            {(product.availableStock ?? product.stock ?? 0) > 0 && (
              <div className="flex shrink-0 items-center rounded-xl bg-[#13254A] border border-slate-600">
                <button type="button" aria-label="کاهش تعداد" disabled={quantity <= 1} onClick={() => setQuantity(value => Math.max(1, value - 1))}
                  className="h-10 w-10 disabled:opacity-30">−</button>
                <span className="w-6 text-center text-sm font-bold">{toPersianDigits(quantity)}</span>
                <button type="button" aria-label="افزایش تعداد" disabled={quantity >= (product.availableStock ?? product.stock ?? 0)}
                  onClick={() => setQuantity(value => Math.min(product.availableStock ?? product.stock ?? 0, value + 1))}
                  className="h-10 w-10 disabled:opacity-30">+</button>
              </div>
            )}
          </div>
          <button type="button" onClick={handleAddToCart}
            disabled={!priceReady || (product.availableStock ?? product.stock ?? 0) <= 0}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#D4AF37] via-[#C5A059] to-[#AA822A] py-3 text-sm font-bold text-slate-950 hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed">
            <ShoppingBag className="h-4 w-4" />
            {!priceReady ? 'در حال دریافت نرخ طلا' : (product.availableStock ?? product.stock ?? 0) <= 0 ? 'اتمام موجودی' : 'افزودن به سبد خرید'}
          </button>
        </div>
      </div>
    </div>
  );
};
