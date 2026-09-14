import React, { createContext, useContext, useEffect, useState } from 'react';
import { INITIAL_COLLECTIONS, INITIAL_PRODUCTS } from '../data/seedData';
import {
  CartItem,
  CollectionInfo,
  GoldPriceData,
  PricingSettings,
  Product,
} from '../types';
import { DEFAULT_SETTINGS } from '../utils/pricingEngine';
import { getAuthHeaders } from '../utils/authHelper';

interface GoldStoreContextType {
  goldPrice: GoldPriceData;
  settings: PricingSettings;
  products: Product[];
  collections: CollectionInfo[];
  cart: CartItem[];
  favorites: string[];
  activeTab: string;
  selectedCategory: string | null;
  selectedCollection: string | null;
  searchQuery: string;
  quickViewProduct: Product | null;
  isCartOpen: boolean;
  isLoading: boolean;
  setActiveTab: (tab: string) => void;
  setSelectedCategory: (cat: string | null) => void;
  setSelectedCollection: (col: string | null) => void;
  setSearchQuery: (query: string) => void;
  setQuickViewProduct: (product: Product | null) => void;
  setIsCartOpen: (open: boolean) => void;
  addToCart: (product: Product, quantity?: number) => void;
  removeFromCart: (productId: string) => void;
  updateCartQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  toggleFavorite: (productId: string) => void;
  isFavorite: (productId: string) => boolean;
  refreshGoldPrice: (force?: boolean) => Promise<void>;
  syncWithApi: () => Promise<GoldPriceData | null>;
  refreshProducts: () => Promise<void>;
  updateSettings: (newSettings: Partial<PricingSettings>) => Promise<void>;
  updateStoreSettings: (newSettings: Partial<PricingSettings>) => Promise<void>;
  updateGoldPriceState: (priceData: Partial<GoldPriceData>) => Promise<void>;
  updateGoldPriceManual: (price: number) => Promise<void>;
  addProduct: (product: Product) => Promise<void>;
  updateProduct: (id: string, updates: Partial<Product>) => Promise<void>;
  updateSingleProductPricing: (
    productId: string,
    makingChargePercent: number | null,
    profitPercent: number | null,
    discountPercent?: number
  ) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
}

const initialGoldPrice: GoldPriceData = {
  pricePerGram: 0,
  currency: 'تومان',
  purity: '18 عیار (750)',
  timestamp: '2026-09-02T16:12:00Z',
  jalaliTimestamp: '۱۴۰۵/۰۶/۱۱ - ۱۹:۴۲',
  source: 'نرخ طلا هنوز دریافت نشده است',
  changePercent: 2.88,
  dailyHigh: 22924400,
  dailyLow: 22197000,
  previousPrice: 22197000,
  isManualOverride: false,
  status: 'cached',
  otherMarkets: {
    gold24k: 30446500,
    mesghal: 98916000,
    emamiCoin: 223570000,
    halfCoin: 116000000,
    quarterCoin: 64000000,
    globalOunceUsd: 4387.09,
  },
};

const GoldStoreContext = createContext<GoldStoreContextType | undefined>(undefined);

