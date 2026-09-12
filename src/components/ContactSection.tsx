import React from 'react';
import { MapPin, Phone, Clock, MessageCircle, Send, Instagram, ShieldCheck } from 'lucide-react';
import { InanaLogo } from './InanaLogo';

export const ContactSection: React.FC = () => {
  return (
    <section
      id="contact-section"
      className="py-16 sm:py-24 px-3.5 sm:px-6 lg:px-8 bg-[#060B15] relative w-full max-w-full overflow-hidden"
      style={{
        background:
          'radial-gradient(ellipse at 50% 0%, rgba(18, 48, 98, 0.25) 0%, rgba(8, 15, 30, 0.6) 45%, #060B15 85%)',
      }}
    >
      {/* Subtle Top Gold Transition Line */}
      <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-[#D4AF37]/30 to-transparent pointer-events-none" />

      <div className="max-w-7xl mx-auto w-full min-w-0 relative z-10">
        <div className="text-center max-w-2xl mx-auto mb-12 sm:mb-16">
          <div className="inline-flex items-center gap-2 text-xs font-semibold text-[#E6CA65] uppercase tracking-widest mb-3 px-4 py-1.5 rounded-full bg-[#0B152B] border border-[#D4AF37]/35 shadow-sm">
            <Phone className="w-3.5 h-3.5 text-[#D4AF37]" />
            <span>فروشگاه کاملاً آنلاین و پشتیبانی اختصاصی</span>
          </div>

          <div className="flex items-center justify-center gap-3 mb-2">
            <span className="hidden sm:inline-block h-[1px] w-8 sm:w-12 bg-gradient-to-r from-transparent via-[#D4AF37]/50 to-transparent" />
            <h2 className="text-2xl sm:text-3xl font-extrabold gold-gradient-text tracking-wide">
              ارتباط مستقیم و پشتیبانی خرید آنلاین
            </h2>
            <span className="hidden sm:inline-block h-[1px] w-8 sm:w-12 bg-gradient-to-r from-transparent via-[#D4AF37]/50 to-transparent" />
          </div>

          <p className="text-slate-300 text-xs sm:text-sm mt-2 font-light leading-relaxed max-w-lg mx-auto">
            فروشگاه اینانا گلد به صورت ۱۰۰٪ آنلاین فعالیت داشته و کلیه سفارش‌ها با بیمه کامل و بسته‌بندی امن به سراسر کشور ارسال می‌گردند.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Card 1: 100% Online Store & Insured Shipping */}
          <div className="luxury-glass-card rounded-2xl p-6 relative shadow-sm border border-[#D4AF37]/25 hover:border-[#D4AF37]/55 transition-all duration-300">
            <div className="w-10 h-10 rounded-xl bg-[#D4AF37]/15 border border-[#D4AF37]/30 flex items-center justify-center text-[#D4AF37] mb-4">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white mb-2">فروش انحصاری آنلاین با ضمانت کامل</h3>
            <p className="text-xs text-slate-300 font-light leading-relaxed mb-4">
              به منظور ارائه بهترین نرخ بدون هزینه‌های واسطه‌ای، فروش ما کاملاً آنلاین بوده و هیچ‌گونه شعبه یا مراجعه حضوری نداریم. تمامی محصولات دارای فاکتور رسمی معتبر و مهر گالری هستند.
            </p>
            <div className="space-y-1.5 text-xs text-slate-300 border-t border-[#D4AF37]/20 pt-3 font-light">
              <div className="flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-[#D4AF37]" />
                <span>ثبت سفارش آنلاین: ۲۴ ساعته در ۷ روز هفته</span>
              </div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-3.5 h-3.5 text-[#D4AF37]" />
                <span>ارسال پستی بیمه‌شده به سراسر ایران (۲۴ الی ۴۸ ساعت)</span>
              </div>
            </div>
          </div>

          {/* Card 2: Phone Hotline & Support hours */}
          <div className="luxury-glass-card rounded-2xl p-6 relative shadow-sm border border-[#D4AF37]/25 hover:border-[#D4AF37]/55 transition-all duration-300">
            <div className="w-10 h-10 rounded-xl bg-[#D4AF37]/15 border border-[#D4AF37]/30 flex items-center justify-center text-[#D4AF37] mb-4">
              <Phone className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white mb-2">مرکز تماس و مشاوره تلفنی</h3>
            <p className="text-xs text-slate-300 font-light leading-relaxed mb-4">
              برای استعلام آنی قیمت روز، راهنمایی در سایزبندی زیورآلات و پیگیری سفارش‌های ارسالی، کارشناسان ما آماده پاسخگویی هستند.
            </p>
            <div className="space-y-1.5 text-xs text-slate-300 border-t border-[#D4AF37]/20 pt-3 font-light">
              <div className="flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-[#D4AF37]" />
                <span>ساعات پاسخگویی تلفنی: ۱۰:۰۰ الی ۲۱:۰۰</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="w-3.5 h-3.5 text-[#D4AF37]" />
                <a href="tel:09909622895" className="hover:text-[#D4AF37] font-bold text-white transition-colors">
                  تلفن تماس: ۰۹۹۰۹۶۲۲۸۹۵
                </a>
              </div>
            </div>
          </div>

          {/* Card 3: VIP Telegram Support & Official Channel */}
          <div className="luxury-glass-card rounded-2xl p-6 relative border-[#D4AF37]/35 hover:border-[#D4AF37]/65 flex flex-col justify-between shadow-sm transition-all duration-300">
            <div>
              <div className="w-10 h-10 rounded-xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-400 mb-4">
                <Send className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white mb-2">پشتیبانی تلگرام و کانال رسمی</h3>
              <p className="text-xs text-slate-300 font-light leading-relaxed mb-4">
                کارشناسان ما در تلگرام آماده پاسخگویی سریع، ارسال تصاویر و ویدیوهای ژورنالی از زوایای مختلف کارها و ثبت سفارش ساخت سفارشی هستند.
              </p>
            </div>

            <div className="space-y-2 pt-3 border-t border-[#D4AF37]/20">
              <a
                href="https://t.me/estella_shopee"
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-2 bg-[#0B152B] hover:bg-[#112040] text-sky-300 border border-sky-500/40 py-2.5 rounded-xl text-xs font-semibold transition-all shadow-sm"
              >
                <Send className="w-4 h-4" />
                <span>ارتباط با پشتیبانی: estella_shopee@</span>
              </a>

              <a
                href="https://t.me/Inana_gold"
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-2 bg-[#050B17] hover:bg-[#0B152B] text-[#E6CA65] border border-[#D4AF37]/35 py-2.5 rounded-xl text-xs font-semibold transition-all shadow-sm"
              >
                <Send className="w-4 h-4" />
                <span>عضویت در کانال تلگرام: Inana_gold@</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
