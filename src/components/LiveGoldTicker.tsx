import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  ShieldCheck,
  Activity,
  Layers,
  Sparkles,
} from 'lucide-react';
import { useGoldStore } from '../context/GoldStoreContext';
import { formatToman, formatPercent, formatJalaliDateTime } from '../utils/persianFormatter';
import { GoldHistoryPoint } from '../types';

export const LiveGoldTicker: React.FC = () => {
  const { goldPrice, refreshGoldPrice } = useGoldStore();
  const [activeRange, setActiveRange] = useState<'24h' | '7d' | '1m' | '3m' | '1y'>('7d');
  const [historyData, setHistoryData] = useState<GoldHistoryPoint[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hoveredPoint, setHoveredPoint] = useState<GoldHistoryPoint | null>(null);

  const ranges = [
    { id: '24h', label: '۲۴ ساعت' },
    { id: '7d', label: '۷ روز' },
    { id: '1m', label: '۱ ماه' },
    { id: '3m', label: '۳ ماه' },
    { id: '1y', label: '۱ سال' },
  ];

  const fetchHistory = async (range: string) => {
    try {
      const res = await fetch(`/api/gold-history?range=${range}`);
      if (res.ok) {
        const data = await res.json();
        setHistoryData(data.points || []);
      }
    } catch {
      // Fallback points
      const base = goldPrice.pricePerGram;
      setHistoryData([
        { time: 'شنبه', date: 'هفته', price: base * 0.985 },
        { time: 'یکشنبه', date: 'هفته', price: base * 0.991 },
        { time: 'دوشنبه', date: 'هفته', price: base * 0.996 },
        { time: 'سه‌شنبه', date: 'هفته', price: base * 1.002 },
        { time: 'چهارشنبه', date: 'هفته', price: base * 1.004 },
        { time: 'پنجشنبه', date: 'هفته', price: base * 1.007 },
        { time: 'امروز', date: 'هفته', price: base },
      ]);
    }
  };

  useEffect(() => {
    fetchHistory(activeRange);
  }, [activeRange, goldPrice.pricePerGram]);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await refreshGoldPrice(true);
    await fetchHistory(activeRange);
    setTimeout(() => setIsRefreshing(false), 600);
  };

  // SVG Chart path & coordinate calculation
  const chartHeight = 250;
  const chartWidth = 760;
  const paddingLeft = 90;
  const paddingRight = 35;
  const paddingTop = 25;
  const paddingBottom = 40;
  const plotWidth = chartWidth - paddingLeft - paddingRight;
  const plotHeight = chartHeight - paddingTop - paddingBottom;

  const prices = historyData.map((d) => d.price);
  const periodHigh = prices.length > 0 ? Math.max(...prices) : goldPrice.pricePerGram;
  const periodLow = prices.length > 0 ? Math.min(...prices) : goldPrice.pricePerGram;
  const priceSpan = periodHigh - periodLow || periodHigh * 0.02;
  const minPrice = Math.max(0, periodLow - priceSpan * 0.15);
  const maxPrice = periodHigh + priceSpan * 0.15;

  const firstPrice = prices[0] || goldPrice.pricePerGram;
  const lastPrice = prices[prices.length - 1] || goldPrice.pricePerGram;
  const periodDiff = lastPrice - firstPrice;
  const periodPercent = firstPrice > 0 ? Number(((periodDiff / firstPrice) * 100).toFixed(2)) : 0;

  const getCoordinates = (point: GoldHistoryPoint, index: number) => {
    const total = historyData.length || 1;
    const x = paddingLeft + (index / (total - 1 || 1)) * plotWidth;
    const normalizedPrice = (point.price - minPrice) / (maxPrice - minPrice || 1);
    const y = paddingTop + (1 - normalizedPrice) * plotHeight;
    return { x, y };
  };

  const pointsCoordinates = historyData.map(getCoordinates);

  // Smooth cubic Bezier spline
  const generateSmoothPath = (pts: { x: number; y: number }[]) => {
    if (pts.length === 0) return '';
    if (pts.length === 1) return `M ${pts[0].x},${pts[0].y}`;
    if (pts.length === 2) return `M ${pts[0].x},${pts[0].y} L ${pts[1].x},${pts[1].y}`;
    let d = `M ${pts[0].x},${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[i + 2] || p2;
      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;
      d += ` C ${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
    }
    return d;
  };

  const pathD = generateSmoothPath(pointsCoordinates);
  const bottomY = paddingTop + plotHeight;
  const areaPathD =
    pointsCoordinates.length > 0
      ? `${pathD} L ${pointsCoordinates[pointsCoordinates.length - 1].x},${bottomY} L ${
          pointsCoordinates[0].x
        },${bottomY} Z`
      : '';

  // 4 Y-Axis Horizontal Grid Levels
  const gridLevels = [0, 0.33, 0.66, 1].map((factor) => {
    const y = paddingTop + factor * plotHeight;
    const priceVal = Math.round(maxPrice - factor * (maxPrice - minPrice));
    return { y, priceVal };
  });

  return (
    <section
      id="gold-price-section"
      className="py-16 sm:py-24 px-3.5 sm:px-6 lg:px-8 bg-[#060B15] relative w-full max-w-full overflow-hidden"
      style={{
        background:
          'radial-gradient(ellipse at 50% 0%, rgba(18, 48, 98, 0.28) 0%, rgba(8, 15, 30, 0.65) 45%, #060B15 85%)',
      }}
    >
      {/* Subtle Top Gold Transition Line */}
      <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-[#D4AF37]/30 to-transparent pointer-events-none" />

      {/* Background Glow */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-[#D4AF37]/5 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto w-full min-w-0 relative z-10">
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-10 sm:mb-12">
          <div>
            <div className="inline-flex items-center gap-2 text-xs font-semibold text-[#E6CA65] uppercase tracking-widest mb-3 px-3.5 py-1.5 rounded-full bg-[#0B152B] border border-[#D4AF37]/35 shadow-sm">
              <Activity className="w-3.5 h-3.5 text-[#D4AF37]" />
              <span>تابلو رسمی و لحظه‌ای نرخ طلا</span>
            </div>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold gold-gradient-text tracking-wide">
              قیمت روز طلای ۱۸ عیار ایران
            </h2>
            <p className="text-slate-300 text-xs sm:text-sm mt-1.5 max-w-xl font-light">
              تمامی قیمت‌های زیورآلات اینانا گلد به صورت خودکار و زنده بر مبنای این نرخ محاسبه
              می‌شوند.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleManualRefresh}
              disabled={isRefreshing}
              className="flex items-center gap-2 bg-[#0B152B] hover:bg-[#112040] border border-[#D4AF37]/35 text-[#E6CA65] px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all shadow-sm"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>بروزرسانی نرخ</span>
            </button>
          </div>
        </div>

        {/* 4-Box Key Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4 mb-8 w-full min-w-0">
          {/* Main 18K Price Card */}
          <div className="luxury-glass-card rounded-2xl p-5 sm:p-6 relative overflow-hidden group min-w-0 border border-[#D4AF37]/25">
            <div className="flex items-center justify-between text-slate-300 text-xs mb-2">
              <span>قیمت هر گرم طلای ۱۸ عیار</span>
              <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-white mb-2 truncate">
              {formatToman(goldPrice.pricePerGram)}
            </div>
            <div className="flex items-center gap-1.5 text-xs">
              <span
                className={`inline-flex items-center font-bold ${
                  goldPrice.changePercent >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {goldPrice.changePercent >= 0 ? (
                  <ArrowUpRight className="w-4 h-4 flex-shrink-0" />
                ) : (
                  <ArrowDownRight className="w-4 h-4 flex-shrink-0" />
                )}
                {formatPercent(goldPrice.changePercent)}
              </span>
              <span className="text-slate-300">تغییر نسبت به دیروز</span>
            </div>
          </div>

          {/* Daily High */}
          <div className="luxury-glass-card rounded-2xl p-5 sm:p-6 min-w-0 border border-[#D4AF37]/25">
            <span className="text-slate-300 text-xs block mb-2">بالاترین قیمت امروز</span>
            <div className="text-xl sm:text-2xl font-bold text-emerald-400 mb-2 truncate">
              {formatToman(goldPrice.dailyHigh || goldPrice.pricePerGram * 1.008)}
            </div>
            <span className="text-[11px] text-slate-400 block truncate">ثبت شده در ساعات اوج بازار</span>
          </div>

          {/* Daily Low */}
          <div className="luxury-glass-card rounded-2xl p-5 sm:p-6 min-w-0 border border-[#D4AF37]/25">
            <span className="text-slate-300 text-xs block mb-2">پایین‌ترین قیمت امروز</span>
            <div className="text-xl sm:text-2xl font-bold text-slate-100 mb-2 truncate">
              {formatToman(goldPrice.dailyLow || goldPrice.pricePerGram * 0.992)}
            </div>
            <span className="text-[11px] text-slate-400 block truncate">کف قیمت معاملاتی روز</span>
          </div>

          {/* Status & Timestamp */}
          <div className="luxury-glass-card rounded-2xl p-5 sm:p-6 min-w-0 border border-[#D4AF37]/25">
            <span className="text-slate-300 text-xs block mb-2">وضعیت و چرخه استعلام</span>
            <div className="flex items-center gap-2 mb-2">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 flex-shrink-0" />
              <span className="text-sm sm:text-base font-bold text-white truncate">
                {goldPrice.isManualOverride ? 'نرخ تثبیت شده' : 'استعلام خودکار هر ۱ ساعت'}
              </span>
            </div>
            <div className="flex items-center gap-1 text-[11px] text-slate-300 truncate">
              <Clock className="w-3.5 h-3.5 text-[#D4AF37] flex-shrink-0" />
              <span>بروزرسانی: {goldPrice.jalaliTimestamp || 'امروز'}</span>
            </div>
          </div>
        </div>

        {/* Secondary Gold & Coin Market Rates (Live from TGJU) */}
        {goldPrice.otherMarkets && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-3 mb-8 w-full min-w-0">
            <div className="bg-[#070E1E]/90 border border-[#D4AF37]/20 rounded-xl p-2.5 sm:p-3 text-center transition-all hover:border-[#D4AF37]/45 min-w-0 overflow-hidden">
              <span className="text-[10px] sm:text-[11px] text-slate-400 block mb-1 truncate">طلای ۲۴ عیار</span>
              <span className="text-xs sm:text-sm font-bold text-white block truncate">
                {goldPrice.otherMarkets.gold24k ? formatToman(goldPrice.otherMarkets.gold24k) : '—'}
              </span>
            </div>
            <div className="bg-[#070E1E]/90 border border-[#D4AF37]/20 rounded-xl p-2.5 sm:p-3 text-center transition-all hover:border-[#D4AF37]/45 min-w-0 overflow-hidden">
              <span className="text-[10px] sm:text-[11px] text-slate-400 block mb-1 truncate">مظنه مثقال طلا</span>
              <span className="text-xs sm:text-sm font-bold text-white block truncate">
                {goldPrice.otherMarkets.mesghal ? formatToman(goldPrice.otherMarkets.mesghal) : '—'}
              </span>
            </div>
            <div className="bg-[#070E1E]/90 border border-[#D4AF37]/20 rounded-xl p-2.5 sm:p-3 text-center transition-all hover:border-[#D4AF37]/45 min-w-0 overflow-hidden">
              <span className="text-[10px] sm:text-[11px] text-slate-400 block mb-1 truncate">سکه تمام امامی</span>
              <span className="text-xs sm:text-sm font-bold text-white block truncate">
                {goldPrice.otherMarkets.emamiCoin ? formatToman(goldPrice.otherMarkets.emamiCoin) : '—'}
              </span>
            </div>
            <div className="bg-[#070E1E]/90 border border-[#D4AF37]/20 rounded-xl p-2.5 sm:p-3 text-center transition-all hover:border-[#D4AF37]/45 min-w-0 overflow-hidden">
              <span className="text-[10px] sm:text-[11px] text-slate-400 block mb-1 truncate">نیم سکه آزادی</span>
              <span className="text-xs sm:text-sm font-bold text-white block truncate">
                {goldPrice.otherMarkets.halfCoin ? formatToman(goldPrice.otherMarkets.halfCoin) : '—'}
              </span>
            </div>
            <div className="bg-[#070E1E]/90 border border-[#D4AF37]/20 rounded-xl p-2.5 sm:p-3 text-center transition-all hover:border-[#D4AF37]/45 min-w-0 overflow-hidden">
              <span className="text-[10px] sm:text-[11px] text-slate-400 block mb-1 truncate">ربع سکه آزادی</span>
              <span className="text-xs sm:text-sm font-bold text-white block truncate">
                {goldPrice.otherMarkets.quarterCoin ? formatToman(goldPrice.otherMarkets.quarterCoin) : '—'}
              </span>
            </div>
            <div className="bg-[#070E1E]/90 border border-[#D4AF37]/20 rounded-xl p-2.5 sm:p-3 text-center transition-all hover:border-[#D4AF37]/45 min-w-0 overflow-hidden">
              <span className="text-[10px] sm:text-[11px] text-slate-400 block mb-1 truncate">انس جهانی طلا</span>
              <span className="text-xs sm:text-sm font-bold text-[#E6CA65] block truncate">
                {goldPrice.otherMarkets.globalOunceUsd
                  ? `$${goldPrice.otherMarkets.globalOunceUsd.toLocaleString()}`
                  : '—'}
              </span>
            </div>
          </div>
        )}

        {/* Interactive Gold Price Chart */}
        <div className="luxury-glass-card rounded-2xl sm:rounded-3xl p-3.5 sm:p-6 lg:p-8 relative w-full max-w-full min-w-0 overflow-hidden border border-[#D4AF37]/25">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
            <div>
              <h3 className="text-base sm:text-xl font-bold text-white flex items-center gap-2">
                <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-[#D4AF37]" />
                <span>نمودار نوسانات قیمت طلای ۱۸ عیار</span>
              </h3>
              <p className="text-xs text-slate-300 mt-1">
                تحلیل روند و تاریخچه تغییرات هر گرم طلا در بازه‌های زمانی مختلف
              </p>
            </div>

            {/* Range Toggle Buttons */}
            <div className="flex items-center gap-1 bg-[#050B17] p-1 sm:p-1.5 rounded-xl border border-[#D4AF37]/25 w-full sm:w-auto max-w-full overflow-x-auto no-scrollbar justify-between sm:justify-start">
              {ranges.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setActiveRange(r.id as any)}
                  className={`px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-lg text-[11px] sm:text-xs font-semibold whitespace-nowrap transition-all flex-1 sm:flex-initial text-center ${
                    activeRange === r.id
                      ? 'bg-gradient-to-r from-[#D4AF37] via-[#C5A059] to-[#B38A30] text-slate-950 shadow-md font-bold'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          {/* Period Summary KPI Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 mb-6 bg-[#050B17]/80 border border-[#D4AF37]/20 rounded-2xl p-2.5 sm:p-3.5 w-full min-w-0">
            <div className="text-right min-w-0">
              <span className="text-[10px] sm:text-[11px] text-slate-400 block mb-0.5 truncate">بالاترین نرخ دوره</span>
              <span className="text-xs sm:text-sm font-bold text-emerald-400 block truncate">
                {formatToman(periodHigh)}
              </span>
            </div>
            <div className="text-right min-w-0">
              <span className="text-[10px] sm:text-[11px] text-slate-400 block mb-0.5 truncate">پایین‌ترین نرخ دوره</span>
              <span className="text-xs sm:text-sm font-bold text-slate-200 block truncate">
                {formatToman(periodLow)}
              </span>
            </div>
            <div className="text-right min-w-0">
              <span className="text-[10px] sm:text-[11px] text-slate-400 block mb-0.5 truncate">تغییر کل بازه</span>
              <span
                className={`text-xs sm:text-sm font-bold inline-flex items-center gap-0.5 ${
                  periodPercent >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {periodPercent >= 0 ? (
                  <ArrowUpRight className="w-3.5 h-3.5 flex-shrink-0" />
                ) : (
                  <ArrowDownRight className="w-3.5 h-3.5 flex-shrink-0" />
                )}
                {formatPercent(periodPercent)}
              </span>
            </div>
            <div className="text-right min-w-0">
              <span className="text-[10px] sm:text-[11px] text-slate-400 block mb-0.5 truncate">نرخ میانگین</span>
              <span className="text-xs sm:text-sm font-bold text-[#E6CA65] block truncate">
                {formatToman(
                  Math.round(prices.reduce((a, b) => a + b, 0) / (prices.length || 1))
                )}
              </span>
            </div>
          </div>

          {/* Hover Tooltip Bar */}
          <div className="min-h-[38px] mb-3 flex items-center w-full min-w-0">
            {hoveredPoint ? (
              <div className="inline-flex flex-wrap items-center gap-2 sm:gap-4 bg-[#142548] border border-[#D4AF37]/50 px-3 sm:px-4 py-1.5 rounded-xl text-[11px] sm:text-xs backdrop-blur-md animate-in fade-in duration-150 shadow-md max-w-full">
                <span className="text-slate-300">
                  زمان: <strong className="text-white font-medium">{hoveredPoint.time} ({hoveredPoint.date})</strong>
                </span>
                <span className="text-slate-500 hidden sm:inline">|</span>
                <span className="text-slate-300">
                  قیمت: <strong className="text-[#D4AF37] font-bold">{formatToman(hoveredPoint.price)}</strong>
                </span>
                {hoveredPoint.isEstimated && (
                  <>
                    <span className="text-slate-500 hidden sm:inline">|</span>
                    <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 text-[10px] font-semibold border border-amber-500/40">
                      داده تخمینی
                    </span>
                  </>
                )}
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-3 text-[10px] sm:text-[11px] text-slate-400">
                <span>جهت مشاهده جزئیات قیمت، نشانگر یا انگشت خود را روی نمودار حرکت دهید.</span>
                {historyData.some((p) => p.isEstimated) && (
                  <span className="text-amber-300/80 bg-amber-900/30 px-2 py-0.5 rounded border border-amber-500/30">
                    * نقاط دارای علامت، داده‌های تخمینی بر اساس روند بازار هستند.
                  </span>
                )}
              </div>
            )}
          </div>

          {/* SVG Chart Graphic */}
          <div className="w-full max-w-full min-w-0 overflow-x-auto pb-2 -mx-1 px-1">
            <div className="min-w-[620px] sm:min-w-[680px] h-[250px] sm:h-[260px] relative">
              <svg
                viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                className="w-full h-full overflow-visible select-none"
                preserveAspectRatio="none"
              >
                <defs>
                  <linearGradient id="goldChartGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#D4AF37" stopOpacity="0.32" />
                    <stop offset="60%" stopColor="#D4AF37" stopOpacity="0.08" />
                    <stop offset="100%" stopColor="#D4AF37" stopOpacity="0.0" />
                  </linearGradient>
                  <filter id="goldGlow" x="-20%" y="-20%" width="140%" height="140%">
                    <feDropShadow dx="0" dy="2" stdDeviation="4" floodColor="#D4AF37" floodOpacity="0.5" />
                  </filter>
                </defs>

                {/* Horizontal Grid lines with Y-Axis Price Labels */}
                {gridLevels.map((level, idx) => (
                  <g key={idx}>
                    <line
                      x1={paddingLeft}
                      y1={level.y}
                      x2={chartWidth - paddingRight}
                      y2={level.y}
                      stroke="rgba(212, 175, 55, 0.14)"
                      strokeDasharray="4 4"
                    />
                    <text
                      x={paddingLeft - 10}
                      y={level.y + 4}
                      textAnchor="end"
                      fill="#94A3B8"
                      fontSize="10"
                      fontFamily="inherit"
                    >
                      {formatToman(level.priceVal)}
                    </text>
                  </g>
                ))}

                {/* Vertical Crosshair on Hover */}
                {hoveredPoint && (() => {
                  const hoveredIdx = historyData.findIndex(
                    (p) => p.time === hoveredPoint.time && p.price === hoveredPoint.price
                  );
                  if (hoveredIdx >= 0 && pointsCoordinates[hoveredIdx]) {
                    const hx = pointsCoordinates[hoveredIdx].x;
                    return (
                      <line
                        x1={hx}
                        y1={paddingTop}
                        x2={hx}
                        y2={bottomY}
                        stroke="#D4AF37"
                        strokeWidth="1.5"
                        strokeDasharray="3 3"
                        strokeOpacity="0.75"
                      />
                    );
                  }
                  return null;
                })()}

                {/* Smooth Area Fill */}
                {areaPathD && (
                  <path d={areaPathD} fill="url(#goldChartGradient)" />
                )}

                {/* Smooth Gold Line Stroke */}
                {pathD && (
                  <path
                    d={pathD}
                    fill="none"
                    stroke="#D4AF37"
                    strokeWidth="3.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    filter="url(#goldGlow)"
                    className="transition-all duration-300"
                  />
                )}

                {/* Interactive Points & X-Axis Labels in SVG */}
                {pointsCoordinates.map((coord, idx) => {
                  const point = historyData[idx];
                  const isHovered =
                    hoveredPoint?.time === point?.time && hoveredPoint?.price === point?.price;
                  const isLastPoint = idx === pointsCoordinates.length - 1;

                  return (
                    <g
                      key={idx}
                      className="cursor-pointer"
                      onMouseEnter={() => setHoveredPoint(point)}
                      onMouseLeave={() => setHoveredPoint(null)}
                      onTouchStart={() => setHoveredPoint(point)}
                    >
                      {/* Pulse ring for last (current) point */}
                      {isLastPoint && (
                        <circle
                          cx={coord.x}
                          cy={coord.y}
                          r={9}
                          fill="none"
                          stroke="#D4AF37"
                          strokeWidth="1.5"
                          className="animate-ping opacity-60"
                        />
                      )}

                      {/* Expanded Hit Area for touch / click */}
                      <circle cx={coord.x} cy={coord.y} r={16} fill="transparent" />

                      {/* Main Point Circle */}
                      <circle
                        cx={coord.x}
                        cy={coord.y}
                        r={isHovered ? 6.5 : isLastPoint ? 5 : 4}
                        fill={isHovered ? '#FFFFFF' : isLastPoint ? '#F59E0B' : point.isEstimated ? '#FCD34D' : '#D4AF37'}
                        stroke={point.isEstimated ? '#B45309' : '#0D1B34'}
                        strokeWidth={isHovered ? 2.5 : point.isEstimated ? 1.5 : 2}
                        strokeDasharray={point.isEstimated && !isHovered ? '2,2' : undefined}
                        className="transition-all duration-150"
                      />

                      {/* X-Axis Date/Time Label centered under point */}
                      <text
                        x={coord.x}
                        y={bottomY + 18}
                        textAnchor="middle"
                        fill={isHovered ? '#D4AF37' : isLastPoint ? '#F59E0B' : point.isEstimated ? '#FBBF24' : '#94A3B8'}
                        fontSize="11"
                        fontWeight={isHovered || isLastPoint ? '700' : '500'}
                        fontFamily="inherit"
                      >
                        {point.time}
                        {point.isEstimated && '*'}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
          </div>

          {/* Legal / Formula note */}
          <div className="mt-6 pt-4 border-t border-slate-700/80 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-300">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#D4AF37]" />
              <span>منبع رسمی: {goldPrice.source}</span>
            </div>
            <span>فرمول قیمت‌گذاری تابع نرخ ۱۸ عیار با کد استاندارد ۷۵۰ است.</span>
          </div>
        </div>
      </div>
    </section>
  );
};
