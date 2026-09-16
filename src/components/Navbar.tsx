import React, { useState, useEffect } from 'react';
import {
  ShoppingBag,
  Heart,
  Search,
  Sliders,
  TrendingUp,
  Calculator,
  ShieldCheck,
  Menu,
  X,
  Phone,
  Sparkles,
  Layers,
  Info,
  User,
  LogOut,
} from 'lucide-react';
import { InanaLogo } from './InanaLogo';
import { useGoldStore } from '../context/GoldStoreContext';
import { useAuth } from '../context/AuthContext';
import { formatToman, formatPercent } from '../utils/persianFormatter';

export const Navbar: React.FC = () => {
  const {
    goldPrice,
    cart,
    favorites,
    activeTab,
    setActiveTab,
    setIsCartOpen,
    searchQuery,
    setSearchQuery,
    setSelectedCategory,
    setSelectedCollection,
  } = useGoldStore();

  const { currentUser, userProfile, isAdmin, openAuthModal, logout } = useAuth();

  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  const totalCartCount = cart.reduce((acc, item) => acc + item.quantity, 0);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { id: 'home', label: 'صفحه نخست', icon: Sparkles },
    { id: 'shop', label: 'ویترین طلا', icon: Layers },
    { id: 'gold-price', label: 'نرخ لحظه‌ای طلا', icon: TrendingUp },
    { id: 'collections', label: 'کالکشن‌ها', icon: Layers },
    { id: 'about', label: 'درباره اینانا', icon: Info },
    { id: 'contact', label: 'تماس و پشتیبانی', icon: Phone },
  ];

  const handleNavClick = (tabId: string) => {
    setActiveTab(tabId);
    if (tabId === 'shop') {
      setSelectedCategory(null);
      setSelectedCollection(null);
    }
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <header
      id="main-navbar-header"
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        isScrolled
          ? 'bg-[#060B15]/95 backdrop-blur-xl border-b border-[#D4AF37]/25 shadow-[0_10px_30px_-10px_rgba(0,0,0,0.8)]'
          : 'bg-gradient-to-b from-[#060B15]/95 via-[#060B15]/80 to-transparent'
      }`}
    >
      {/* Top Gold Ticker Strip */}
      <div className="w-full bg-[#040810] border-b border-[#D4AF37]/20 py-1.5 px-3 sm:px-4 text-xs overflow-hidden">
        <div className="max-w-7xl mx-auto flex items-center justify-center lg:justify-between gap-2">
          <div className="flex min-w-0 max-w-full items-center justify-center gap-2 xl:gap-4 overflow-hidden">
            <button
              onClick={() => handleNavClick('gold-price')}
              className="flex min-w-0 max-w-full items-center justify-center gap-1 sm:gap-1.5 text-[#E6CA65] hover:text-white whitespace-nowrap font-medium text-[10px] sm:text-xs bg-[#0B152B] hover:bg-[#112040] border border-[#D4AF37]/35 hover:border-[#D4AF37]/60 px-2 sm:px-2.5 py-0.5 rounded-full transition-all cursor-pointer group"
              title="مشاهده نمودار و جزئیات لحظه‌ای نرخ طلا"
            >
              <span className="relative flex h-2 w-2 flex-shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#D4AF37] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#D4AF37]"></span>
              </span>
              <span className="hidden sm:inline">{goldPrice.status === 'live' ? 'نرخ لحظه‌ای ۱۸ عیار:' : 'نرخ تأییدنشده / آخرین نرخ:'}</span>
              <span className="sm:hidden">{goldPrice.status === 'live' ? 'طلای ۱۸ عیار:' : 'آخرین نرخ:'}</span>
              <span className="min-w-0 truncate font-bold text-white font-sans">
                {goldPrice.pricePerGram > 0 ? formatToman(goldPrice.pricePerGram) : 'در دسترس نیست'}
              </span>
              <TrendingUp className="w-3 h-3 text-[#D4AF37] mr-0.5 opacity-80 group-hover:opacity-100 transition-opacity" />
            </button>

            <div className="hidden xl:flex items-center gap-1 text-slate-300 whitespace-nowrap">
              <span>تغییر روزانه:</span>
              <span
                className={`font-semibold ${
                  goldPrice.changePercent >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {formatPercent(goldPrice.changePercent)}
              </span>
            </div>

            <div className="hidden 2xl:flex items-center gap-1 text-slate-400 text-[11px] whitespace-nowrap">
              <span>بروزرسانی:</span>
              <span>{goldPrice.jalaliTimestamp || 'لحظه‌ای'}</span>
            </div>
          </div>

          <div className="hidden lg:flex items-center gap-2 xl:gap-3 text-slate-300 text-xs flex-shrink-0">
            {/* Admin Dashboard Button - ONLY visible to verified admins */}
            {isAdmin && (
              <button
                onClick={() => handleNavClick('admin')}
                className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full transition-all text-[10px] sm:text-[11px] whitespace-nowrap ${
                  activeTab === 'admin'
                    ? 'bg-[#D4AF37] text-slate-950 font-bold shadow-md'
                    : 'bg-amber-500/20 hover:bg-amber-500/30 text-[#F5E8C7] border border-[#D4AF37]/50 font-bold'
                }`}
              >
                <Sliders className="w-3 h-3 flex-shrink-0 text-[#D4AF37]" />
                <span>پنل مدیریت</span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              </button>
            )}

            {/* Auth / Account Ticker Button */}
            {currentUser ? (
              <button
                onClick={() => openAuthModal('profile')}
                className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#13254A] hover:bg-[#1A3264] text-slate-200 border border-slate-700/80 text-[10px] sm:text-[11px] transition-all"
                title="مشاهده پروفایل کاربری"
              >
                <User className="w-3 h-3 text-[#D4AF37]" />
                <span className="max-w-[90px] sm:max-w-[120px] truncate font-medium">
                  {userProfile?.displayName || currentUser.email?.split('@')[0]}
                </span>
                {isAdmin && (
                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-[#D4AF37] text-slate-950 font-black">
                    مدیر
                  </span>
                )}
              </button>
            ) : (
              <button
                onClick={() => openAuthModal('login')}
                className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#D4AF37]/15 hover:bg-[#D4AF37]/25 text-[#F5E8C7] border border-[#D4AF37]/30 text-[10px] sm:text-[11px] font-medium transition-all"
              >
                <User className="w-3 h-3 text-[#D4AF37]" />
                <span>ورود / ثبت‌نام</span>
              </button>
            )}

          </div>
        </div>
      </div>

      {/* Main Nav Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-18">
          {/* Right Section (Persian RTL): Logo & Desktop Navigation Links */}
          <div className="flex items-center gap-3 lg:gap-8">
            <button
              id="mobile-menu-toggle-btn"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800/60 transition-colors"
              aria-label="منوی سایت"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>

            {/* Brand Logo in Header */}
            <div
              className="cursor-pointer flex items-center hover:scale-105 transition-transform"
              onClick={() => handleNavClick('home')}
            >
              <InanaLogo size="md" variant="pure-gold-glow" showText={false} />
              <div className="hidden sm:flex flex-col items-start mr-2.5">
                <span className="font-serif-brand font-bold text-xs tracking-[0.2em] gold-gradient-text uppercase leading-none">
                  INANA GOLD
                </span>
                <span className="text-[8.5px] text-[#E6CA65] font-medium tracking-wider mt-0.5 leading-none">
                  گالری طلای اینانا
                </span>
              </div>
            </div>

            {/* Desktop Navigation Links */}
            <nav className="hidden lg:flex items-center gap-6">
              {navLinks.map((link) => {
                const isActive = activeTab === link.id;
                return (
                  <button
                    key={link.id}
                    onClick={() => handleNavClick(link.id)}
                    className={`relative py-2 text-sm font-medium transition-colors duration-300 ${
                      isActive ? 'text-[#F5E8C7] font-bold' : 'text-slate-300 hover:text-[#D4AF37]'
                    }`}
                  >
                    {link.label}
                    {isActive && (
                      <span className="absolute bottom-0 right-0 left-0 h-[2px] bg-gradient-to-r from-transparent via-[#D4AF37] to-transparent rounded-full shadow-[0_0_8px_#D4AF37]" />
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Left Section: Search, Favorites, Cart */}
          <div className="flex items-center gap-2 sm:gap-4">
            {/* Search Button */}
            <div className="relative">
              <button
                id="search-toggle-btn"
                onClick={() => setSearchOpen(!searchOpen)}
                className="p-2.5 rounded-full text-slate-300 hover:text-[#D4AF37] hover:bg-slate-800/50 transition-colors"
                title="جستجوی محصول یا حرف"
              >
                <Search className="w-5 h-5" />
              </button>

              {searchOpen && (
                <div className="fixed inset-x-4 top-24 sm:absolute sm:inset-auto sm:left-0 sm:mt-3 sm:w-80 bg-[#132342] border border-[#D4AF37]/35 rounded-2xl shadow-2xl p-3 z-50 backdrop-blur-2xl">
                  <div className="relative flex items-center">
                    <input
                      type="text"
                      placeholder="جستجوی پلاک، حرف، انگشتر..."
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        if (activeTab !== 'shop') setActiveTab('shop');
                      }}
                      className="w-full bg-[#0B152B] text-sm text-slate-100 placeholder-slate-400 rounded-xl px-4 py-2.5 pl-9 border border-slate-600 focus:border-[#D4AF37] outline-none transition-colors"
                      autoFocus
                    />
                    <Search className="w-4 h-4 text-slate-300 absolute left-3" />
                  </div>
                  {searchQuery && (
                    <div className="mt-2 pt-2 border-t border-slate-700 text-xs text-slate-300 flex justify-between items-center px-1">
                      <span>در حال فیلتر نتایج...</span>
                      <button
                        onClick={() => setSearchQuery('')}
                        className="text-[#D4AF37] hover:underline"
                      >
                        پاک کردن
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* User Account / Profile Button */}
            <button
              id="user-account-nav-btn"
              onClick={() => {
                if (currentUser) {
                  openAuthModal('profile');
                } else {
                  openAuthModal('login');
                }
              }}
              className="relative p-2.5 rounded-full text-slate-300 hover:text-[#D4AF37] hover:bg-slate-800/50 transition-colors"
              title={currentUser ? userProfile?.displayName || 'پروفایل کاربری' : 'ورود / ثبت‌نام'}
            >
              <User className={`w-5 h-5 ${currentUser ? 'text-[#D4AF37]' : ''}`} />
              {currentUser && (
                <span
                  className={`absolute top-1.5 right-1.5 flex h-2 w-2 rounded-full ${
                    isAdmin ? 'bg-[#D4AF37]' : 'bg-emerald-400'
                  }`}
                />
              )}
            </button>

            {/* Favorites Icon */}
            <button
              id="favorites-nav-btn"
              onClick={() => handleNavClick('favorites')}
              className="relative p-2.5 rounded-full text-slate-300 hover:text-rose-400 hover:bg-slate-800/50 transition-colors"
              title="علاقه‌مندی‌ها"
            >
              <Heart
                className={`w-5 h-5 ${favorites.length > 0 ? 'fill-rose-500/20 text-rose-400' : ''}`}
              />
              {favorites.length > 0 && (
                <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white shadow-sm">
                  {favorites.length}
                </span>
              )}
            </button>

            {/* Shopping Cart Button */}
            <button
              id="shopping-cart-nav-btn"
              onClick={() => setIsCartOpen(true)}
              className="relative flex items-center gap-2 bg-gradient-to-r from-[#D4AF37] via-[#C5A059] to-[#AA822A] text-slate-950 px-3.5 py-2 rounded-full font-bold text-xs sm:text-sm hover:brightness-110 active:scale-95 transition-all shadow-[0_0_20px_rgba(212,175,55,0.25)]"
              title="سبد خرید"
            >
              <ShoppingBag className="w-4 h-4 text-slate-950" />
              <span className="hidden sm:inline">سبد خرید</span>
              {totalCartCount > 0 && (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-950 text-[11px] font-bold text-[#F5E8C7]">
                  {totalCartCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-[#0E1A33]/98 border-b border-[#D4AF37]/35 px-6 py-6 backdrop-blur-2xl animate-in slide-in-from-top-4 duration-300">
          {/* Mobile User Profile Section */}
          <div className="p-3.5 rounded-2xl bg-[#0A1120] border border-slate-700/80 mb-4">
            {currentUser ? (
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-[#D4AF37]/20 border border-[#D4AF37]/40 flex items-center justify-center text-[#D4AF37] font-black flex-shrink-0">
                    {userProfile?.displayName?.charAt(0) || currentUser.email?.charAt(0)?.toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-sm font-bold text-white truncate">
                        {userProfile?.displayName || 'کاربر گرامی'}
                      </span>
                      {isAdmin && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#D4AF37] text-slate-950 font-black">
                          مدیر ارشد
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-slate-400 font-mono dir-ltr block text-right truncate">
                      {currentUser.email}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    openAuthModal('profile');
                  }}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 text-xs text-[#D4AF37] font-semibold border border-slate-700 hover:bg-slate-700 flex-shrink-0"
                >
                  پروفایل
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs text-slate-300">
                  حساب کاربری گالری طلای اینانا
                </div>
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    openAuthModal('login');
                  }}
                  className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#AA822A] text-slate-950 font-bold text-xs shadow-md"
                >
                  ورود / ثبت‌نام
                </button>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive = activeTab === link.id;
              return (
                <button
                  key={link.id}
                  onClick={() => handleNavClick(link.id)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-right font-medium text-base transition-all ${
                    isActive
                      ? 'bg-[#D4AF37]/20 text-[#F5E8C7] border border-[#D4AF37]/40 font-bold'
                      : 'text-slate-200 hover:bg-[#132342] hover:text-white'
                  }`}
                >
                  <Icon className={`w-5 h-5 ${isActive ? 'text-[#D4AF37]' : 'text-slate-400'}`} />
                  <span>{link.label}</span>
                </button>
              );
            })}

            {isAdmin && (
              <button
                onClick={() => handleNavClick('admin')}
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-right font-bold text-base bg-[#132342] text-[#D4AF37] border border-[#D4AF37]/40 mt-2"
              >
                <Sliders className="w-5 h-5 text-[#D4AF37]" />
                <span>پنل مدیریت و تنظیمات قیمت طلا</span>
              </button>
            )}

            {/* Mobile VIP Support Hotline */}
            <div className="pt-4 mt-2 border-t border-slate-800 flex items-center justify-between text-xs text-slate-300">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-[#D4AF37]/15 text-[#D4AF37]">
                  <Phone className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-semibold text-white">پشتیبانی VIP گالری</div>
                  <div className="text-[11px] text-slate-400">پاسخگویی ۹:۰۰ الی ۲۱:۰۰</div>
                </div>
              </div>
              <a
                href="tel:09909622895"
                className="px-3 py-1.5 rounded-lg bg-[#13254A] hover:bg-[#1A3264] text-[#D4AF37] border border-[#D4AF37]/30 font-bold dir-ltr"
              >
                ۰۹۹۰۹۶۲۲۸۹۵
              </a>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
