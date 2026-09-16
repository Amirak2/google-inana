import React from 'react';
import { Clock, Phone, Send } from 'lucide-react';

export const ContactSection: React.FC = () => (
  <section id="contact-section" className="relative w-full overflow-hidden bg-[#060B15] px-3.5 py-14 sm:px-6 sm:py-20 lg:px-8">
    <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#D4AF37]/30 to-transparent" />
    <div className="relative z-10 mx-auto w-full max-w-4xl">
      <div className="mx-auto mb-9 max-w-xl text-center">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#D4AF37]/35 bg-[#0B152B] px-4 py-1.5 text-xs font-semibold text-[#E6CA65]">
          <Phone className="h-3.5 w-3.5" /><span>ارتباط با اینانا گلد</span>
        </div>
        <h2 className="text-2xl font-extrabold gold-gradient-text sm:text-3xl">پشتیبانی خرید</h2>
        <p className="mt-2 text-xs leading-relaxed text-slate-300 sm:text-sm">برای مشاوره، پیگیری سفارش و دریافت تصاویر محصول با ما در تماس باشید.</p>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <div className="luxury-glass-card rounded-2xl border border-[#D4AF37]/25 p-6 transition-colors hover:border-[#D4AF37]/55">
          <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl border border-[#D4AF37]/30 bg-[#D4AF37]/15 text-[#D4AF37]"><Phone className="h-5 w-5" /></div>
          <h3 className="mb-3 text-base font-bold text-white">تماس تلفنی</h3>
          <a href="tel:09909622895" className="text-lg font-bold text-[#E6CA65] hover:text-white">۰۹۹۰۹۶۲۲۸۹۵</a>
          <div className="mt-3 flex items-center gap-2 border-t border-[#D4AF37]/20 pt-3 text-xs text-slate-300"><Clock className="h-3.5 w-3.5 text-[#D4AF37]" /><span>پاسخگویی هر روز از ساعت ۱۰ تا ۲۱</span></div>
        </div>

        <div className="luxury-glass-card rounded-2xl border border-[#D4AF37]/25 p-6 transition-colors hover:border-[#D4AF37]/55">
          <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl border border-sky-500/30 bg-sky-500/15 text-sky-400"><Send className="h-5 w-5" /></div>
          <h3 className="mb-3 text-base font-bold text-white">تلگرام</h3>
          <div className="flex flex-col gap-2">
            <a href="https://t.me/estella_shopee" target="_blank" rel="noreferrer" className="rounded-xl border border-sky-500/40 bg-[#0B152B] px-4 py-2.5 text-center text-xs font-semibold text-sky-300 hover:bg-[#112040]">گفت‌وگو با پشتیبانی</a>
            <a href="https://t.me/Inana_gold" target="_blank" rel="noreferrer" className="text-center text-xs text-[#E6CA65] hover:text-white">مشاهده کانال رسمی اینانا گلد</a>
          </div>
        </div>
      </div>
    </div>
  </section>
);
