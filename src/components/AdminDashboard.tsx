import React, { useState, useEffect } from 'react';
import {
  Sliders,
  TrendingUp,
  Package,
  Plus,
  Trash2,
  Edit2,
  CheckCircle,
  Clock,
  ShieldCheck,
  RotateCcw,
  Save,
  Search,
  Sparkles,
  ShoppingBag,
  Calculator,
  Copy,
  Check,
  Percent,
  CheckCheck,
  ArrowRight,
  Filter,
  RefreshCw,
  Lock,
  LogIn,
  AlertTriangle,
  AlertCircle,
  KeyRound,
  CheckCircle2,
  XCircle,
  Eye,
  X,
  CreditCard,
  Image as ImageIcon,
  ExternalLink,
  ThumbsUp,
  ThumbsDown,
  FileText,
  Database,
  Terminal,
} from 'lucide-react';
import { useGoldStore } from '../context/GoldStoreContext';
import { useAuth } from '../context/AuthContext';
import { CATEGORIES_LIST } from '../data/seedData';
import { Product, Order } from '../types';
import { formatToman, formatWeight, toPersianDigits } from '../utils/persianFormatter';
import { calculateProductPrice, calculateCustomGoldQuotation } from '../utils/pricingEngine';
import { SystemLogsViewer } from './SystemLogsViewer';
import { getAuthHeaders } from '../utils/authHelper';

