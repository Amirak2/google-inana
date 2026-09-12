import React from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { ArrowLeft, Sparkles } from 'lucide-react';
import { useGoldStore } from '../context/GoldStoreContext';
import { DynamicBackgroundMotion } from './DynamicBackgroundMotion';

export const HeroSection: React.FC = () => {
  const { setActiveTab } = useGoldStore();
  const shouldReduceMotion = useReducedMotion();

  // Entrance transition helpers respecting prefers-reduced-motion
  const auraTransition = shouldReduceMotion
    ? { duration: 0 }
    : { duration: 0.6, ease: [0.16, 1, 0.3, 1] as const };

  const logoTransition = shouldReduceMotion
    ? { duration: 0 }
    : { duration: 0.6, delay: 0.3, ease: [0.16, 1, 0.3, 1] as const };

  const titleTransition = shouldReduceMotion
    ? { duration: 0 }
    : { duration: 0.5, delay: 0.7, ease: [0.16, 1, 0.3, 1] as const };

  const buttonTransition = shouldReduceMotion
    ? { duration: 0 }
    : { duration: 0.45, delay: 1.05, ease: [0.16, 1, 0.3, 1] as const };

  return (
    <section
      id="inana-luxury-hero"
      className="relative w-full h-[100svh] min-h-[100svh] max-h-[1100px] flex flex-col items-center justify-center px-4 sm:px-6 overflow-hidden bg-[#060B15] select-none"
      style={{
        background:
          'radial-gradient(circle at 50% 50%, rgba(18, 48, 98, 0.55) 0%, rgba(12, 28, 58, 0.4) 38%, rgba(7, 13, 24, 0.95) 75%, #050A14 100%)',
      }}
    >
      {/* Background Micro-Particles (Few, Fine, Excluded from Logo Zone) */}
      <DynamicBackgroundMotion variant="hero-sacred" />

      {/* Main Centered Stage: Exactly Centered in Viewport */}
      <div className="relative z-10 w-full max-w-xl mx-auto flex flex-col items-center justify-center text-center my-auto pt-10 sm:pt-14 pb-6">
        {/* Stage 1: Central Soft Luminous Blue-Gold Aura */}
        <motion.div
          initial={shouldReduceMotion ? { opacity: 0.85, scale: 1 } : { opacity: 0, scale: 0.85 }}
          animate={{ opacity: 0.85, scale: 1 }}
          transition={auraTransition}
          className="absolute pointer-events-none -z-10 w-[280px] h-[280px] sm:w-[360px] sm:h-[360px] rounded-full"
          style={{
            background:
              'radial-gradient(circle, rgba(212,175,55,0.18) 0%, rgba(20,55,115,0.35) 45%, transparent 72%)',
            filter: 'blur(32px)',
          }}
        />

        {/* Stage 2: Rotating Geometric Rings & Sacred Logo */}
        <motion.div
          initial={shouldReduceMotion ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={logoTransition}
          className="relative flex items-center justify-center mb-5 sm:mb-6"
        >
          {/* Two Faint Sacred Geometric Rings Rotating Slowly Behind the Logo */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none -z-10">
            {/* Outer Ring: Very faint, 260px desktop / 210px mobile, 75s clockwise slow spin */}
            <div className="absolute w-[210px] h-[210px] sm:w-[260px] sm:h-[260px] animate-slow-spin-cw">
              <svg viewBox="0 0 260 260" className="w-full h-full">
                <circle
                  cx="130"
                  cy="130"
                  r="122"
                  fill="none"
                  stroke="#D4AF37"
                  strokeOpacity="0.16"
                  strokeWidth="1"
                  strokeDasharray="4 6"
                />
                <circle
                  cx="130"
                  cy="130"
                  r="126"
                  fill="none"
                  stroke="#D4AF37"
                  strokeOpacity="0.08"
                  strokeWidth="0.5"
                />
                {/* 8 Cardinal and Intercardinal Celestial Dots */}
                {[
                  [252, 130],
                  [216.3, 216.3],
                  [130, 252],
                  [43.7, 216.3],
                  [8, 130],
                  [43.7, 43.7],
                  [130, 8],
                  [216.3, 43.7],
                ].map(([cx, cy], idx) => (
                  <circle
                    key={idx}
                    cx={cx}
                    cy={cy}
                    r="1.4"
                    fill="#D4AF37"
                    fillOpacity="0.25"
                  />
                ))}
              </svg>
            </div>

            {/* Inner Ring: Very faint, 210px desktop / 172px mobile, 90s counter-clockwise slow spin */}
            <div className="absolute w-[172px] h-[172px] sm:w-[210px] sm:h-[210px] animate-slow-spin-ccw">
              <svg viewBox="0 0 210 210" className="w-full h-full">
                <circle
                  cx="105"
                  cy="105"
                  r="98"
                  fill="none"
                  stroke="#D4AF37"
                  strokeOpacity="0.12"
                  strokeWidth="0.8"
                />
                {/* Inscribed rotated geometric square (45 degrees) */}
                <rect
                  x="37"
                  y="37"
                  width="136"
                  height="136"
                  fill="none"
                  stroke="#D4AF37"
                  strokeOpacity="0.07"
                  strokeWidth="0.6"
                  transform="rotate(45 105 105)"
                />
              </svg>
            </div>
          </div>

          {/* Central Logo with Gentle Breathing Motion (Max 2.5% scale change) */}
          <div className="relative group cursor-pointer transition-transform duration-300">
            {/* The breathing wrapper (max 2-3% scale change) */}
            <div className="animate-gentle-breathe flex items-center justify-center">
              {/* Logo Container: 136px on mobile, 168px on desktop */}
              <div
                className="relative w-[136px] h-[136px] sm:w-[168px] sm:h-[168px] rounded-full flex items-center justify-center aspect-square"
                onClick={() => {
                  setActiveTab('collections');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
              >
                {/* Logo Image */}
                <img
                  src="/inana-logo-gold.png"
                  alt="گالری طلای اینانا - INANA GOLD"
                  className="w-full h-full object-contain pointer-events-none select-none drop-shadow-[0_0_16px_rgba(212,175,55,0.45)] drop-shadow-[0_0_4px_rgba(255,244,184,0.6)]"
                  loading="eager"
                />

                {/* Thin Golden Light Sheen sweeping across the logo every 7s */}
                <div className="absolute inset-0 rounded-full overflow-hidden pointer-events-none z-10">
                  <div
                    className="absolute -top-[35%] -left-[35%] w-[170%] h-[170%] pointer-events-none animate-golden-sheen"
                    style={{
                      background:
                        'linear-gradient(105deg, transparent 40%, rgba(255,248,210,0.12) 46%, rgba(255,245,180,0.85) 50%, rgba(212,175,55,0.95) 52%, rgba(255,248,210,0.18) 56%, transparent 62%)',
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Stage 3: Brand Name & Subtitle */}
        <motion.div
          initial={shouldReduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={titleTransition}
          className="flex flex-col items-center justify-center mb-6 sm:mb-7"
        >
          <h1 className="font-serif-brand font-extrabold text-2xl sm:text-3xl md:text-[32px] gold-gradient-text uppercase tracking-[0.24em] sm:tracking-[0.28em] leading-none select-none">
            INANA GOLD
          </h1>

          <div className="flex items-center gap-2 mt-2.5 opacity-90">
            <span className="h-[1px] w-6 sm:w-10 bg-gradient-to-r from-transparent via-[#D4AF37]/70 to-transparent" />
            <p className="text-xs sm:text-sm text-[#F5E8C7] font-medium tracking-wider whitespace-nowrap">
              گالری اینانا برای زنان توانا
            </p>
            <span className="h-[1px] w-6 sm:w-10 bg-gradient-to-r from-transparent via-[#D4AF37]/70 to-transparent" />
          </div>
        </motion.div>

        {/* Stage 4: Single Primary CTA Button (Strictly Only «مشاهده مجموعه‌ها») */}
        <motion.div
          initial={shouldReduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={buttonTransition}
          className="flex items-center justify-center w-full"
        >
          <button
            id="hero-cta-collections"
            onClick={() => {
              setActiveTab('collections');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="group relative inline-flex items-center justify-center gap-2.5 px-8 py-3.5 sm:px-9 sm:py-4 rounded-full bg-gradient-to-r from-[#D4AF37] via-[#C5A059] to-[#B38A30] text-slate-950 font-bold text-sm sm:text-base shadow-[0_4px_25px_rgba(212,175,55,0.3)] hover:shadow-[0_6px_35px_rgba(212,175,55,0.48)] hover:brightness-105 active:scale-98 transition-all cursor-pointer"
          >
            <span>مشاهده مجموعه‌ها</span>
            <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
          </button>
        </motion.div>
      </div>

      {/* Subtle Scroll Down Indicator at the very bottom */}
      <div className="absolute bottom-4 sm:bottom-6 z-10 opacity-50 hover:opacity-100 transition-opacity">
        <button
          onClick={() => {
            window.scrollBy({ top: window.innerHeight * 0.85, behavior: 'smooth' });
          }}
          className="flex flex-col items-center gap-1 text-[11px] text-[#D4AF37] tracking-wider cursor-pointer"
          aria-label="ورود به گالری"
        >
          <span className="text-[10px] tracking-widest opacity-80">ورود به گالری</span>
          <span className="w-1.5 h-1.5 border-b border-r border-[#D4AF37] rotate-45 animate-pulse" />
        </button>
      </div>
    </section>
  );
};
