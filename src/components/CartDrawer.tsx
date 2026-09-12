import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  ShoppingBag,
  Trash2,
  Sparkles,
  ArrowLeft,
  CheckCircle2,
  Phone,
  MessageCircle,
  Send,
  ShieldCheck,
  RotateCcw,
  Copy,
  Check,
  AlertCircle,
  CreditCard,
  UploadCloud,
  Image as ImageIcon,
  Eye,
  Clock,
  FileCheck,
  UserPlus,
  LogIn,
  Lock,
  ChevronLeft,
  User,
  Edit2,
  MapPin,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { useGoldStore } from '../context/GoldStoreContext';
import { useAuth } from '../context/AuthContext';
import { formatToman, formatWeight, toPersianDigits } from '../utils/persianFormatter';
import { calculateProductPrice } from '../utils/pricingEngine';
import { Order } from '../types';
import { db } from '../lib/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { getAuthHeaders } from '../utils/authHelper';

export const CartDrawer: React.FC = () => {
  const { cart, isCartOpen, setIsCartOpen, removeFromCart, updateCartQuantity, clearCart, goldPrice, settings, refreshProducts } =
    useGoldStore();
  const { userProfile, currentUser, openAuthModal } = useAuth();
  const isAuthenticated = !!(currentUser || userProfile);

  const [checkoutStep, setCheckoutStep] = useState<'cart' | 'info' | 'payment' | 'success'>('cart');
  const [showAuthRequiredModal, setShowAuthRequiredModal] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [contactMethod, setContactMethod] = useState<'telegram' | 'phone' | 'sms'>('telegram');
  const [notes, setNotes] = useState('');
  const [paymentTrackingNumber, setPaymentTrackingNumber] = useState('');
  const [paymentReceiptImage, setPaymentReceiptImage] = useState<string | null>(null);
  const [receiptSizeInfo, setReceiptSizeInfo] = useState<string | null>(null);
  const [isReadingReceipt, setIsReadingReceipt] = useState(false);
  const [isReserving, setIsReserving] = useState(false);
  const [copiedCard, setCopiedCard] = useState(false);
  const [copiedSheba, setCopiedSheba] = useState(false);
  const [previewReceiptModal, setPreviewReceiptModal] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmedOrder, setConfirmedOrder] = useState<Order | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  // Price quote lock state (15-minute guarantee)
  const [activeQuote, setActiveQuote] = useState<{
    quoteId: string;
    expiresAt: number;
    totalPrice: number;
    goldPriceAtOrder: number;
  } | null>(null);
  const [quoteSecondsLeft, setQuoteSecondsLeft] = useState<number | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState<string>(() => `idemp_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`);
  const [networkErrorOccurred, setNetworkErrorOccurred] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Countdown timer for 15-minute locked price quote
  useEffect(() => {
    if (!activeQuote) {
      setQuoteSecondsLeft(null);
      return;
    }
    const updateCountdown = () => {
      const remaining = Math.max(0, Math.floor((activeQuote.expiresAt - Date.now()) / 1000));
      setQuoteSecondsLeft(remaining);
    };
    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [activeQuote]);

  // Request/refresh guaranteed 15-minute price quote from server
  const obtainPriceQuote = async () => {
    try {
      const res = await fetch('/api/orders/quote', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          items: cart.map((i) => ({ productId: i.product.id, quantity: i.quantity })),
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setActiveQuote({
          quoteId: data.quoteId,
          expiresAt: data.expiresAt,
          totalPrice: data.totalPrice,
          goldPriceAtOrder: data.goldPriceAtOrder,
        });
        return true;
      } else {
        const err = await res.json().catch(() => ({}));
        setFormError(err.message || err.error || 'خطا در محاسبه و قفل نرخ طلای سبد خرید.');
        return false;
      }
    } catch {
      setFormError('خطا در اتصال به سرور جهت دریافت پیش‌فاکتور رسمی طلا.');
      return false;
    }
  };

  // Auto pre-fill user profile info if logged in
  useEffect(() => {
    if (userProfile || currentUser) {
      if (!customerName) {
        setCustomerName(userProfile?.displayName || currentUser?.displayName || '');
      }
      if (!customerPhone) {
        setCustomerPhone(userProfile?.phoneNumber || currentUser?.phoneNumber || '');
      }
      if (!customerAddress && userProfile?.address) {
        setCustomerAddress(userProfile.address);
      }
    }
  }, [userProfile, currentUser, checkoutStep]);

  // If user registers/logs in while auth required prompt is active, auto-advance to info form
  useEffect(() => {
    if (isAuthenticated && showAuthRequiredModal) {
      setShowAuthRequiredModal(false);
      setCheckoutStep('info');
    }
  }, [isAuthenticated, showAuthRequiredModal]);

  if (!isCartOpen) return null;

  // Calculate real-time cart summary
  let totalWeight = 0;
  let subtotalPrice = 0;

  const itemDetails = cart.map((item) => {
    const breakdown = calculateProductPrice(item.product, goldPrice.pricePerGram, settings);
    const unitPrice = breakdown.finalPrice;
    const itemTotal = unitPrice * item.quantity;
    totalWeight += item.product.weight * item.quantity;
    subtotalPrice += itemTotal;

    return {
      ...item,
      unitPrice,
      itemTotal,
      effectiveMakingCharge: breakdown.effectiveMakingChargePercent,
    };
  });

  const copyCardNumber = () => {
    const card = settings.bankCardNumber || '۶۰۳۷-۹۹۱۸-۴۲۱۰-۸۸۷۶';
    navigator.clipboard.writeText(card);
    setCopiedCard(true);
    setTimeout(() => setCopiedCard(false), 2000);
  };

  const copyShebaNumber = () => {
    const sheba = settings.bankSheba || 'IR-120170000000108876543210';
    navigator.clipboard.writeText(sheba);
    setCopiedSheba(true);
    setTimeout(() => setCopiedSheba(false), 2000);
  };

  const handleReceiptUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      setFormError('حجم تصویر فیش بیش از ۱۵ مگابایت است. لطفاً تصویر کم‌حجم‌تری انتخاب فرمایید.');
      return;
    }

    setIsReadingReceipt(true);
    setFormError(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          // Target max dimension 800px: plenty of resolution for legible tracking numbers and IBAN
          const maxDim = 800;

          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, 0, 0, width, height);

            // Phase 1: High quality 70% compression
            let compressed = canvas.toDataURL('image/jpeg', 0.70);

            // Phase 2: If still > 160KB (approx 210,000 chars), step down slightly to protect RAM
            if (compressed.length > 210000) {
              compressed = canvas.toDataURL('image/jpeg', 0.55);
            }

            const approxKb = Math.round((compressed.length * 0.75) / 1024);
            setPaymentReceiptImage(compressed);
            setReceiptSizeInfo(`حجم بهینه‌شده: ${approxKb} کیلوبایت (کاهش بیش از ۹۰٪ برای پایداری و ثبت فوری)`);
          } else {
            setPaymentReceiptImage(event.target?.result as string);
          }
        } catch {
          setPaymentReceiptImage(event.target?.result as string);
        } finally {
          setIsReadingReceipt(false);
        }
      };
      img.onerror = () => {
        setPaymentReceiptImage(event.target?.result as string);
        setIsReadingReceipt(false);
      };
      img.src = event.target?.result as string;
    };
    reader.onerror = () => {
      setFormError('خطا در خواندن فایل فیش.');
      setIsReadingReceipt(false);
    };
    reader.readAsDataURL(file);
  };

  const handleProceedToPayment = async () => {
    if (!isAuthenticated) {
      setShowAuthRequiredModal(true);
      return;
    }

    // Concurrency Lock: Pre-reserve cart items on server to prevent race conditions during payment
    setIsReserving(true);
    setFormError(null);
    try {
      const authHeaders = getAuthHeaders();
      for (const item of cart) {
        const res = await fetch('/api/cart/reserve', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...authHeaders,
          },
          body: JSON.stringify({
            productId: item.product.id,
            quantity: item.quantity,
          }),
        });

        if (!res.ok) {
          const errJson = await res.json().catch(() => ({}));
          setFormError(
            errJson.message ||
              `متأسفانه موجودی محصول «${item.product.title}» هم‌اکنون توسط خریدار دیگری در حال نهایی‌سازی است.`
          );
          setIsReserving(false);
          return;
        }
      }
      setCheckoutStep('info');
    } catch {
      // Allow moving to info
      setCheckoutStep('info');
    } finally {
      setIsReserving(false);
    }
  };

  const handleProceedToPaymentStep = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setFormError(null);

    if (!isAuthenticated) {
      setShowAuthRequiredModal(true);
      setFormError('جهت ثبت سفارش و پرداخت، لطفاً ابتدا در سایت ثبت‌نام نمایید.');
      return;
    }

    if (!customerName.trim()) {
      setFormError('لطفاً نام و نام خانوادگی خریدار را وارد فرمایید.');
      return;
    }

    if (!customerPhone.trim()) {
      setFormError('لطفاً شماره تماس همراه خود را وارد فرمایید.');
      return;
    }

    // Lock price quote on server (15-min guarantee)
    setIsReserving(true);
    const quoteSuccess = await obtainPriceQuote();
    setIsReserving(false);
    if (!quoteSuccess) {
      return;
    }

    // Proceed to Card-to-Card step
    setCheckoutStep('payment');
  };

  const handleCheckoutSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setFormError(null);
    setNetworkErrorOccurred(false);

    if (!isAuthenticated) {
      setShowAuthRequiredModal(true);
      setFormError('جهت ثبت سفارش و پرداخت، لطفاً ابتدا در سایت ثبت‌نام نمایید.');
      return;
    }

    if (!customerName.trim() || !customerPhone.trim()) {
      setFormError('لطفاً ابتدا نام و شماره تماس همراه خود را تکمیل فرمایید.');
      setCheckoutStep('info');
      return;
    }

    setIsSubmitting(true);

    try {
      const orderPayload = {
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        customerAddress: customerAddress.trim(),
        contactMethod,
        notes: notes.trim(),
        paymentMethod: 'card_to_card',
        paymentTrackingNumber: paymentTrackingNumber.trim(),
        paymentReceiptImage: paymentReceiptImage || '',
        quoteId: activeQuote?.quoteId,
        idempotencyKey,
        items: cart.map((item) => ({
          productId: item.product.id,
          quantity: item.quantity,
        })),
      };

      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-idempotency-key': idempotencyKey,
          ...getAuthHeaders(),
        },
        body: JSON.stringify(orderPayload),
      });

      if (response.ok) {
        const data = await response.json();
        const createdOrder: Order = data.order;
        setConfirmedOrder(createdOrder);
        setCheckoutStep('success');
        clearCart();
        refreshProducts();
        setNetworkErrorOccurred(false);

        // Also mirror in cloud Firestore database for redundancy
        try {
          if (createdOrder?.id) {
            await setDoc(doc(db, 'orders', createdOrder.id), {
              ...createdOrder,
              userId: currentUser?.uid || userProfile?.uid || 'authenticated_user',
              userEmail: currentUser?.email || userProfile?.email || '',
              updatedAt: new Date().toISOString(),
            });
          }
        } catch (firestoreErr) {
          console.warn('[FIRESTORE] Cloud sync notice (order is safely persisted in server DB):', firestoreErr);
        }

        try {
          confetti({
            particleCount: 80,
            spread: 70,
            origin: { y: 0.6 },
            colors: ['#D4AF37', '#F5E8C7', '#AA822A', '#FFFFFF'],
          });
        } catch {
          // ignore if canvas unavailable
        }
      } else {
        const errJson = await response.json().catch(() => ({}));
        if (errJson.quoteExpired) {
          setFormError('مهلت ۱۵ دقیقه‌ای پیش‌فاکتور طلا به پایان رسیده است. در حال دریافت پیش‌فاکتور جدید...');
          await obtainPriceQuote();
        } else {
          setFormError(
            errJson.message ||
              errJson.error ||
              'خطا در ثبت سفارش. لطفاً موجودی و مشخصات سفارش را مجدداً بررسی فرمایید.'
          );
        }
      }
    } catch (networkErr: any) {
      // CRITICAL FIX: NEVER create a mock order or pretend success on network error!
      // Cart items and payment receipt data MUST be retained, allowing the customer to retry safely.
      setNetworkErrorOccurred(true);
      setFormError(
        'خطا در برقراری ارتباط با سرور یا قطعی اینترنت. سفارش شما هنوز ثبت نشده است، اما کلیه اطلاعات سبد خرید و فیش بانکی شما محفوظ است. لطفاً اتصال اینترنت را بررسی نموده و دوباره تلاش فرمایید.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyTrackingCode = () => {
    if (confirmedOrder?.trackingCode) {
      navigator.clipboard.writeText(confirmedOrder.trackingCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-300">
      <div
        className="fixed inset-y-0 left-0 max-w-full flex pl-0 sm:pl-10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-screen max-w-full sm:max-w-md bg-[#060B15] border-r border-[#D4AF37]/35 shadow-[0_0_60px_rgba(0,0,0,0.85)] flex flex-col justify-between min-w-0">
          {/* Top Header */}
          <div className="p-5 border-b border-[#D4AF37]/25 bg-[#0A1224] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-[#D4AF37]" />
              <h2 className="font-bold text-white text-base">
                {checkoutStep === 'cart'
                  ? 'سبد خرید زیورآلات'
                  : checkoutStep === 'info'
                  ? 'مشخصات خریدار و تحویل'
                  : checkoutStep === 'payment'
                  ? 'صفحه پرداخت کارت به کارت'
                  : 'تأییدیه نهایی سفارش'}
              </h2>
            </div>

            <button
              onClick={() => {
                setIsCartOpen(false);
                setCheckoutStep('cart');
              }}
              className="p-1.5 rounded-full text-slate-300 hover:text-white hover:bg-[#0B152B] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* 3-Step Progress Indicator */}
          {checkoutStep !== 'success' && (
            <div className="flex items-center justify-between px-5 py-2.5 bg-[#040810] border-b border-[#D4AF37]/20 text-[11px]">
              <button
                type="button"
                onClick={() => setCheckoutStep('cart')}
                className={`flex items-center gap-1.5 transition-colors ${
                  checkoutStep === 'cart'
                    ? 'text-[#D4AF37] font-bold'
                    : 'text-slate-400 hover:text-white cursor-pointer'
                }`}
              >
                <span
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
                    checkoutStep === 'cart'
                      ? 'bg-[#D4AF37] text-slate-950 font-bold'
                      : 'bg-slate-800 text-slate-300'
                  }`}
                >
                  ۱
                </span>
                <span>سبد خرید</span>
              </button>
              <ChevronLeft className="w-3.5 h-3.5 text-slate-600 flex-shrink-0" />
              <button
                type="button"
                onClick={() => {
                  if (checkoutStep === 'payment') setCheckoutStep('info');
                }}
                className={`flex items-center gap-1.5 transition-colors ${
                  checkoutStep === 'info'
                    ? 'text-[#D4AF37] font-bold'
                    : checkoutStep === 'payment'
                    ? 'text-emerald-400 font-semibold cursor-pointer hover:underline'
                    : 'text-slate-500 cursor-default'
                }`}
              >
                <span
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
                    checkoutStep === 'info'
                      ? 'bg-[#D4AF37] text-slate-950 font-bold'
                      : checkoutStep === 'payment'
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 font-bold'
                      : 'bg-slate-800 text-slate-500'
                  }`}
                >
                  ۲
                </span>
                <span>اطلاعات خرید</span>
              </button>
              <ChevronLeft className="w-3.5 h-3.5 text-slate-600 flex-shrink-0" />
              <div
                className={`flex items-center gap-1.5 ${
                  checkoutStep === 'payment' ? 'text-[#D4AF37] font-bold' : 'text-slate-500'
                }`}
              >
                <span
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
                    checkoutStep === 'payment'
                      ? 'bg-[#D4AF37] text-slate-950 font-bold shadow-[0_0_10px_rgba(212,175,55,0.5)]'
                      : 'bg-slate-800 text-slate-500'
                  }`}
                >
                  ۳
                </span>
                <span>کارت به کارت</span>
              </div>
            </div>
          )}

          {/* Live Gold Price Recalculation Notice */}
          <div className="bg-[#0A1224] border-b border-[#D4AF37]/20 px-4 py-2 text-[11px] text-[#F5E8C7] flex items-center justify-between shadow-sm">
            <span className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#D4AF37]" />
              <span>قیمت نهایی بر اساس آخرین قیمت روز طلا محاسبه شده است.</span>
            </span>
            <span className="font-bold text-[#E6CA65]">
              {formatToman(goldPrice.pricePerGram)} / گ
            </span>
          </div>

          {/* Body Section */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5">
            {/* STEP 1: CART ITEMS */}
            {checkoutStep === 'cart' && (
              <>
                {cart.length === 0 ? (
                  <div className="text-center py-24">
                    <ShoppingBag className="w-12 h-12 text-slate-500 mx-auto mb-3" />
                    <h3 className="text-base font-bold text-white mb-1">سبد خرید شما خالی است</h3>
                    <p className="text-xs text-slate-300 mb-6">
                      می‌توانید از گالری محصولات قطعات مورد نظر خود را انتخاب فرمایید.
                    </p>
                    <button
                      onClick={() => setIsCartOpen(false)}
                      className="bg-[#D4AF37] text-slate-950 px-6 py-2.5 rounded-xl text-xs font-bold hover:brightness-110 transition-all shadow-md"
                    >
                      بازگشت به ویترین
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* User Auth Status Banner */}
                    {!isAuthenticated ? (
                      <div className="bg-gradient-to-r from-amber-500/15 via-[#D4AF37]/15 to-amber-500/15 border border-[#D4AF37]/40 rounded-2xl p-3 sm:p-3.5 flex items-center justify-between gap-3 shadow-sm text-xs animate-in fade-in">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center flex-shrink-0 text-[#D4AF37]">
                            <Lock className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="text-white font-bold block text-xs">
                              ثبت‌نام جهت ورود به مرحله پرداخت
                            </span>
                            <span className="text-[11px] text-amber-200/80 block mt-0.5">
                              برای صدور فاکتور و پرداخت، ابتدا در سامانه عضو شوید.
                            </span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => openAuthModal('register')}
                          className="bg-gradient-to-r from-[#D4AF37] to-[#AA822A] text-slate-950 px-3 py-1.5 rounded-xl text-xs font-bold hover:brightness-110 active:scale-95 transition-all shadow whitespace-nowrap flex items-center gap-1 cursor-pointer flex-shrink-0"
                        >
                          <UserPlus className="w-3.5 h-3.5" />
                          <span>لینک ثبت‌نام</span>
                        </button>
                      </div>
                    ) : (
                      <div className="bg-emerald-950/40 border border-emerald-500/30 rounded-2xl px-3.5 py-2.5 flex items-center justify-between text-xs text-emerald-300 shadow-sm animate-in fade-in">
                        <span className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          <span>
                            خوش‌آمدید، <strong className="text-white">{userProfile?.displayName || currentUser?.displayName || 'کاربر گرامی'}</strong>
                          </span>
                        </span>
                        <span className="text-[10px] bg-emerald-500/20 border border-emerald-500/40 px-2 py-0.5 rounded-full font-medium text-emerald-300">
                          حساب فعال
                        </span>
                      </div>
                    )}

                    {itemDetails.map((item) => (
                      <div
                        key={item.product.id}
                        className="bg-[#0B152B] border border-[#D4AF37]/25 hover:border-[#D4AF37]/50 rounded-2xl p-3.5 flex gap-3 relative group shadow-sm transition-all duration-300"
                      >
                        {/* Image */}
                        <img
                          src={item.product.images?.[0] || 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=800&q=80'}
                          alt={item.product.title}
                          className="w-16 h-20 rounded-xl object-cover border border-slate-600/70"
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src =
                              'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=800&q=80';
                          }}
                        />

                        {/* Info */}
                        <div className="flex-1 flex flex-col justify-between">
                          <div>
                            <h4 className="text-xs sm:text-sm font-bold text-white line-clamp-1">
                              {item.product.title}
                            </h4>
                            <div className="flex items-center gap-2 text-[11px] text-slate-300 mt-1">
                              <span>وزن: {formatWeight(item.product.weight)}</span>
                              <span>•</span>
                              <span>اجرت: {item.effectiveMakingCharge}٪</span>
                            </div>
                          </div>

                          <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-700/80">
                            <span className="text-xs font-bold text-white gold-gradient-text">
                              {formatToman(item.itemTotal)}
                            </span>

                            {/* Quantity buttons */}
                            <div className="flex items-center bg-[#0E1A33] border border-slate-600 rounded-lg px-1.5 py-0.5">
                              <button
                                onClick={() =>
                                  updateCartQuantity(item.product.id, item.quantity - 1)
                                }
                                className="w-5 h-5 flex items-center justify-center text-slate-300 hover:text-white text-xs"
                              >
                                -
                              </button>
                              <span className="w-6 text-center text-xs font-bold text-white">
                                {toPersianDigits(item.quantity)}
                              </span>
                              <button
                                onClick={() =>
                                  updateCartQuantity(item.product.id, item.quantity + 1)
                                }
                                className="w-5 h-5 flex items-center justify-center text-slate-300 hover:text-white text-xs"
                              >
                                +
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Delete Button */}
                        <button
                          onClick={() => removeFromCart(item.product.id)}
                          className="text-slate-400 hover:text-rose-400 p-1 transition-colors self-start"
                          title="حذف از سبد"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* STEP 2: BUYER INFORMATION FORM */}
            {checkoutStep === 'info' && (
              <form onSubmit={handleProceedToPaymentStep} className="space-y-4 text-xs animate-in fade-in">
                {/* Registration requirement warning banner if unauthenticated */}
                {!isAuthenticated && (
                  <div className="p-4 bg-gradient-to-br from-[#241705] via-[#1A1208] to-[#0E1A33] border-2 border-amber-500/60 rounded-2xl space-y-3 shadow-xl text-xs">
                    <div className="flex items-start gap-3">
                      <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-300 flex-shrink-0 mt-0.5 border border-amber-500/30">
                        <Lock className="w-5 h-5 text-[#D4AF37]" />
                      </div>
                      <div className="space-y-1">
                        <h4 className="text-white font-bold text-sm">
                          ثبت‌نام برای تکمیل و پرداخت سفارش الزامی است
                        </h4>
                        <p className="text-slate-300 leading-relaxed text-[11px]">
                          کاربر گرامی، جهت صدور پیش‌فاکتور معتبر و نهایی‌سازی سفارش، باید ابتدا در سایت ثبت‌نام فرمایید.
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2 pt-1 border-t border-slate-700/80">
                      <button
                        type="button"
                        onClick={() => openAuthModal('register')}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#AA822A] text-slate-950 font-bold text-xs hover:brightness-110 active:scale-98 shadow-md transition-all cursor-pointer"
                      >
                        <UserPlus className="w-4 h-4" />
                        <span>لینک ثبت‌نام در گالری اینانا</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => openAuthModal('login')}
                        className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs border border-slate-700 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <LogIn className="w-3.5 h-3.5 text-[#D4AF37]" />
                        <span>ورود به حساب</span>
                      </button>
                    </div>
                  </div>
                )}

                {formError && (
                  <div className="p-3 bg-rose-500/15 border border-rose-500/40 rounded-xl flex items-center gap-2 text-rose-300 text-xs">
                    <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
                    <span>{formError}</span>
                  </div>
                )}

                <div className="p-3 bg-[#13254A]/60 border border-slate-700/70 rounded-2xl space-y-1 text-slate-300">
                  <div className="flex items-center gap-1.5 text-white font-bold text-xs">
                    <User className="w-4 h-4 text-[#D4AF37]" />
                    <span>مشخصات خریدار و تحویل‌گیرنده سفارش</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    لطفاً اطلاعات خود را وارد فرمایید؛ پس از ثبت، مستقیماً به صفحه پرداخت کارت به کارت منتقل می‌شوید.
                  </p>
                </div>

                <div>
                  <label className="block text-slate-200 font-semibold mb-1">
                    نام و نام خانوادگی خریدار: *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: سارا محمدی"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full bg-[#13254A] border border-slate-600 focus:border-[#D4AF37] rounded-xl px-3.5 py-2.5 text-white outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-200 font-semibold mb-1">
                    شماره تماس همراه (جهت هماهنگی و پیامک رهگیری): *
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="مثال: 09121234567"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="w-full bg-[#13254A] border border-slate-600 focus:border-[#D4AF37] rounded-xl px-3.5 py-2.5 text-white outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-200 font-semibold mb-1">
                    آدرس دقیق پستی جهت ارسال بیمه‌شده:
                  </label>
                  <textarea
                    rows={2}
                    placeholder="استان، شهر، آدرس دقیق، کد پستی و پلاک (ارسال با پست پیشتاز بیمه‌شده)"
                    value={customerAddress}
                    onChange={(e) => setCustomerAddress(e.target.value)}
                    className="w-full bg-[#13254A] border border-slate-600 focus:border-[#D4AF37] rounded-xl px-3.5 py-2 text-white outline-none resize-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-200 font-semibold mb-1">
                    یادداشت سفارش (اختیاری):
                  </label>
                  <input
                    type="text"
                    placeholder="مثال: بسته‌بندی هدیه، سایز انگشتر یا متن کارت تبریک"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full bg-[#13254A] border border-slate-600 focus:border-[#D4AF37] rounded-xl px-3.5 py-2 text-white outline-none"
                  />
                </div>

                {/* Quick items & amount summary */}
                <div className="p-3 bg-[#0A1324] border border-[#D4AF37]/30 rounded-2xl space-y-2">
                  <div className="flex justify-between items-center text-[11px] text-slate-300">
                    <span>اقلام انتخاب شده:</span>
                    <span className="font-semibold text-white">{toPersianDigits(cart.length)} قطعه طلا</span>
                  </div>
                  <div className="flex justify-between items-center text-[11px] text-slate-300">
                    <span>مجموع وزن طلای ۱۸ عیار:</span>
                    <span className="font-semibold text-white">{formatWeight(totalWeight)}</span>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-slate-800 font-bold text-xs">
                    <span className="text-slate-200">مبلغ قابل پرداخت:</span>
                    <span className="text-[#D4AF37] text-sm">{formatToman(subtotalPrice)}</span>
                  </div>
                </div>

                {/* Submit button inside form for desktop/mobile accessibility */}
                <button
                  type="submit"
                  className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-[#D4AF37] via-[#C5A059] to-[#AA822A] text-slate-950 font-bold py-3.5 rounded-xl hover:brightness-110 active:scale-98 transition-all text-xs shadow-md cursor-pointer"
                >
                  <span>ثبت اطلاعات و رفتن به صفحه کارت به کارت</span>
                  <ArrowLeft className="w-4 h-4" />
                </button>
              </form>
            )}

            {/* STEP 3: CARD-TO-CARD PAYMENT SCREEN */}
            {checkoutStep === 'payment' && (
              <div className="space-y-4 text-xs animate-in fade-in">
                {formError && !networkErrorOccurred && (
                  <div className="p-3 bg-rose-500/15 border border-rose-500/40 rounded-xl flex items-center gap-2 text-rose-300 text-xs">
                    <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
                    <span>{formError}</span>
                  </div>
                )}

                {/* Network failure notice with actionable retry */}
                {networkErrorOccurred && (
                  <div className="p-3.5 bg-amber-500/15 border-2 border-amber-500/50 rounded-2xl space-y-2 text-amber-200">
                    <div className="flex items-center gap-2 font-bold text-xs">
                      <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                      <span>سفارش ثبت نشد (عدم اتصال به سرور) — سبد و فیش شما محفوظ است</span>
                    </div>
                    <p className="text-[11px] leading-relaxed text-amber-200/90">
                      پاسخی از سرور دریافت نشد؛ سفارش هنوز ثبت نشده اما اطلاعات سبد خرید و فیش بارگذاری‌شده شما محفوظ مانده است. لطفاً اتصال اینترنت خود را بررسی کرده و مجدداً دکمه زیر را برای ثبت نهایی لمس فرمایید.
                    </p>
                    <button
                      type="button"
                      onClick={handleCheckoutSubmit}
                      disabled={isSubmitting}
                      className="w-full mt-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold py-2.5 px-3 rounded-xl text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>{isSubmitting ? 'در حال ارسال مجدد...' : 'تلاش مجدد برای ثبت نهایی سفارش'}</span>
                    </button>
                  </div>
                )}

                {/* Guaranteed Gold Price Lock Banner (15-minute TTL) */}
                {activeQuote && (
                  <div
                    className={`p-3 rounded-2xl border flex items-center justify-between gap-3 text-xs transition-colors ${
                      quoteSecondsLeft !== null && quoteSecondsLeft > 60
                        ? 'bg-[#101E3D] border-[#D4AF37]/50 text-[#F5E8C7]'
                        : quoteSecondsLeft !== null && quoteSecondsLeft > 0
                        ? 'bg-amber-500/10 border-amber-500/40 text-amber-300'
                        : 'bg-rose-500/10 border-rose-500/40 text-rose-300'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-[#D4AF37] flex-shrink-0" />
                      <div>
                        <span className="font-bold block text-white text-xs">
                          تضمین و قفل نرخ طلا پیش‌فاکتور (۱۵ دقیقه)
                        </span>
                        <span className="text-[10px] opacity-80 block mt-0.5">
                          {quoteSecondsLeft !== null && quoteSecondsLeft > 0
                            ? `مهلت واریز با نرخ تضمین‌شده: ${toPersianDigits(Math.floor(quoteSecondsLeft / 60))}:${toPersianDigits(String(quoteSecondsLeft % 60).padStart(2, '0'))}`
                            : 'مهلت پیش‌فاکتور منقضی شده است. لطفاً نرخ را بروزرسانی فرمایید.'}
                        </span>
                      </div>
                    </div>
                    {quoteSecondsLeft === 0 && (
                      <button
                        type="button"
                        onClick={obtainPriceQuote}
                        className="px-2.5 py-1.5 bg-[#D4AF37] text-slate-950 rounded-lg font-bold text-[11px] flex items-center gap-1 hover:brightness-110 cursor-pointer"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>بروزرسانی نرخ</span>
                      </button>
                    )}
                  </div>
                )}

                {/* Step Banner: Info Registered */}
                <div className="p-3 bg-emerald-500/15 border border-emerald-500/35 rounded-2xl flex items-center justify-between gap-3 text-emerald-300">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    <div>
                      <span className="font-bold text-white text-xs block">اطلاعات خرید با موفقیت ثبت شد</span>
                      <span className="text-[11px] text-emerald-300/90 block mt-0.5">
                        لطفاً مبلغ فاکتور را به شماره کارت رسمی زیر واریز فرمایید:
                      </span>
                    </div>
                  </div>
                </div>

                {/* Buyer info summary card with Edit button */}
                <div className="p-3.5 bg-[#13254A] border border-slate-700 rounded-2xl space-y-2 relative">
                  <div className="flex items-center justify-between border-b border-slate-700/70 pb-2">
                    <div className="flex items-center gap-1.5 text-white font-bold text-xs">
                      <User className="w-3.5 h-3.5 text-[#D4AF37]" />
                      <span>مشخصات خریدار ثبت‌شده</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setCheckoutStep('info')}
                      className="text-[#D4AF37] hover:text-[#F5E8C7] flex items-center gap-1 text-[11px] font-semibold transition-colors cursor-pointer"
                    >
                      <Edit2 className="w-3 h-3" />
                      <span>ویرایش اطلاعات</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-300 pt-0.5">
                    <div>
                      <span className="text-slate-400">نام خریدار: </span>
                      <span className="font-bold text-white">{customerName}</span>
                    </div>
                    <div>
                      <span className="text-slate-400">شماره همراه: </span>
                      <span className="font-bold text-white font-mono dir-ltr inline-block">{customerPhone}</span>
                    </div>
                  </div>

                  {customerAddress && (
                    <div className="text-[11px] text-slate-300 pt-1 border-t border-slate-800 flex items-start gap-1">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0 mt-0.5" />
                      <span className="text-slate-400 flex-shrink-0">آدرس: </span>
                      <span className="text-white line-clamp-1">{customerAddress}</span>
                    </div>
                  )}
                </div>

                {/* CARD-TO-CARD PAYMENT SECTION */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-white font-bold text-xs sm:text-sm">
                      <CreditCard className="w-4 h-4 text-[#D4AF37]" />
                      <span>پرداخت از طریق کارت به کارت شتاب</span>
                    </div>
                    <span className="text-[10px] text-amber-300 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full font-medium">
                      تأیید در پنل مدیریت
                    </span>
                  </div>

                  {/* Luxury Bank Card Mockup */}
                  <div className="bg-gradient-to-br from-[#101E3D] via-[#0D1830] to-[#080F1E] border border-[#D4AF37]/50 rounded-2xl p-4 shadow-lg relative overflow-hidden text-xs">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-[#D4AF37]/10 rounded-full blur-2xl pointer-events-none" />

                    <div className="flex items-center justify-between mb-3 text-slate-300">
                      <span className="font-bold text-[#F5E8C7]">
                        {settings.bankName || 'بانک ملی ایران (شعبه تجریش)'}
                      </span>
                      <span className="text-[10px] text-[#D4AF37] border border-[#D4AF37]/40 px-2 py-0.5 rounded-md bg-[#D4AF37]/5">
                        حساب رسمی اینانا
                      </span>
                    </div>

                    {/* Card Number & Copy */}
                    <div className="my-2 bg-[#060B14]/80 border border-slate-700/80 rounded-xl p-2.5 flex items-center justify-between">
                      <span className="font-mono font-bold text-base sm:text-lg text-white tracking-widest dir-ltr">
                        {settings.bankCardNumber || '۶۰۳۷-۹۹۱۸-۴۲۱۰-۸۸۷۶'}
                      </span>
                      <button
                        type="button"
                        onClick={copyCardNumber}
                        className="flex items-center gap-1 bg-[#D4AF37] hover:bg-[#c5a033] text-slate-950 font-bold px-2.5 py-1 rounded-lg text-[11px] transition-all shadow cursor-pointer active:scale-95"
                      >
                        {copiedCard ? (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            <span>کپی شد</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>کپی کارت</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* Cardholder & Sheba */}
                    <div className="space-y-1.5 pt-1 text-[11px] text-slate-300">
                      <div className="flex justify-between">
                        <span className="text-slate-400">به نام:</span>
                        <span className="font-semibold text-white">
                          {settings.bankCardHolder || 'امیر بی‌اشد (گالری طلا و جواهر اینانا)'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400">شماره شبا:</span>
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-slate-300 text-[10px] dir-ltr">
                            {settings.bankSheba || 'IR-120170000000108876543210'}
                          </span>
                          <button
                            type="button"
                            onClick={copyShebaNumber}
                            className="text-[#D4AF37] hover:text-white p-0.5"
                            title="کپی شماره شبا"
                          >
                            {copiedSheba ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                          </button>
                        </div>
                      </div>
                      <div className="flex justify-between pt-1.5 border-t border-slate-700/60 font-bold items-center">
                        <span className="text-[#D4AF37]">مبلغ دقیق قابل انتقال:</span>
                        <span className="text-white text-sm sm:text-base gold-gradient-text">
                          {formatToman(subtotalPrice)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Receipt Photo Upload */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                        <ImageIcon className="w-3.5 h-3.5 text-[#D4AF37]" />
                        <span>عکس فیش واریز کارت به کارت:</span>
                      </label>
                      <span className="text-[10px] text-slate-400">تصویر رسید بانکی</span>
                    </div>

                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleReceiptUpload}
                      className="hidden"
                    />

                    {paymentReceiptImage ? (
                      <div className="relative rounded-2xl overflow-hidden border border-[#D4AF37]/50 bg-[#060B14] p-2.5 flex items-center justify-between gap-3 shadow-inner">
                        <div className="flex items-center gap-3">
                          <img
                            src={paymentReceiptImage}
                            alt="رسید واریز"
                            className="w-14 h-14 object-cover rounded-xl border border-slate-700 cursor-pointer hover:opacity-90"
                            onClick={() => setPreviewReceiptModal(paymentReceiptImage)}
                          />
                          <div>
                            <div className="flex items-center gap-1 text-emerald-400 font-bold text-xs">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>عکس فیش با موفقیت بارگذاری شد</span>
                            </div>
                            {receiptSizeInfo && (
                              <p className="text-[10px] text-emerald-300/90 mt-0.5">
                                {receiptSizeInfo}
                              </p>
                            )}
                            <button
                              type="button"
                              onClick={() => setPreviewReceiptModal(paymentReceiptImage)}
                              className="text-[11px] text-[#D4AF37] hover:underline flex items-center gap-1 mt-0.5 cursor-pointer"
                            >
                              <Eye className="w-3 h-3" />
                              <span>مشاهده پیش‌نمایش تصویر فیش</span>
                            </button>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-[11px] transition-colors cursor-pointer"
                          >
                            تغییر عکس
                          </button>
                          <button
                            type="button"
                            onClick={() => setPaymentReceiptImage(null)}
                            className="p-1.5 text-rose-400 hover:bg-rose-500/20 rounded-lg transition-colors cursor-pointer"
                            title="حذف فیش"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isReadingReceipt}
                        className="w-full border-2 border-dashed border-[#D4AF37]/40 hover:border-[#D4AF37] rounded-2xl p-4 flex flex-col items-center justify-center gap-2 bg-[#13254A]/40 hover:bg-[#13254A]/80 transition-all cursor-pointer group text-center"
                      >
                        <div className="w-10 h-10 rounded-full bg-[#D4AF37]/10 flex items-center justify-center text-[#D4AF37] group-hover:scale-110 transition-transform">
                          <UploadCloud className="w-5 h-5" />
                        </div>
                        <div className="space-y-0.5">
                          <span className="text-xs font-bold text-white block">
                            {isReadingReceipt ? 'در حال پردازش تصویر فیش...' : 'برای انتخاب و بارگذاری عکس فیش کلیک کنید'}
                          </span>
                          <span className="text-[10px] text-slate-400 block">
                            فرمت‌های مجاز: JPG، PNG، WEBP (حداکثر ۱۲ مگابایت)
                          </span>
                        </div>
                      </button>
                    )}
                  </div>

                  {/* Optional Bank Tracking Number Input */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-semibold text-slate-200">
                        شماره پیگیری / کد ارجاع بانکی (اختیاری):
                      </label>
                      <span className="text-[10px] text-slate-400">اختیاری</span>
                    </div>
                    <input
                      type="text"
                      placeholder="مثال: 98421463 یا TRX-00124 (اختیاری)"
                      value={paymentTrackingNumber}
                      onChange={(e) => setPaymentTrackingNumber(e.target.value)}
                      className="w-full bg-[#13254A] border border-slate-600 focus:border-[#D4AF37] rounded-xl px-3.5 py-2 text-white outline-none text-xs font-mono"
                    />
                    <span className="text-[10px] text-slate-400 mt-1 block">
                      در صورت ثبت شماره پیگیری، بررسی و تأیید سفارش شما با سرعت بیشتری انجام می‌شود.
                    </span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-[#13254A]/80 border border-slate-700/80 text-[11px] text-slate-300 space-y-1">
                  <div className="flex items-center gap-1.5 text-[#D4AF37]">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span className="font-semibold">تضمین امنیت خرید و تایید در پنل مدیریت اینانا</span>
                  </div>
                  <p>
                    سفارش شما پس از ثبت، به عنوان «در انتظار بررسی» در پنل مدیریت گالری قرار می‌گیرد.
                    پس از بررسی و تایید فیش بانکی توسط کارشناس مالی، فاکتور رسمی صادر و ارسال بیمه‌شده انجام می‌شود.
                  </p>
                </div>
              </div>
            )}

            {/* STEP 3: ORDER SUCCESS CONFIRMATION */}
            {checkoutStep === 'success' && confirmedOrder && (
              <div className="text-center py-6 space-y-4">
                <div className="w-16 h-16 rounded-full bg-[#D4AF37]/20 border border-[#D4AF37] flex items-center justify-center mx-auto text-[#D4AF37] shadow-[0_0_25px_rgba(212,175,55,0.4)]">
                  <CheckCircle2 className="w-8 h-8" />
                </div>

                <h3 className="text-lg font-bold text-white">سفارش شما با موفقیت ثبت شد</h3>

                {/* Status Notice: In Review */}
                <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-amber-500/15 border border-amber-500/35 text-amber-300 text-xs font-bold shadow-sm">
                  <Clock className="w-3.5 h-3.5 animate-pulse" />
                  <span>وضعیت: در انتظار بررسی و تأیید فیش بانکی</span>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed px-2">
                  سفارش و اطلاعات فیش واریز شما در کارتابل مدیریت گالری طلای اینانا ثبت گردید.
                  پس از تطبیق و تایید مالی، وضعیت سفارش به «تأیید شده» تغییر یافته و پیامک و هماهنگی ارسال خدمت شما انجام می‌پذیرد.
                </p>

                {/* Tracking code pill */}
                <div className="bg-[#13254A] border border-[#D4AF37]/45 rounded-2xl p-4 my-4 shadow-sm">
                  <span className="text-[11px] text-slate-300 block mb-1">کد پیگیری اختصاصی اینانا:</span>
                  <div className="flex items-center justify-center gap-2">
                    <span className="font-serif-brand font-bold text-xl text-[#F5E8C7] tracking-widest">
                      {confirmedOrder.trackingCode}
                    </span>
                    <button
                      onClick={copyTrackingCode}
                      className="p-1 text-slate-300 hover:text-white"
                      title="کپی کد رهگیری"
                    >
                      {copiedCode ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Summary list */}
                <div className="bg-[#13254A]/70 border border-slate-700/80 rounded-xl p-3 text-xs text-right space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-300">نام خریدار:</span>
                    <span className="font-bold text-white">{confirmedOrder.customerName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-300">روش پرداخت:</span>
                    <span className="font-bold text-[#D4AF37]">کارت به کارت شتاب</span>
                  </div>
                  {confirmedOrder.paymentTrackingNumber && (
                    <div className="flex justify-between">
                      <span className="text-slate-300">شماره پیگیری فیش:</span>
                      <span className="font-mono text-white font-bold">{confirmedOrder.paymentTrackingNumber}</span>
                    </div>
                  )}
                  {confirmedOrder.paymentReceiptImage && (
                    <div className="flex justify-between items-center pt-1 border-t border-slate-700/60">
                      <span className="text-slate-300">عکس فیش ضمیمه:</span>
                      <button
                        type="button"
                        onClick={() => setPreviewReceiptModal(confirmedOrder.paymentReceiptImage || null)}
                        className="text-[11px] text-[#D4AF37] hover:underline flex items-center gap-1 font-semibold"
                      >
                        <Eye className="w-3 h-3" />
                        <span>مشاهده فیش</span>
                      </button>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-slate-300">مجموع وزن طلا:</span>
                    <span className="font-bold text-[#D4AF37]">
                      {formatWeight(confirmedOrder.totalWeight)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-300">مبلغ نهایی فاکتور:</span>
                    <span className="font-bold text-white">
                      {formatToman(confirmedOrder.totalPrice)}
                    </span>
                  </div>
                </div>

                {/* Telegram Support CTA */}
                <div className="space-y-2">
                  <a
                    href={`https://t.me/estella_shopee?text=${encodeURIComponent(
                      `با سلام. سفارش من با کد رهگیری ${confirmedOrder.trackingCode} به نام ${confirmedOrder.customerName} به مبلغ ${formatToman(
                        confirmedOrder.totalPrice
                      )} ثبت شد. لطفاً بررسی و هماهنگی فرمایید.`
                    )}`}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full flex items-center justify-center gap-2 bg-[#1E3A8A] hover:bg-[#2563EB] text-white font-bold py-3 rounded-xl text-xs transition-all shadow-md"
                  >
                    <Send className="w-4 h-4" />
                    <span>ارسال فاکتور به پشتیبانی تلگرام (@estella_shopee)</span>
                  </a>

                  <a
                    href="https://t.me/Inana_gold"
                    target="_blank"
                    rel="noreferrer"
                    className="w-full flex items-center justify-center gap-2 bg-[#0E1A33] hover:bg-[#13254A] text-[#D4AF37] border border-[#D4AF37]/40 font-semibold py-2.5 rounded-xl text-xs transition-all"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>عضویت در کانال تلگرام گالری اینانا (@Inana_gold)</span>
                  </a>
                </div>
              </div>
            )}
          </div>

          {/* Footer & Checkout Action Bar */}
          {cart.length > 0 && checkoutStep !== 'success' && (
            <div className="p-5 border-t border-[#D4AF37]/25 bg-[#0A1224] space-y-3">
              {/* Weight & Total summary */}
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between text-slate-300">
                  <span>مجموع وزن طلای ۱۸ عیار:</span>
                  <span className="font-semibold text-slate-100">{formatWeight(totalWeight)}</span>
                </div>
                <div className="flex justify-between items-baseline pt-2 border-t border-slate-700/80">
                  <span className="text-sm font-bold text-white">مبلغ قابل پرداخت:</span>
                  <span className="text-lg sm:text-xl font-extrabold text-white gold-gradient-text">
                    {formatToman(subtotalPrice)}
                  </span>
                </div>
              </div>

              {checkoutStep === 'cart' && formError && (
                <div className="p-3 bg-rose-500/15 border border-rose-500/40 rounded-xl flex items-center gap-2 text-rose-300 text-xs">
                  <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {checkoutStep === 'cart' ? (
                <button
                  onClick={handleProceedToPayment}
                  disabled={isReserving}
                  className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-[#D4AF37] via-[#C5A059] to-[#AA822A] text-slate-950 font-bold py-3.5 rounded-xl hover:brightness-110 active:scale-98 transition-all shadow-[0_4px_20px_rgba(212,175,55,0.3)] text-sm cursor-pointer disabled:opacity-75"
                >
                  {isReserving ? (
                    <span>در حال بررسی و رزرو قطعه طلا...</span>
                  ) : (
                    <>
                      {!isAuthenticated && <Lock className="w-4 h-4 text-slate-950" />}
                      <span>ادامه و ثبت مشخصات خریدار</span>
                      <ArrowLeft className="w-4 h-4" />
                    </>
                  )}
                </button>
              ) : checkoutStep === 'info' ? (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setCheckoutStep('cart')}
                    className="flex-1 py-3 rounded-xl bg-slate-700/80 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-all cursor-pointer"
                  >
                    بازگشت به سبد
                  </button>
                  <button
                    type="button"
                    onClick={handleProceedToPaymentStep}
                    className="flex-[2] flex items-center justify-center gap-2 bg-gradient-to-r from-[#D4AF37] via-[#C5A059] to-[#AA822A] text-slate-950 font-bold py-3 rounded-xl hover:brightness-110 active:scale-98 transition-all text-xs shadow-md cursor-pointer"
                  >
                    <span>ثبت اطلاعات و رفتن به صفحه کارت به کارت</span>
                    <ArrowLeft className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setCheckoutStep('info')}
                    className="flex-1 py-3 rounded-xl bg-slate-700/80 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-all cursor-pointer"
                  >
                    ویرایش مشخصات
                  </button>
                  <button
                    type="button"
                    onClick={handleCheckoutSubmit}
                    disabled={isSubmitting}
                    className="flex-[2] flex items-center justify-center gap-2 bg-gradient-to-r from-[#D4AF37] via-[#C5A059] to-[#AA822A] text-slate-950 font-bold py-3 rounded-xl hover:brightness-110 active:scale-98 transition-all text-xs shadow-md cursor-pointer disabled:opacity-75"
                  >
                    <span>{isSubmitting ? 'در حال ثبت سفارش...' : 'تأیید نهایی و ارسال فیش واریزی'}</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* AUTHENTICATION REQUIRED MODAL FOR PAYMENT ACCESS */}
      {showAuthRequiredModal && (
        <div
          className="fixed inset-0 z-[75] bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setShowAuthRequiredModal(false)}
        >
          <div
            className="relative max-w-md w-full bg-[#0E1A33] border-2 border-[#D4AF37]/60 rounded-3xl overflow-hidden shadow-2xl p-6 space-y-5 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              type="button"
              onClick={() => setShowAuthRequiredModal(false)}
              className="absolute top-4 left-4 p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Glowing Icon */}
            <div className="relative mx-auto w-16 h-16 rounded-2xl bg-gradient-to-tr from-[#D4AF37]/25 to-amber-500/10 border border-[#D4AF37]/50 flex items-center justify-center shadow-lg shadow-[#D4AF37]/10">
              <Lock className="w-8 h-8 text-[#D4AF37]" />
            </div>

            {/* Explanatory Message */}
            <div className="space-y-2">
              <h3 className="text-base sm:text-lg font-bold text-white">
                ثبت‌نام برای ورود به بخش پرداخت الزامی است
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed max-w-sm mx-auto">
                کاربر گرامی، جهت نهایی‌سازی سفارش، صدور فاکتور رسمی به همراه کد رهگیری شتاب و بررسی فیش کارت به کارت، لازم است ابتدا در سامانه گالری اینانا ثبت‌نام کنید یا وارد حساب خود شوید.
              </p>
            </div>

            {/* Value Props */}
            <div className="bg-[#081124] border border-slate-800 rounded-2xl p-3.5 text-right space-y-2.5 text-xs text-slate-300">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <span>ثبت‌نام سریع و رایگان در کمتر از ۳۰ ثانیه</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#D4AF37] flex-shrink-0" />
                <span>صدور فاکتور رسمی با وزن دقیق و نرخ لحظه‌ای طلا</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-sky-400 flex-shrink-0" />
                <span>رهگیری برخط وضعیت تایید فیش توسط مدیریت</span>
              </div>
            </div>

            {/* Direct Action Links */}
            <div className="space-y-2.5 pt-1">
              <button
                type="button"
                onClick={() => {
                  openAuthModal('register');
                }}
                className="w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl bg-gradient-to-r from-[#D4AF37] via-[#C5A059] to-[#AA822A] text-slate-950 font-bold text-sm hover:brightness-110 active:scale-98 transition-all shadow-[0_4px_20px_rgba(212,175,55,0.3)] cursor-pointer"
              >
                <UserPlus className="w-5 h-5" />
                <span>لینک ثبت‌نام در گالری اینانا</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  openAuthModal('login');
                }}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-white font-semibold text-xs border border-slate-700 transition-all cursor-pointer"
              >
                <LogIn className="w-4 h-4 text-[#D4AF37]" />
                <span>قبلاً ثبت‌نام کرده‌اید؟ ورود به حساب</span>
              </button>

              <button
                type="button"
                onClick={() => setShowAuthRequiredModal(false)}
                className="text-xs text-slate-400 hover:text-slate-200 py-1 transition-colors block mx-auto cursor-pointer"
              >
                بازگشت به سبد خرید
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RECEIPT IMAGE PREVIEW LIGHTBOX MODAL */}
      {previewReceiptModal && (
        <div
          className="fixed inset-0 z-[70] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setPreviewReceiptModal(null)}
        >
          <div
            className="relative max-w-lg w-full bg-[#0E1A33] border border-[#D4AF37]/50 rounded-2xl overflow-hidden shadow-2xl p-4 space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-700">
              <div className="flex items-center gap-2 text-white font-bold text-sm">
                <ImageIcon className="w-4 h-4 text-[#D4AF37]" />
                <span>تصویر فیش واریزی</span>
              </div>
              <button
                type="button"
                onClick={() => setPreviewReceiptModal(null)}
                className="p-1 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="max-h-[75vh] overflow-auto flex items-center justify-center bg-black/50 rounded-xl p-2">
              <img
                src={previewReceiptModal}
                alt="فیش واریزی کامل"
                className="max-h-[70vh] w-auto object-contain rounded-lg shadow"
              />
            </div>
            <div className="text-center pt-1">
              <button
                type="button"
                onClick={() => setPreviewReceiptModal(null)}
                className="px-6 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition-all"
              >
                بستن پنجره
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
