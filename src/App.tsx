import React, { useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { GoldStoreProvider, useGoldStore } from './context/GoldStoreContext';
import { Navbar } from './components/Navbar';
import { HeroSection } from './components/HeroSection';
import { LiveGoldTicker } from './components/LiveGoldTicker';
import { ShopCatalog } from './components/ShopCatalog';
import { CollectionsShowcase } from './components/CollectionsShowcase';
import { InanaStory } from './components/InanaStory';
import { TestimonialsFAQ } from './components/TestimonialsFAQ';
import { ContactSection } from './components/ContactSection';
import { Footer } from './components/Footer';
import { MobileBottomNav } from './components/MobileBottomNav';
import { CartDrawer } from './components/CartDrawer';
import { ProductDetailModal } from './components/ProductDetailModal';
import { AuthModal } from './components/AuthModal';
import { AdminDashboard } from './components/AdminDashboard';
import { FavoritesView } from './components/FavoritesView';
import { DynamicBackgroundMotion } from './components/DynamicBackgroundMotion';

const MainLayout: React.FC = () => {
  const { activeTab, setActiveTab, quickViewProduct, setQuickViewProduct } = useGoldStore();
  const { isAdmin } = useAuth();

  // Strict guard: Ordinary users are never shown the admin panel and are routed to home
  useEffect(() => {
    if (activeTab === 'admin' && !isAdmin) {
      setActiveTab('home');
    }
  }, [activeTab, isAdmin, setActiveTab]);

  return (
    <div className="min-h-screen bg-[#060B15] text-slate-100 flex flex-col font-sans selection:bg-[#D4AF37] selection:text-slate-950 w-full max-w-full overflow-x-hidden relative">
      {/* Top Navbar */}
      <Navbar />

      {/* Main Content Router based on activeTab */}
      <main className="flex-1 relative w-full max-w-full overflow-x-hidden">
        {activeTab === 'home' && (
          <>
            <HeroSection />
            <CollectionsShowcase />
            <ShopCatalog />
            <LiveGoldTicker />
            <InanaStory />
            <TestimonialsFAQ />
            <ContactSection />
          </>
        )}

        {activeTab === 'shop' && (
          <div className="relative pt-24 min-h-[90vh]">
            <DynamicBackgroundMotion variant="shop-sparkles" />
            <div className="relative z-10">
              <ShopCatalog />
            </div>
          </div>
        )}

        {activeTab === 'gold-price' && (
          <div className="relative pt-24 min-h-[90vh]">
            <DynamicBackgroundMotion variant="gold-flow" />
            <div className="relative z-10">
              <LiveGoldTicker />
              <ShopCatalog />
            </div>
          </div>
        )}

        {activeTab === 'collections' && (
          <div className="relative pt-24 min-h-[90vh]">
            <DynamicBackgroundMotion variant="collections-constellation" />
            <div className="relative z-10">
              <CollectionsShowcase />
              <ShopCatalog />
            </div>
          </div>
        )}

        {activeTab === 'favorites' && (
          <div className="relative pt-24 min-h-[90vh]">
            <DynamicBackgroundMotion variant="favorites-twilight" />
            <div className="relative z-10">
              <FavoritesView />
            </div>
          </div>
        )}

        {activeTab === 'about' && (
          <div className="relative pt-24 min-h-[90vh]">
            <DynamicBackgroundMotion variant="story-mythology" />
            <div className="relative z-10">
              <InanaStory />
              <TestimonialsFAQ />
              <ContactSection />
            </div>
          </div>
        )}

        {activeTab === 'contact' && (
          <div className="relative pt-24 min-h-[90vh]">
            <DynamicBackgroundMotion variant="contact-aurora" />
            <div className="relative z-10">
              <ContactSection />
            </div>
          </div>
        )}

        {activeTab === 'admin' && isAdmin && (
          <div className="relative pt-24 min-h-[90vh]">
            <DynamicBackgroundMotion variant="admin-cyber" />
            <div className="relative z-10">
              <AdminDashboard />
            </div>
          </div>
        )}
      </main>

      {/* Global Modals & Drawers */}
      <CartDrawer />
      <ProductDetailModal
        product={quickViewProduct}
        onClose={() => setQuickViewProduct(null)}
      />
      <AuthModal />

      {/* Footer */}
      <Footer />

      {/* Mobile App Navigation Bar */}
      <MobileBottomNav />
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <GoldStoreProvider>
        <MainLayout />
      </GoldStoreProvider>
    </AuthProvider>
  );
}