export const AdminDashboard: React.FC = () => {
  const {
    goldPrice,
    settings,
    products,
    updateGoldPriceManual,
    updateStoreSettings,
    addProduct,
    updateProduct,
    updateSingleProductPricing,
    deleteProduct,
    refreshGoldPrice,
    syncWithApi,
    setActiveTab,
  } = useGoldStore();

  const { currentUser, userProfile, isAdmin, openAuthModal, logout } = useAuth();

  const [activeAdminTab, setActiveAdminTab] = useState<
    'direct-pricing' | 'products' | 'gold-rate' | 'calculator' | 'orders' | 'logs'
  >('direct-pricing');

  // Direct Product Pricing State
  const [selectedProductId, setSelectedProductId] = useState<string>(
    products[0]?.id || 'inana-letter-f'
  );
  const [productSearchQuery, setProductSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);

  // Selected Product Pricing Form State
  const [singleMakingCharge, setSingleMakingCharge] = useState<number>(20);
  const [singleProfit, setSingleProfit] = useState<number>(7);
  const [singleDiscount, setSingleDiscount] = useState<number>(0);
  const [isCustomProfit, setIsCustomProfit] = useState<boolean>(false);
  const [directSaveSuccess, setDirectSaveSuccess] = useState<boolean>(false);
  const [savingProductId, setSavingProductId] = useState<string | null>(null);

  // Pricing inputs for Tab: gold-rate
  const [overridePrice, setOverridePrice] = useState<number>(goldPrice.pricePerGram);
  const [profitPct, setProfitPct] = useState<number>(settings.profitPercent || 7);
  const [taxPct, setTaxPct] = useState<number>(settings.taxPercent || 9);
  const [globalMakingChargePct, setGlobalMakingChargePct] = useState<number>(
    settings.globalMakingChargePercent || 20
  );
  const [rateSaveSuccess, setRateSaveSuccess] = useState(false);
  const [isSyncingApi, setIsSyncingApi] = useState(false);

  const handleSyncLiveApi = async () => {
    setIsSyncingApi(true);
    const updated = await syncWithApi();
    if (updated) {
      setOverridePrice(updated.pricePerGram);
      setRateSaveSuccess(true);
      setTimeout(() => setRateSaveSuccess(false), 3000);
    }
    setIsSyncingApi(false);
  };

  // Exclusive Admin Calculator State
  const [calcWeight, setCalcWeight] = useState<number>(2.5);
  const [calcMakingCharge, setCalcMakingCharge] = useState<number>(20);
  const [calcProfit, setCalcProfit] = useState<number>(7);
  const [calcTax, setCalcTax] = useState<number>(9);
  const [calcDiscount, setCalcDiscount] = useState<number>(0);
  const [copiedQuotation, setCopiedQuotation] = useState(false);

  const quotationResult = calculateCustomGoldQuotation(
    calcWeight,
    goldPrice.pricePerGram,
    calcMakingCharge,
    calcProfit,
    calcTax,
    calcDiscount
  );

  // Orders list and Card-to-Card Verification States
  const [orders, setOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [orderFilterStatus, setOrderFilterStatus] = useState<
    'all' | 'در انتظار بررسی' | 'تأیید شده' | 'رد شده' | 'other'
  >('all');
  const [orderSearchQuery, setOrderSearchQuery] = useState('');
  const [viewingReceiptOrder, setViewingReceiptOrder] = useState<Order | null>(null);
  const [rejectingOrder, setRejectingOrder] = useState<Order | null>(null);
  const [rejectionReasonInput, setRejectionReasonInput] = useState('');
  const [deletingOrder, setDeletingOrder] = useState<Order | null>(null);
  const [isDeletingLoading, setIsDeletingLoading] = useState(false);
  const [actionLoadingOrderId, setActionLoadingOrderId] = useState<string | null>(null);
  const [orderActionNotification, setOrderActionNotification] = useState<{
    message: string;
    type: 'success' | 'error';
  } | null>(null);

  // Bank Card Settings State (synchronized with store settings)
  const [adminBankCard, setAdminBankCard] = useState(
    settings.bankCardNumber || '۶۰۳۷-۹۹۱۸-۴۲۱۰-۸۸۷۶'
  );
  const [adminBankHolder, setAdminBankHolder] = useState(
    settings.bankCardHolder || 'امیر بی‌اشد (گالری طلا و جواهر اینانا)'
  );
  const [adminBankName, setAdminBankName] = useState(
    settings.bankName || 'بانک ملی ایران (شعبه تجریش)'
  );
  const [adminBankSheba, setAdminBankSheba] = useState(
    settings.bankSheba || 'IR-120170000000108876543210'
  );

  useEffect(() => {
    if (settings.bankCardNumber) setAdminBankCard(settings.bankCardNumber);
    if (settings.bankCardHolder) setAdminBankHolder(settings.bankCardHolder);
    if (settings.bankName) setAdminBankName(settings.bankName);
    if (settings.bankSheba) setAdminBankSheba(settings.bankSheba);
  }, [settings]);

  // New/Edit product form state
  const [isEditingProduct, setIsEditingProduct] = useState(false);
  const [productFormError, setProductFormError] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [productForm, setProductForm] = useState<Partial<Product>>({
    title: '',
    titleEn: '',
    category: 'پلاک حروف (INANA LETTERS)',
    collection: 'INANA LETTERS',
    weight: 1.0,
    purity: '18 عیار',
    customMakingChargePercent: 20,
    customProfitPercent: 7,
    discountPercent: 0,
    stock: 5,
    description: '',
    features: ['طلای ۱۸ عیار استاندارد ۷۵۰', 'دست‌ساز با پرداخت آینه‌ای'],
    images: [
      'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=800&q=80',
    ],
    sku: `INA-${Math.floor(1000 + Math.random() * 9000)}`,
    letter: '',
    isNewArrival: true,
  });

  // Keep selected product in sync
  const selectedProduct =
    products.find((p) => p.id === selectedProductId) || products[0] || null;

  useEffect(() => {
    if (selectedProduct) {
      setSingleMakingCharge(
        selectedProduct.customMakingChargePercent !== undefined &&
          selectedProduct.customMakingChargePercent !== null
          ? selectedProduct.customMakingChargePercent
          : settings.globalMakingChargePercent || 20
      );
      if (
        selectedProduct.customProfitPercent !== undefined &&
        selectedProduct.customProfitPercent !== null
      ) {
        setSingleProfit(selectedProduct.customProfitPercent);
        setIsCustomProfit(true);
      } else {
        setSingleProfit(settings.profitPercent || 7);
        setIsCustomProfit(false);
      }
      setSingleDiscount(selectedProduct.discountPercent || 0);
    }
  }, [selectedProductId, selectedProduct, settings]);

  const fetchOrders = async () => {
    setLoadingOrders(true);
    try {
      const res = await fetch('/api/orders', { headers: { ...getAuthHeaders() } });
      if (!res.ok) throw new Error('دریافت سفارش‌ها از سرور انجام نشد.');
      const serverOrders: Order[] = await res.json();
      const sortedOrders = serverOrders.sort(
        (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
      );
      setOrders(sortedOrders);
    } catch (err) {
      console.error('[ORDERS] Server fetch failed:', err);
    } finally {
      setLoadingOrders(false);
    }
  };

  useEffect(() => {
    if (activeAdminTab === 'orders') {
      fetchOrders();
      const interval = window.setInterval(fetchOrders, 15000);
      return () => window.clearInterval(interval);
    }
  }, [activeAdminTab]);

  // Handle direct save for the currently selected product
  const handleSaveDirectPricing = async () => {
    if (!selectedProduct) return;
    setSavingProductId(selectedProduct.id);

    const effectiveProfit = isCustomProfit ? singleProfit : null;
    await updateSingleProductPricing(
      selectedProduct.id,
      singleMakingCharge,
      effectiveProfit,
      singleDiscount
    );

    setDirectSaveSuccess(true);
    setSavingProductId(null);
    setTimeout(() => setDirectSaveSuccess(false), 3000);
  };

  // Handle global gold rate and bank account settings save
  const handleSaveRateAndGlobalSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateGoldPriceManual(overridePrice);
    await updateStoreSettings({
      profitPercent: profitPct,
      taxPercent: taxPct,
      globalMakingChargePercent: globalMakingChargePct,
      bankCardNumber: adminBankCard.trim(),
      bankCardHolder: adminBankHolder.trim(),
      bankName: adminBankName.trim(),
      bankSheba: adminBankSheba.trim(),
    });
    setRateSaveSuccess(true);
    setTimeout(() => setRateSaveSuccess(false), 3000);
  };

  // Handle full product save (create or full edit)
  const handleSaveProductFull = async (e: React.FormEvent) => {
    e.preventDefault();
    setProductFormError(null);
    if (!productForm.title?.trim() || !productForm.weight || Number(productForm.weight) <= 0) {
      setProductFormError('لطفاً عنوان و وزن معتبر برای محصول را وارد فرمایید.');
      return;
    }

    if (isEditingProduct && productForm.id) {
      await updateProduct(productForm.id, productForm);
    } else {
      const newProd: Product = {
        id: `prod-${Date.now()}`,
        sku: productForm.sku || `INA-${Math.floor(1000 + Math.random() * 9000)}`,
        title: productForm.title || '',
        titleEn: productForm.titleEn || '',
        slug: productForm.title?.toLowerCase().replace(/\s+/g, '-') || `prod-${Date.now()}`,
        category: productForm.category || 'پلاک و مدال',
        collection: productForm.collection || 'INANA SIGNATURE',
        weight: Number(productForm.weight) || 1,
        purity: '18 عیار',
        customMakingChargePercent: Number(productForm.customMakingChargePercent) || 20,
        customProfitPercent:
          productForm.customProfitPercent !== undefined && productForm.customProfitPercent !== null
            ? Number(productForm.customProfitPercent)
            : null,
        additionalCost: 0,
        stoneCost: 0,
        stock: Number(productForm.stock) || 1,
        description: productForm.description || '',
        features: productForm.features || ['طلای ۱۸ عیار ۷۵۰'],
        images:
          productForm.images && productForm.images.length > 0
            ? productForm.images
            : [
                'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=800&q=80',
              ],
        letter: productForm.letter || undefined,
        discountPercent: Number(productForm.discountPercent) || 0,
        isNewArrival: productForm.isNewArrival ?? true,
        isBestSeller: productForm.isBestSeller ?? false,
        isFeatured: productForm.isFeatured ?? true,
        createdAt: new Date().toISOString(),
      };
      await addProduct(newProd);
    }

    // Reset Form
    setIsEditingProduct(false);
    setProductForm({
      title: '',
      category: 'پلاک حروف (INANA LETTERS)',
      collection: 'INANA LETTERS',
      weight: 1.0,
      purity: '18 عیار',
      customMakingChargePercent: 20,
      customProfitPercent: 7,
      discountPercent: 0,
      stock: 5,
      description: '',
      images: [
        'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=800&q=80',
      ],
      sku: `INA-${Math.floor(1000 + Math.random() * 9000)}`,
      letter: '',
    });
  };

  const startEditProduct = (prod: Product) => {
    setProductForm(prod);
    setIsEditingProduct(true);
    setActiveAdminTab('products');
    window.scrollTo({ top: 200, behavior: 'smooth' });
  };

  const handleUpdateOrderStatus = async (orderId: string, newStatus: string) => {
    setActionLoadingOrderId(orderId);
    try {
      const nowIso = new Date().toISOString();
      const res = await fetch(`/api/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({
          status: newStatus,
          reviewedAt: nowIso,
        }),
      });

      if (res.ok) {
        setOrders((prev) =>
          prev.map((o) =>
            o.id === orderId
              ? {
                  ...o,
                  status: newStatus as any,
                  reviewedAt: nowIso,
                  updatedAt: nowIso,
                }
              : o
          )
        );
        setOrderActionNotification({
          message: `وضعیت سفارش به «${newStatus}» تغییر یافت.`,
          type: 'success',
        });
        setTimeout(() => setOrderActionNotification(null), 3000);
      }
    } catch {
      // ignore
    } finally {
      setActionLoadingOrderId(null);
    }
  };

  const handleApproveOrder = async (order: Order) => {
    setActionLoadingOrderId(order.id);
    try {
      const nowIso = new Date().toISOString();
      const res = await fetch(`/api/orders/${order.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({
          status: 'تأیید شده',
          reviewedAt: nowIso,
        }),
      });

      if (res.ok) {
        setOrders((prev) =>
          prev.map((o) =>
            o.id === order.id
              ? {
                  ...o,
                  status: 'تأیید شده' as any,
                  reviewedAt: nowIso,
                  updatedAt: nowIso,
                }
              : o
          )
        );
        setOrderActionNotification({
          message: `فیش و سفارش کد ${order.trackingCode} با موفقیت تایید شد.`,
          type: 'success',
        });
        setTimeout(() => setOrderActionNotification(null), 3500);
        if (viewingReceiptOrder?.id === order.id) {
          setViewingReceiptOrder(null);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoadingOrderId(null);
    }
  };

  const handleRejectOrder = async () => {
    if (!rejectingOrder) return;
    const orderId = rejectingOrder.id;
    const tracking = rejectingOrder.trackingCode;
    setActionLoadingOrderId(orderId);
    try {
      const reason = rejectionReasonInput.trim() || 'عدم تطابق یا تایید فیش بانکی';
      const nowIso = new Date().toISOString();
      const res = await fetch(`/api/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({
          status: 'رد شده',
          rejectionReason: reason,
          reviewedAt: nowIso,
        }),
      });

      if (res.ok) {
        setOrders((prev) =>
          prev.map((o) =>
            o.id === orderId
              ? {
                  ...o,
                  status: 'رد شده' as any,
                  rejectionReason: reason,
                  reviewedAt: nowIso,
                  updatedAt: nowIso,
                }
              : o
          )
        );
        setOrderActionNotification({
          message: `سفارش کد ${tracking} با ثبت دلیل رد شد.`,
          type: 'error',
        });
        setTimeout(() => setOrderActionNotification(null), 3500);
        setRejectingOrder(null);
        setRejectionReasonInput('');
        if (viewingReceiptOrder?.id === orderId) {
          setViewingReceiptOrder(null);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoadingOrderId(null);
    }
  };

  const handleDeleteOrder = async () => {
    if (!deletingOrder) return;
    const targetId = deletingOrder.id;
    const tracking = deletingOrder.trackingCode;
    setIsDeletingLoading(true);

    try {
      const res = await fetch(`/api/orders/${targetId}`, {
        method: 'DELETE',
        headers: { ...getAuthHeaders() },
      });

      if (res.ok) {
        setOrders((prev) => prev.filter((o) => o.id !== targetId));
        setOrderActionNotification({
          message: `سفارش کد ${tracking} با موفقیت از پایگاه داده و حافظه حذف گردید.`,
          type: 'success',
        });
        setTimeout(() => setOrderActionNotification(null), 3500);
        setDeletingOrder(null);
      } else {
        setOrderActionNotification({
          message: 'خطا در حذف سفارش از پایگاه داده.',
          type: 'error',
        });
        setTimeout(() => setOrderActionNotification(null), 3500);
      }
    } catch (err) {
      console.error(err);
      setOrderActionNotification({
        message: 'خطا در برقراری ارتباط با سرور جهت حذف سفارش.',
        type: 'error',
      });
      setTimeout(() => setOrderActionNotification(null), 3500);
    } finally {
      setIsDeletingLoading(false);
    }
  };

  const handleClearRejectedOrders = async () => {
    const rejected = orders.filter((o) => o.status === 'رد شده');
    if (rejected.length === 0) {
      setOrderActionNotification({
        message: 'هیچ سفارشی با وضعیت «رد شده» جهت پاکسازی وجود ندارد.',
        type: 'error',
      });
      setTimeout(() => setOrderActionNotification(null), 3500);
      return;
    }

    const ids = rejected.map((o) => o.id);
    try {
      const res = await fetch('/api/orders', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ ids }),
      });
      if (res.ok) {
        setOrders((prev) => prev.filter((o) => o.status !== 'رد شده'));
        setOrderActionNotification({
          message: `${rejected.length} سفارش رد شده از پایگاه داده و حافظه پاکسازی شد.`,
          type: 'success',
        });
        setTimeout(() => setOrderActionNotification(null), 3500);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const copyQuotationText = () => {
    const text = `📋 استعلام قیمت و پیش‌فاکتور گالری طلای اینانا:
وزن طلا: ${formatWeight(calcWeight)}
نرخ طلای ۱۸ عیار: ${formatToman(goldPrice.pricePerGram)} / گرم
اجرت ساخت: ${calcMakingCharge}٪
سود طلافروش: ${calcProfit}٪ (مصوب رسمی اتحادیه)
مالیات ارزش افزوده: ${calcTax}٪
${calcDiscount > 0 ? `تخفیف ویژه اختصاصی: ${calcDiscount}٪ (${formatToman(quotationResult.discountAmount)})\n` : ''}مبلغ نهایی قابل پرداخت: ${formatToman(quotationResult.finalPrice)}
اعتبار پیش‌فاکتور: تا پایان ساعات کاری روز جاری`;

    navigator.clipboard.writeText(text);
    setCopiedQuotation(true);
    setTimeout(() => setCopiedQuotation(false), 2500);
  };

  // Filtered products for selection
  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      p.title.toLowerCase().includes(productSearchQuery.toLowerCase()) ||
      p.sku.toLowerCase().includes(productSearchQuery.toLowerCase()) ||
      (p.letter && p.letter.toLowerCase() === productSearchQuery.toLowerCase());
    const matchesCategory = categoryFilter ? p.category === categoryFilter : true;
    return matchesSearch && matchesCategory;
  });

  // Calculate live preview for selected product
  const previewBreakdown = selectedProduct
    ? calculateProductPrice(
        {
          ...selectedProduct,
          customMakingChargePercent: singleMakingCharge,
          customProfitPercent: isCustomProfit ? singleProfit : settings.profitPercent || 7,
          discountPercent: singleDiscount,
        },
        goldPrice.pricePerGram,
        settings
      )
    : null;

  if (!isAdmin) {
    return (
      <section
        id="admin-dashboard-restricted-section"
        className="py-16 px-4 sm:px-6 lg:px-8 bg-[#050A14] min-h-[80vh] flex items-center justify-center w-full"
      >
        <div className="max-w-md w-full mx-auto bg-[#0E1A33] border border-[#D4AF37]/40 rounded-3xl p-6 sm:p-8 text-center shadow-[0_0_50px_rgba(212,175,55,0.15)] relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#D4AF37]/10 rounded-full blur-2xl pointer-events-none" />

          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-[#D4AF37]/20 to-[#1E3A8A] border border-[#D4AF37]/40 flex items-center justify-center mx-auto mb-5 text-[#D4AF37] shadow-lg">
            <Lock className="w-8 h-8" />
          </div>

          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold text-[#D4AF37] bg-[#D4AF37]/10 border border-[#D4AF37]/30 mb-3">
            <ShieldCheck className="w-3.5 h-3.5" />
            سطح دسترسی محافظت شده
          </span>

          <h2 className="text-xl sm:text-2xl font-black text-white mb-2">
            پنل مدیریت اختصاصی گالری اینانا
          </h2>

          <p className="text-xs sm:text-sm text-slate-300 mb-6 leading-relaxed">
            این بخش منحصراً متعلق به مدیران ارشد سیستم است و برای اعمال مستقیم درصد اجرت، سود طلا و مدیریت کاتالوگ در پایگاه داده طراحی شده است.
          </p>

          {currentUser ? (
            <div className="mb-6 p-3.5 rounded-2xl bg-[#0A1120] border border-slate-700/80 text-right">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                <span className="text-xs font-bold text-amber-300">عدم دسترسی حساب فعلی</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-normal">
                شما هم‌اکنون با حساب <span className="text-white font-mono dir-ltr inline-block">{currentUser.email}</span> وارد شده‌اید که دسترسی مشتری عادی دارد.
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={logout}
                  className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-all"
                >
                  خروج از این حساب
                </button>
              </div>
            </div>
          ) : (
            <div className="mb-6 p-3.5 rounded-2xl bg-[#0A1120] border border-[#D4AF37]/20 text-xs text-slate-300">
              لطفاً با حساب کاربری مدیر مجاز وارد سیستم شوید تا تمام امکانات مدیریتی فعال گردد.
            </div>
          )}

          <div className="flex flex-col gap-2.5">
            <button
              onClick={() => openAuthModal('login')}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-[#D4AF37] via-[#E6CA65] to-[#C5A059] text-slate-950 font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg hover:brightness-110 active:scale-98 transition-all"
            >
              <LogIn className="w-4 h-4" />
              <span>ورود با حساب کاربری مدیر</span>
            </button>

            <button
              onClick={() => setActiveTab('home')}
              className="w-full py-2.5 rounded-xl bg-[#13254A] hover:bg-[#1A3264] text-slate-300 hover:text-white text-xs font-semibold border border-slate-700 transition-all"
            >
              بازگشت به ویترین و کاتالوگ فروشگاه
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section id="admin-dashboard-section" className="py-8 sm:py-10 px-3 sm:px-6 lg:px-8 bg-[#050A14] min-h-screen w-full max-w-full overflow-hidden">
      <div className="max-w-7xl mx-auto w-full min-w-0">
        {/* Admin Verified Status Banner */}
        <div className="mb-6 p-3.5 sm:p-4 rounded-2xl bg-gradient-to-r from-emerald-950/50 via-[#0E1A33] to-[#0A1120] border border-emerald-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30 flex-shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-white text-sm">دسترسی مدیر ارشد تایید شد</span>
                <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-mono dir-ltr">
                  {currentUser?.email || userProfile?.email || 'admin'}
                </span>
              </div>
              <p className="text-[11px] text-slate-300 mt-0.5">
                تغییرات محصولات، اجرت، سود و نرخ‌ها به صورت امن در پایگاه داده اصلی سایت ذخیره می‌شوند.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-center">
            <span className="text-[10px] text-emerald-400 bg-emerald-950/80 px-3 py-1 rounded-full border border-emerald-500/30 whitespace-nowrap">
              ● ذخیره‌سازی ابری فعال
            </span>
          </div>
        </div>

        {/* Header */}
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 pb-6 border-b border-slate-800 mb-8 w-full min-w-0">
          <div>
            <div className="inline-flex items-center gap-2 text-xs font-semibold text-[#D4AF37] uppercase tracking-widest mb-1">
              <Sliders className="w-4 h-4 text-[#D4AF37]" />
              <span>پنل مدیریت اختصاصی گالری طلای اینانا</span>
            </div>
            <h1 className="text-xl sm:text-3xl font-extrabold text-white">
              تنظیم مستقیم اجرت و سود طلاها
            </h1>
            <p className="text-slate-400 text-xs sm:text-sm mt-1">
              هر قطعه طلا را انتخاب کنید و درصد اجرت و سود را منحصراً برای همان طلا تنظیم و اعمال نمایید.
            </p>
          </div>

          {/* Tab Selector */}
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar bg-[#0A1120] p-1.5 rounded-2xl border border-slate-800 w-full lg:w-auto max-w-full min-w-0">
            {[
              { id: 'direct-pricing', label: 'تنظیم مستقیم اجرت و سود طلا', icon: Percent },
              { id: 'products', label: 'مدیریت کل محصولات', icon: Package },
              { id: 'gold-rate', label: 'نرخ پایه و فرمول', icon: TrendingUp },
              { id: 'calculator', label: 'ماشین‌حساب ادمین', icon: Calculator },
              { id: 'orders', label: 'سفارش‌ها', icon: ShoppingBag },
              { id: 'logs', label: 'لاگ‌ها و مانیتورینگ', icon: Terminal },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeAdminTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveAdminTab(tab.id as any)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap transition-all flex-shrink-0 ${
                    isActive
                      ? 'bg-[#D4AF37] text-slate-950 font-bold shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* TAB 1: DIRECT SINGLE-PRODUCT MAKING CHARGE & PROFIT CONFIGURATOR (MAIN) */}
        {/* ========================================================================= */}
        {activeAdminTab === 'direct-pricing' && (
          <div className="space-y-8">
            {/* Top Notification Banner */}
            <div className="bg-gradient-to-r from-[#D4AF37]/15 via-[#0A1120] to-[#0A1120] border border-[#D4AF37]/30 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-[#D4AF37]/20 text-[#D4AF37] rounded-xl">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-xs font-bold text-[#F5E8C7] block">
                    امکان انتخاب دلخواه هر طلا و اعمال مستقیم درصد اجرت و سود
                  </span>
                  <span className="text-[11px] text-slate-400">
                    تغییرات شما فوراً قیمت محصول را در ویترین، جزئیات، فاکتور و سبد خرید مشتریان بروزرسانی می‌کند.
                  </span>
                </div>
              </div>
              <div className="text-left sm:text-right">
                <span className="text-[11px] text-slate-400 block">نرخ طلای ۱۸ عیار:</span>
                <span className="text-sm font-bold text-[#D4AF37]">
                  {formatToman(goldPrice.pricePerGram)} / گرم
                </span>
              </div>
            </div>

            {/* Main Configurator 2-Column Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* Left Column (Persian Right): Product Selector Grid */}
              <div className="lg:col-span-5 luxury-glass-card rounded-3xl p-5 sm:p-6 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <Package className="w-4 h-4 text-[#D4AF37]" />
                    <h2 className="text-sm font-bold text-white">۱. طلای مورد نظر را انتخاب کنید:</h2>
                  </div>
                  <span className="text-xs text-slate-400">
                    {toPersianDigits(filteredProducts.length)} قطعه طلا
                  </span>
                </div>

                {/* Search & Filter */}
                <div className="space-y-2">
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="جستجوی نام، کد طلا یا حرف..."
                      value={productSearchQuery}
                      onChange={(e) => setProductSearchQuery(e.target.value)}
                      className="w-full bg-[#060B14] border border-slate-700 focus:border-[#D4AF37] rounded-xl pr-10 pl-3 py-2 text-xs text-white outline-none"
                    />
                  </div>

                  {/* Category Chips */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-[11px]">
                    <button
                      onClick={() => setCategoryFilter(null)}
                      className={`px-2.5 py-1 rounded-lg whitespace-nowrap transition-colors ${
                        categoryFilter === null
                          ? 'bg-[#D4AF37] text-slate-950 font-bold'
                          : 'bg-[#060B14] text-slate-400 hover:text-white border border-slate-800'
                      }`}
                    >
                      همه
                    </button>
                    {CATEGORIES_LIST.map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setCategoryFilter(categoryFilter === cat ? null : cat)}
                        className={`px-2.5 py-1 rounded-lg whitespace-nowrap transition-colors ${
                          categoryFilter === cat
                            ? 'bg-[#D4AF37] text-slate-950 font-bold'
                            : 'bg-[#060B14] text-slate-400 hover:text-white border border-slate-800'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Product List Scrollable Grid */}
                <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1 custom-scrollbar">
                  {filteredProducts.map((p) => {
                    const isSelected = p.id === selectedProductId;
                    const priceBreakdown = calculateProductPrice(
                      p,
                      goldPrice.pricePerGram,
                      settings
                    );
                    const currentMaking =
                      p.customMakingChargePercent ?? settings.globalMakingChargePercent ?? 20;
                    const currentProfit =
                      p.customProfitPercent ?? settings.profitPercent ?? 7;

                    return (
                      <div
                        key={p.id}
                        onClick={() => setSelectedProductId(p.id)}
                        className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                          isSelected
                            ? 'bg-[#D4AF37]/15 border-[#D4AF37] shadow-[0_0_20px_rgba(212,175,55,0.15)] ring-1 ring-[#D4AF37]'
                            : 'bg-[#060B14]/80 border-slate-800 hover:border-slate-700 hover:bg-[#060B14]'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <img
                            src={p.images[0]}
                            alt={p.title}
                            className="w-12 h-12 object-cover rounded-xl border border-slate-700 flex-shrink-0"
                          />
                          <div>
                            <span className="text-xs font-bold text-white block line-clamp-1">
                              {p.title}
                            </span>
                            <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-1">
                              <span>وزن: {formatWeight(p.weight)}</span>
                              <span className="text-slate-600">•</span>
                              <span className="text-[#D4AF37] font-semibold">
                                اجرت: {currentMaking}٪
                              </span>
                              <span className="text-slate-600">•</span>
                              <span className="text-emerald-400 font-semibold">
                                سود: {currentProfit}٪
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="text-left flex-shrink-0">
                          <span className="text-xs font-bold text-white block">
                            {formatToman(priceBreakdown.finalPrice)}
                          </span>
                          {isSelected && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#D4AF37] mt-0.5">
                              <Check className="w-3 h-3" />
                              <span>انتخاب شده</span>
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Right Column (Persian Left): Active Configurator for Selected Product */}
              {selectedProduct && previewBreakdown && (
                <div className="lg:col-span-7 space-y-6">
                  {/* Selected Item Editor Card */}
                  <div className="luxury-glass-card rounded-3xl p-6 sm:p-8 border-[#D4AF37]/30 shadow-[0_10px_35px_rgba(212,175,55,0.1)]">
                    {/* Header with Product Quick Identity */}
                    <div className="flex items-start justify-between gap-4 pb-5 border-b border-slate-800">
                      <div className="flex items-center gap-4">
                        <img
                          src={selectedProduct.images[0]}
                          alt={selectedProduct.title}
                          className="w-16 h-16 sm:w-20 sm:h-20 object-cover rounded-2xl border-2 border-[#D4AF37] shadow-md flex-shrink-0"
                        />
                        <div>
                          <span className="text-[10px] uppercase font-bold text-[#D4AF37] bg-[#D4AF37]/10 px-2.5 py-0.5 rounded-full border border-[#D4AF37]/20">
                            {selectedProduct.category}
                          </span>
                          <h2 className="text-base sm:text-lg font-bold text-white mt-1">
                            {selectedProduct.title}
                          </h2>
                          <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                            <span>کد: {selectedProduct.sku}</span>
                            <span>•</span>
                            <span className="text-white font-semibold">
                              وزن خالص: {formatWeight(selectedProduct.weight, true)}
                            </span>
                            <span>•</span>
                            <span>عیار: {selectedProduct.purity}</span>
                          </div>
                        </div>
                      </div>

                      {directSaveSuccess && (
                        <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-bold bg-emerald-500/10 px-3.5 py-1.5 rounded-full border border-emerald-500/30 animate-in fade-in">
                          <CheckCheck className="w-4 h-4" />
                          <span>روی این طلا اعمال شد!</span>
                        </div>
                      )}
                    </div>

                    {/* Direct Sliders & Inputs */}
                    <div className="space-y-6 mt-6">
                      {/* 1. Making Charge (اجرت ساخت اختصاصی این طلا) */}
                      <div className="bg-[#060B14] p-5 rounded-2xl border border-[#D4AF37]/40 shadow-inner">
                        <div className="flex justify-between items-center mb-2">
                          <label className="text-xs sm:text-sm font-bold text-white flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-[#D4AF37]"></span>
                            <span>درصد اجرت ساخت این طلا:</span>
                          </label>
                          <div className="flex items-center gap-2">
                            <div className="relative w-24">
                              <input
                                type="number"
                                min="0"
                                max="60"
                                step="1"
                                value={singleMakingCharge}
                                onChange={(e) =>
                                  setSingleMakingCharge(
                                    Math.max(0, parseFloat(e.target.value) || 0)
                                  )
                                }
                                className="w-full bg-[#0A1120] border border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/50 rounded-xl px-2.5 py-1.5 text-sm font-bold text-white text-center outline-none"
                              />
                              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-[#D4AF37] font-bold">
                                ٪
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Slider */}
                        <input
                          type="range"
                          min="0"
                          max="45"
                          step="1"
                          value={singleMakingCharge}
                          onChange={(e) => setSingleMakingCharge(parseInt(e.target.value, 10))}
                          className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-[#D4AF37] my-3"
                        />

                        {/* Preset Buttons */}
                        <div className="flex flex-wrap items-center gap-1.5 pt-1">
                          <span className="text-[11px] text-slate-400 ml-2">انتخاب سریع:</span>
                          {[10, 15, 18, 20, 24, 26, 30].map((preset) => (
                            <button
                              key={preset}
                              type="button"
                              onClick={() => setSingleMakingCharge(preset)}
                              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                                singleMakingCharge === preset
                                  ? 'bg-[#D4AF37] text-slate-950 font-bold shadow'
                                  : 'bg-[#0A1120] text-slate-300 hover:text-white border border-slate-800'
                              }`}
                            >
                              {preset}٪
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* 2. Profit (سود فروشنده اختصاصی این طلا) */}
                      <div className="bg-[#060B14] p-5 rounded-2xl border border-emerald-500/30 shadow-inner">
                        <div className="flex justify-between items-center mb-2">
                          <label className="text-xs sm:text-sm font-bold text-white flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                            <span>درصد سود فروشنده برای این طلا:</span>
                          </label>
                          <div className="flex items-center gap-2">
                            <div className="relative w-24">
                              <input
                                type="number"
                                min="0"
                                max="30"
                                step="1"
                                value={singleProfit}
                                onChange={(e) => {
                                  setSingleProfit(Math.max(0, parseFloat(e.target.value) || 0));
                                  setIsCustomProfit(true);
                                }}
                                className="w-full bg-[#0A1120] border border-emerald-500 focus:ring-2 focus:ring-emerald-400/50 rounded-xl px-2.5 py-1.5 text-sm font-bold text-white text-center outline-none"
                              />
                              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-emerald-400 font-bold">
                                ٪
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Slider */}
                        <input
                          type="range"
                          min="0"
                          max="20"
                          step="1"
                          value={singleProfit}
                          onChange={(e) => {
                            setSingleProfit(parseInt(e.target.value, 10));
                            setIsCustomProfit(true);
                          }}
                          className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-400 my-3"
                        />

                        {/* Profit Modes & Presets */}
                        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-[11px] text-slate-400 ml-1">پیش‌فرض‌ها:</span>
                            {[0, 5, 7, 9, 10, 12].map((preset) => (
                              <button
                                key={preset}
                                type="button"
                                onClick={() => {
                                  setSingleProfit(preset);
                                  setIsCustomProfit(true);
                                }}
                                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                                  singleProfit === preset
                                    ? 'bg-emerald-500 text-slate-950 font-bold shadow'
                                    : 'bg-[#0A1120] text-slate-300 hover:text-white border border-slate-800'
                                }`}
                              >
                                {preset === 7 ? '۷٪ (اتحادیه)' : `${preset}٪`}
                              </button>
                            ))}
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              setSingleProfit(settings.profitPercent || 7);
                              setIsCustomProfit(false);
                            }}
                            className={`text-[11px] px-3 py-1 rounded-lg border transition-colors ${
                              !isCustomProfit
                                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-bold'
                                : 'text-slate-400 border-slate-800 hover:text-white'
                            }`}
                          >
                            سود عمومی گالری ({settings.profitPercent || 7}٪)
                          </button>
                        </div>
                      </div>

                      {/* 3. Discount (تخفیف ویژه این طلا) */}
                      <div className="bg-[#060B14] p-4 rounded-2xl border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                        <div>
                          <label className="text-xs font-bold text-slate-300 block">
                            درصد تخفیف اختصاصی این طلا:
                          </label>
                          <span className="text-[11px] text-slate-500">
                            در ویترین به صورت نشان قرمز درصد تخفیف نمایش داده می‌شود.
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="0"
                            max="50"
                            value={singleDiscount}
                            onChange={(e) =>
                              setSingleDiscount(Math.max(0, parseFloat(e.target.value) || 0))
                            }
                            className="w-20 bg-[#0A1120] border border-slate-700 focus:border-rose-500 rounded-xl px-2.5 py-1.5 text-xs font-bold text-white text-center outline-none"
                          />
                          <span className="text-xs text-rose-400 font-bold">٪ تخفیف</span>
                        </div>
                      </div>

                      {/* 4. Live Calculated Price Preview Box */}
                      <div className="p-5 rounded-2xl bg-gradient-to-b from-[#0A1120] to-[#060B14] border border-[#D4AF37]/50 shadow-lg space-y-3">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                          <span className="text-xs font-bold text-[#D4AF37] flex items-center gap-1.5">
                            <Sparkles className="w-4 h-4" />
                            <span>پیش‌نمایش قیمت نهایی این طلا در فروشگاه:</span>
                          </span>
                          <span className="text-xs text-slate-400">
                            وزن: {formatWeight(selectedProduct.weight)}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-slate-300 py-1">
                          <div className="bg-[#060B14] p-2.5 rounded-xl border border-slate-800">
                            <span className="text-slate-400 block">طلای خام:</span>
                            <span className="font-bold text-white mt-0.5 block">
                              {formatToman(previewBreakdown.baseGoldValue)}
                            </span>
                          </div>
                          <div className="bg-[#060B14] p-2.5 rounded-xl border border-slate-800">
                            <span className="text-[#D4AF37] block">
                              اجرت ({singleMakingCharge}٪):
                            </span>
                            <span className="font-bold text-white mt-0.5 block">
                              {formatToman(previewBreakdown.makingChargeAmount)}
                            </span>
                          </div>
                          <div className="bg-[#060B14] p-2.5 rounded-xl border border-slate-800">
                            <span className="text-emerald-400 block">
                              سود ({isCustomProfit ? singleProfit : settings.profitPercent || 7}٪):
                            </span>
                            <span className="font-bold text-white mt-0.5 block">
                              {formatToman(previewBreakdown.profitAmount)}
                            </span>
                          </div>
                          <div className="bg-[#060B14] p-2.5 rounded-xl border border-slate-800">
                            <span className="text-slate-400 block">مالیات (۹٪):</span>
                            <span className="font-bold text-white mt-0.5 block">
                              {formatToman(previewBreakdown.taxAmount)}
                            </span>
                          </div>
                        </div>

                        {/* Final Price Highlight */}
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pt-3 border-t border-[#D4AF37]/20">
                          <div>
                            <span className="text-xs text-slate-400 block">قیمت نمایشی زیر عکس در ویترین:</span>
                            <span className="text-2xl sm:text-3xl font-extrabold text-white gold-gradient-text">
                              {formatToman(previewBreakdown.finalPrice)}
                            </span>
                          </div>

                          {/* 1-Click Action Button */}
                          <button
                            type="button"
                            onClick={handleSaveDirectPricing}
                            disabled={savingProductId === selectedProduct.id}
                            className="w-full sm:w-auto flex items-center justify-center gap-2 bg-gradient-to-r from-[#D4AF37] via-[#C5A059] to-[#AA822A] text-slate-950 font-bold px-8 py-3.5 rounded-xl hover:brightness-110 active:scale-98 transition-all shadow-[0_4px_20px_rgba(212,175,55,0.3)] text-xs sm:text-sm cursor-pointer"
                          >
                            <Save className="w-4 h-4" />
                            <span>
                              {savingProductId === selectedProduct.id
                                ? 'در حال اعمال...'
                                : 'اعمال مستقیم اجرت و سود بر روی این طلا'}
                            </span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Quick-Action Table for All Products */}
            <div className="luxury-glass-card rounded-3xl p-6 overflow-x-auto">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-base font-bold text-white">
                    جدول سریع اجرت و سود تمام طلاهای ویترین ({toPersianDigits(products.length)})
                  </h3>
                  <span className="text-xs text-slate-400">
                    می‌توانید روی هر سطر کلیک کنید یا مستقیماً درصد اجرت و سود آن را تغییر دهید.
                  </span>
                </div>
              </div>

              <table className="w-full text-right text-xs text-slate-300">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400">
                    <th className="py-3 px-2">تصویر</th>
                    <th className="py-3 px-2">نام قطعه طلا</th>
                    <th className="py-3 px-2">وزن خالص</th>
                    <th className="py-3 px-2 text-[#D4AF37] font-bold">درصد اجرت</th>
                    <th className="py-3 px-2 text-emerald-400 font-bold">درصد سود</th>
                    <th className="py-3 px-2 text-rose-400 font-bold">تخفیف</th>
                    <th className="py-3 px-2">قیمت نهایی در ویترین</th>
                    <th className="py-3 px-2 text-center">عملیات</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p) => {
                    const isSelected = p.id === selectedProductId;
                    const priceBreakdown = calculateProductPrice(
                      p,
                      goldPrice.pricePerGram,
                      settings
                    );
                    const makingCharge =
                      p.customMakingChargePercent ?? settings.globalMakingChargePercent ?? 20;
                    const profit = p.customProfitPercent ?? settings.profitPercent ?? 7;

                    return (
                      <tr
                        key={p.id}
                        className={`border-b border-slate-800/60 transition-colors ${
                          isSelected ? 'bg-[#D4AF37]/10' : 'hover:bg-slate-800/30'
                        }`}
                      >
                        <td className="py-2.5 px-2">
                          <img
                            src={p.images[0]}
                            alt={p.title}
                            className="w-10 h-10 object-cover rounded-lg border border-slate-700"
                          />
                        </td>
                        <td className="py-2.5 px-2 font-semibold text-white">
                          <div className="flex items-center gap-2">
                            <span>{p.title}</span>
                            {isSelected && (
                              <span className="text-[9px] bg-[#D4AF37] text-slate-950 font-bold px-1.5 py-0.5 rounded">
                                در حال ویرایش
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 px-2 font-medium">{formatWeight(p.weight)}</td>
                        <td className="py-2.5 px-2 font-bold text-[#D4AF37]">
                          <span className="bg-[#060B14] border border-[#D4AF37]/40 px-2.5 py-1 rounded-lg">
                            {makingCharge}٪
                          </span>
                        </td>
                        <td className="py-2.5 px-2 font-bold text-emerald-400">
                          <span className="bg-[#060B14] border border-emerald-500/40 px-2.5 py-1 rounded-lg">
                            {profit}٪
                          </span>
                        </td>
                        <td className="py-2.5 px-2 font-bold">
                          {p.discountPercent > 0 ? (
                            <span className="text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded">
                              {p.discountPercent}٪
                            </span>
                          ) : (
                            <span className="text-slate-600">۰٪</span>
                          )}
                        </td>
                        <td className="py-2.5 px-2 font-bold text-white">
                          {formatToman(priceBreakdown.finalPrice)}
                        </td>
                        <td className="py-2.5 px-2 text-center">
                          <button
                            onClick={() => {
                              setSelectedProductId(p.id);
                              window.scrollTo({ top: 150, behavior: 'smooth' });
                            }}
                            className="px-3 py-1.5 rounded-lg bg-[#D4AF37]/20 hover:bg-[#D4AF37] text-[#D4AF37] hover:text-slate-950 font-bold transition-all text-xs"
                          >
                            تنظیم اجرت و سود
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: ALL PRODUCTS CRUD & MANAGEMENT */}
        {/* ========================================================================= */}
        {activeAdminTab === 'products' && (
          <div className="space-y-8">
            {/* Add / Edit Product Form */}
            <div className="luxury-glass-card rounded-3xl p-6 sm:p-8">
              <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-6">
                <div className="flex items-center gap-2">
                  <Plus className="w-5 h-5 text-[#D4AF37]" />
                  <h2 className="text-lg font-bold text-white">
                    {isEditingProduct ? 'ویرایش مشخصات کامل محصول' : 'ثبت زیورآلات جدید در ویترین اینانا'}
                  </h2>
                </div>
                {isEditingProduct && (
                  <button
                    onClick={() => {
                      setIsEditingProduct(false);
                      setProductForm({
                        title: '',
                        weight: 1.0,
                        customMakingChargePercent: 20,
                        customProfitPercent: 7,
                        discountPercent: 0,
                        stock: 5,
                      });
                    }}
                    className="text-xs text-rose-400 hover:underline"
                  >
                    انصراف از ویرایش
                  </button>
                )}
              </div>

              <form onSubmit={handleSaveProductFull} className="space-y-4 text-xs">
                {productFormError && (
                  <div className="p-3 bg-rose-500/15 border border-rose-500/40 rounded-xl flex items-center gap-2 text-rose-300 text-xs">
                    <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
                    <span>{productFormError}</span>
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">
                      عنوان محصول به فارسی: *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="مثال: پلاک طلای حرف M اینانا"
                      value={productForm.title || ''}
                      onChange={(e) => setProductForm({ ...productForm, title: e.target.value })}
                      className="w-full bg-[#060B14] border border-slate-700 focus:border-[#D4AF37] rounded-xl px-3.5 py-2.5 text-white outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">
                      دسته‌بندی محصول:
                    </label>
                    <select
                      value={productForm.category}
                      onChange={(e) => setProductForm({ ...productForm, category: e.target.value })}
                      className="w-full bg-[#060B14] border border-slate-700 focus:border-[#D4AF37] rounded-xl px-3.5 py-2.5 text-white outline-none cursor-pointer"
                    >
                      {CATEGORIES_LIST.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">کالکشن:</label>
                    <input
                      type="text"
                      value={productForm.collection || ''}
                      onChange={(e) =>
                        setProductForm({ ...productForm, collection: e.target.value })
                      }
                      className="w-full bg-[#060B14] border border-slate-700 focus:border-[#D4AF37] rounded-xl px-3.5 py-2.5 text-white outline-none"
                      placeholder="INANA LETTERS, INANA SIGNATURE, ..."
                    />
                  </div>
                </div>

                {/* Key Financial Inputs: Weight, Making Charge %, Profit %, Discount %, Stock, Letter */}
                <div className="grid grid-cols-2 sm:grid-cols-6 gap-3 bg-[#060B14] p-4 rounded-2xl border border-slate-800">
                  <div>
                    <label className="block text-[#D4AF37] font-bold mb-1">وزن خالص (گرم): *</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={productForm.weight || ''}
                      onChange={(e) =>
                        setProductForm({ ...productForm, weight: parseFloat(e.target.value) || 0 })
                      }
                      className="w-full bg-[#0A1120] border border-[#D4AF37]/50 focus:border-[#D4AF37] rounded-xl px-3 py-2 text-white font-bold outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[#D4AF37] font-bold mb-1">درصد اجرت ساخت (%): *</label>
                    <input
                      type="number"
                      step="1"
                      required
                      placeholder="20"
                      value={productForm.customMakingChargePercent ?? ''}
                      onChange={(e) =>
                        setProductForm({
                          ...productForm,
                          customMakingChargePercent: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="w-full bg-[#0A1120] border border-[#D4AF37]/50 focus:border-[#D4AF37] rounded-xl px-3 py-2 text-white font-bold outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-emerald-400 font-bold mb-1">درصد سود (%):</label>
                    <input
                      type="number"
                      step="1"
                      placeholder="7"
                      value={productForm.customProfitPercent ?? 7}
                      onChange={(e) =>
                        setProductForm({
                          ...productForm,
                          customProfitPercent: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="w-full bg-[#0A1120] border border-emerald-500/50 focus:border-emerald-400 rounded-xl px-3 py-2 text-white font-bold outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-rose-400 font-bold mb-1">درصد تخفیف (%):</label>
                    <input
                      type="number"
                      step="1"
                      min="0"
                      max="50"
                      placeholder="0"
                      value={productForm.discountPercent ?? ''}
                      onChange={(e) =>
                        setProductForm({
                          ...productForm,
                          discountPercent: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="w-full bg-[#0A1120] border border-rose-500/50 focus:border-rose-400 rounded-xl px-3 py-2 text-white font-bold outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">تعداد موجودی:</label>
                    <input
                      type="number"
                      value={productForm.stock || ''}
                      onChange={(e) =>
                        setProductForm({ ...productForm, stock: parseInt(e.target.value, 10) || 0 })
                      }
                      className="w-full bg-[#0A1120] border border-slate-700 focus:border-[#D4AF37] rounded-xl px-3 py-2 text-white outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">حرف انگلیسی (A-Z):</label>
                    <input
                      type="text"
                      maxLength={1}
                      placeholder="M"
                      value={productForm.letter || ''}
                      onChange={(e) =>
                        setProductForm({ ...productForm, letter: e.target.value.toUpperCase() })
                      }
                      className="w-full bg-[#0A1120] border border-slate-700 focus:border-[#D4AF37] rounded-xl px-3 py-2 text-white outline-none uppercase font-serif-brand font-bold text-center"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    آدرس تصویر محصول (URL):
                  </label>
                  <input
                    type="text"
                    value={productForm.images?.[0] || ''}
                    onChange={(e) =>
                      setProductForm({ ...productForm, images: [e.target.value] })
                    }
                    className="w-full bg-[#060B14] border border-slate-700 focus:border-[#D4AF37] rounded-xl px-3.5 py-2 text-white outline-none"
                    placeholder="https://..."
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">توضیحات معرفی محصول:</label>
                  <textarea
                    rows={2}
                    value={productForm.description || ''}
                    onChange={(e) =>
                      setProductForm({ ...productForm, description: e.target.value })
                    }
                    className="w-full bg-[#060B14] border border-slate-700 focus:border-[#D4AF37] rounded-xl px-3.5 py-2 text-white outline-none resize-none"
                  />
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    className="bg-gradient-to-r from-[#D4AF37] via-[#C5A059] to-[#AA822A] text-slate-950 font-bold px-7 py-3 rounded-xl hover:brightness-110 transition-all text-xs cursor-pointer"
                  >
                    {isEditingProduct ? 'بروزرسانی کامل محصول' : 'ثبت و انتشار محصول در ویترین'}
                  </button>
                </div>
              </form>
            </div>

            {/* Products Table */}
            <div className="luxury-glass-card rounded-3xl p-6 overflow-x-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-bold text-white">
                  فهرست تمام محصولات ({toPersianDigits(products.length)})
                </h3>
              </div>

              <table className="w-full text-right text-xs text-slate-300">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400">
                    <th className="py-3 px-2">تصویر</th>
                    <th className="py-3 px-2">نام محصول</th>
                    <th className="py-3 px-2">کد SKU</th>
                    <th className="py-3 px-2">دسته</th>
                    <th className="py-3 px-2">وزن طلا</th>
                    <th className="py-3 px-2 text-[#D4AF37] font-bold">اجرت</th>
                    <th className="py-3 px-2 text-emerald-400 font-bold">سود</th>
                    <th className="py-3 px-2">قیمت روز</th>
                    <th className="py-3 px-2">موجودی</th>
                    <th className="py-3 px-2 text-center">عملیات</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p) => {
                    const priceBreakdown = calculateProductPrice(
                      p,
                      goldPrice.pricePerGram,
                      settings
                    );
                    const makingCharge =
                      p.customMakingChargePercent ?? settings.globalMakingChargePercent ?? 20;
                    const profit = p.customProfitPercent ?? settings.profitPercent ?? 7;

                    return (
                      <tr
                        key={p.id}
                        className="border-b border-slate-800/60 hover:bg-slate-800/30 transition-colors"
                      >
                        <td className="py-2.5 px-2">
                          <img
                            src={p.images?.[0] || 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=800&q=80'}
                            alt={p.title}
                            className="w-10 h-10 object-cover rounded-lg border border-slate-700"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src =
                                'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=800&q=80';
                            }}
                          />
                        </td>
                        <td className="py-2.5 px-2 font-semibold text-white">{p.title}</td>
                        <td className="py-2.5 px-2 text-slate-400">{p.sku}</td>
                        <td className="py-2.5 px-2 text-[#D4AF37]">{p.category}</td>
                        <td className="py-2.5 px-2 font-medium">{formatWeight(p.weight)}</td>
                        <td className="py-2.5 px-2 font-bold text-[#D4AF37]">{makingCharge}٪</td>
                        <td className="py-2.5 px-2 font-bold text-emerald-400">{profit}٪</td>
                        <td className="py-2.5 px-2 font-bold text-white">
                          {formatToman(priceBreakdown.finalPrice)}
                        </td>
                        <td className="py-2.5 px-2">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] ${
                              p.stock > 0
                                ? 'bg-emerald-500/20 text-emerald-400'
                                : 'bg-rose-500/20 text-rose-400'
                            }`}
                          >
                            {p.stock > 0 ? `${toPersianDigits(p.stock)} عدد` : 'ناموجود'}
                          </span>
                        </td>
                        <td className="py-2.5 px-2 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => startEditProduct(p)}
                              className="p-1.5 bg-slate-800 hover:bg-[#D4AF37]/20 text-slate-300 hover:text-[#D4AF37] rounded-lg transition-colors"
                              title="ویرایش کامل مشخصات"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            {deleteConfirmId === p.id ? (
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => {
                                    deleteProduct(p.id);
                                    setDeleteConfirmId(null);
                                  }}
                                  className="px-2 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded text-[10px] font-bold transition-colors"
                                  title="تأیید نهایی حذف"
                                >
                                  حذف
                                </button>
                                <button
                                  onClick={() => setDeleteConfirmId(null)}
                                  className="px-2 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded text-[10px] transition-colors"
                                  title="انصراف"
                                >
                                  انصراف
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setDeleteConfirmId(p.id)}
                                className="p-1.5 bg-slate-800 hover:bg-rose-500/20 text-slate-300 hover:text-rose-400 rounded-lg transition-colors"
                                title="حذف محصول"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: GOLD BASE RATE & GLOBAL PRICING SETTINGS */}
        {/* ========================================================================= */}
        {activeAdminTab === 'gold-rate' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-8 luxury-glass-card rounded-3xl p-6 sm:p-8">
              <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-6">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-[#D4AF37]" />
                  <h2 className="text-lg font-bold text-white">تنظیم نرخ پایه طلای ۱۸ عیار و فرمول عمومی</h2>
                </div>
                {rateSaveSuccess && (
                  <span className="flex items-center gap-1 text-xs text-emerald-400 font-bold bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
                    <CheckCircle className="w-4 h-4" />
                    <span>تغییرات با موفقیت ذخیره شد</span>
                  </span>
                )}
              </div>

              {/* API Live Status & Instant Sync Card */}
              <div className="bg-[#0A1224] border border-[#D4AF37]/30 rounded-2xl p-5 mb-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="text-xs font-bold text-emerald-400">وب‌سرویس استعلام خودکار فعال است</span>
                      <span className="text-[10px] text-slate-300 bg-slate-800 px-2 py-0.5 rounded-md">چرخه: هر ۱ ساعت</span>
                      <span className="text-[10px] text-[#D4AF37] bg-[#D4AF37]/10 border border-[#D4AF37]/30 px-2 py-0.5 rounded-md">Navasan API (18ayar)</span>
                    </div>
                    <p className="text-xs text-slate-300">
                      منبع: {goldPrice.source}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      آخرین استعلام: {goldPrice.jalaliTimestamp || 'امروز'} | تغییرات روز: {goldPrice.changePercent > 0 ? `+${goldPrice.changePercent}%` : `${goldPrice.changePercent}%`}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleSyncLiveApi}
                    disabled={isSyncingApi}
                    className="flex items-center justify-center gap-2 bg-[#D4AF37] hover:bg-[#c5a033] text-slate-950 font-bold px-4 py-2.5 rounded-xl text-xs transition-all shadow-md active:scale-95 disabled:opacity-50 cursor-pointer"
                  >
                    <RefreshCw className={`w-4 h-4 ${isSyncingApi ? 'animate-spin' : ''}`} />
                    <span>{isSyncingApi ? 'در حال استعلام از API...' : 'همگام‌سازی فوری با API زنده'}</span>
                  </button>
                </div>

                {/* Other markets summary */}
                {goldPrice.otherMarkets && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4 pt-3 border-t border-slate-800/80 text-[11px]">
                    <div className="bg-[#060B14] p-2 rounded-lg border border-slate-800">
                      <span className="text-slate-400 block text-[10px]">طلای ۲۴ عیار:</span>
                      <span className="font-bold text-slate-200">
                        {goldPrice.otherMarkets.gold24k ? formatToman(goldPrice.otherMarkets.gold24k) : '—'}
                      </span>
                    </div>
                    <div className="bg-[#060B14] p-2 rounded-lg border border-slate-800">
                      <span className="text-slate-400 block text-[10px]">مظنه مثقال:</span>
                      <span className="font-bold text-slate-200">
                        {goldPrice.otherMarkets.mesghal ? formatToman(goldPrice.otherMarkets.mesghal) : '—'}
                      </span>
                    </div>
                    <div className="bg-[#060B14] p-2 rounded-lg border border-slate-800">
                      <span className="text-slate-400 block text-[10px]">سکه تمام امامی:</span>
                      <span className="font-bold text-slate-200">
                        {goldPrice.otherMarkets.emamiCoin ? formatToman(goldPrice.otherMarkets.emamiCoin) : '—'}
                      </span>
                    </div>
                    <div className="bg-[#060B14] p-2 rounded-lg border border-slate-800">
                      <span className="text-slate-400 block text-[10px]">انس جهانی ($):</span>
                      <span className="font-bold text-[#D4AF37]">
                        {goldPrice.otherMarkets.globalOunceUsd ? `$${goldPrice.otherMarkets.globalOunceUsd.toLocaleString()}` : '—'}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <form onSubmit={handleSaveRateAndGlobalSettings} className="space-y-6">
                {/* Gold Price Per Gram Input */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-sm font-semibold text-slate-200">
                      نرخ هر گرم طلای ۱۸ عیار (تومان):
                    </label>
                    <span className="text-xs text-slate-400">
                      نرخ فعال فعلی: {formatToman(goldPrice.pricePerGram)}
                    </span>
                  </div>
                  <div className="relative">
                    <input
                      type="number"
                      step="1000"
                      value={overridePrice}
                      onChange={(e) => setOverridePrice(parseFloat(e.target.value) || 0)}
                      className="w-full bg-[#060B14] border border-slate-700 focus:border-[#D4AF37] rounded-xl px-4 py-3 text-lg font-bold text-white outline-none"
                    />
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-medium">
                      تومان
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400 mt-1 block">
                    با تغییر این نرخ، قیمت تمام محصولات بر اساس اجرت و سود تعیین‌شده هر طلا به طور خودکار بروزرسانی می‌شود.
                  </span>
                </div>

                {/* Profit % & Tax % & Global Making Charge */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                      درصد سود عمومی طلافروش (%):
                    </label>
                    <input
                      type="number"
                      value={profitPct}
                      onChange={(e) => setProfitPct(parseFloat(e.target.value) || 0)}
                      className="w-full bg-[#060B14] border border-slate-700 focus:border-[#D4AF37] rounded-xl px-3 py-2.5 text-sm font-bold text-white outline-none"
                    />
                    <span className="text-[10px] text-slate-500 mt-1 block">استاندارد اتحادیه: ۷٪</span>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                      مالیات ارزش افزوده (%):
                    </label>
                    <input
                      type="number"
                      value={taxPct}
                      onChange={(e) => setTaxPct(parseFloat(e.target.value) || 0)}
                      className="w-full bg-[#060B14] border border-slate-700 focus:border-[#D4AF37] rounded-xl px-3 py-2.5 text-sm font-bold text-white outline-none"
                    />
                    <span className="text-[10px] text-slate-500 mt-1 block">
                      بر مجموع اجرت + سود: ۹٪
                    </span>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                      اجرت ساخت پیش‌فرض (%):
                    </label>
                    <input
                      type="number"
                      value={globalMakingChargePct}
                      onChange={(e) => setGlobalMakingChargePct(parseFloat(e.target.value) || 0)}
                      className="w-full bg-[#060B14] border border-slate-700 focus:border-[#D4AF37] rounded-xl px-3 py-2.5 text-sm font-bold text-white outline-none"
                    />
                    <span className="text-[10px] text-slate-500 mt-1 block">
                      برای اقلام بدون اجرت اختصاصی
                    </span>
                  </div>
                </div>

                {/* Bank Account Settings for Card-to-Card Orders */}
                <div className="pt-4 border-t border-slate-800 space-y-4">
                  <div className="flex items-center gap-2 text-white font-bold text-sm">
                    <CreditCard className="w-4 h-4 text-[#D4AF37]" />
                    <span>مشخصات حساب بانکی جهت واریز کارت به کارت مشتریان</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                        شماره کارت ۱۶ رقمی:
                      </label>
                      <input
                        type="text"
                        dir="ltr"
                        value={adminBankCard}
                        onChange={(e) => setAdminBankCard(e.target.value)}
                        placeholder="۶۰۳۷-xxxx-xxxx-xxxx"
                        className="w-full bg-[#060B14] border border-slate-700 focus:border-[#D4AF37] rounded-xl px-3 py-2.5 text-xs sm:text-sm font-mono font-bold text-white outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                        نام صاحب حساب:
                      </label>
                      <input
                        type="text"
                        value={adminBankHolder}
                        onChange={(e) => setAdminBankHolder(e.target.value)}
                        placeholder="نام و نام خانوادگی صاحب حساب"
                        className="w-full bg-[#060B14] border border-slate-700 focus:border-[#D4AF37] rounded-xl px-3 py-2.5 text-xs sm:text-sm font-bold text-white outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                        نام بانک و شعبه:
                      </label>
                      <input
                        type="text"
                        value={adminBankName}
                        onChange={(e) => setAdminBankName(e.target.value)}
                        placeholder="بانک ملی ایران (شعبه ...)"
                        className="w-full bg-[#060B14] border border-slate-700 focus:border-[#D4AF37] rounded-xl px-3 py-2.5 text-xs sm:text-sm font-bold text-white outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                        شماره شبا (اختیاری):
                      </label>
                      <input
                        type="text"
                        dir="ltr"
                        value={adminBankSheba}
                        onChange={(e) => setAdminBankSheba(e.target.value)}
                        placeholder="IR-..."
                        className="w-full bg-[#060B14] border border-slate-700 focus:border-[#D4AF37] rounded-xl px-3 py-2.5 text-xs sm:text-sm font-mono text-white outline-none"
                      />
                    </div>
                  </div>
                  <span className="text-[11px] text-slate-400 block">
                    این اطلاعات در سبد خرید به مشتریان نمایش داده می‌شود تا مبلغ را به این حساب کارت به کارت کرده و عکس فیش را ارسال کنند.
                  </span>
                </div>

                <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={refreshGoldPrice}
                    className="flex items-center gap-2 text-xs text-[#D4AF37] hover:underline"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>دریافت آخرین نرخ رسمی اتحادیه</span>
                  </button>

                  <button
                    type="submit"
                    className="flex items-center gap-2 bg-gradient-to-r from-[#D4AF37] via-[#C5A059] to-[#AA822A] text-slate-950 font-bold px-6 py-3 rounded-xl hover:brightness-110 active:scale-95 transition-all text-xs sm:text-sm cursor-pointer"
                  >
                    <Save className="w-4 h-4" />
                    <span>ذخیره و اعمال سراسری نرخ طلا</span>
                  </button>
                </div>
              </form>
            </div>

            {/* Live Pricing Formula Preview Info (4 Cols) */}
            <div className="lg:col-span-4 luxury-glass-card rounded-3xl p-6">
              <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#D4AF37]" />
                <span>فرمول استاندارد مصوب طلا و جواهر</span>
              </h3>

              <div className="space-y-3 text-xs text-slate-300 leading-relaxed font-light">
                <p className="bg-[#060B14] p-3 rounded-xl border border-slate-800">
                  <strong className="text-white block mb-1">فرمول قیمت طلا:</strong>
                  <code>قیمت = ارزش خام + اجرت ساخت + سود + مالیات ۹٪ - تخفیف</code>
                </p>
                <p>
                  ۱. <strong>ارزش خام طلا:</strong> وزن هر قطعه × نرخ روز هر گرم طلای ۱۸ عیار.
                </p>
                <p>
                  ۲. <strong>اجرت ساخت قطعه:</strong> درصد اجرت اختصاصی تعیین‌شده توسط شما برای هر طلا.
                </p>
                <p>
                  ۳. <strong>سود فروشنده (۷٪):</strong> درصد سود تعیین‌شده از مجموع (ارزش خام + اجرت).
                </p>
                <p>
                  ۴. <strong>مالیات بر ارزش افزوده (۹٪):</strong> طبق قانون جدید طلا، ۹٪ صرفاً بر مجموع (اجرت + سود) اعمال می‌شود.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 4: EXCLUSIVE ADMIN GOLD QUOTATION CALCULATOR */}
        {/* ========================================================================= */}
        {activeAdminTab === 'calculator' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* Inputs Column */}
              <div className="lg:col-span-7 luxury-glass-card rounded-3xl p-6 sm:p-8">
                <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-6">
                  <div className="flex items-center gap-2">
                    <Calculator className="w-5 h-5 text-[#D4AF37]" />
                    <h2 className="text-lg font-bold text-white">
                      ماشین‌حساب و صدور پیش‌فاکتور اختصاصی مدیریت
                    </h2>
                  </div>
                  <span className="text-xs text-[#D4AF37] bg-[#D4AF37]/10 px-3 py-1 rounded-full border border-[#D4AF37]/30">
                    مخصوص ادمین
                  </span>
                </div>

                <div className="space-y-6">
                  {/* Current Gold Price Live Indicator */}
                  <div className="bg-[#060B14] border border-[#D4AF37]/30 rounded-2xl p-4 flex items-center justify-between">
                    <div>
                      <span className="text-xs text-slate-400 block">نرخ مبنای ۱۸ عیار:</span>
                      <span className="text-sm font-bold text-white">
                        {formatToman(goldPrice.pricePerGram)} / گرم
                      </span>
                    </div>
                    <span className="text-[11px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-1 rounded-full font-medium">
                      فعال در فروشگاه
                    </span>
                  </div>

                  {/* 1. Weight Input */}
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <label className="text-sm font-semibold text-slate-200">
                        وزن طلا برای استعلام (گرم):
                      </label>
                      <span className="text-sm font-bold text-[#D4AF37]">
                        {formatWeight(calcWeight, true)}
                      </span>
                    </div>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.01"
                        min="0.05"
                        value={calcWeight || ''}
                        onChange={(e) => setCalcWeight(Math.max(0, parseFloat(e.target.value) || 0))}
                        className="w-full bg-[#060B14] border border-slate-700 focus:border-[#D4AF37] rounded-xl px-4 py-3 text-lg font-bold text-white outline-none"
                      />
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-medium">
                        گرم
                      </span>
                    </div>
                  </div>

                  {/* 2. Making Charge Slider (اجرت ساخت) */}
                  <div className="bg-[#060B14] p-4 rounded-2xl border border-slate-800">
                    <div className="flex justify-between items-center mb-2">
                      <label className="text-sm font-semibold text-slate-200">
                        درصد اجرت ساخت این قطعه:
                      </label>
                      <span className="text-sm font-bold text-[#D4AF37]">
                        {toPersianDigits(calcMakingCharge)}٪
                      </span>
                    </div>
                    <input
                      type="range"
                      min="5"
                      max="40"
                      step="1"
                      value={calcMakingCharge}
                      onChange={(e) => setCalcMakingCharge(parseInt(e.target.value, 10))}
                      className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-[#D4AF37]"
                    />
                    <div className="flex justify-between text-[11px] text-slate-500 mt-1">
                      <span>ساده (۱۰٪)</span>
                      <span>سفارشی (۲۰٪)</span>
                      <span>لوکس و دست‌ساز (۳۰٪)</span>
                    </div>
                  </div>

                  {/* 3. Discount Slider */}
                  <div className="bg-[#060B14] p-4 rounded-2xl border border-slate-800">
                    <div className="flex justify-between items-center mb-2">
                      <label className="text-sm font-semibold text-emerald-400">
                        درصد تخفیف سفارشی ادمین:
                      </label>
                      <span className="text-sm font-bold text-emerald-400">
                        {toPersianDigits(calcDiscount)}٪
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="30"
                      step="1"
                      value={calcDiscount}
                      onChange={(e) => setCalcDiscount(parseInt(e.target.value, 10))}
                      className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-400"
                    />
                  </div>

                  {/* 4. Profit & Tax */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-[#060B14] p-3 rounded-xl border border-slate-800 text-xs">
                      <span className="text-slate-400 block mb-1">سود طلافروش:</span>
                      <span className="font-bold text-white">{calcProfit}٪ (مصوب اتحادیه)</span>
                    </div>
                    <div className="bg-[#060B14] p-3 rounded-xl border border-slate-800 text-xs">
                      <span className="text-slate-400 block mb-1">مالیات بر ارزش افزوده:</span>
                      <span className="font-bold text-white">{calcTax}٪ (بر اجرت + سود)</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Results & Invoice Column */}
              <div className="lg:col-span-5 luxury-glass-card rounded-3xl p-6 sm:p-8 border-[#D4AF37]/40 shadow-[0_15px_40px_rgba(212,175,55,0.1)]">
                <div className="flex items-center justify-between pb-4 border-b border-[#D4AF37]/20 mb-6">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-[#D4AF37]" />
                    <h3 className="font-bold text-white text-base">پیش‌فاکتور محاسبه‌شده</h3>
                  </div>
                  <button
                    onClick={copyQuotationText}
                    className="flex items-center gap-1 text-xs text-[#D4AF37] hover:underline cursor-pointer"
                  >
                    {copiedQuotation ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400">کپی شد!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>کپی پیش‌فاکتور</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="space-y-4 text-xs">
                  <div className="flex justify-between items-center text-slate-300">
                    <span>ارزش طلای خام:</span>
                    <span className="font-semibold text-white">
                      {formatToman(quotationResult.baseGoldValue)}
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-slate-300">
                    <span>مبلغ اجرت ساخت ({toPersianDigits(calcMakingCharge)}٪):</span>
                    <span className="font-semibold text-white">
                      {formatToman(quotationResult.makingChargeAmount)}
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-slate-300">
                    <span>سود طلافروش ({toPersianDigits(calcProfit)}٪):</span>
                    <span className="font-semibold text-white">
                      {formatToman(quotationResult.profitAmount)}
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-slate-300">
                    <span>مالیات ارزش افزوده ({toPersianDigits(calcTax)}٪):</span>
                    <span className="font-semibold text-white">
                      {formatToman(quotationResult.taxAmount)}
                    </span>
                  </div>

                  {calcDiscount > 0 && (
                    <div className="flex justify-between items-center text-emerald-400 bg-emerald-500/10 p-2.5 rounded-xl border border-emerald-500/20">
                      <span>مبلغ تخفیف اعمال‌شده ({toPersianDigits(calcDiscount)}٪):</span>
                      <span className="font-bold">- {formatToman(quotationResult.discountAmount)}</span>
                    </div>
                  )}
                </div>

                {/* Total */}
                <div className="mt-8 p-5 rounded-2xl bg-gradient-to-b from-[#0A1120] to-[#060B14] border border-[#D4AF37]/40 shadow-inner">
                  <span className="text-xs text-[#D4AF37] block font-medium">مبلغ نهایی قابل پرداخت:</span>
                  <div className="text-2xl sm:text-3xl font-extrabold text-white mt-1 gold-gradient-text">
                    {formatToman(quotationResult.finalPrice)}
                  </div>
                  <span className="text-[11px] text-slate-400 mt-1 block">
                    محاسبه شده بر مبنای وزن {formatWeight(calcWeight)}
                  </span>
                </div>

                <div className="mt-6 flex flex-col gap-3">
                  <button
                    onClick={copyQuotationText}
                    className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-[#D4AF37] via-[#C5A059] to-[#AA822A] text-slate-950 font-bold py-3.5 rounded-xl hover:brightness-110 active:scale-98 transition-all shadow-md text-xs sm:text-sm cursor-pointer"
                  >
                    <Copy className="w-4 h-4" />
                    <span>{copiedQuotation ? 'متن پیش‌فاکتور کپی شد' : 'کپی متن برای ارسال به مشتری'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 5: ORDERS & CARD-TO-CARD PAYMENT VERIFICATION */}
        {/* ========================================================================= */}
        {activeAdminTab === 'orders' && (
          <div className="space-y-6">
            {/* Notification alert banner */}
            {orderActionNotification && (
              <div
                className={`p-4 rounded-2xl flex items-center justify-between text-xs sm:text-sm font-bold border transition-all animate-in fade-in duration-300 ${
                  orderActionNotification.type === 'success'
                    ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-300'
                    : 'bg-rose-950/60 border-rose-500/50 text-rose-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  {orderActionNotification.type === 'success' ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  ) : (
                    <XCircle className="w-5 h-5 text-rose-400" />
                  )}
                  <span>{orderActionNotification.message}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setOrderActionNotification(null)}
                  className="p-1 hover:opacity-70"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Top Metrics Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-[#0A1120] border border-slate-800 rounded-2xl p-4">
                <span className="text-xs text-slate-400 block mb-1">کل سفارش‌ها</span>
                <span className="text-xl sm:text-2xl font-bold text-white font-serif-brand">
                  {toPersianDigits(orders.length)}
                </span>
              </div>
              <div className="bg-[#0A1120] border border-amber-500/40 rounded-2xl p-4 relative overflow-hidden">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-amber-300 font-semibold block mb-1">
                    در انتظار بررسی فیش
                  </span>
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
                  </span>
                </div>
                <span className="text-xl sm:text-2xl font-bold text-amber-400 font-serif-brand">
                  {toPersianDigits(orders.filter((o) => o.status === 'در انتظار بررسی').length)}
                </span>
              </div>
              <div className="bg-[#0A1120] border border-emerald-500/30 rounded-2xl p-4">
                <span className="text-xs text-emerald-300 font-semibold block mb-1">
                  تأیید شده
                </span>
                <span className="text-xl sm:text-2xl font-bold text-emerald-400 font-serif-brand">
                  {toPersianDigits(
                    orders.filter((o) => o.status === 'تأیید شده' || o.status === 'تأیید شد و در حال ساخت')
                      .length
                  )}
                </span>
              </div>
              <div className="bg-[#0A1120] border border-rose-500/30 rounded-2xl p-4">
                <span className="text-xs text-rose-300 font-semibold block mb-1">
                  رد شده
                </span>
                <span className="text-xl sm:text-2xl font-bold text-rose-400 font-serif-brand">
                  {toPersianDigits(orders.filter((o) => o.status === 'رد شده').length)}
                </span>
              </div>
            </div>

            {/* Main Order Management Card */}
            <div className="luxury-glass-card rounded-3xl p-6 sm:p-8 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
                <div>
                  <h2 className="text-lg font-bold text-white flex flex-wrap items-center gap-2">
                    <CreditCard className="w-5 h-5 text-[#D4AF37]" />
                    <span>مدیریت و تایید سفارش‌های کارت به کارت</span>
                    <span className="text-[11px] font-normal px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5">
                      <Database className="w-3.5 h-3.5 text-emerald-400" />
                      <span>پایگاه داده و حافظه پایدار ({toPersianDigits(orders.length)} سفارش)</span>
                    </span>
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    سفارش‌ها در دیتابیس و حافظه تا زمان حذف توسط شما حفظ می‌شوند • امکان بررسی فیش، تایید، رد و حذف قطعی
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {orders.some((o) => o.status === 'رد شده') && (
                    <button
                      type="button"
                      onClick={handleClearRejectedOrders}
                      className="text-xs text-rose-400 hover:text-rose-300 bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/40 px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
                      title="پاکسازی یکجای تمام سفارش‌های رد شده"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>پاکسازی رد شده‌ها</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={fetchOrders}
                    className="text-xs text-[#D4AF37] hover:underline flex items-center gap-1.5 self-start sm:self-auto cursor-pointer px-3 py-1.5 rounded-xl bg-[#060B14] border border-slate-800"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>بروزرسانی زنده لیست</span>
                  </button>
                </div>
              </div>

              {/* Filters & Search Toolbar */}
              <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
                {/* Status Tabs */}
                <div className="flex flex-wrap gap-1.5 p-1 bg-[#060B14] rounded-xl border border-slate-800 text-xs">
                  <button
                    type="button"
                    onClick={() => setOrderFilterStatus('all')}
                    className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                      orderFilterStatus === 'all'
                        ? 'bg-[#D4AF37] text-slate-950 shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    همه ({toPersianDigits(orders.length)})
                  </button>
                  <button
                    type="button"
                    onClick={() => setOrderFilterStatus('در انتظار بررسی')}
                    className={`px-3 py-1.5 rounded-lg font-semibold transition-all flex items-center gap-1.5 ${
                      orderFilterStatus === 'در انتظار بررسی'
                        ? 'bg-amber-500 text-slate-950 shadow-sm'
                        : 'text-amber-400 hover:text-amber-300'
                    }`}
                  >
                    <span>⏳ در انتظار بررسی</span>
                    <span className="bg-black/30 px-1.5 py-0.5 rounded-full text-[10px]">
                      {toPersianDigits(orders.filter((o) => o.status === 'در انتظار بررسی').length)}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setOrderFilterStatus('تأیید شده')}
                    className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                      orderFilterStatus === 'تأیید شده'
                        ? 'bg-emerald-500 text-slate-950 shadow-sm'
                        : 'text-emerald-400 hover:text-emerald-300'
                    }`}
                  >
                    تأیید شده (
                    {toPersianDigits(
                      orders.filter(
                        (o) => o.status === 'تأیید شده' || o.status === 'تأیید شد و در حال ساخت'
                      ).length
                    )}
                    )
                  </button>
                  <button
                    type="button"
                    onClick={() => setOrderFilterStatus('رد شده')}
                    className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                      orderFilterStatus === 'رد شده'
                        ? 'bg-rose-600 text-white shadow-sm'
                        : 'text-rose-400 hover:text-rose-300'
                    }`}
                  >
                    رد شده ({toPersianDigits(orders.filter((o) => o.status === 'رد شده').length)})
                  </button>
                  <button
                    type="button"
                    onClick={() => setOrderFilterStatus('other')}
                    className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                      orderFilterStatus === 'other'
                        ? 'bg-slate-700 text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    سایر مراحل
                  </button>
                </div>

                {/* Search Input */}
                <div className="relative min-w-[240px]">
                  <input
                    type="text"
                    value={orderSearchQuery}
                    onChange={(e) => setOrderSearchQuery(e.target.value)}
                    placeholder="جستجو با کد رهگیری، نام یا تلفن..."
                    className="w-full bg-[#060B14] border border-slate-700 focus:border-[#D4AF37] rounded-xl pr-9 pl-4 py-2 text-xs text-white outline-none"
                  />
                  <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                  {orderSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setOrderSearchQuery('')}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Orders List */}
              {loadingOrders ? (
                <div className="text-center py-12 text-slate-400 text-xs">
                  در حال دریافت اطلاعات سفارش‌ها...
                </div>
              ) : (
                (() => {
                  const filteredOrders = orders.filter((ord) => {
                    // Status filter
                    if (orderFilterStatus === 'در انتظار بررسی' && ord.status !== 'در انتظار بررسی') {
                      return false;
                    }
                    if (
                      orderFilterStatus === 'تأیید شده' &&
                      ord.status !== 'تأیید شده' &&
                      ord.status !== 'تأیید شد و در حال ساخت'
                    ) {
                      return false;
                    }
                    if (orderFilterStatus === 'رد شده' && ord.status !== 'رد شده') {
                      return false;
                    }
                    if (
                      orderFilterStatus === 'other' &&
                      (ord.status === 'در انتظار بررسی' ||
                        ord.status === 'تأیید شده' ||
                        ord.status === 'تأیید شد و در حال ساخت' ||
                        ord.status === 'رد شده')
                    ) {
                      return false;
                    }

                    // Search query filter
                    if (orderSearchQuery.trim()) {
                      const q = orderSearchQuery.toLowerCase().trim();
                      const matchTracking = ord.trackingCode?.toLowerCase().includes(q);
                      const matchName = ord.customerName?.toLowerCase().includes(q);
                      const matchPhone = ord.customerPhone?.toLowerCase().includes(q);
                      const matchPaymentTrack = ord.paymentTrackingNumber?.toLowerCase().includes(q);
                      return matchTracking || matchName || matchPhone || matchPaymentTrack;
                    }

                    return true;
                  });

                  if (filteredOrders.length === 0) {
                    return (
                      <div className="text-center py-12 text-slate-400 text-xs bg-[#060B14]/40 border border-slate-800/80 rounded-2xl">
                        هیچ سفارشی مطابق با این فیلتر یافت نشد.
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-4">
                      {filteredOrders.map((ord) => {
                        const isPending = ord.status === 'در انتظار بررسی';
                        const isApproved =
                          ord.status === 'تأیید شده' || ord.status === 'تأیید شد و در حال ساخت';
                        const isRejected = ord.status === 'رد شده';
                        const isLoadingThis = actionLoadingOrderId === ord.id;

                        return (
                          <div
                            key={ord.id}
                            className={`bg-[#0A1120] border rounded-2xl p-5 text-xs text-slate-300 space-y-4 transition-all shadow-md ${
                              isPending
                                ? 'border-amber-500/40 shadow-[0_0_15px_rgba(245,158,11,0.05)]'
                                : isApproved
                                ? 'border-emerald-500/40'
                                : isRejected
                                ? 'border-rose-500/40 bg-[#120B10]'
                                : 'border-slate-800'
                            }`}
                          >
                            {/* Card Header */}
                            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
                              <div className="flex items-center gap-3">
                                <div>
                                  <span className="text-[10px] text-slate-400 block">کد رهگیری:</span>
                                  <span className="font-serif-brand font-bold text-[#F5E8C7] text-base">
                                    {ord.trackingCode}
                                  </span>
                                </div>
                                <div className="h-6 w-px bg-slate-800"></div>
                                <div>
                                  <span className="text-[10px] text-slate-400 block">تاریخ ثبت:</span>
                                  <span className="text-[11px] text-slate-300">
                                    {new Date(ord.createdAt).toLocaleDateString('fa-IR', {
                                      year: 'numeric',
                                      month: 'long',
                                      day: 'numeric',
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    })}
                                  </span>
                                </div>
                              </div>

                              {/* Status Badge */}
                              <div className="flex items-center gap-2">
                                {isPending && (
                                  <span className="flex items-center gap-1.5 bg-amber-500/15 text-amber-300 border border-amber-500/30 px-3 py-1 rounded-full text-xs font-bold">
                                    <Clock className="w-3.5 h-3.5 animate-spin" />
                                    <span>در انتظار بررسی و تایید فیش</span>
                                  </span>
                                )}
                                {isApproved && (
                                  <span className="flex items-center gap-1.5 bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 px-3 py-1 rounded-full text-xs font-bold">
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    <span>تأیید شده توسط مدیریت</span>
                                  </span>
                                )}
                                {isRejected && (
                                  <span className="flex items-center gap-1.5 bg-rose-500/20 text-rose-300 border border-rose-500/40 px-3 py-1 rounded-full text-xs font-bold">
                                    <XCircle className="w-3.5 h-3.5" />
                                    <span>رد شده توسط مدیریت</span>
                                  </span>
                                )}
                                {!isPending && !isApproved && !isRejected && (
                                  <span className="bg-slate-800 text-slate-300 border border-slate-700 px-3 py-1 rounded-full text-xs font-medium">
                                    {ord.status}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Customer Info Grid */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-[#060B14]/60 p-3 rounded-xl border border-slate-800/60">
                              <div>
                                <span className="text-slate-400 block text-[11px]">نام خریدار:</span>
                                <strong className="text-white text-xs">{ord.customerName}</strong>
                              </div>
                              <div>
                                <span className="text-slate-400 block text-[11px]">شماره تماس:</span>
                                <a
                                  href={`tel:${ord.customerPhone}`}
                                  dir="ltr"
                                  className="text-white hover:text-[#D4AF37] font-mono text-xs inline-block"
                                >
                                  {ord.customerPhone}
                                </a>
                              </div>
                              <div>
                                <span className="text-slate-400 block text-[11px]">روش هماهنگی:</span>
                                <strong className="text-[#D4AF37] text-xs">{ord.contactMethod}</strong>
                              </div>
                              {ord.customerAddress && (
                                <div className="sm:col-span-3 pt-1 border-t border-slate-800/40">
                                  <span className="text-slate-400 text-[11px]">آدرس تحویل: </span>
                                  <span className="text-slate-200">{ord.customerAddress}</span>
                                </div>
                              )}
                            </div>

                            {/* PAYMENT VERIFICATION DEDICATED SECTION */}
                            <div className="bg-gradient-to-br from-[#0D182E] to-[#08101E] border border-slate-700/80 rounded-2xl p-4 space-y-3">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <CreditCard className="w-4 h-4 text-[#D4AF37]" />
                                  <span className="font-bold text-white text-xs sm:text-sm">
                                    اطلاعات پرداخت کارت به کارت
                                  </span>
                                </div>
                                <span className="text-[11px] text-[#D4AF37] bg-[#D4AF37]/10 px-2.5 py-0.5 rounded-full border border-[#D4AF37]/20">
                                  شتاب بانکی
                                </span>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                                {/* Tracking code */}
                                <div className="bg-[#060B14] p-3 rounded-xl border border-slate-800 flex items-center justify-between">
                                  <div>
                                    <span className="text-[10px] text-slate-400 block">
                                      شماره پیگیری / ارجاع فیش:
                                    </span>
                                    {ord.paymentTrackingNumber ? (
                                      <span className="font-mono text-white font-bold text-sm select-all">
                                        {ord.paymentTrackingNumber}
                                      </span>
                                    ) : (
                                      <span className="text-slate-400 text-[11px] italic">
                                        ثبت نشده توسط مشتری (اختیاری)
                                      </span>
                                    )}
                                  </div>
                                  {ord.paymentTrackingNumber && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        navigator.clipboard.writeText(ord.paymentTrackingNumber || '');
                                        setOrderActionNotification({
                                          message: 'شماره پیگیری کپی شد.',
                                          type: 'success',
                                        });
                                        setTimeout(() => setOrderActionNotification(null), 2000);
                                      }}
                                      className="p-1.5 hover:bg-slate-800 rounded-lg text-[#D4AF37] transition-colors"
                                      title="کپی شماره پیگیری"
                                    >
                                      <Copy className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>

                                {/* Receipt Image Button / Thumbnail */}
                                <div className="bg-[#060B14] p-2.5 rounded-xl border border-slate-800 flex items-center justify-between gap-3">
                                  <div className="flex items-center gap-2.5 overflow-hidden">
                                    {ord.paymentReceiptImage ? (
                                      <div
                                        onClick={() => setViewingReceiptOrder(ord)}
                                        className="w-12 h-12 rounded-lg bg-black overflow-hidden cursor-pointer border border-[#D4AF37]/40 hover:scale-105 transition-transform flex-shrink-0 relative group"
                                      >
                                        <img
                                          src={ord.paymentReceiptImage}
                                          alt="فیش واریزی"
                                          className="w-full h-full object-cover"
                                        />
                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                          <Eye className="w-4 h-4 text-white" />
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="w-12 h-12 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500 flex-shrink-0">
                                        <ImageIcon className="w-5 h-5" />
                                      </div>
                                    )}
                                    <div className="truncate">
                                      <span className="text-[10px] text-slate-400 block">تصویر فیش بانکی:</span>
                                      <span className="text-xs text-white font-medium">
                                        {ord.paymentReceiptImage
                                          ? 'تصویر فیش ضمیمه شده است'
                                          : 'عکسی بارگذاری نشده'}
                                      </span>
                                    </div>
                                  </div>

                                  {ord.paymentReceiptImage && (
                                    <button
                                      type="button"
                                      onClick={() => setViewingReceiptOrder(ord)}
                                      className="flex items-center gap-1.5 bg-[#D4AF37]/15 hover:bg-[#D4AF37]/25 text-[#F5E8C7] border border-[#D4AF37]/40 px-3 py-2 rounded-xl text-xs font-bold transition-all flex-shrink-0"
                                    >
                                      <Eye className="w-3.5 h-3.5 text-[#D4AF37]" />
                                      <span>مشاهده فیش</span>
                                    </button>
                                  )}
                                </div>
                              </div>

                              {/* Rejection Alert if already rejected */}
                              {isRejected && ord.rejectionReason && (
                                <div className="bg-rose-950/40 border border-rose-500/40 rounded-xl p-3 text-xs text-rose-300 flex items-start gap-2">
                                  <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
                                  <div>
                                    <strong className="block text-rose-200">
                                      علت رد سفارش توسط مدیریت:
                                    </strong>
                                    <span>{ord.rejectionReason}</span>
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Ordered Items List */}
                            <div className="bg-[#060B14] p-3 rounded-xl border border-slate-800 space-y-2">
                              <span className="text-[11px] text-slate-400 block font-semibold">
                                اقلام فاکتور:
                              </span>
                              {ord.items.map((it, idx) => (
                                <div
                                  key={idx}
                                  className="flex justify-between items-center text-[11px] py-1 border-b border-slate-800/40 last:border-0"
                                >
                                  <span>
                                    {it.productTitle} ({toPersianDigits(it.quantity)} عدد) - وزن:{' '}
                                    {formatWeight(it.weight)}
                                  </span>
                                  <span className="font-bold text-white">{formatToman(it.totalPrice)}</span>
                                </div>
                              ))}
                            </div>

                            {/* Summary & Actions Bar */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-3 border-t border-slate-800">
                              <div className="flex items-center gap-4">
                                <span className="text-slate-400">
                                  مجموع وزن: <strong className="text-white">{formatWeight(ord.totalWeight)}</strong>
                                </span>
                                <div className="h-4 w-px bg-slate-800"></div>
                                <div className="flex items-center gap-1.5">
                                  <span className="text-slate-400">مبلغ کل فاکتور:</span>
                                  <span className="font-bold text-base text-white gold-gradient-text">
                                    {formatToman(ord.totalPrice)}
                                  </span>
                                </div>
                              </div>

                              {/* ADMIN ACTION BUTTONS */}
                              <div className="flex flex-wrap items-center gap-2 self-end sm:self-auto">
                                {/* One-Click Approve Button */}
                                <button
                                  type="button"
                                  disabled={isLoadingThis || isApproved}
                                  onClick={() => handleApproveOrder(ord)}
                                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm ${
                                    isApproved
                                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 cursor-default'
                                      : 'bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white'
                                  }`}
                                >
                                  <CheckCircle2 className="w-4 h-4" />
                                  <span>{isApproved ? 'تأیید شده' : 'تأیید فیش و سفارش'}</span>
                                </button>

                                {/* Reject Button (Opens reason dialog) */}
                                <button
                                  type="button"
                                  disabled={isLoadingThis}
                                  onClick={() => {
                                    setRejectingOrder(ord);
                                    setRejectionReasonInput(ord.rejectionReason || '');
                                  }}
                                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                                    isRejected
                                      ? 'bg-rose-950/60 hover:bg-rose-900/60 text-rose-300 border border-rose-500/40'
                                      : 'bg-rose-600/90 hover:bg-rose-600 text-white'
                                  }`}
                                >
                                  <XCircle className="w-4 h-4" />
                                  <span>{isRejected ? 'ویرایش دلیل رد' : 'رد فیش و سفارش'}</span>
                                </button>

                                {/* Workflow status dropdown for custom states */}
                                <div className="flex items-center gap-1 bg-[#060B14] border border-slate-700 rounded-xl px-2 py-1">
                                  <span className="text-[10px] text-slate-400">تغییر وضعیت:</span>
                                  <select
                                    value={ord.status}
                                    onChange={(e) => handleUpdateOrderStatus(ord.id, e.target.value)}
                                    className="bg-transparent text-[#D4AF37] font-bold text-xs outline-none cursor-pointer"
                                  >
                                    <option value="در انتظار بررسی" className="bg-[#060B14] text-white">
                                      در انتظار بررسی
                                    </option>
                                    <option value="تأیید شده" className="bg-[#060B14] text-white">
                                      تأیید شده
                                    </option>
                                    <option value="تأیید شد و در حال ساخت" className="bg-[#060B14] text-white">
                                      تأیید شد و در حال ساخت
                                    </option>
                                    <option value="ارسال شد" className="bg-[#060B14] text-white">
                                      ارسال شد
                                    </option>
                                    <option value="تکمیل شده" className="bg-[#060B14] text-white">
                                      تکمیل شده
                                    </option>
                                    <option value="رد شده" className="bg-[#060B14] text-white">
                                      رد شده
                                    </option>
                                    <option value="لغو شده" className="bg-[#060B14] text-white">
                                      لغو شده
                                    </option>
                                  </select>
                                </div>

                                {/* Delete Order Button */}
                                <button
                                  type="button"
                                  disabled={isLoadingThis}
                                  onClick={() => setDeletingOrder(ord)}
                                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all bg-rose-950/40 hover:bg-rose-900/60 text-rose-400 hover:text-rose-300 border border-rose-800/40 active:scale-95 cursor-pointer"
                                  title="حذف سفارش از دیتابیس و حافظه"
                                >
                                  <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                                  <span>حذف سفارش</span>
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()
              )}
            </div>

            {/* ========================================================================= */}
            {/* FULL-SCREEN RECEIPT IMAGE PREVIEW MODAL */}
            {/* ========================================================================= */}
            {viewingReceiptOrder && (
              <div
                className="fixed inset-0 z-[80] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in"
                onClick={() => setViewingReceiptOrder(null)}
              >
                <div
                  className="relative max-w-2xl w-full bg-[#0E1A33] border border-[#D4AF37]/50 rounded-2xl overflow-hidden shadow-2xl space-y-4"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Modal Header */}
                  <div className="flex items-center justify-between p-4 border-b border-slate-700/80 bg-[#081124]">
                    <div>
                      <h3 className="text-white font-bold text-sm flex items-center gap-2">
                        <ImageIcon className="w-4 h-4 text-[#D4AF37]" />
                        <span>بررسی فیش واریزی کد {viewingReceiptOrder.trackingCode}</span>
                      </h3>
                      <p className="text-xs text-slate-400 mt-0.5">
                        مشتری: {viewingReceiptOrder.customerName} | مبلغ فاکتور:{' '}
                        {formatToman(viewingReceiptOrder.totalPrice)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setViewingReceiptOrder(null)}
                      className="p-1 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Receipt Image Display */}
                  <div className="p-4 flex flex-col items-center">
                    <div className="max-h-[60vh] overflow-auto bg-black/60 rounded-xl p-2 border border-slate-800 w-full flex items-center justify-center">
                      <img
                        src={viewingReceiptOrder.paymentReceiptImage}
                        alt={`فیش واریزی سفارش ${viewingReceiptOrder.trackingCode}`}
                        className="max-h-[55vh] max-w-full object-contain rounded shadow"
                      />
                    </div>

                    {viewingReceiptOrder.paymentTrackingNumber && (
                      <div className="mt-3 text-xs bg-[#060B14] px-4 py-2 rounded-xl border border-slate-800 flex items-center gap-3">
                        <span className="text-slate-400">کد پیگیری ثبت‌شده در فیش:</span>
                        <span className="font-mono font-bold text-white select-all">
                          {viewingReceiptOrder.paymentTrackingNumber}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Modal Actions */}
                  <div className="p-4 border-t border-slate-700/80 bg-[#081124] flex items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => setViewingReceiptOrder(null)}
                      className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold"
                    >
                      بستن پنجره
                    </button>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const ord = viewingReceiptOrder;
                          setViewingReceiptOrder(null);
                          setRejectingOrder(ord);
                          setRejectionReasonInput(ord.rejectionReason || '');
                        }}
                        className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-all"
                      >
                        <XCircle className="w-4 h-4" />
                        <span>رد فیش</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleApproveOrder(viewingReceiptOrder)}
                        className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-md"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>تأیید فیش و سفارش</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ========================================================================= */}
            {/* REJECTION REASON MODAL DIALOG */}
            {/* ========================================================================= */}
            {rejectingOrder && (
              <div
                className="fixed inset-0 z-[85] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in"
                onClick={() => setRejectingOrder(null)}
              >
                <div
                  className="relative max-w-lg w-full bg-[#0E1A33] border border-rose-500/50 rounded-2xl overflow-hidden shadow-2xl p-6 space-y-4"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between pb-3 border-b border-slate-700">
                    <div className="flex items-center gap-2 text-rose-400 font-bold text-sm">
                      <AlertTriangle className="w-5 h-5 text-rose-400" />
                      <span>رد سفارش و عدم تأیید فیش</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setRejectingOrder(null)}
                      className="p-1 rounded-full text-slate-400 hover:text-white"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="space-y-3">
                    <p className="text-xs text-slate-300 leading-relaxed">
                      شما در حال رد سفارش با کد رهگیری{' '}
                      <strong className="text-white font-mono">{rejectingOrder.trackingCode}</strong> به نام{' '}
                      <strong className="text-white">{rejectingOrder.customerName}</strong> هستید. لطفاً دلیل رد
                      را مشخص فرمایید:
                    </p>

                    {/* Quick Preset Reason Tags */}
                    <div>
                      <span className="text-[11px] text-slate-400 block mb-1.5 font-semibold">
                        دلایل متداول (انتخاب سریع):
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {[
                          'تصویر فیش ناخوانا یا مخدوش است',
                          'مبلغ فیش کمتر از مبلغ سفارش است',
                          'کد پیگیری با واریزی حساب تطابق ندارد',
                          'وجهی به حساب گالری واریز نشده است',
                          'فیش ارسالی تکراری یا نامعتبر است',
                          'انصراف توسط خریدار',
                        ].map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => setRejectionReasonInput(preset)}
                            className={`text-[11px] px-2.5 py-1 rounded-lg border transition-all ${
                              rejectionReasonInput === preset
                                ? 'bg-rose-500 text-white border-rose-400 font-bold'
                                : 'bg-[#060B14] text-slate-300 border-slate-700 hover:border-slate-500'
                            }`}
                          >
                            {preset}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Custom Textarea */}
                    <div>
                      <label className="text-xs font-semibold text-slate-200 block mb-1.5">
                        متن دقیق دلیل رد سفارش:
                      </label>
                      <textarea
                        rows={3}
                        value={rejectionReasonInput}
                        onChange={(e) => setRejectionReasonInput(e.target.value)}
                        placeholder="علت عدم تایید فیش را شرح دهید..."
                        className="w-full bg-[#060B14] border border-slate-700 focus:border-rose-400 rounded-xl p-3 text-xs text-white outline-none resize-none"
                      />
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-700/80 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setRejectingOrder(null)}
                      className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold"
                    >
                      انصراف
                    </button>
                    <button
                      type="button"
                      disabled={actionLoadingOrderId === rejectingOrder.id}
                      onClick={handleRejectOrder}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-all shadow-md disabled:opacity-50"
                    >
                      <XCircle className="w-4 h-4" />
                      <span>
                        {actionLoadingOrderId === rejectingOrder.id ? 'در حال ثبت...' : 'ثبت قطعی رد سفارش'}
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ========================================================================= */}
            {/* DELETE ORDER CONFIRMATION MODAL */}
            {/* ========================================================================= */}
            {deletingOrder && (
              <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
                <div className="bg-[#0A1120] border border-rose-500/30 rounded-2xl max-w-md w-full p-6 text-slate-200 shadow-2xl space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                    <div className="flex items-center gap-2 text-rose-400 font-bold text-sm">
                      <Trash2 className="w-5 h-5 text-rose-500" />
                      <span>تأیید حذف سفارش از دیتابیس و حافظه</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setDeletingOrder(null)}
                      className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="space-y-3 text-xs">
                    <p className="text-slate-300 leading-relaxed">
                      آیا از حذف سفارش کد{' '}
                      <strong className="text-white font-mono text-sm px-1.5 py-0.5 bg-[#060B14] rounded border border-slate-800">
                        {deletingOrder.trackingCode}
                      </strong>{' '}
                      متعلق به <strong className="text-[#D4AF37]">{deletingOrder.customerName}</strong> با مبلغ کل{' '}
                      <strong className="text-white">{formatToman(deletingOrder.totalPrice)}</strong> اطمینان دارید؟
                    </p>
                    <div className="p-3 bg-rose-950/20 border border-rose-500/30 rounded-xl text-rose-300 text-[11px] flex items-start gap-2 leading-relaxed">
                      <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                      <span>
                        این سفارش به صورت قطعی و همیشگی از پایگاه داده (دیتابیس) و حافظه رم سیستم پاک خواهد شد و قابل بازگشت نخواهد بود.
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                    <button
                      type="button"
                      disabled={isDeletingLoading}
                      onClick={() => setDeletingOrder(null)}
                      className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-800 transition-all cursor-pointer"
                    >
                      انصراف
                    </button>
                    <button
                      type="button"
                      disabled={isDeletingLoading}
                      onClick={handleDeleteOrder}
                      className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 active:scale-95 transition-all flex items-center gap-2 shadow-lg shadow-rose-950/40 cursor-pointer disabled:opacity-50"
                    >
                      {isDeletingLoading ? (
                        <span>در حال حذف...</span>
                      ) : (
                        <>
                          <Trash2 className="w-4 h-4" />
                          <span>بله، حذف قطعی از دیتابیس</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 6: SYSTEM AUDIT LOGGING & MONITORING */}
        {/* ========================================================================= */}
        {activeAdminTab === 'logs' && <SystemLogsViewer />}
      </div>
    </section>
  );
};
