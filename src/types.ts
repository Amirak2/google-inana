export interface OtherMarketsData {
  gold24k?: number;      // Toman per gram of 24K gold
  mesghal?: number;      // Toman per mesghal (4.608g)
  emamiCoin?: number;    // Toman per Bahar Azadi Emami coin
  halfCoin?: number;     // Toman per Half coin
  quarterCoin?: number;  // Toman per Quarter coin
  globalOunceUsd?: number; // USD per Troy Ounce
}

export interface GoldPriceData {
  pricePerGram: number; // in Toman for 18K gold (e.g. 22,835,100)
  currency: string; // 'تومان'
  purity: string; // '18 عیار (750)'
  timestamp: string; // ISO string
  jalaliTimestamp: string; // e.g. "۱۴۰۵/۰۶/۱۱ - ۱۹:۴۲"
  source: string; // e.g. 'سامانه نرخ لحظه‌ای اتحادیه طلا و جواهر'
  changePercent: number; // e.g. 2.88 (positive or negative)
  dailyHigh: number;
  dailyLow: number;
  previousPrice: number;
  isManualOverride: boolean;
  status: 'live' | 'cached' | 'manual';
  otherMarkets?: OtherMarketsData;
}

export interface PricingSettings {
  globalMakingChargePercent: number; // e.g. 20%
  profitPercent: number; // e.g. 7%
  taxPercent: number; // Legacy compatibility; always zero.
  fixedCost: number; // e.g. 0
  autoSyncIntervalMinutes: number; // e.g. 5
  goldApiUrl?: string;
  storePhone?: string;
  storeTelegram?: string;
  storeInstagram?: string;
  storeAddress?: string;
  bankCardNumber?: string; // e.g. "6037-9918-4210-8876"
  bankCardHolder?: string; // e.g. "امیر بی‌اشد (گالری طلا و جواهر اینانا)"
  bankName?: string;       // e.g. "بانک ملی ایران"
  bankSheba?: string;      // e.g. "IR-120170000000108876543210"
}

export interface Product {
  id: string;
  title: string;
  titleEn?: string;
  slug: string;
  category: string;
  collection: string;
  weight: number; // in grams (e.g. 0.450 or 2.300)
  purity: string; // '18 عیار'
  customMakingChargePercent?: number | null; // if specified, overrides global
  customProfitPercent?: number | null;
  additionalCost: number; // fixed cost in Toman (e.g. for stones or chains)
  stoneCost: number; // in Toman
  discountPercent: number;
  images: string[];
  description: string;
  features: string[];
  dimensions?: string;
  sku: string;
  stock: number;
  availableStock?: number;
  isNewArrival: boolean;
  isBestSeller: boolean;
  isFeatured: boolean;
  letter?: string; // e.g. 'F', 'M', 'A', 'S'
  createdAt: string;
}

export interface CalculatedPriceBreakdown {
  baseGoldValue: number;
  effectiveMakingChargePercent: number;
  makingChargeAmount: number;
  profitPercent: number;
  profitAmount: number;
  taxPercent: number;
  taxAmount: number;
  additionalCosts: number;
  stoneCost: number;
  discountPercent: number;
  discountAmount: number;
  finalPrice: number;
  rawFinalPrice: number;
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export type OrderStatus =
  | 'در انتظار بررسی'
  | 'تایید شده'
  | 'تأیید شده'
  | 'رد شده'
  | 'در حال آماده‌سازی'
  | 'آماده تحویل'
  | 'تکمیل شده'
  | 'لغو شده';

export interface OrderItem {
  productId: string;
  productTitle: string;
  productImage: string;
  weight: number;
  unitPrice: number;
  quantity: number;
  totalPrice: number;
  goldPriceAtOrder: number;
  makingChargePercent: number;
}

export interface Order {
  id: string;
  trackingCode: string;
  userId?: string;
  userEmail?: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  contactMethod: 'telegram' | 'phone' | 'sms' | 'whatsapp';
  notes?: string;
  items: OrderItem[];
  totalWeight: number;
  totalPrice: number;
  goldPriceAtCheckout: number;
  status: OrderStatus;
  inventoryReleased?: boolean;
  idempotencyKey?: string;
  quoteId?: string;
  paymentMethod?: 'card_to_card' | 'online' | 'cash';
  paymentTrackingNumber?: string; // اختیاری - شماره پیگیری یا ارجاع تراکنش
  paymentReceiptImage?: string; // تصویر فیش واریز کارت به کارت
  paymentDate?: string;
  rejectionReason?: string; // در صورت رد توسط ادمین
  reviewedAt?: string; // زمان تایید یا رد سفارش
  updatedAt?: string;
  createdAt: string;
}

export interface CollectionInfo {
  id: string;
  name: string;
  titleFa: string;
  subtitleFa: string;
  description: string;
  coverImage: string;
  accentQuote: string;
  tag: string;
}

export interface GoldHistoryPoint {
  time: string;
  price: number;
  date: string;
  isEstimated?: boolean;
}

export type UserRole = 'admin' | 'customer';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  phoneNumber?: string;
  role: UserRole;
  address?: string;
  createdAt: string;
  updatedAt?: string;
}

export type SystemLogLevel =
  | 'info'
  | 'warn'
  | 'error'
  | 'security'
  | 'order'
  | 'price'
  | 'debug';

export type SystemLogModule =
  | 'API'
  | 'AUTH'
  | 'ADMIN'
  | 'ORDERS'
  | 'GOLD_PRICE'
  | 'INVENTORY'
  | 'CLIENT'
  | 'SYSTEM';

export interface SystemLogEntry {
  id: string;
  timestamp: string;
  jalaliTimestamp: string;
  level: SystemLogLevel;
  module: SystemLogModule;
  message: string;
  details?: Record<string, any>;
  ip?: string;
  userId?: string;
  userEmail?: string;
}

export interface SystemLogStats {
  total: number;
  byLevel: Record<SystemLogLevel, number>;
  byModule: Record<SystemLogModule, number>;
  errorsCount: number;
  warningsCount: number;
  securityCount: number;
  ordersCount: number;
  priceCount: number;
  lastErrorAt?: string;
}
