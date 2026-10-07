import React from 'react';
import { InanaLogo } from './InanaLogo';
import { useGoldStore } from '../context/GoldStoreContext';
import { useAuth } from '../context/AuthContext';
import {
  Instagram,
  Send,
  Phone,
  ShieldCheck,
  ArrowUp,
} from 'lucide-react';
import { CATEGORIES_LIST } from '../data/seedData';

export const Footer: React.FC = () => {
  const { setActiveTab, openCatalog } = useGoldStore();
  const { isAdmin } = useAuth();

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCategoryClick = (cat: string) => {
    openCatalog({ selectedCategory: cat });
    scrollToTop();
  };

  const handleCollectionClick = (col: string) => {
    openCatalog({ selectedCollection: col });
    scrollToTop();
  };

  return (
    <footer id="main-footer" className="bg-[#040810] border-t border-[#D4AF37]/30 pt-12 sm:pt-16 pb-24 md:pb-12 text-slate-300 text-xs w-full max-w-full overflow-hidden relative">
      {/* Top subtle highlight */}
      <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-[#D4AF37]/40 to-transparent pointer-events-none" />

      <div className="max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8 w-full min-w-0 relative z-10">
        {/* Top 4-Column Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-10 pb-12 border-b border-[#D4AF37]/20">
          {/* Brand & Identity (4 Cols) */}
          <div className="lg:col-span-4 flex flex-col items-start">
            <div className="cursor-pointer mb-4" onClick={scrollToTop}>
              <InanaLogo size="md" variant="gold" showText={true} />
            </div>
            <p className="text-slate-300 text-xs font-light leading-relaxed mb-6 max-w-sm">
              اینانا گلد؛ پیشگام در طراحی زیورآلات طلای ۱۸ عیار با الهام از معماری کهن و زیبایی‌شناسی
              مدرن. محاسبه لحظه‌ای، شفافیت تمام‌عیار و ضمانت اصالت.
            </p>

            <div className="flex items-center gap-3">
              <a
                href="https://instagram.com/inanagold"
                target="_blank"
                rel="noreferrer"
                className="w-9 h-9 rounded-xl bg-[#0B152B] border border-[#D4AF37]/25 hover:border-[#D4AF37]/60 text-slate-300 hover:text-[#E6CA65] flex items-center justify-center transition-all shadow-sm"
                title="اینستاگرام اینانا گلد"
              >
                <Instagram className="w-4 h-4" />
              </a>
              <a
                href="https://t.me/Inana_gold"
                target="_blank"
                rel="noreferrer"
                className="w-9 h-9 rounded-xl bg-[#0B152B] border border-[#D4AF37]/25 hover:border-[#D4AF37]/60 text-slate-300 hover:text-[#E6CA65] flex items-center justify-center transition-all shadow-sm"
                title="کانال تلگرام اینانا"
              >
                <Send className="w-4 h-4" />
              </a>
              <a
                href="tel:09909622895"
                className="w-9 h-9 rounded-xl bg-[#0B152B] border border-[#D4AF37]/25 hover:border-[#D4AF37]/60 text-slate-300 hover:text-[#E6CA65] flex items-center justify-center transition-all shadow-sm"
                title="تماس مستقیم: ۰۹۹۰۹۶۲۲۸۹۵"
              >
                <Phone className="w-4 h-4" />
              </a>
            </div>
          </div>

          {/* Categories Links (2 Cols) */}
          <div className="lg:col-span-3">
            <h4 className="text-sm font-bold text-white mb-4">دسته‌بندی زیورآلات</h4>
            <ul className="space-y-2.5">
              {CATEGORIES_LIST.slice(0, 6).map((cat) => (
                <li key={cat}>
                  <button
                    onClick={() => handleCategoryClick(cat)}
                    className="hover:text-[#F5E8C7] transition-colors"
                  >
                    {cat}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Quick Access (2 Cols) */}
          <div className="lg:col-span-2">
            <h4 className="text-sm font-bold text-white mb-4">دسترسی سریع</h4>
            <ul className="space-y-2.5">
              <li>
                <button
                  onClick={() => {
                    setActiveTab('gold-price');
                    scrollToTop();
                  }}
                  className="hover:text-[#F5E8C7] transition-colors"
                >
                  نرخ لحظه‌ای طلای ۱۸ عیار
                </button>
              </li>
              <li>
                <button
                  onClick={() => {
                    openCatalog();
                    scrollToTop();
                  }}
                  className="hover:text-[#F5E8C7] transition-colors"
                >
                  ویترین و زیورآلات طلا
                </button>
              </li>
              <li>
                <button
                  onClick={() => {
                    setActiveTab('collections');
                    scrollToTop();
                  }}
                  className="hover:text-[#F5E8C7] transition-colors"
                >
                  کالکشن‌های اختصاصی
                </button>
              </li>
              <li>
                <button
                  onClick={() => {
                    setActiveTab('about');
                    scrollToTop();
                  }}
                  className="hover:text-[#F5E8C7] transition-colors"
                >
                  درباره برند و آتلیه
                </button>
              </li>
              {isAdmin && (
                <li>
                  <button
                    onClick={() => {
                      setActiveTab('admin');
                      scrollToTop();
                    }}
                    className="text-[#D4AF37] hover:underline font-medium"
                  >
                    پنل مدیریت
                  </button>
                </li>
              )}
            </ul>
          </div>

          {/* Trust Badges & Guarantee (3 Cols) */}
          <div className="lg:col-span-3">
            <h4 className="text-sm font-bold text-white mb-4">مجوزها و اصالت</h4>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-[#070E1E] border border-[#D4AF37]/25 rounded-xl p-3 text-center flex flex-col items-center justify-center shadow-sm">
                <ShieldCheck className="w-6 h-6 text-[#D4AF37] mb-1" />
                <span className="text-[10px] text-slate-200 font-semibold block">
                  عضو اتحادیه طلا
                </span>
                <span className="text-[9px] text-slate-300 font-mono">مجوز ۱۱۰۱/۱۲۵۰۹</span>
              </div>

              <a
                referrerPolicy="origin"
                target="_blank"
                rel="noopener"
                href="https://trustseal.enamad.ir/?id=8085844&Code=rtBl30Q7yemmFt2Bpy6J6zqv6VnhfhI9"
                className="bg-white border border-[#D4AF37]/25 rounded-xl p-3 text-center flex flex-col items-center justify-center shadow-sm cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D4AF37]"
                aria-label="مشاهده اعتبار نماد اعتماد الکترونیکی اینانا گلد"
              >
                <img
                  referrerPolicy="origin"
                  src="https://trustseal.enamad.ir/logo.aspx?id=8085844&Code=rtBl30Q7yemmFt2Bpy6J6zqv6VnhfhI9"
                  alt="نماد اعتماد الکترونیکی اینانا گلد"
                  className="w-24 h-28 max-w-full object-contain cursor-pointer"
                  {...{ code: 'rtBl30Q7yemmFt2Bpy6J6zqv6VnhfhI9' }}
                />
                <span className="text-[10px] text-slate-700 font-semibold mt-1">
                  مشاهده اعتبار اینماد
                </span>
              </a>
            </div>

            <p className="text-[11px] text-slate-300 font-light">
              تمامی قیمت‌ها شامل فرمول مصوب اتحادیه بوده و تحت نظارت رسمی ارائه می‌گردند.
            </p>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-slate-400">
          <div>
            © {new Date().getFullYear()} گالری طلا و جواهر اینانا (INANA GOLD). تمامی حقوق محفوظ است.
          </div>

          <button
            onClick={scrollToTop}
            className="flex items-center gap-1 text-slate-300 hover:text-[#E6CA65] transition-colors"
          >
            <span>بازگشت به بالای صفحه</span>
            <ArrowUp className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </footer>
  );
};
