import React, { useState } from 'react';
import { Star, ChevronDown, ChevronUp, HelpCircle, Quote } from 'lucide-react';
import { TESTIMONIALS_DATA } from '../data/seedData';

interface TestimonialsFAQProps {
  compact?: boolean;
}

export const TestimonialsFAQ: React.FC<TestimonialsFAQProps> = ({ compact = false }) => {
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  const faqs = [
    {
      q: 'آیا قیمت محصولات بر روی سایت زنده و نهایی است؟',
      a: 'بله. سیستم قیمت‌گذاری اینانا به صورت لحظه‌ای به نرخ اتحادیه طلا متصل است. در لحظه ثبت سفارش، قیمت هر قطعه بر اساس آخرین نرخ هر گرم طلای ۱۸ عیار، اجرت ساخت و سود مشخص محاسبه و قفل می‌شود.',
    },
    {
      q: 'آیا فاکتور رسمی به همراه زیورآلات ارسال می‌گردد؟',
      a: 'بله، تمامی سفارش‌ها همراه با فاکتور رسمی ممهور با ذکر دقیق وزن (با دقت یک‌هزارم گرم/سوت)، عیار ۱۸ (۷۵۰)، اجرت و کد رهگیری پستی معتبر صادر و ارسال می‌شوند.',
    },
    {
      q: 'شرایط تعویض یا بازخرید طلا چگونه است؟',
      a: 'کلیه محصولات اینانا گلد شامل گارانتی اصالت مادام‌العمر و فاکتور رسمی هستند. با توجه به فعالیت ۱۰۰٪ آنلاین گالری، هماهنگی‌های بازخرید یا تعویض قطعات از طریق پشتیبانی تلگرام انجام شده و پس از اعتبارسنجی قطعه، تسویه آنلاین بر اساس نرخ لحظه‌ای انجام می‌شود.',
    },
    {
      q: 'آیا امکان ساخت سفارشی پلاک حروف یا اسامی وجود دارد؟',
      a: 'بله. شما می‌توانید از طریق بخش ماشین‌حساب طلا یا ارتباط مستقیم با کارشناسان اینانا در تلگرام (estella_shopee@)، طرح و وزن دلخواه خود را برای ساخت سفارشی اعلام فرمایید.',
    },
    {
      q: 'روش‌های ارسال و تحویل سفارش چگونه است؟',
      a: 'فروش اینانا کاملاً آنلاین بوده و هیچ‌گونه مراجعه حضوری نداریم. برای سراسر کشور و تهران، تمامی سفارش‌ها توسط پست پیشتاز ویژه یا پیک معتمد با بیمه کامل طلا و بسته‌بندی امن و محرمانه ارسال می‌گردند (تحویل ۲۴ الی ۴۸ ساعت).',
    },
  ];

  return (
    <section
      id="faq-testimonials-section"
      className="py-16 sm:py-24 px-3.5 sm:px-6 lg:px-8 bg-[#060B15] relative w-full max-w-full overflow-hidden"
      style={{
        background:
          'radial-gradient(ellipse at 50% 0%, rgba(18, 48, 98, 0.25) 0%, rgba(8, 15, 30, 0.6) 45%, #060B15 85%)',
      }}
    >
      {/* Subtle Top Gold Transition Line */}
      <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-[#D4AF37]/30 to-transparent pointer-events-none" />

      <div className="max-w-7xl mx-auto w-full min-w-0 relative z-10">
        {/* Testimonials */}
        <div className="mb-16 sm:mb-24">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <div className="inline-flex items-center gap-2 text-xs font-semibold text-[#E6CA65] uppercase tracking-widest mb-3 px-4 py-1.5 rounded-full bg-[#0B152B] border border-[#D4AF37]/35 shadow-sm">
              <Quote className="w-3.5 h-3.5 text-[#D4AF37]" />
              <span>نظرات همراهان اینانا</span>
            </div>

            <div className="flex items-center justify-center gap-3 mb-2">
              <span className="hidden sm:inline-block h-[1px] w-8 sm:w-12 bg-gradient-to-r from-transparent via-[#D4AF37]/50 to-transparent" />
              <h2 className="text-2xl sm:text-3xl font-extrabold gold-gradient-text tracking-wide">
                تجربه خرید مشتریان گرانقدر
              </h2>
              <span className="hidden sm:inline-block h-[1px] w-8 sm:w-12 bg-gradient-to-r from-transparent via-[#D4AF37]/50 to-transparent" />
            </div>
          </div>

          <div className={`grid grid-cols-1 gap-6 ${compact ? 'md:grid-cols-2 max-w-4xl mx-auto' : 'md:grid-cols-3'}`}>
            {TESTIMONIALS_DATA.slice(0, compact ? 2 : TESTIMONIALS_DATA.length).map((t) => (
              <div
                key={t.id}
                className="luxury-glass-card rounded-2xl p-6 relative flex flex-col justify-between border border-[#D4AF37]/25 hover:border-[#D4AF37]/55 transition-all duration-300"
              >
                <div>
                  <div className="flex items-center gap-1 text-[#D4AF37] mb-3">
                    {Array.from({ length: t.rating }).map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-current" />
                    ))}
                  </div>
                  <p className="text-xs sm:text-sm text-slate-200 font-light leading-relaxed mb-4">
                    «{t.comment}»
                  </p>
                </div>

                <div className="pt-3 border-t border-[#D4AF37]/20 flex items-center justify-between text-xs">
                  <div>
                    <strong className="text-white block">{t.name}</strong>
                    <span className="text-slate-400 text-[11px]">{t.city}</span>
                  </div>
                  <span className="text-[11px] text-[#E6CA65] bg-[#D4AF37]/15 px-2.5 py-0.5 rounded-md font-medium border border-[#D4AF37]/30">
                    {t.purchasedItem}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* FAQs */}
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 text-xs font-semibold text-[#E6CA65] uppercase tracking-widest mb-3 px-4 py-1.5 rounded-full bg-[#0B152B] border border-[#D4AF37]/35 shadow-sm">
              <HelpCircle className="w-3.5 h-3.5 text-[#D4AF37]" />
              <span>پاسخ به پرسش‌های شما</span>
            </div>

            <div className="flex items-center justify-center gap-3 mb-2">
              <span className="hidden sm:inline-block h-[1px] w-8 sm:w-12 bg-gradient-to-r from-transparent via-[#D4AF37]/50 to-transparent" />
              <h2 className="text-2xl sm:text-3xl font-extrabold gold-gradient-text tracking-wide">
                سوالات متداول درباره خرید و قیمت طلا
              </h2>
              <span className="hidden sm:inline-block h-[1px] w-8 sm:w-12 bg-gradient-to-r from-transparent via-[#D4AF37]/50 to-transparent" />
            </div>
          </div>

          <div className="space-y-3">
            {faqs.slice(0, compact ? 3 : faqs.length).map((faq, idx) => {
              const isOpen = openFaqIndex === idx;
              return (
                <div
                  key={idx}
                  className="rounded-2xl bg-[#081224]/90 border border-[#D4AF37]/25 overflow-hidden transition-all duration-300 shadow-sm hover:border-[#D4AF37]/50"
                >
                  <button
                    onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                    className="w-full p-4 sm:p-5 flex items-center justify-between text-right text-sm font-bold text-white hover:text-[#F5E8C7] transition-colors"
                  >
                    <span>{faq.q}</span>
                    {isOpen ? (
                      <ChevronUp className="w-4 h-4 text-[#D4AF37] flex-shrink-0" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-300 flex-shrink-0" />
                    )}
                  </button>

                  {isOpen && (
                    <div className="px-5 pb-5 pt-2 text-xs sm:text-sm text-slate-300 font-light leading-relaxed border-t border-[#D4AF37]/20">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
};
