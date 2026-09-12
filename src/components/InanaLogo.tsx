import React from 'react';

export interface InanaLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | 'custom';
  variant?: 'gold' | 'pure-gold-glow' | 'white' | 'dark' | 'ivory';
  showText?: boolean;
  textPosition?: 'bottom' | 'right';
  className?: string;
  customWidth?: number | string;
  customHeight?: number | string;
  subtitle?: string;
}

export const InanaLogo: React.FC<InanaLogoProps> = ({
  size = 'md',
  variant = 'pure-gold-glow',
  showText = false,
  textPosition = 'right',
  className = '',
  customWidth,
  customHeight,
  subtitle = 'گالری اینانا برای زنان توانا',
}) => {
  const sizeMap = {
    sm: { icon: 'w-7 h-7', text: 'text-[11px] tracking-[0.18em]', subtext: 'text-[8px]', gap: 'gap-1.5', lineW: 'w-2' },
    md: { icon: 'w-9 h-9 sm:w-10 sm:h-10', text: 'text-xs tracking-[0.2em]', subtext: 'text-[8.5px]', gap: 'gap-2', lineW: 'w-2.5' },
    lg: { icon: 'w-14 h-14 sm:w-16 sm:h-16', text: 'text-base sm:text-lg tracking-[0.22em]', subtext: 'text-[10px]', gap: 'gap-2.5', lineW: 'w-4' },
    xl: { icon: 'w-20 h-20 sm:w-24 sm:h-24', text: 'text-xl sm:text-2xl tracking-[0.25em]', subtext: 'text-xs', gap: 'gap-3', lineW: 'w-5' },
    '2xl': { icon: 'w-32 h-32 sm:w-40 sm:h-40 md:w-44 md:h-44', text: 'text-2xl sm:text-3xl tracking-[0.28em] font-extrabold', subtext: 'text-xs sm:text-sm', gap: 'gap-3.5', lineW: 'w-8 sm:w-10' },
    '3xl': { icon: 'w-40 h-40 sm:w-48 sm:h-48 md:w-56 md:h-56', text: 'text-3xl sm:text-4xl tracking-[0.3em] font-extrabold', subtext: 'text-sm sm:text-base', gap: 'gap-4', lineW: 'w-10 sm:w-12' },
    custom: { icon: '', text: 'text-xs tracking-[0.2em]', subtext: 'text-[9.5px]', gap: 'gap-1.5', lineW: 'w-3' },
  };

  const isPureGlow = variant === 'pure-gold-glow';

  return (
    <div
      className={`inline-flex items-center justify-center select-none ${
        textPosition === 'bottom' ? 'flex-col' : 'flex-row'
      } ${sizeMap[size].gap} ${className}`}
    >
      {/* Logo Graphic Container - Pure transparent circular visual */}
      <div
        className={`relative flex items-center justify-center ${
          size !== 'custom' ? sizeMap[size].icon : ''
        } aspect-square`}
        style={{
          width: customWidth,
          height: customHeight,
        }}
      >
        <img
          src="/inana-logo-gold.png"
          alt="لوگوی گالری طلای اینانا - INANA GOLD"
          className="w-full h-full object-contain pointer-events-none transition-all duration-300"
          style={{
            filter: isPureGlow
              ? 'drop-shadow(0 0 14px rgba(212,175,55,0.5)) drop-shadow(0 0 3px rgba(255,244,184,0.65))'
              : 'drop-shadow(0 2px 6px rgba(212,175,55,0.3))',
          }}
          loading="eager"
        />
      </div>

      {/* Brand Typography */}
      {showText && (
        <div
          className={`flex flex-col ${
            textPosition === 'bottom' ? 'items-center text-center mt-3' : 'items-start text-right'
          }`}
        >
          <div className="flex items-center gap-2">
            <span
              className={`font-serif-brand font-extrabold ${sizeMap[size].text} gold-gradient-text uppercase tracking-widest leading-none`}
            >
              INANA GOLD
            </span>
          </div>
          <div className="flex items-center gap-1.5 mt-2 opacity-90">
            <span
              className={`h-[1px] bg-gradient-to-r from-transparent via-[#D4AF37] to-transparent ${sizeMap[size].lineW}`}
            />
            <span
              className={`${sizeMap[size].subtext} text-[#F5E8C7] font-medium tracking-wider whitespace-nowrap`}
            >
              {subtitle}
            </span>
            <span
              className={`h-[1px] bg-gradient-to-r from-transparent via-[#D4AF37] to-transparent ${sizeMap[size].lineW}`}
            />
          </div>
        </div>
      )}
    </div>
  );
};
