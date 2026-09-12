import React from 'react';
import { Sparkles, ShieldCheck, Gem, Compass, Award } from 'lucide-react';
import { InanaLogo } from './InanaLogo';

export const InanaStory: React.FC = () => {
  const pillars = [
    {
      icon: Gem,
      title: 'خلوص استاندارد طلای ۱۸ عیار',
      description:
        'کلیه دست‌سازه‌های اینانا دارای کد شناسایی رسمی اتحادیه طلا و جواهر (۷۵۰) بوده و با بالاترین خلوص شمش عرضه می‌گردند.',
    },
    {
      icon: Compass,
      title: 'معماری و هندسه مقدس',
      description:
        'الهام‌گرفته از خطوط پله‌ای زیگورات‌های کهن، تناسبات طلایی و هارمونی مینیمالیسم مدرن برای خلق قطعاتی با هویت ماندگار.',
    },
    {
      icon: Sparkles,
      title: 'تراش لیزری و پرداخت دست‌ساز',
      description:
        'تلفیق فناوری تراش میکرونی سوئیسی با ظرافت دست استادکاران زرگر در آتلیه طراحی اختصاصی اینانا در تهران.',
    },
    {
      icon: ShieldCheck,
      title: 'فاکتور رسمی و ضمانت بازخرید',
      description:
        'ارائه فاکتور رسمی معتبر کشوری و قابلیت بازخرید یا تعویض کلیه زیورآلات بر مبنای نرخ لحظه‌ای طلا.',
    },
  ];

  return (
    <section
      id="inana-story-section"
      className="py-16 sm:py-24 px-3.5 sm:px-6 lg:px-8 bg-[#060B15] relative w-full max-w-full overflow-hidden"
      style={{
        background:
          'radial-gradient(ellipse at 50% 0%, rgba(18, 48, 98, 0.28) 0%, rgba(8, 15, 30, 0.65) 45%, #060B15 85%)',
      }}
    >
      {/* Subtle Top Gold Transition Line */}
      <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-[#D4AF37]/30 to-transparent pointer-events-none" />

      {/* Background Subtle Logo Architecture */}
      <div className="absolute -left-20 top-1/2 -translate-y-1/2 opacity-10 pointer-events-none w-[300px] sm:w-[600px] aspect-square">
        <InanaLogo size="lg" variant="gold" showText={false} />
      </div>

      <div className="max-w-7xl mx-auto relative z-10 w-full min-w-0">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          {/* Visual Showcase (5 Cols) */}
          <div className="lg:col-span-5 relative">
            <div className="relative aspect-[4/5] rounded-3xl overflow-hidden border border-[#D4AF37]/35 shadow-[0_20px_60px_rgba(0,0,0,0.75)] group">
              <img
                src="https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?auto=format&fit=crop&w=1000&q=85"
                alt="INANA GOLD Atelier"
                className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-1000"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#060B15] via-transparent to-transparent opacity-80" />

              {/* Floating Story Quote */}
              <div className="absolute bottom-6 inset-x-6 bg-[#060C18]/90 backdrop-blur-md p-5 rounded-2xl border border-[#D4AF37]/35 shadow-md">
                <span className="font-serif-brand text-xs text-[#D4AF37] tracking-widest uppercase block mb-1">
                  INANA PHILOSOPHY
                </span>
                <p className="text-xs sm:text-sm text-slate-200 font-light leading-relaxed">
                  «ما طلا را صرفاً یک فلز گرانبها نمی‌دانیم؛ بلکه آن را اثری معماری برای بازتاب هویت
                  و ظرافت جاودانه شما می‌سازیم.»
                </p>
              </div>
            </div>
          </div>

          {/* Editorial Text & Brand Pillars (7 Cols) */}
          <div className="lg:col-span-7 flex flex-col justify-center">
            <div className="inline-flex items-center gap-2 text-xs font-semibold text-[#E6CA65] uppercase tracking-widest mb-3 px-3.5 py-1.5 rounded-full bg-[#0B152B] border border-[#D4AF37]/35 shadow-sm w-fit">
              <Award className="w-3.5 h-3.5 text-[#D4AF37]" />
              <span>اصالت، هنر و ماندگاری</span>
            </div>

            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white leading-tight mb-6">
              داستان خلق زیبایی در <span className="gold-gradient-text">اینانا گلد</span>
            </h2>

            <p className="text-sm sm:text-base text-slate-300 font-light leading-relaxed mb-10">
              برند اینانا گلد با الهام از تمدن‌های باستانی و تلفیق آن با طراحی مینیمال معاصر متولد
              شد. نشان هندسی اینانا نمادی از پله‌های صعود، تقارن بی‌پایان و ماندگاری خورشید طلایی
              است. در دنیایی که مدها به سرعت رنگ می‌بازند، آثار اینانا برای نسل‌ها درخشندگی خود را
              حفظ می‌کنند.
            </p>

            {/* 4 Brand Pillars Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {pillars.map((p, idx) => {
                const Icon = p.icon;
                return (
                  <div
                    key={idx}
                    className="p-5 rounded-2xl bg-[#081224]/85 border border-[#D4AF37]/25 hover:border-[#D4AF37]/55 transition-all duration-300 group shadow-sm hover:shadow-[0_10px_30px_rgba(212,175,55,0.12)]"
                  >
                    <div className="w-10 h-10 rounded-xl bg-[#D4AF37]/15 border border-[#D4AF37]/30 flex items-center justify-center text-[#D4AF37] mb-3 group-hover:scale-110 transition-transform">
                      <Icon className="w-5 h-5" />
                    </div>
                    <h3 className="text-sm font-bold text-white mb-1.5">{p.title}</h3>
                    <p className="text-xs text-slate-300 font-light leading-relaxed">
                      {p.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
