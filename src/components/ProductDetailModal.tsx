import React, { useState } from 'react';
import {
  X,
  Heart,
  ShoppingBag,
  ShieldCheck,
  Truck,
  RotateCcw,
  Sparkles,
  Info,
  Layers,
  ChevronLeft,
  ChevronRight,
  Send,
  MessageCircle,
} from 'lucide-react';
import { Product } from '../types';
import { useGoldStore } from '../context/GoldStoreContext';
import { formatToman, formatWeight, toPersianDigits } from '../utils/persianFormatter';
import { calculateProductPrice } from '../utils/pricingEngine';

interface ProductDetailModalProps {
  product: Product | null;
  onClose: () => void;
}

export const ProductDetailModal: React.FC<ProductDetailModalProps> = ({ product, onClose }) => {
  const { goldPrice, settings, addToCart, toggleFavorite, isFavorite } = useGoldStore();

  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [is360Mode, setIs360Mode] = useState(false);
  const [rotationAngle, setRotationAngle] = useState(0);
  const [showFormulaBreakdown, setShowFormulaBreakdown] = useState(false);
  const [quantity, setQuantity] = useState(1);

  if (!product) return null;

  const favorite = isFavorite(product.id);
  const priceBreakdown = calculateProductPrice(product, goldPrice.pricePerGram, settings);
  const finalPrice = priceBreakdown.finalPrice;

  const handleAddToCart = () => {
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
    `با سلام. من مایل به ثبت سفارش/استعلام محصول «${product.title}» با کد ${product.sku} به وزن ${product.weight} گرم و قیمت محاسبه شده ${formatToman(
      finalPrice
    )} از گالری اینانا هستم.`
  )}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-6 overflow-y-auto bg-slate-950/80 backdrop-blur-xl animate-in fade-in duration-300">
      <div
        id="product-detail-modal-card"
        className="relative w-full max-w-4xl bg-[#060B15] border border-[#D4AF37]/40 rounded-2xl sm:rounded-3xl overflow-hidden shadow-[0_20px_70px_rgba(0,0,0,0.9)] my-auto text-slate-100 max-h-[92vh] flex flex-col min-w-0"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header Bar */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-[#D4AF37]/25 bg-[#0A1224]">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-full bg-[#0B152B] text-[#E6CA65] border border-[#D4AF37]/35 text-xs font-semibold">
              {product.collection}
            </span>
            <span className="text-xs text-slate-400">کد محصول: {product.sku}</span>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-full text-slate-400 hover:text-white hover:bg-[#0B152B] transition-colors"
            title="بستن"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="overflow-y-auto p-4 sm:p-6 lg:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Gallery & 360 Column (5 Cols) */}
          <div className="lg:col-span-5 flex flex-col gap-4">
            {/* Main Stage Image */}
            <div className="relative aspect-[4/5] rounded-2xl overflow-hidden bg-[#0B152B] border border-[#D4AF37]/25 group">
              <img
                src={images[selectedImageIndex] || images[0]}
                alt={product.title}
                className="w-full h-full object-cover object-center transition-transform duration-700 group-hover:scale-110"
                style={{
                  transform: is360Mode ? `rotateY(${rotationAngle}deg)` : undefined,
                  transition: is360Mode ? 'none' : 'transform 0.7s ease',
                }}
                referrerPolicy="no-referrer"
                onError={(e) => {
                  (e.target as HTMLImageElement).src =
                    'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=800&q=85';
                }}
              />

              {/* 360 Indicator & Toggle */}
              <div className="absolute top-3 left-3 z-10 flex gap-2">
                <button
                  onClick={() => setIs360Mode(!is360Mode)}
                  className={`px-3 py-1 rounded-full text-xs font-semibold backdrop-blur-md transition-all ${
                    is360Mode
                      ? 'bg-gradient-to-r from-[#D4AF37] to-[#AA822A] text-slate-950 shadow-md font-bold'
                      : 'bg-[#060B15]/85 text-slate-200 hover:text-white border border-[#D4AF37]/35'
                  }`}
                >
                  نمای ۳۶۰ درجه
                </button>
              </div>

              {/* 360 Drag / Slider Control if active */}
              {is360Mode && (
                <div className="absolute bottom-3 inset-x-3 bg-[#060B15]/95 backdrop-blur-md p-3 rounded-xl border border-[#D4AF37]/35">
                  <span className="text-[11px] text-[#E6CA65] block mb-1 text-center font-medium">
                    زاویه چرخش سه‌بعدی را تغییر دهید
                  </span>
                  <input
                    type="range"
                    min="0"
                    max="360"
                    value={rotationAngle}
                    onChange={(e) => setRotationAngle(parseInt(e.target.value, 10))}
                    className="w-full h-1 bg-slate-700 rounded-lg accent-[#D4AF37]"
                  />
                </div>
              )}
            </div>

            {/* Thumbnails */}
            {images.length > 1 && (
              <div className="flex items-center gap-3 overflow-x-auto pb-2">
                {images.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setSelectedImageIndex(idx);
                      setIs360Mode(false);
                    }}
                    className={`relative w-16 h-16 rounded-xl overflow-hidden border-2 transition-all flex-shrink-0 ${
                      selectedImageIndex === idx
                        ? 'border-[#D4AF37] scale-105 shadow-[0_0_12px_rgba(212,175,55,0.45)]'
                        : 'border-[#D4AF37]/20 opacity-60 hover:opacity-100'
                    }`}
                  >
                    <img
                      src={img}
                      alt=""
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
                <span className="text-xs text-slate-300">{product.purity} (استاندارد ۷۵۰)</span>
              </div>

              <h1 className="text-2xl sm:text-3xl font-extrabold text-white mb-4">
                {product.title}
              </h1>

              {/* Live Gold Calculation Notice Banner */}
              <div className="bg-[#0A1224] border border-[#D4AF37]/30 rounded-2xl p-3.5 mb-6 flex items-center justify-between text-xs shadow-sm">
                <div className="flex items-center gap-2 text-slate-200">
                  <Sparkles className="w-4 h-4 text-[#D4AF37]" />
                  <span>قیمت این محصول با توجه به قیمت روز طلا محاسبه شده است.</span>
                </div>
                <span className="text-[#E6CA65] font-bold">
                  نرخ ۱۸ عیار: {formatToman(goldPrice.pricePerGram)}
                </span>
              </div>

              {/* Key Specs Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                <div className="bg-[#081224] border border-[#D4AF37]/20 p-3 rounded-xl text-center">
                  <span className="text-[11px] text-slate-400 block">وزن طلا</span>
                  <span className="text-sm font-bold text-white mt-1 block">
                    {formatWeight(product.weight, true)}
                  </span>
                </div>
                <div className="bg-[#081224] border border-[#D4AF37]/20 p-3 rounded-xl text-center">
                  <span className="text-[11px] text-slate-400 block">عیار قطعه</span>
                  <span className="text-sm font-bold text-white mt-1 block">{product.purity}</span>
                </div>
                <div className="bg-[#081224] border border-[#D4AF37]/20 p-3 rounded-xl text-center">
                  <span className="text-[11px] text-slate-400 block">درصد اجرت</span>
                  <span className="text-sm font-bold text-[#E6CA65] mt-1 block">
                    {priceBreakdown.effectiveMakingChargePercent}٪
                  </span>
                </div>
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
              <div className="mb-6">
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
              </div>
            </div>

            {/* Price & Action Section */}
            <div className="pt-4 border-t border-slate-700/80">
              <div className="flex items-baseline justify-between mb-4">
                <div>
                  <span className="text-xs text-slate-300 block">قیمت تمام‌شده روز:</span>
                  <div className="text-2xl sm:text-3xl font-extrabold text-white gold-gradient-text">
                    {formatToman(finalPrice * quantity)}
                  </div>
                </div>

                {/* Quantity adjust */}
                {product.availableStock !== undefined && product.availableStock <= 0 ? (
                  <span className="px-3 py-1.5 rounded-lg bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-semibold">
                    اتمام موجودی در انبار
                  </span>
                ) : (
                  <div className="flex items-center bg-[#13254A] border border-slate-600 rounded-xl px-2 py-1">
                    <button
                      type="button"
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      className="w-7 h-7 flex items-center justify-center text-slate-300 hover:text-white"
                    >
                      -
                    </button>
                    <span className="w-8 text-center text-sm font-bold text-white">
                      {toPersianDigits(quantity)}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const maxStock = product.availableStock ?? product.stock ?? 10;
                        if (quantity < maxStock) setQuantity(quantity + 1);
                      }}
                      className="w-7 h-7 flex items-center justify-center text-slate-300 hover:text-white disabled:opacity-30"
                      disabled={quantity >= (product.availableStock ?? product.stock ?? 10)}
                    >
                      +
                    </button>
                  </div>
                )}
              </div>

              {/* Action Buttons Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  onClick={handleAddToCart}
                  disabled={product.availableStock !== undefined && product.availableStock <= 0}
                  className="flex items-center justify-center gap-2 bg-gradient-to-r from-[#D4AF37] via-[#C5A059] to-[#AA822A] text-slate-950 font-bold py-3.5 rounded-xl hover:brightness-110 active:scale-98 transition-all shadow-[0_4px_20px_rgba(212,175,55,0.3)] text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ShoppingBag className="w-4 h-4" />
                  <span>
                    {product.availableStock !== undefined && product.availableStock <= 0
                      ? 'اتمام موجودی'
                      : 'افزودن به سبد خرید'}
                  </span>
                </button>

                <a
                  href={telegramUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-center gap-2 bg-[#13254A] hover:bg-[#1A3366] text-sky-400 border border-sky-500/40 font-semibold py-3.5 rounded-xl transition-all text-sm"
                >
                  <Send className="w-4 h-4" />
                  <span>سفارش و استعلام در تلگرام</span>
                </a>
              </div>

              {/* Channel & Favorite secondary row */}
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-700/80 text-xs">
                <a
                  href="https://t.me/Inana_gold"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 text-[#D4AF37] hover:underline transition-colors"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>عضویت در کانال تلگرام (Inana_gold@)</span>
                </a>

                <button
                  onClick={() => toggleFavorite(product.id)}
                  className={`flex items-center gap-1.5 transition-colors ${
                    favorite ? 'text-rose-400 font-semibold' : 'text-slate-300 hover:text-white'
                  }`}
                >
                  <Heart className={`w-3.5 h-3.5 ${favorite ? 'fill-current' : ''}`} />
                  <span>{favorite ? 'ذخیره شده در علاقه‌مندی‌ها' : 'افزودن به علاقه‌مندی'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