export const GoldStoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [goldPrice, setGoldPrice] = useState<GoldPriceData>(initialGoldPrice);
  const [settings, setSettings] = useState<PricingSettings>(DEFAULT_SETTINGS);
  const [products, setProducts] = useState<Product[]>(INITIAL_PRODUCTS);
  const [collections, setCollections] = useState<CollectionInfo[]>(INITIAL_COLLECTIONS);
  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem('inana_cart');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('inana_favorites');
      return saved ? JSON.parse(saved) : ['inana-letter-f', 'inana-sig-pendant'];
    } catch {
      return ['inana-letter-f', 'inana-sig-pendant'];
    }
  });

  const [activeTab, setActiveTab] = useState<string>('home');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedCollection, setSelectedCollection] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [quickViewProduct, setQuickViewProduct] = useState<Product | null>(null);
  const [isCartOpen, setIsCartOpen] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Save cart & favorites to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('inana_cart', JSON.stringify(cart));
    } catch (e) {
      console.error(e);
    }
  }, [cart]);

  useEffect(() => {
    try {
      localStorage.setItem('inana_favorites', JSON.stringify(favorites));
    } catch (e) {
      console.error(e);
    }
  }, [favorites]);

  // Fetch initial data from server
  const refreshGoldPrice = async (force: boolean = false) => {
    try {
      const url = force ? '/api/gold-price?force=true' : '/api/gold-price';
      const res = await fetch(url);
      if (!res.ok) throw new Error('دریافت نرخ طلا انجام نشد.');
      if (res.ok) {
        const data = await res.json();
        setGoldPrice(data);
      }
    } catch (err) {
      setGoldPrice(prev => ({ ...prev, status: 'cached' }));
      console.warn('Using local gold price state', err);
    }
  };

  const syncWithApi = async (): Promise<GoldPriceData | null> => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/admin/gold-price/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      });
      if (res.ok) {
        const result = await res.json();
        if (result.goldPrice) {
          setGoldPrice(result.goldPrice);
          await refreshProducts();
          return result.goldPrice;
        }
      }
    } catch (err) {
      console.error('Failed to sync gold price with live API', err);
    } finally {
      setIsLoading(false);
    }
    return null;
  };

  const refreshProducts = async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/products');
      if (res.ok) {
        const data = await res.json();
        setProducts(data);
      }
      const colRes = await fetch('/api/collections');
      if (colRes.ok) {
        const cols = await colRes.json();
        setCollections(cols);
      }
      const setRes = await fetch('/api/settings');
      if (setRes.ok) {
        const sets = await setRes.json();
        setSettings(sets);
      }
    } catch (err) {
      console.warn('Using initial product data', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshGoldPrice();
    refreshProducts();

    // Auto-poll gold price every 1 hour (3600000 ms)
    const ONE_HOUR_MS = 60 * 60 * 1000;
    const interval = setInterval(refreshGoldPrice, ONE_HOUR_MS);

    return () => {
      clearInterval(interval);
    };
  }, []);

  const addToCart = (product: Product, quantity = 1) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      }
      return [...prev, { product, quantity }];
    });
    setIsCartOpen(true);
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const updateCartQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }
    setCart((prev) =>
      prev.map((item) =>
        item.product.id === productId ? { ...item, quantity } : item
      )
    );
  };

  const clearCart = () => {
    setCart([]);
  };

  const toggleFavorite = (productId: string) => {
    setFavorites((prev) =>
      prev.includes(productId)
        ? prev.filter((id) => id !== productId)
        : [...prev, productId]
    );
  };

  const isFavorite = (productId: string) => favorites.includes(productId);

  const updateSettings = async (newSettings: Partial<PricingSettings>) => {
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(newSettings),
      });
      if (!res.ok) throw new Error('تنظیمات ذخیره نشد. دوباره تلاش کنید.');
      if (res.ok) {
        const data = await res.json();
        setSettings(data.settings);
        refreshProducts();
      }
    } catch (e) {
      console.error(e);
      throw e;
    }
  };

  const updateStoreSettings = updateSettings;

  const updateGoldPriceState = async (priceData: Partial<GoldPriceData>) => {
    try {
      const res = await fetch('/api/admin/gold-price', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(priceData),
      });
      if (!res.ok) throw new Error('نرخ طلا ذخیره نشد. دوباره تلاش کنید.');
      if (res.ok) {
        const data = await res.json();
        setGoldPrice(data.goldPrice);
        refreshProducts();
      }
    } catch (e) {
      console.error(e);
      throw e;
    }
  };

  const updateGoldPriceManual = async (price: number) => {
    await updateGoldPriceState({
      pricePerGram: price,
      isManualOverride: true,
    });
  };

  const addProduct = async (product: Product) => {
    const prodWithId: Product = {
      ...product,
      id: product.id || `ina-prod-${Date.now()}`,
      createdAt: product.createdAt || new Date().toISOString(),
    };
    const res = await fetch('/api/admin/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(prodWithId),
    });
    if (!res.ok) throw new Error('ذخیره محصول در سرور انجام نشد.');
    setProducts((prev) => [prodWithId, ...prev.filter((p) => p.id !== prodWithId.id)]);
  };

  const updateProduct = async (id: string, updates: Partial<Product>) => {
    const res = await fetch(`/api/admin/products/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error('ویرایش محصول در سرور انجام نشد.');
    setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, ...updates } : p)));
  };

  const updateSingleProductPricing = async (
    productId: string,
    makingChargePercent: number | null,
    profitPercent: number | null,
    discountPercent?: number
  ) => {
    const updates: Partial<Product> = {
      customMakingChargePercent: makingChargePercent,
      customProfitPercent: profitPercent,
      ...(discountPercent !== undefined ? { discountPercent } : {}),
    };
    const res = await fetch(`/api/admin/products/${productId}/pricing`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error('ذخیره قیمت‌گذاری محصول در سرور انجام نشد.');
    setProducts((prev) =>
      prev.map((p) => (p.id === productId ? { ...p, ...updates } : p))
    );
  };

  const deleteProduct = async (id: string) => {
    const res = await fetch(`/api/admin/products/${id}`, {
      method: 'DELETE',
      headers: { ...getAuthHeaders() },
    });
    if (!res.ok) throw new Error('حذف محصول از سرور انجام نشد.');
    setProducts((prev) => prev.filter((p) => p.id !== id));
  };

  return (
    <GoldStoreContext.Provider
      value={{
        goldPrice,
        settings,
        products,
        collections,
        cart,
        favorites,
        activeTab,
        selectedCategory,
        selectedCollection,
        searchQuery,
        quickViewProduct,
        isCartOpen,
        isLoading,
        setActiveTab,
        setSelectedCategory,
        setSelectedCollection,
        setSearchQuery,
        setQuickViewProduct,
        setIsCartOpen,
        addToCart,
        removeFromCart,
        updateCartQuantity,
        clearCart,
        toggleFavorite,
        isFavorite,
        refreshGoldPrice,
        syncWithApi,
        refreshProducts,
        updateSettings,
        updateStoreSettings,
        updateGoldPriceState,
        updateGoldPriceManual,
        addProduct,
        updateProduct,
        updateSingleProductPricing,
        deleteProduct,
      }}
    >
      {children}
    </GoldStoreContext.Provider>
  );
};

export const useGoldStore = () => {
  const context = useContext(GoldStoreContext);
  if (!context) {
    throw new Error('useGoldStore must be used within a GoldStoreProvider');
  }
  return context;
};
