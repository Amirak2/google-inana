import React from 'react';
import { Home, Layers, TrendingUp, Heart, ShoppingBag } from 'lucide-react';
import { useGoldStore } from '../context/GoldStoreContext';

export const MobileBottomNav: React.FC = () => {
  const { activeTab, setActiveTab, cart, favorites, setIsCartOpen } = useGoldStore();

  const totalCartCount = cart.reduce((acc, item) => acc + item.quantity, 0);

  const tabs = [
    { id: 'home', label: 'خانه', icon: Home },
    { id: 'shop', label: 'فروشگاه', icon: Layers },
    { id: 'gold-price', label: 'نرخ طلا', icon: TrendingUp },
    { id: 'favorites', label: 'علاقه‌مندی', icon: Heart, badge: favorites.length },
    { id: 'cart-action', label: 'سبد خرید', icon: ShoppingBag, badge: totalCartCount },
  ];

  const handleTabClick = (id: string) => {
    if (id === 'cart-action') {
      setIsCartOpen(true);
    } else {
      setActiveTab(id);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0E1A33]/95 backdrop-blur-2xl border-t border-[#D4AF37]/30 px-2 py-2 shadow-[0_-10px_30px_rgba(0,0,0,0.6)] w-full max-w-full overflow-hidden">
      <div className="flex items-center justify-around w-full max-w-full">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = tab.id === activeTab || (tab.id === 'cart-action' && false);
          return (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab.id)}
              className={`relative flex flex-col items-center justify-center py-1 px-1.5 sm:px-3 rounded-xl transition-all duration-300 min-w-0 flex-1 ${
                isActive
                  ? 'text-[#F5E8C7] scale-105'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <div className="relative">
                <Icon
                  className={`w-5 h-5 transition-colors ${
                    isActive ? 'text-[#D4AF37]' : 'text-slate-400'
                  }`}
                />
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span className="absolute -top-1.5 -right-2 flex h-4 w-4 items-center justify-center rounded-full bg-[#D4AF37] text-[10px] font-bold text-slate-950 shadow-sm">
                    {tab.badge}
                  </span>
                )}
              </div>
              <span
                className={`text-[11px] mt-1 font-medium ${
                  isActive ? 'text-[#D4AF37] font-bold' : 'text-slate-400'
                }`}
              >
                {tab.label}
              </span>
              {isActive && (
                <span className="w-1.5 h-1.5 rounded-full bg-[#D4AF37] shadow-[0_0_6px_#D4AF37] mt-0.5" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
