import React, { useState, useMemo } from 'react';
import {
  Search,
  Filter,
  SlidersHorizontal,
  ArrowUpDown,
  Sparkles,
  X,
  Layers,
  ChevronDown,
} from 'lucide-react';
import { CATEGORIES_LIST } from '../data/seedData';
import { ProductCard } from './ProductCard';
import { useGoldStore } from '../context/GoldStoreContext';
import { Product } from '../types';
import { formatToman, toPersianDigits, formatWeight } from '../utils/persianFormatter';
import { calculateProductPrice } from '../utils/pricingEngine';

export const ShopCatalog: React.FC = () => {
  const {
    products,
    collections,
    goldPrice,
    settings,
    selectedCategory,
    setSelectedCategory,
    selectedCollection,
    setSelectedCollection,
    searchQuery,
    setSearchQuery,
    setQuickViewProduct,
  } = useGoldStore();

  const [selectedLetter, setSelectedLetter] = useState<string | null>(null);
  const [maxWeight, setMaxWeight] = useState<number>(10);
  const [onlyInStock, setOnlyInStock] = useState<boolean>(false);
  const [sortBy, setSortBy] = useState<
    'newest' | 'bestseller' | 'price-asc' | 'price-desc' | 'weight-asc' | 'weight-desc'
  >('newest');
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);

  const alphabetLetters = [
    'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M',
    'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'
  ];

  // Filter & Sort Logic
  const filteredProducts = useMemo(() => {
    return products
      .filter((p) => {
        // Search query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const matchesTitle = p.title.toLowerCase().includes(q);
          const matchesCategory = p.category.toLowerCase().includes(q);
          const matchesCollection = p.collection.toLowerCase().includes(q);
          const matchesSku = p.sku.toLowerCase().includes(q);
          const matchesLetter = p.letter?.toLowerCase() === q;
          if (!matchesTitle && !matchesCategory && !matchesCollection && !matchesSku && !matchesLetter) {
            return false;
          }
        }

        // Category filter
        if (selectedCategory && p.category !== selectedCategory) {
          return false;
        }

        // Collection filter
        if (selectedCollection && p.collection !== selectedCollection) {
          return false;
        }

        // Letter filter
        if (selectedLetter && p.letter?.toUpperCase() !== selectedLetter.toUpperCase()) {
          return false;
        }

        // Weight filter
        if (p.weight > maxWeight) {
          return false;
        }

        // Stock filter
        if (onlyInStock && p.stock <= 0) {
          return false;
        }

        return true;
      })
      .sort((a, b) => {
        const priceA = calculateProductPrice(a, goldPrice.pricePerGram, settings).finalPrice;
        const priceB = calculateProductPrice(b, goldPrice.pricePerGram, settings).finalPrice;

        switch (sortBy) {
          case 'newest':
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
          case 'bestseller':
            return (b.isBestSeller ? 1 : 0) - (a.isBestSeller ? 1 : 0);
          case 'price-asc':
            return priceA - priceB;
          case 'price-desc':
            return priceB - priceA;
          case 'weight-asc':
            return a.weight - b.weight;
          case 'weight-desc':
            return b.weight - a.weight;
          default:
            return 0;
        }
      });
  }, [
    products,
    searchQuery,
    selectedCategory,
    selectedCollection,
    selectedLetter,
    maxWeight,
    onlyInStock,
    sortBy,
    goldPrice.pricePerGram,
    settings,
  ]);

  const clearAllFilters = () => {
    setSelectedCategory(null);
    setSelectedCollection(null);
    setSelectedLetter(null);
    setSearchQuery('');
    setMaxWeight(10);
    setOnlyInStock(false);
  };

  const hasActiveFilters =
    Boolean(selectedCategory) ||
    Boolean(selectedCollection) ||
    Boolean(selectedLetter) ||
    Boolean(searchQuery) ||
    maxWeight < 10 ||
    onlyInStock;

  return (
    <section
      id="shop-catalog-section"
      className="py-14 sm:py-20 px-3.5 sm:px-6 lg:px-8 bg-[#060B15] min-h-screen w-full max-w-full overflow-hidden relative"
      style={{
        background:
          'radial-gradient(ellipse at 50% 0%, rgba(18, 48, 98, 0.25) 0%, rgba(8, 15, 30, 0.6) 45%, #060B15 85%)',
      }}
    >
      {/* Subtle Top Gold Transition Line */}
      <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-[#D4AF37]/30 to-transparent pointer-events-none" />

      <div className="max-w-7xl mx-auto w-full min-w-0 relative z-10">
        {/* Catalog Banner / Header */}
        <div className="text-center max-w-2xl mx-auto mb-10 sm:mb-12">
          <div className="inline-flex items-center gap-2 text-xs font-semibold text-[#E6CA65] uppercase tracking-widest mb-3 px-4 py-1.5 rounded-full bg-[#0B152B] border border-[#D4AF37]/35 shadow-sm">
            <Layers className="w-3.5 h-3.5 text-[#D4AF37]" />
            <span>گالری انحصاری زیورآلات ۱۸ عیار</span>
          </div>

          <div className="flex items-center justify-center gap-3 mb-2">
            <span className="hidden sm:inline-block h-[1px] w-8 sm:w-12 bg-gradient-to-r from-transparent via-[#D4AF37]/50 to-transparent" />
            <h1 className="text-2xl sm:text-4xl font-extrabold gold-gradient-text tracking-wide">
              ویترین طلای لوکس اینانا
            </h1>
            <span className="hidden sm:inline-block h-[1px] w-8 sm:w-12 bg-gradient-to-r from-transparent via-[#D4AF37]/50 to-transparent" />
          </div>

          <p className="text-slate-300 text-xs sm:text-sm mt-2 font-light leading-relaxed max-w-lg mx-auto">
            مجموعه‌ای کم‌نظیر از پلاک‌های حروف، مدال‌های معماری زیگورات، دستبند و گوشواره با محاسبه
            لحظه‌ای قیمت طلا.
          </p>
        </div>

        {/* Categories Chips Bar */}
        <div className="flex items-center gap-2 overflow-x-auto pb-3 no-scrollbar mb-6 sm:mb-8 w-full max-w-full min-w-0">
          <button
            onClick={() => {
              setSelectedCategory(null);
              setSelectedLetter(null);
            }}
            className={`px-4 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm whitespace-nowrap transition-all ${
              selectedCategory === null
                ? 'bg-gradient-to-r from-[#D4AF37] via-[#C5A059] to-[#B38A30] text-slate-950 font-bold shadow-[0_4px_18px_rgba(212,175,55,0.3)]'
                : 'bg-[#0B152B] text-slate-300 hover:text-white border border-[#D4AF37]/20 hover:border-[#D4AF37]/50'
            }`}
          >
            همه دسته‌ها ({toPersianDigits(products.length)})
          </button>
          {CATEGORIES_LIST.map((cat) => {
            const count = products.filter((p) => p.category === cat).length;
            const isSelected = selectedCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => {
                  const nextCategory = isSelected ? null : cat;
                  setSelectedCategory(nextCategory);
                  if (nextCategory !== 'حروف انگلیسی') {
                    setSelectedLetter(null);
                  }
                }}
                className={`px-4 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm whitespace-nowrap transition-all ${
                  isSelected
                    ? 'bg-gradient-to-r from-[#D4AF37] via-[#C5A059] to-[#B38A30] text-slate-950 font-bold shadow-[0_4px_18px_rgba(212,175,55,0.3)]'
                    : 'bg-[#0B152B] text-slate-300 hover:text-white border border-[#D4AF37]/20 hover:border-[#D4AF37]/50'
                }`}
              >
                {cat} {count > 0 && `(${toPersianDigits(count)})`}
              </button>
            );
          })}
        </div>

        {/* INANA LETTERS Alphabet Quick Bar - Only shown in English Letters category */}
        {(selectedCategory === 'حروف انگلیسی' || selectedCollection === 'INANA LETTERS') && (
          <div className="bg-[#081224]/90 border border-[#D4AF37]/35 rounded-2xl p-3.5 sm:p-4 mb-6 sm:mb-8 shadow-md w-full max-w-full overflow-hidden">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-[#F5E8C7] flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#D4AF37]" />
                <span>انتخاب مستقیم پلاک حروف انگلیسی (INANA LETTERS):</span>
              </span>
              {selectedLetter && (
                <button
                  onClick={() => setSelectedLetter(null)}
                  className="text-[11px] text-[#D4AF37] hover:underline"
                >
                  حذف فیلتر حرف ({selectedLetter})
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5 sm:gap-2">
              {alphabetLetters.map((char) => {
                const isSelected = selectedLetter === char;
                const hasProduct = products.some(
                  (p) => p.letter?.toUpperCase() === char.toUpperCase()
                );
                return (
                  <button
                    key={char}
                    onClick={() => setSelectedLetter(isSelected ? null : char)}
                    className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg text-xs font-bold font-serif-brand transition-all flex items-center justify-center ${
                      isSelected
                        ? 'bg-[#D4AF37] text-slate-950 scale-110 shadow-md ring-2 ring-[#D4AF37]/60'
                        : hasProduct
                        ? 'bg-[#050B17] text-[#D4AF37] border border-[#D4AF37]/40 hover:bg-[#D4AF37]/25'
                        : 'bg-[#050B17]/50 text-slate-600 border border-slate-800 opacity-40 cursor-not-allowed'
                    }`}
                    disabled={!hasProduct}
                    title={hasProduct ? `پلاک حرف ${char}` : `حرف ${char} ناموجود`}
                  >
                    {char}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Filter and Sort Toolbar */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3.5 sm:gap-4 bg-[#081224]/85 border border-[#D4AF37]/25 rounded-2xl p-3.5 sm:p-4 mb-6 sm:mb-8 shadow-sm w-full max-w-full min-w-0">
          {/* Active Filter summary */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-slate-300 font-medium">
              نمایش {toPersianDigits(filteredProducts.length)} محصول
            </span>
            {hasActiveFilters && (
              <button
                onClick={clearAllFilters}
                className="inline-flex items-center gap-1 text-rose-400 hover:text-rose-300 mr-2 bg-rose-500/15 px-2.5 py-1 rounded-lg border border-rose-500/30"
              >
                <X className="w-3 h-3" />
                <span>حذف همه فیلترها</span>
              </button>
            )}
          </div>

          {/* Controls: Weight Slider, In-Stock, Sort */}
          <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 w-full sm:w-auto">
            {/* Weight Filter */}
            <div className="flex items-center gap-2 bg-[#050B17] border border-[#D4AF37]/25 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs flex-1 sm:flex-initial">
              <span className="text-slate-300">حداکثر وزن:</span>
              <span className="font-bold text-[#D4AF37]">{toPersianDigits(maxWeight)} گرم</span>
              <input
                type="range"
                min="0.5"
                max="10"
                step="0.5"
                value={maxWeight}
                onChange={(e) => setMaxWeight(parseFloat(e.target.value))}
                className="w-14 sm:w-24 h-1 bg-slate-700 rounded-lg accent-[#D4AF37]"
              />
            </div>

            {/* In-Stock Toggle */}
            <label className="flex items-center gap-2 bg-[#050B17] border border-[#D4AF37]/25 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs text-slate-200 cursor-pointer hover:border-[#D4AF37]/50">
              <input
                type="checkbox"
                checked={onlyInStock}
                onChange={(e) => setOnlyInStock(e.target.checked)}
                className="accent-[#D4AF37] rounded"
              />
              <span>فقط موجود</span>
            </label>

            {/* Sort Dropdown */}
            <div className="flex items-center gap-1.5 bg-[#050B17] border border-[#D4AF37]/25 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs text-slate-200">
              <ArrowUpDown className="w-3.5 h-3.5 text-[#D4AF37]" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-transparent text-slate-100 outline-none cursor-pointer text-xs"
              >
                <option value="newest" className="bg-[#050B17]">
                  جدیدترین‌ها
                </option>
                <option value="bestseller" className="bg-[#050B17]">
                  پرفروش‌ترین‌ها
                </option>
                <option value="price-asc" className="bg-[#050B17]">
                  قیمت: ارزان‌ترین
                </option>
                <option value="price-desc" className="bg-[#050B17]">
                  قیمت: گران‌ترین
                </option>
                <option value="weight-asc" className="bg-[#050B17]">
                  وزن: سبک‌ترین
                </option>
                <option value="weight-desc" className="bg-[#050B17]">
                  وزن: سنگین‌ترین
                </option>
              </select>
            </div>
          </div>
        </div>

        {/* Product Grid */}
        {filteredProducts.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {filteredProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onQuickView={(p) => setQuickViewProduct(p)}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-20 bg-[#081224]/60 border border-[#D4AF37]/20 rounded-3xl p-8">
            <Layers className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <h3 className="text-lg font-bold text-white mb-1">محصولی با این مشخصات یافت نشد</h3>
            <p className="text-sm text-slate-400 max-w-md mx-auto mb-6">
              می‌توانید فیلترهای جستجو یا رده وزنی را تغییر دهید تا نتایج بیشتری مشاهده کنید.
            </p>
            <button
              onClick={clearAllFilters}
              className="bg-[#D4AF37] text-slate-950 font-bold px-6 py-2.5 rounded-xl text-xs hover:brightness-110 transition-all shadow-md"
            >
              مشاهده همه محصولات
            </button>
          </div>
        )}
      </div>
    </section>
  );
};
