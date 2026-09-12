import React, { useState } from 'react';
import { Calculator, Sparkles, HelpCircle, ArrowLeft, CheckCircle2, RotateCcw, Send } from 'lucide-react';
import { useGoldStore } from '../context/GoldStoreContext';
import { calculateCustomGoldQuotation } from '../utils/pricingEngine';
import { formatToman, toPersianDigits, formatWeight } from '../utils/persianFormatter';

export const GoldCalculator: React.FC = () => {
  const { goldPrice, settings, setActiveTab } = useGoldStore();

  // Inputs
  const [weightGrams, setWeightGrams] = useState<number>(2.5);
  const [makingChargePercent, setMakingChargePercent] = useState<number>(20);
  const [profitPercent, setProfitPercent] = useState<number>(settings.profitPercent ?? 7);
  const [taxPercent, setTaxPercent] = useState<number>(settings.taxPercent ?? 9);
  const [discountPercent, setDiscountPercent] = useState<number>(0);

  // Quick weight presets
  const weightPresets = [0.26, 0.5, 1.0, 2.5, 4.8, 8.5];

  const result = calculateCustomGoldQuotation(
    weightGrams,
    goldPrice.pricePerGram,
    makingChargePercent,
    profitPercent,
    taxPercent,
    discountPercent
  );

  const resetToDefaults = () => {
    setWeightGrams(2.5);
    setMakingChargePercent(20);
    setProfitPercent(settings.profitPercent ?? 7);
    setTaxPercent(settings.taxPercent ?? 9);
    setDiscountPercent(0);
  };

  return (
    <section
      id="gold-calculator-section"
      className="py-14 sm:py-20 px-3.5 sm:px-6 lg:px-8 bg-[#060B15] relative w-full max-w-full overflow-hidden"
      style={{
        background:
          'radial-gradient(ellipse at 50% 0%, rgba(18, 48, 98, 0.3) 0%, rgba(8, 15, 30, 0.7) 45%, #060B15 85%)',
      }}
    >
      {/* Background radial accent */}
      <div className="absolute top-1/4 left-1/4 w-[350px] sm:w-[550px] aspect-square bg-[#D4AF37]/5 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto w-full min-w-0">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-12">
          <div className="inline-flex items-center gap-2 text-xs font-semibold text-[#E6CA65] uppercase tracking-widest mb-2 px-3.5 py-1.5 rounded-full bg-[#0B152B] border border-[#D4AF37]/30 shadow-sm">
            <Calculator className="w-4 h-4 text-[#D4AF37]" />
            <span>سامانه هوشمند شفافیت قیمت</span>
          </div>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white">
            ماشین‌حساب آنلاین قیمت طلا
          </h2>
          <p className="text-slate-300 text-sm sm:text-base mt-2">
            محاسبه دقیق و لحظه‌ای ارزش انواع زیورآلات و طلای ۱۸ عیار با فرمول رسمی و مصوب اتحادیه
            طلا و جواهر ایران.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Inputs Column (7 Cols) */}
          <div className="lg:col-span-7 luxury-glass-card rounded-3xl p-6 sm:p-8">
            <div className="flex items-center justify-between pb-6 border-b border-[#D4AF37]/20 mb-6">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-[#D4AF37]" />
                <span className="font-bold text-white text-base">ورودی‌های محاسبه طلا</span>
              </div>
              <button
                onClick={resetToDefaults}
                className="flex items-center gap-1 text-xs text-slate-400 hover:text-[#D4AF37] transition-colors"
                title="بازنشانی به مقادیر اولیه"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>تنظیم مجدد</span>
              </button>
            </div>

            <div className="space-y-6">
              {/* Current Gold Price Live Indicator */}
              <div className="bg-[#0B152B] border border-[#D4AF37]/30 rounded-2xl p-4 flex items-center justify-between">
                <div>
                  <span className="text-xs text-slate-400 block">نرخ مبنای ۱۸ عیار (API):</span>
                  <span className="text-sm font-bold text-white">
                    {formatToman(goldPrice.pricePerGram)} / گرم
                  </span>
                </div>
                <span className="text-[11px] bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 px-2.5 py-1 rounded-full font-medium">
                  بروزرسانی زنده
                </span>
              </div>

              {/* 1. Weight Input */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-sm font-semibold text-slate-200 flex items-center gap-1.5">
                    <span>وزن طلا (گرم و سوت):</span>
                  </label>
                  <span className="text-sm font-bold text-[#E6CA65]">
                    {formatWeight(weightGrams, true)}
                  </span>
                </div>

                {/* Number input */}
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    min="0.05"
                    max="1000"
                    value={weightGrams || ''}
                    onChange={(e) => setWeightGrams(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="w-full bg-[#081224] border border-[#D4AF37]/25 focus:border-[#D4AF37] rounded-xl px-4 py-3 text-lg font-bold text-white outline-none transition-colors"
                  />
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-medium">
                    گرم
                  </span>
                </div>

                {/* Weight Preset Pills */}
                <div className="flex flex-wrap gap-2 mt-3">
                  <span className="text-xs text-slate-400 self-center">وزن‌های پرطرفدار:</span>
                  {weightPresets.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setWeightGrams(preset)}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                        weightGrams === preset
                          ? 'bg-gradient-to-r from-[#D4AF37] to-[#AA822A] text-slate-950 shadow-md font-bold'
                          : 'bg-[#0B152B] text-slate-300 hover:bg-[#112040] border border-[#D4AF37]/25'
                      }`}
                    >
                      {toPersianDigits(preset)} گرم
                    </button>
                  ))}
                </div>
              </div>

              {/* 2. Making Charge Slider (اجرت ساخت) */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-sm font-semibold text-slate-200">
                    اجرت ساخت طلا سازنده:
                  </label>
                  <span className="text-sm font-bold text-[#D4AF37]">
                    {toPersianDigits(makingChargePercent)}٪
                  </span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="35"
                  step="1"
                  value={makingChargePercent}
                  onChange={(e) => setMakingChargePercent(parseInt(e.target.value, 10))}
                  className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-[#D4AF37]"
                />
                <div className="flex justify-between text-[11px] text-slate-500 mt-1">
                  <span>ساده (۱۰٪)</span>
                  <span>متوسط (۲۰٪)</span>
                  <span>لوکس و لیزری (۳۰٪)</span>
                </div>
              </div>

              {/* 3. Profit & Tax Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Seller Profit */}
                <div className="bg-[#0B152B] p-4 rounded-2xl border border-[#D4AF37]/20">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs text-slate-300 font-medium">سود طلافروش:</span>
                    <span className="text-xs font-bold text-[#E6CA65]">
                      {toPersianDigits(profitPercent)}٪
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="15"
                    step="1"
                    value={profitPercent}
                    onChange={(e) => setProfitPercent(parseInt(e.target.value, 10))}
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-[#D4AF37]"
                  />
                  <span className="text-[10px] text-slate-400 block mt-1">
                    مصوب قانونی اتحادیه: ۷٪
                  </span>
                </div>

                {/* VAT Tax */}
                <div className="bg-[#0B152B] p-4 rounded-2xl border border-[#D4AF37]/20">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs text-slate-300 font-medium">مالیات ارزش افزوده:</span>
                    <span className="text-xs font-bold text-[#E6CA65]">
                      {toPersianDigits(taxPercent)}٪
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="15"
                    step="1"
                    value={taxPercent}
                    onChange={(e) => setTaxPercent(parseInt(e.target.value, 10))}
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-[#D4AF37]"
                  />
                  <span className="text-[10px] text-slate-400 block mt-1">
                    (اعمال بر اجرت + سود: ۹٪)
                  </span>
                </div>
              </div>

              {/* 4. Discount */}
              <div className="bg-[#0B152B] p-4 rounded-2xl border border-[#D4AF37]/20">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs text-slate-300 font-medium">درصد تخفیف ویژه:</span>
                  <span className="text-xs font-bold text-emerald-400">
                    {toPersianDigits(discountPercent)}٪
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="20"
                  step="1"
                  value={discountPercent}
                  onChange={(e) => setDiscountPercent(parseInt(e.target.value, 10))}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-400"
                />
              </div>
            </div>
          </div>

          {/* Results Breakdown Column (5 Cols) */}
          <div className="lg:col-span-5 luxury-glass-card rounded-3xl p-6 sm:p-8 relative border-[#D4AF37]/40 shadow-[0_15px_40px_rgba(212,175,55,0.1)]">
            <div className="flex items-center gap-2 pb-4 border-b border-[#D4AF37]/20 mb-6">
              <Sparkles className="w-5 h-5 text-[#D4AF37]" />
              <h3 className="font-bold text-white text-lg">ریز محاسبات قیمت تمام‌شده</h3>
            </div>

            {/* Line Items */}
            <div className="space-y-4 text-sm">
              <div className="flex justify-between items-center text-slate-300">
                <span className="text-xs">ارزش طلای خام:</span>
                <span className="font-semibold text-white">
                  {formatToman(result.baseGoldValue)}
                </span>
              </div>

              <div className="flex justify-between items-center text-slate-300">
                <span className="text-xs">مبلغ اجرت ساخت ({toPersianDigits(makingChargePercent)}٪):</span>
                <span className="font-semibold text-white">
                  {formatToman(result.makingChargeAmount)}
                </span>
              </div>

              <div className="flex justify-between items-center text-slate-300">
                <span className="text-xs">سود طلافروشی ({toPersianDigits(profitPercent)}٪):</span>
                <span className="font-semibold text-white">
                  {formatToman(result.profitAmount)}
                </span>
              </div>

              <div className="flex justify-between items-center text-slate-300">
                <span className="text-xs">مالیات بر ارزش افزوده ({toPersianDigits(taxPercent)}٪):</span>
                <span className="font-semibold text-white">
                  {formatToman(result.taxAmount)}
                </span>
              </div>

              {discountPercent > 0 && (
                <div className="flex justify-between items-center text-emerald-400 bg-emerald-500/10 p-2.5 rounded-xl border border-emerald-500/20">
                  <span className="text-xs">مبلغ تخفیف ({toPersianDigits(discountPercent)}٪):</span>
                  <span className="font-bold">- {formatToman(result.discountAmount)}</span>
                </div>
              )}
            </div>

            {/* Total Highlight Box */}
            <div className="mt-8 p-5 rounded-2xl bg-gradient-to-b from-[#0B152B] to-[#060B15] border border-[#D4AF37]/40 shadow-inner">
              <span className="text-xs text-[#E6CA65] block font-medium">مبلغ نهایی قابل پرداخت:</span>
              <div className="text-2xl sm:text-3xl font-extrabold text-white mt-1 gold-gradient-text">
                {formatToman(result.finalPrice)}
              </div>
              <span className="text-[11px] text-slate-400 mt-1 block">
                محاسبه شده بر مبنای وزن {formatWeight(weightGrams)}
              </span>
            </div>

            {/* CTAs */}
            <div className="mt-6 flex flex-col gap-3">
              <button
                onClick={() => {
                  setActiveTab('shop');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-[#D4AF37] via-[#C5A059] to-[#AA822A] text-slate-950 font-bold py-3.5 rounded-xl hover:brightness-110 active:scale-98 transition-all shadow-md text-sm cursor-pointer"
              >
                <span>مشاهده محصولات با این رده وزنی</span>
                <ArrowLeft className="w-4 h-4" />
              </button>

              <a
                href={`https://t.me/estella_shopee?text=${encodeURIComponent(
                  `با سلام. من درخواست ساخت سفارشی قطعه طلا با وزن ${weightGrams} گرم و اجرت ${makingChargePercent} درصد را دارم. قیمت محاسبه شده: ${formatToman(
                    result.finalPrice
                  )}`
                )}`}
                target="_blank"
                rel="noreferrer"
                className="w-full flex items-center justify-center gap-2 bg-[#0B152B] text-sky-400 hover:bg-[#112040] border border-sky-500/30 py-3 rounded-xl text-xs font-semibold transition-all"
              >
                <Send className="w-4 h-4" />
                <span>سفارش ساخت این قطعه در تلگرام (@estella_shopee)</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
