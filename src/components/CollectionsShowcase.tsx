import React from 'react';
import { Sparkles, ArrowLeft } from 'lucide-react';
import { useGoldStore } from '../context/GoldStoreContext';

export const CollectionsShowcase: React.FC = () => {
  const { collections, setSelectedCollection, setActiveTab, setSelectedCategory } = useGoldStore();

  const handleCollectionSelect = (colName: string) => {
    setSelectedCollection(colName);
    setSelectedCategory(null);
    setActiveTab('shop');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <section
      id="collections-showcase-section"
      className="py-16 sm:py-24 px-3.5 sm:px-6 lg:px-8 bg-[#060B15] relative w-full max-w-full overflow-hidden"
      style={{
        background:
          'radial-gradient(ellipse at 50% 0%, rgba(18, 48, 98, 0.3) 0%, rgba(8, 15, 30, 0.7) 45%, #060B15 85%)',
      }}
    >
      {/* Subtle Top Gold Transition Line */}
      <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-[#D4AF37]/30 to-transparent pointer-events-none" />

      <div className="max-w-7xl mx-auto w-full min-w-0 relative z-10">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-12 sm:mb-16">
          <div className="inline-flex items-center gap-2 text-xs font-semibold text-[#E6CA65] uppercase tracking-widest mb-3 px-4 py-1.5 rounded-full bg-[#0B152B] border border-[#D4AF37]/35 shadow-sm">
            <Sparkles className="w-3.5 h-3.5 text-[#D4AF37]" />
            <span>کالکشن‌های اختصاصی اینانا</span>
          </div>

          <div className="flex items-center justify-center gap-3 mb-2">
            <span className="hidden sm:inline-block h-[1px] w-8 sm:w-12 bg-gradient-to-r from-transparent via-[#D4AF37]/50 to-transparent" />
            <h2 className="text-2xl sm:text-4xl font-extrabold gold-gradient-text tracking-wide">
              روایت‌هایی درخشان از هنر زرگری
            </h2>
            <span className="hidden sm:inline-block h-[1px] w-8 sm:w-12 bg-gradient-to-r from-transparent via-[#D4AF37]/50 to-transparent" />
          </div>

          <p className="text-slate-300 text-xs sm:text-sm mt-2 font-light leading-relaxed max-w-xl mx-auto">
            هر کالکشن تجسمی از هویت معماری باستانی، خطوط مدرن و خلوص طلای ۱۸ عیار استاندارد است.
          </p>
        </div>

        {/* Collections Editorial Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {collections.map((col) => (
            <div
              key={col.id}
              onClick={() => handleCollectionSelect(col.name)}
              className="group relative h-[420px] rounded-3xl overflow-hidden cursor-pointer border border-[#D4AF37]/25 hover:border-[#D4AF37]/60 transition-all duration-700 hover:-translate-y-2 hover:shadow-[0_20px_50px_rgba(0,0,0,0.75),0_0_30px_rgba(212,175,55,0.2)] bg-[#070E1E]"
            >
              {/* Cover Image */}
              <img
                src={col.coverImage}
                alt={col.name}
                className="w-full h-full object-cover object-center group-hover:scale-110 transition-transform duration-1000 ease-out"
                referrerPolicy="no-referrer"
              />

              {/* Luxury Gradient Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-[#060B15] via-[#060B15]/70 to-black/30 group-hover:opacity-90 transition-opacity" />

              {/* Tag Badge */}
              <div className="absolute top-4 right-4 z-10">
                <span className="px-3.5 py-1 rounded-full text-[10px] font-bold font-serif-brand tracking-widest uppercase bg-[#060C18]/90 backdrop-blur-md text-[#E6CA65] border border-[#D4AF37]/40 shadow-md">
                  {col.tag}
                </span>
              </div>

              {/* Content Box */}
              <div className="absolute bottom-0 inset-x-0 p-6 z-10 flex flex-col justify-end">
                <span className="text-xs font-serif-brand uppercase tracking-[0.2em] text-[#D4AF37] mb-1">
                  {col.name}
                </span>
                <h3 className="text-xl font-bold text-white mb-2 group-hover:text-[#F5E8C7] transition-colors">
                  {col.titleFa}
                </h3>
                <p className="text-xs text-slate-300 line-clamp-2 mb-4 font-light leading-relaxed">
                  {col.description}
                </p>

                <div className="flex items-center justify-between pt-3 border-t border-[#D4AF37]/20">
                  <span className="text-[11px] text-slate-300 italic">«{col.accentQuote}»</span>
                  <div className="flex items-center gap-1 text-xs font-bold text-[#D4AF37] group-hover:-translate-x-1.5 transition-transform">
                    <span>مشاهده</span>
                    <ArrowLeft className="w-3.5 h-3.5" />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
