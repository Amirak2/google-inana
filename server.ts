import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { createServer as createViteServer } from 'vite';
import { INITIAL_COLLECTIONS, INITIAL_PRODUCTS } from './src/data/seedData';
import { GoldHistoryPoint, GoldPriceData, Order, OtherMarketsData, PricingSettings, Product, SystemLogModule } from './src/types';
import { calculateProductPrice, DEFAULT_SETTINGS } from './src/utils/pricingEngine';
import { formatJalaliDateTime } from './src/utils/persianFormatter';
import {
  registerUser,
  loginUser,
  updateUser,
  verifySessionToken,
  revokeSessionToken,
  sendSmsOtpCode,
  verifySmsOtpAndAuthenticate,
  syncGoogleUser,
  requestPhoneChangeOtp,
  verifyPhoneChangeOtp,
  checkRateLimit,
} from './server/authStore';
import {
  validateString,
  validatePositiveNumber,
  validateInteger,
  validatePercentOrNull,
  validatePhoneNumber,
  validateEmail,
  validatePassword,
} from './server/validation';
import { logger, requestLoggerMiddleware } from './server/logger';

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '4mb' }));
app.use(express.urlencoded({ extended: true, limit: '4mb' }));
app.use(requestLoggerMiddleware);

// --- Auth Utilities & Middlewares ---
export interface AuthenticatedRequest extends Request {
  user?: import('./src/types').UserProfile;
}

function parseCookies(cookieHeader?: string): Record<string, string> {
  const list: Record<string, string> = {};
  if (!cookieHeader) return list;
  cookieHeader.split(';').forEach((cookie) => {
    const parts = cookie.split('=');
    const key = parts.shift()?.trim();
    if (key) {
      list[key] = decodeURIComponent(parts.join('=') || '').trim();
    }
  });
  return list;
}

function extractToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    let tokenStr = authHeader.slice(7).trim();
    if (tokenStr.startsWith('{')) {
      try {
        const parsed = JSON.parse(tokenStr);
        if (parsed?.token && typeof parsed.token === 'string') {
          tokenStr = parsed.token.trim();
        }
      } catch {}
    }
    if (tokenStr) {
      return tokenStr;
    }
  }
  const cookies = parseCookies(req.headers.cookie);
  if (cookies.token) {
    return cookies.token.trim();
  }
  return null;
}

function extractAndVerifyUser(req: Request): import('./src/types').UserProfile | null {
  // 1. Check Authorization header
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    let tokenStr = authHeader.slice(7).trim();
    if (tokenStr.startsWith('{')) {
      try {
        const parsed = JSON.parse(tokenStr);
        if (parsed?.token && typeof parsed.token === 'string') {
          tokenStr = parsed.token.trim();
        }
      } catch {}
    }
    if (tokenStr) {
      const verified = verifySessionToken(tokenStr);
      if (verified) return verified;
    }
  }

  // 2. Check HttpOnly Cookie fallback
  const cookies = parseCookies(req.headers.cookie);
  if (cookies.token) {
    const verified = verifySessionToken(cookies.token.trim());
    if (verified) return verified;
  }

  return null;
}

function setAuthCookie(res: Response, token: string): void {
  const isProd = process.env.NODE_ENV === 'production';
  const maxAgeSeconds = 30 * 24 * 60 * 60; // 30 days
  const cookieVal = `token=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}${isProd ? '; Secure' : ''}`;
  res.setHeader('Set-Cookie', cookieVal);
}

function clearAuthCookie(res: Response): void {
  const isProd = process.env.NODE_ENV === 'production';
  const cookieVal = `token=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${isProd ? '; Secure' : ''}`;
  res.setHeader('Set-Cookie', cookieVal);
}

const authenticateUser = (req: AuthenticatedRequest, _res: Response, next: express.NextFunction) => {
  const verified = extractAndVerifyUser(req);
  if (verified) {
    req.user = verified;
  }
  next();
};

const requireAuth = (req: AuthenticatedRequest, res: Response, next: express.NextFunction) => {
  const verified = extractAndVerifyUser(req);
  if (!verified) {
    res.status(401).json({ error: 'لطفاً برای دسترسی به این بخش وارد حساب کاربری خود شوید.' });
    return;
  }
  req.user = verified;
  next();
};

const requireAdminAuth = (req: AuthenticatedRequest, res: Response, next: express.NextFunction) => {
  const verified = extractAndVerifyUser(req);
  if (!verified) {
    res.status(401).json({ error: 'دسترسی غیرمجاز: لطفاً وارد حساب مدیریت سیستم شوید.' });
    return;
  }
  if (verified.role !== 'admin') {
    res.status(403).json({ error: 'دسترسی غیرمجاز: این عملیات مختص مدیریت سیستم می‌باشد.' });
    return;
  }
  req.user = verified;
  next();
};

// In-Memory Database with State Persistence across Server Lifecycles
let currentGoldState: GoldPriceData = {
  pricePerGram: 23387510, // Live 18K Gold Rate from Navasan Tech API (item: 18ayar)
  currency: 'تومان',
  purity: '18 عیار (750)',
  timestamp: new Date().toISOString(),
  jalaliTimestamp: '۱۴۰۵/۰۶/۱۲ - ۱۴:۰۰',
  source: 'سامانه نوسان (Navasan.tech Live API - 18ayar)',
  changePercent: 2.74,
  dailyHigh: 23450000,
  dailyLow: 22761900,
  previousPrice: 22761900,
  isManualOverride: false,
  status: 'live',
  otherMarkets: {
    gold24k: 31183300,
    mesghal: 10131000,
    emamiCoin: 23400000,
    halfCoin: 12000000,
    quarterCoin: 66000000,
    globalOunceUsd: 4423.12,
  },
};

const SETTINGS_DB_FILE = path.join(process.cwd(), 'settings_db.json');
const PRODUCTS_DB_FILE = path.join(process.cwd(), 'products_db.json');
const ORDERS_DB_FILE = path.join(process.cwd(), 'orders_db.json');

const DEFAULT_SEED_ORDERS: Order[] = [
  {
    id: 'ord-103',
    trackingCode: 'INA-91042',
    customerName: 'مشتری نمونه ۱',
    customerPhone: '09000000001',
    customerAddress: 'تهران، مرکز تحویل و ارسال پستی نمونه',
    contactMethod: 'telegram',
    notes: 'فیش واریز کارت به کارت پیوست شد، لطفاً پس از تایید فاکتور ارسال فرمایید.',
    items: [
      {
        productId: 'inana-ring-diamond',
        productTitle: 'انگشتر سولیتر برلیان اینانا',
        productImage: 'https://images.unsplash.com/photo-1605100804763-247f67b3557e?auto=format&fit=crop&w=800&q=85',
        weight: 1.150,
        unitPrice: 24500000,
        quantity: 1,
        totalPrice: 24500000,
        goldPriceAtOrder: 23387510,
        makingChargePercent: 22,
      },
    ],
    totalWeight: 1.150,
    totalPrice: 24500000,
    goldPriceAtCheckout: 23387510,
    status: 'در انتظار بررسی',
    paymentMethod: 'card_to_card',
    paymentTrackingNumber: 'TRX-98421463',
    paymentReceiptImage: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=1200&q=85',
    paymentDate: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    createdAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
  },
  {
    id: 'ord-101',
    trackingCode: 'INA-74921',
    customerName: 'مشتری نمونه ۲',
    customerPhone: '09000000002',
    customerAddress: 'تهران، صندوق پستی نمونه ۲',
    contactMethod: 'telegram',
    notes: 'لطفاً بسته‌بندی هدیه اختصاصی اینانا باشد.',
    items: [
      {
        productId: 'inana-letter-f',
        productTitle: 'پلاک طلا حرف F اینانا',
        productImage: 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=800&q=85',
        weight: 0.260,
        unitPrice: 4850000,
        quantity: 1,
        totalPrice: 4850000,
        goldPriceAtOrder: 14850000,
        makingChargePercent: 24,
      },
    ],
    totalWeight: 0.260,
    totalPrice: 4850000,
    goldPriceAtCheckout: 14850000,
    status: 'در حال آماده‌سازی',
    paymentMethod: 'card_to_card',
    paymentTrackingNumber: 'TRX-55102914',
    paymentReceiptImage: 'https://images.unsplash.com/photo-1554224154-26032ffc0d07?auto=format&fit=crop&w=1200&q=85',
    reviewedAt: new Date(Date.now() - 3600 * 1000 * 20).toISOString(),
    createdAt: new Date(Date.now() - 3600 * 1000 * 24).toISOString(),
  },
  {
    id: 'ord-102',
    trackingCode: 'INA-83190',
    customerName: 'مشتری نمونه ۳',
    customerPhone: '09000000003',
    customerAddress: 'تهران، صندوق پستی نمونه ۳',
    contactMethod: 'phone',
    items: [
      {
        productId: 'inana-sig-pendant',
        productTitle: 'مدال سلطنتی زیگورات اینانا',
        productImage: 'https://images.unsplash.com/photo-1599643477877-530eb83abc8e?auto=format&fit=crop&w=800&q=85',
        weight: 2.450,
        unitPrice: 46800000,
        quantity: 1,
        totalPrice: 46800000,
        goldPriceAtOrder: 14850000,
        makingChargePercent: 26,
      },
    ],
    totalWeight: 2.450,
    totalPrice: 46800000,
    goldPriceAtCheckout: 14850000,
    status: 'تأیید شده',
    paymentMethod: 'card_to_card',
    paymentTrackingNumber: 'TRX-10928374',
    paymentReceiptImage: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=1200&q=85',
    reviewedAt: new Date(Date.now() - 3600 * 1000 * 40).toISOString(),
    createdAt: new Date(Date.now() - 3600 * 1000 * 48).toISOString(),
  },
];

// --- Settings Persistence ---
function loadSettingsFromDb(): PricingSettings {
  try {
    if (fs.existsSync(SETTINGS_DB_FILE)) {
      const data = fs.readFileSync(SETTINGS_DB_FILE, 'utf-8');
      const saved = JSON.parse(data);
      if (saved && typeof saved === 'object') {
        return { ...DEFAULT_SETTINGS, ...saved };
      }
    }
  } catch (err) {
    console.error('[SETTINGS DB] Error reading settings_db.json:', err);
  }
  saveSettingsToDb(DEFAULT_SETTINGS);
  return { ...DEFAULT_SETTINGS };
}

let isSavingSettings = false;
let needsReSaveSettings = false;

async function saveSettingsToDbAsync(settings: PricingSettings): Promise<void> {
  if (isSavingSettings) {
    needsReSaveSettings = true;
    return;
  }
  isSavingSettings = true;
  try {
    const tmpFile = `${SETTINGS_DB_FILE}.tmp`;
    const jsonStr = JSON.stringify(settings, null, 2);
    await fs.promises.writeFile(tmpFile, jsonStr, 'utf-8');
    await fs.promises.rename(tmpFile, SETTINGS_DB_FILE);
  } catch (err) {
    console.error('[SETTINGS DB] Error async writing settings_db.json:', err);
  } finally {
    isSavingSettings = false;
    if (needsReSaveSettings) {
      needsReSaveSettings = false;
      saveSettingsToDbAsync(pricingSettings).catch(() => {});
    }
  }
}

function saveSettingsToDb(settings: PricingSettings): void {
  saveSettingsToDbAsync(settings).catch((err) =>
    console.error('[SETTINGS DB] Background saveSettingsToDb error:', err)
  );
}

// --- Products Persistence ---
function loadProductsFromDb(): Product[] {
  try {
    if (fs.existsSync(PRODUCTS_DB_FILE)) {
      const data = fs.readFileSync(PRODUCTS_DB_FILE, 'utf-8');
      const list = JSON.parse(data);
      if (Array.isArray(list) && list.length > 0) {
        return list;
      }
    }
  } catch (err) {
    console.error('[PRODUCTS DB] Error reading products_db.json:', err);
  }
  saveProductsToDb(INITIAL_PRODUCTS);
  return [...INITIAL_PRODUCTS];
}

let isSavingProducts = false;
let needsReSaveProducts = false;

async function saveProductsToDbAsync(products: Product[]): Promise<void> {
  if (isSavingProducts) {
    needsReSaveProducts = true;
    return;
  }
  isSavingProducts = true;
  try {
    const tmpFile = `${PRODUCTS_DB_FILE}.tmp`;
    const jsonStr = JSON.stringify(products, null, 2);
    await fs.promises.writeFile(tmpFile, jsonStr, 'utf-8');
    await fs.promises.rename(tmpFile, PRODUCTS_DB_FILE);
  } catch (err) {
    console.error('[PRODUCTS DB] Error async writing products_db.json:', err);
  } finally {
    isSavingProducts = false;
    if (needsReSaveProducts) {
      needsReSaveProducts = false;
      saveProductsToDbAsync(productsList).catch(() => {});
    }
  }
}

function saveProductsToDb(products: Product[]): void {
  saveProductsToDbAsync(products).catch((err) =>
    console.error('[PRODUCTS DB] Background saveProductsToDb error:', err)
  );
}

/**
 * Atomic synchronous-awaitable persistence for transactions (throws on error)
 */
async function persistProducts(): Promise<void> {
  const tmpFile = `${PRODUCTS_DB_FILE}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`;
  const jsonStr = JSON.stringify(productsList, null, 2);
  await fs.promises.writeFile(tmpFile, jsonStr, 'utf-8');
  await fs.promises.rename(tmpFile, PRODUCTS_DB_FILE);
}

// --- Orders Persistence ---
function loadOrdersFromDb(): Order[] {
  try {
    if (fs.existsSync(ORDERS_DB_FILE)) {
      const data = fs.readFileSync(ORDERS_DB_FILE, 'utf-8');
      const list = JSON.parse(data);
      if (Array.isArray(list)) {
        return list;
      }
    }
  } catch (err) {
    console.error('[ORDERS DB] Error reading orders_db.json:', err);
  }
  saveOrdersToDb(DEFAULT_SEED_ORDERS);
  return [...DEFAULT_SEED_ORDERS];
}

// Asynchronous Non-Blocking Atomic File Persistence (Prevents Event Loop Blocking on 100+ Concurrent Writes)
let isSavingOrders = false;
let needsReSaveOrders = false;

async function saveOrdersToDbAsync(orders: Order[]): Promise<void> {
  if (isSavingOrders) {
    needsReSaveOrders = true;
    return;
  }
  isSavingOrders = true;
  try {
    const tmpFile = `${ORDERS_DB_FILE}.tmp`;
    const jsonStr = JSON.stringify(orders, null, 2);
    await fs.promises.writeFile(tmpFile, jsonStr, 'utf-8');
    await fs.promises.rename(tmpFile, ORDERS_DB_FILE);
  } catch (err) {
    console.error('[ORDERS DB] Error async writing orders_db.json:', err);
  } finally {
    isSavingOrders = false;
    if (needsReSaveOrders) {
      needsReSaveOrders = false;
      saveOrdersToDbAsync(ordersList).catch(() => {});
    }
  }
}

function saveOrdersToDb(orders: Order[]): void {
  saveOrdersToDbAsync(orders).catch((err) =>
    console.error('[ORDERS DB] Background saveOrdersToDb error:', err)
  );
}

/**
 * Atomic synchronous-awaitable persistence for transactions (throws on error)
 */
async function persistOrders(): Promise<void> {
  const tmpFile = `${ORDERS_DB_FILE}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`;
  const jsonStr = JSON.stringify(ordersList, null, 2);
  await fs.promises.writeFile(tmpFile, jsonStr, 'utf-8');
  await fs.promises.rename(tmpFile, ORDERS_DB_FILE);
}

// Persistent In-Memory Databases Synchronized with Persistent Storage
let pricingSettings: PricingSettings = loadSettingsFromDb();
let productsList: Product[] = loadProductsFromDb();
let ordersList: Order[] = loadOrdersFromDb();

// -------------------------------------------------------------
// Real-time Stock Lock & Concurrency Reservation Engine
// Prevents overselling & race conditions for unique jewelry pieces
// -------------------------------------------------------------
interface StockReservation {
  productId: string;
  quantity: number;
  userId: string;
  expiresAt: number;
}
const stockReservations: Map<string, StockReservation[]> = new Map();

function cleanExpiredReservations(): void {
  const now = Date.now();
  for (const [pId, resList] of stockReservations.entries()) {
    const valid = resList.filter((r) => r.expiresAt > now);
    if (valid.length === 0) stockReservations.delete(pId);
    else stockReservations.set(pId, valid);
  }
}

function getReservedStock(productId: string, excludeUserId?: string): number {
  cleanExpiredReservations();
  const list = stockReservations.get(productId) || [];
  return list
    .filter((r) => !excludeUserId || r.userId !== excludeUserId)
    .reduce((sum, r) => sum + r.quantity, 0);
}

function getAvailableStock(product: Product, excludeUserId?: string): number {
  const baseStock = product.stock !== undefined ? product.stock : 5;
  const reserved = getReservedStock(product.id, excludeUserId);
  return Math.max(0, baseStock - reserved);
}

// Helper to parse numbers from Rial to Toman (1 Toman = 10 Rials)
function parseRialToToman(val: any): number {
  if (typeof val === 'number') return Math.round(val);
  if (!val) return 0;
  const clean = String(val).replace(/<[^>]*>/g, '').replace(/,/g, '').trim();
  const rial = parseFloat(clean);
  if (isNaN(rial)) return 0;
  return Math.round(rial / 10);
}

function parsePercent(val: any): number {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  const isNegative = String(val).includes('class="low"') || String(val).includes('-');
  const clean = String(val).replace(/<[^>]*>/g, '').replace(/%/g, '').replace(/,/g, '').trim();
  const num = parseFloat(clean);
  if (isNaN(num)) return 0;
  return isNegative ? -Math.abs(num) : Math.abs(num);
}

// In-memory cache for TGJU indicator summary table (historical daily records)
let cachedTgjuData: any[][] = [];
let lastFetchTimestamp = 0;
const CACHE_LIFETIME_MS = 60 * 60 * 1000; // 1 hour cache (scheduled updates every 1 hour)

async function ensureTgjuHistory(): Promise<any[][]> {
  if (cachedTgjuData.length > 0) return cachedTgjuData;
  try {
    const res = await fetch('https://api.tgju.org/v1/market/indicator/summary-table-data/geram18', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/javascript, */*; q=0.01',
        'X-Requested-With': 'XMLHttpRequest',
      },
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      const json = await res.json();
      if (json && Array.isArray(json.data) && json.data.length > 0) {
        cachedTgjuData = json.data;
        return cachedTgjuData;
      }
    }
  } catch (err) {
    console.warn('Could not fetch TGJU historical table data:', err);
  }
  return cachedTgjuData;
}

async function fetchOtherMarkets(): Promise<OtherMarketsData> {
  const other: OtherMarketsData = {};
  const indicators: Array<{ key: keyof OtherMarketsData; ind: string; isRial: boolean }> = [
    { key: 'gold24k', ind: 'geram24', isRial: true },
    { key: 'mesghal', ind: 'mesghal', isRial: true },
    { key: 'emamiCoin', ind: 'sekeb', isRial: true },
    { key: 'halfCoin', ind: 'nim', isRial: true },
    { key: 'quarterCoin', ind: 'rob', isRial: true },
    { key: 'globalOunceUsd', ind: 'ons', isRial: false },
  ];

  await Promise.allSettled(
    indicators.map(async ({ key, ind, isRial }) => {
      try {
        const res = await fetch(`https://api.tgju.org/v1/market/indicator/summary-table-data/${ind}`, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'application/json, text/javascript, */*; q=0.01',
            'X-Requested-With': 'XMLHttpRequest',
          },
          signal: AbortSignal.timeout(3500),
        });
        if (res.ok) {
          const json = await res.json();
          if (json && json.data && json.data[0]) {
            const raw = json.data[0][3];
            if (isRial) {
              other[key] = parseRialToToman(raw);
            } else {
              const clean = String(raw).replace(/,/g, '').trim();
              other[key] = parseFloat(clean) || 0;
            }
          }
        }
      } catch {
        // Silently continue for secondary items
      }
    })
  );

  return other;
}

// Main function to fetch or refresh live gold price from official APIs
async function getOrUpdateGoldPrice(force: boolean = false): Promise<GoldPriceData> {
  // If manual override is enabled and not forced by admin sync, respect manual
  if (currentGoldState.isManualOverride && !force) {
    return currentGoldState;
  }

  // Return cached if fresh
  const now = Date.now();
  if (!force && now - lastFetchTimestamp < CACHE_LIFETIME_MS && currentGoldState.pricePerGram > 0) {
    return currentGoldState;
  }

  // 1. Primary Source: Navasan Tech API (item: 18ayar) if configured
  const navasanKey = process.env.GOLD_API_KEY ? process.env.GOLD_API_KEY.trim() : '';
  if (navasanKey) {
    const navasanUrl = `http://api.navasan.tech/latest/?api_key=${encodeURIComponent(navasanKey)}`;

    try {
      const navResponse = await fetch(navasanUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(6000),
      });

    if (navResponse.ok) {
      const data = await navResponse.json();
      if (data && data['18ayar'] && data['18ayar'].value) {
        const item18 = data['18ayar'];
        const pricePerGram = parseFloat(String(item18.value).replace(/,/g, ''));

        if (!isNaN(pricePerGram) && pricePerGram > 0) {
          const changeVal = typeof item18.change === 'number' ? item18.change : parseFloat(item18.change) || 0;
          const prevPrice = changeVal !== 0 ? Math.max(0, pricePerGram - changeVal) : pricePerGram;
          const changePercent = prevPrice > 0 ? Number(((changeVal / prevPrice) * 100).toFixed(2)) : 0;

          // Parse other markets from Navasan if available
          const other: OtherMarketsData = { ...currentGoldState.otherMarkets };

          // 24K Gold: calculated from 18K (750) -> 24K (999.9) or proportional
          other.gold24k = Math.round((pricePerGram / 750) * 1000);

          // abshodeh = mesghal
          if (data['abshodeh'] && data['abshodeh'].value) {
            const abVal = parseFloat(String(data['abshodeh'].value).replace(/,/g, ''));
            if (!isNaN(abVal) && abVal > 0) {
              other.mesghal = abVal < 1000000 ? abVal * 100 : abVal; // normalize unit if needed
            }
          }

          // Bahar Azadi / Emami Coin
          if (data['sekkeh'] && data['sekkeh'].value) {
            const sekkehVal = parseFloat(String(data['sekkeh'].value).replace(/,/g, ''));
            if (!isNaN(sekkehVal) && sekkehVal > 0) {
              other.emamiCoin = sekkehVal < 1000000 ? sekkehVal * 1000 : sekkehVal;
            }
          }

          // Half Coin (nim)
          if (data['nim'] && data['nim'].value) {
            const nimVal = parseFloat(String(data['nim'].value).replace(/,/g, ''));
            if (!isNaN(nimVal) && nimVal > 0) {
              other.halfCoin = nimVal < 1000000 ? nimVal * 1000 : nimVal;
            }
          }

          // Quarter Coin (rob)
          if (data['rob'] && data['rob'].value) {
            const robVal = parseFloat(String(data['rob'].value).replace(/,/g, ''));
            if (!isNaN(robVal) && robVal > 0) {
              other.quarterCoin = robVal < 1000000 ? robVal * 1000 : robVal;
            }
          }

          // Global Ounce USD (usd_xau)
          if (data['usd_xau'] && data['usd_xau'].value) {
            const xauVal = parseFloat(String(data['usd_xau'].value).replace(/,/g, ''));
            if (!isNaN(xauVal) && xauVal > 0) {
              other.globalOunceUsd = xauVal;
            }
          }

          currentGoldState = {
            pricePerGram: Math.round(pricePerGram),
            currency: 'تومان',
            purity: '18 عیار (750)',
            timestamp: new Date().toISOString(),
            jalaliTimestamp: item18.date ? `${item18.date}` : formatJalaliDateTime(new Date()),
            source: 'سامانه نوسان (Navasan.tech Live API - 18ayar)',
            changePercent: changePercent,
            dailyHigh: Math.max(currentGoldState.dailyHigh || pricePerGram, pricePerGram),
            dailyLow: Math.min(currentGoldState.dailyLow || pricePerGram, pricePerGram),
            previousPrice: Math.round(prevPrice),
            isManualOverride: false,
            status: 'live',
            otherMarkets: other,
          };

          lastFetchTimestamp = now;
          return currentGoldState;
        }
      }
    }
    } catch (navErr) {
      console.warn('Navasan API query failed, checking fallback TGJU API...', navErr);
    }
  }

  // 2. Fallback Source: TGJU (اتحادیه طلا و جواهر تهران) Live Indicator API
  try {
    const tgjuResponse = await fetch('https://api.tgju.org/v1/market/indicator/summary-table-data/geram18', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/javascript, */*; q=0.01',
        'X-Requested-With': 'XMLHttpRequest',
      },
      signal: AbortSignal.timeout(4500),
    });

    if (tgjuResponse.ok) {
      const json = await tgjuResponse.json();
      if (json && Array.isArray(json.data) && json.data.length > 0) {
        cachedTgjuData = json.data;
        const latest = json.data[0];
        // TGJU columns:
        // [0: Open, 1: Low, 2: High, 3: Close, 4: ChangeRial, 5: Change%, 6: GregorianDate, 7: JalaliDate]
        const openToman = parseRialToToman(latest[0]);
        const lowToman = parseRialToToman(latest[1]);
        const highToman = parseRialToToman(latest[2]);
        const closeToman = parseRialToToman(latest[3]);
        const changePercent = parsePercent(latest[5]);
        const jalaliDate = latest[7] || '';

        // Secondary other markets (24K, Mesghal, Coins)
        const otherMarkets = await fetchOtherMarkets();

        currentGoldState = {
          pricePerGram: closeToman > 0 ? closeToman : currentGoldState.pricePerGram,
          currency: 'تومان',
          purity: '18 عیار (750)',
          timestamp: new Date().toISOString(),
          jalaliTimestamp: jalaliDate ? `${jalaliDate} - ${new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })}` : formatJalaliDateTime(new Date()),
          source: 'سامانه آنلاین اتحادیه طلا و جواهر (TGJU Live API)',
          changePercent: changePercent,
          dailyHigh: highToman > 0 ? highToman : closeToman,
          dailyLow: lowToman > 0 ? lowToman : closeToman,
          previousPrice: openToman > 0 ? openToman : currentGoldState.pricePerGram,
          isManualOverride: false,
          status: 'live',
          otherMarkets: {
            ...currentGoldState.otherMarkets,
            ...otherMarkets,
          },
        };

        lastFetchTimestamp = now;
        return currentGoldState;
      }
    }
  } catch (err) {
    console.warn('TGJU live indicator API temporarily unreachable, checking fallback mirror...', err);
  }

  // 3. Fallback Source: GitHub pricedb TGJU real-time mirror
  try {
    const fallbackRes = await fetch('https://raw.githubusercontent.com/margani/pricedb/main/tgju/current/geram18/latest.json', {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(3500),
    });

    if (fallbackRes.ok) {
      const data = await fallbackRes.json();
      const priceToman = parseRialToToman(data.p);
      const highToman = parseRialToToman(data.h);
      const lowToman = parseRialToToman(data.l);

      if (priceToman > 0) {
        currentGoldState = {
          ...currentGoldState,
          pricePerGram: priceToman,
          dailyHigh: highToman || priceToman,
          dailyLow: lowToman || priceToman,
          timestamp: new Date().toISOString(),
          jalaliTimestamp: formatJalaliDateTime(new Date()),
          source: 'پایگاه داده استعلام نرخ رسمی اتحادیه طلا و جواهر (Mirror)',
          status: 'live',
        };
        lastFetchTimestamp = now;
        return currentGoldState;
      }
    }
  } catch (err) {
    console.warn('Fallback mirror error:', err);
  }

  // If all live calls fail, preserve state but flag as cached
  currentGoldState.status = 'cached';
  return currentGoldState;
}

// ----------------------------------------------------
// API ROUTES
// ----------------------------------------------------

// 1. Gold Price Endpoint
app.get('/api/gold-price', async (req: Request, res: Response) => {
  try {
    const force = req.query.force === 'true';
    const goldPrice = await getOrUpdateGoldPrice(force);
    res.json(goldPrice);
  } catch (error) {
    // Graceful fallback to prevent client crash
    res.json(currentGoldState);
  }
});

app.post('/api/gold-price/refresh', async (_req: Request, res: Response) => {
  try {
    const goldPrice = await getOrUpdateGoldPrice(true);
    res.json(goldPrice);
  } catch (error) {
    res.json(currentGoldState);
  }
});

// Admin update gold price (manual override or switch)
app.post('/api/admin/gold-price', requireAdminAuth, (req: AuthenticatedRequest, res: Response) => {
  const { pricePerGram, isManualOverride, changePercent, source } = req.body;

  if (pricePerGram !== undefined) {
    const valResult = validatePositiveNumber(pricePerGram, 'قیمت هر گرم طلا', 1_000_000, 1_000_000_000);
    if (!valResult.isValid) {
      res.status(400).json({ error: valResult.error });
      return;
    }
    const newPrice = Math.round(valResult.value);
    currentGoldState.previousPrice = currentGoldState.pricePerGram;
    currentGoldState.pricePerGram = newPrice;
    currentGoldState.dailyHigh = Math.max(currentGoldState.dailyHigh, newPrice);
    currentGoldState.dailyLow = Math.min(currentGoldState.dailyLow, newPrice);
  }

  if (isManualOverride !== undefined) {
    currentGoldState.isManualOverride = Boolean(isManualOverride);
    currentGoldState.status = isManualOverride ? 'manual' : 'live';
  }

  if (changePercent !== undefined) {
    const changeResult = validatePercentOrNull(changePercent, 'درصد تغییرات', -50, 50);
    if (!changeResult.isValid) {
      res.status(400).json({ error: changeResult.error });
      return;
    }
    currentGoldState.changePercent = changeResult.value ?? 0;
  }

  if (source) {
    currentGoldState.source = String(source).slice(0, 100);
  }

  currentGoldState.timestamp = new Date().toISOString();
  logger.security('ADMIN', `تغییر نرخ طلا توسط مدیر: ${currentGoldState.pricePerGram.toLocaleString('fa-IR')} تومان`, {
    admin: req.user?.email,
    newPrice: currentGoldState.pricePerGram,
    isManual: currentGoldState.isManualOverride,
  });
  res.json({ success: true, goldPrice: currentGoldState });
});

// Admin force sync with official API
app.post('/api/admin/gold-price/sync', requireAdminAuth, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    currentGoldState.isManualOverride = false;
    const updated = await getOrUpdateGoldPrice(true);
    res.json({ success: true, goldPrice: updated });
  } catch (error) {
    res.status(500).json({ error: 'خطا در همگام‌سازی با API', current: currentGoldState });
  }
});

// 2. Gold Historical Price Chart Data
app.get('/api/gold-history', async (req: Request, res: Response) => {
  const range = (req.query.range as string) || '7d';

  // Ensure TGJU history table is loaded for historical ranges
  await ensureTgjuHistory();

  const base = currentGoldState.pricePerGram;
  let points: GoldHistoryPoint[] = [];

  if (range === '24h' || range === '1d') {
    const hours = ['۰۹:۰۰', '۱۱:۰۰', '۱۳:۰۰', '۱۵:۰۰', '۱۷:۰۰', '۱۹:۰۰', 'اکنون'];
    const low = currentGoldState.dailyLow || Math.round(base * 0.985);
    const high = currentGoldState.dailyHigh || Math.round(base * 1.015);
    const open = currentGoldState.previousPrice || Math.round(base * 0.99);
    const close = base;

    const prices = [
      open,
      Math.round(open + (low - open) * 0.5),
      low,
      Math.round(low + (high - low) * 0.6),
      high,
      Math.round(high - (high - close) * 0.3),
      close,
    ];

    points = hours.map((hour, idx) => ({
      time: hour,
      date: 'امروز',
      price: prices[idx],
      isEstimated: idx < hours.length - 1,
    }));
  } else if (range === '7d') {
    if (cachedTgjuData && cachedTgjuData.length >= 6) {
      const slice = cachedTgjuData.slice(0, 6).reverse();
      points = slice.map((row) => {
        const rawDate = String(row[7] || row[6] || '');
        const dateShort = rawDate.split('/').slice(1).join('/'); // e.g. 06/07
        return {
          time: dateShort || rawDate,
          date: rawDate || 'روزهای گذشته',
          price: parseRialToToman(row[3]) || Math.round(base * 0.98),
          isEstimated: false,
        };
      });
      // Append today's live price as the 7th point
      points.push({
        time: 'امروز',
        date: currentGoldState.jalaliTimestamp?.split(' - ')[0] || '۱۴۰۵/۰۶/۱۲',
        price: base,
        isEstimated: false,
      });
    } else {
      // Fallback 7 days (synthetic estimation)
      const days = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'امروز'];
      const offsets = [-0.024, -0.018, -0.015, -0.008, 0.003, -0.002, 0];
      points = days.map((day, idx) => ({
        time: day,
        date: `روز ${idx + 1}`,
        price: Math.round(base * (1 + offsets[idx])),
        isEstimated: idx < days.length - 1,
      }));
    }
  } else if (range === '1m') {
    if (cachedTgjuData && cachedTgjuData.length >= 10) {
      const slice = cachedTgjuData.slice(0, 30).reverse();
      const sampled = slice.filter((_, idx) => idx % 4 === 0);
      points = sampled.map((row) => ({
        time: row[7] ? row[7].split('/').slice(1).join('/') : row[6],
        date: row[7] || row[6] || 'ماه گذشته',
        price: parseRialToToman(row[3]) || base,
        isEstimated: false,
      }));
      points.push({
        time: 'امروز',
        date: 'امروز',
        price: base,
        isEstimated: false,
      });
    } else {
      const weeks = ['۴ هفته پیش', '۳ هفته پیش', '۲ هفته پیش', 'هفته گذشته', 'امروز'];
      const offsets = [-0.05, -0.035, -0.02, -0.01, 0];
      points = weeks.map((w, idx) => ({
        time: w,
        date: w,
        price: Math.round(base * (1 + offsets[idx])),
        isEstimated: idx < weeks.length - 1,
      }));
    }
  } else if (range === '3m') {
    if (cachedTgjuData && cachedTgjuData.length >= 20) {
      const slice = cachedTgjuData.slice(0, 90).reverse();
      const sampled = slice.filter((_, idx) => idx % 10 === 0);
      points = sampled.map((row) => ({
        time: row[7] ? row[7].split('/').slice(1).join('/') : row[6],
        date: row[7] || row[6] || '۳ ماه گذشته',
        price: parseRialToToman(row[3]) || base,
        isEstimated: false,
      }));
      points.push({
        time: 'امروز',
        date: 'امروز',
        price: base,
        isEstimated: false,
      });
    } else {
      const months = ['۳ ماه پیش', '۲ ماه پیش', '۱ ماه پیش', 'امروز'];
      const offsets = [-0.09, -0.06, -0.03, 0];
      points = months.map((m, idx) => ({
        time: m,
        date: m,
        price: Math.round(base * (1 + offsets[idx])),
        isEstimated: idx < months.length - 1,
      }));
    }
  } else if (range === '1y') {
    if (cachedTgjuData && cachedTgjuData.length >= 30) {
      const slice = cachedTgjuData.slice(0, 365).reverse();
      const sampled = slice.filter((_, idx) => idx % 35 === 0);
      points = sampled.map((row) => ({
        time: row[7] ? row[7].split('/').slice(1).join('/') : row[6],
        date: row[7] || row[6] || 'یک سال گذشته',
        price: parseRialToToman(row[3]) || base,
        isEstimated: false,
      }));
      points.push({
        time: 'امروز',
        date: 'امروز',
        price: base,
        isEstimated: false,
      });
    } else {
      const periods = ['۱۲ ماه پیش', '۹ ماه پیش', '۶ ماه پیش', '۳ ماه پیش', 'امروز'];
      const offsets = [-0.22, -0.15, -0.08, -0.03, 0];
      points = periods.map((p, idx) => ({
        time: p,
        date: p,
        price: Math.round(base * (1 + offsets[idx])),
        isEstimated: idx < periods.length - 1,
      }));
    }
  }

  if (!points || points.length === 0) {
    const days = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'امروز'];
    const offsets = [-0.024, -0.018, -0.015, -0.008, 0.003, -0.002, 0];
    points = days.map((day, idx) => ({
      time: day,
      date: `روز ${idx + 1}`,
      price: Math.round(base * (1 + offsets[idx])),
      isEstimated: idx < days.length - 1,
    }));
  }


  res.json({ range, points, currentPrice: base });
});

// 3. Products Endpoints
app.get('/api/products', async (_req: Request, res: Response) => {
  await getOrUpdateGoldPrice();
  // Enrich products with dynamic calculated price and real-time available stock
  const enrichedProducts = productsList.map((p) => {
    const calc = calculateProductPrice(p, currentGoldState.pricePerGram, pricingSettings);
    return {
      ...p,
      availableStock: getAvailableStock(p),
      calculatedPrice: calc.finalPrice,
      priceBreakdown: calc,
    };
  });
  res.json(enrichedProducts);
});

app.get('/api/products/:id', async (req: Request, res: Response) => {
  await getOrUpdateGoldPrice();
  const product = productsList.find((p) => p.id === req.params.id || p.slug === req.params.id);
  if (!product) {
    res.status(404).json({ error: 'محصول یافت نشد' });
    return;
  }
  const calc = calculateProductPrice(product, currentGoldState.pricePerGram, pricingSettings);
  res.json({
    ...product,
    availableStock: getAvailableStock(product),
    calculatedPrice: calc.finalPrice,
    priceBreakdown: calc,
  });
});

// Temporary stock reservation endpoint during checkout step (10 minutes TTL)
app.post('/api/cart/reserve', authenticateUser, (req: AuthenticatedRequest, res: Response) => {
  const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';
  const rl = checkRateLimit(`reserve_stock_${clientIp}`, 25, 60 * 1000);
  if (!rl.allowed) {
    res.status(429).json({ error: 'تعداد درخواست‌های رزرو بیش از حد مجاز است. لطفاً کمی صبر فرمایید.' });
    return;
  }

  const { productId, quantity } = req.body;
  if (!productId) {
    res.status(400).json({ error: 'شناسه محصول الزامی است.' });
    return;
  }
  const product = productsList.find((p) => p.id === productId);
  if (!product) {
    res.status(404).json({ error: 'محصول یافت نشد.' });
    return;
  }

  const qty = Number(quantity);
  if (!Number.isInteger(qty) || qty < 1 || qty > 20) {
    res.status(400).json({ error: 'تعداد رزرو باید یک عدد صحیح بین ۱ تا ۲۰ باشد.' });
    return;
  }

  // Derive secure identity: authenticated UID or cryptographically sound reservationToken
  let uId: string;
  let reservationToken = String(req.headers['x-reservation-token'] || req.body.reservationToken || '').trim();
  if (req.user?.uid) {
    uId = `usr_${req.user.uid}`;
  } else {
    if (!reservationToken || reservationToken.length < 16) {
      reservationToken = `rst_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
    }
    uId = `anon_${reservationToken}`;
  }

  const available = getAvailableStock(product, uId);

  if (available < qty) {
    res.status(409).json({
      success: false,
      error: 'موجودی ناکافی',
      message: `این قطعه طلا هم‌اکنون توسط خریدار دیگری در حال نهایی‌سازی است.`,
      availableStock: available,
    });
    return;
  }

  const list = stockReservations.get(productId) || [];
  const existingIdx = list.findIndex((r) => r.userId === uId);
  const expiresAt = Date.now() + 10 * 60 * 1000;
  if (existingIdx >= 0) {
    list[existingIdx].quantity = qty;
    list[existingIdx].expiresAt = expiresAt;
  } else {
    list.push({ productId, quantity: qty, userId: uId, expiresAt });
  }
  stockReservations.set(productId, list);

  res.json({
    success: true,
    reservedUntil: expiresAt,
    reservationToken: req.user ? undefined : reservationToken,
    availableStock: getAvailableStock(product, uId),
  });
});

app.post('/api/cart/release-reservation', authenticateUser, (req: AuthenticatedRequest, res: Response) => {
  const { productId } = req.body;
  const reservationToken = String(req.headers['x-reservation-token'] || req.body.reservationToken || '').trim();
  const uId = req.user?.uid ? `usr_${req.user.uid}` : reservationToken ? `anon_${reservationToken}` : null;

  if (productId && uId && stockReservations.has(productId)) {
    const list = (stockReservations.get(productId) || []).filter((r) => r.userId !== uId);
    if (list.length > 0) stockReservations.set(productId, list);
    else stockReservations.delete(productId);
  }
  res.json({ success: true });
});

app.post('/api/admin/products', requireAdminAuth, (req: AuthenticatedRequest, res: Response) => {
  const titleVal = validateString(req.body.title || 'محصول جدید اینانا', 'عنوان محصول', 2, 150);
  if (!titleVal.isValid) {
    res.status(400).json({ error: titleVal.error });
    return;
  }

  const weightVal = validatePositiveNumber(req.body.weight || 1.0, 'وزن طلا', 0.01, 5000);
  if (!weightVal.isValid) {
    res.status(400).json({ error: weightVal.error });
    return;
  }

  const stockVal = validateInteger(req.body.stock !== undefined ? req.body.stock : 3, 'موجودی انبار', 0, 100000);
  if (!stockVal.isValid) {
    res.status(400).json({ error: stockVal.error });
    return;
  }

  const makingChargeVal = validatePercentOrNull(req.body.customMakingChargePercent, 'اجرت ساخت', 0, 100);
  if (!makingChargeVal.isValid) {
    res.status(400).json({ error: makingChargeVal.error });
    return;
  }

  const profitVal = validatePercentOrNull(req.body.customProfitPercent, 'درصد سود', 0, 50);
  if (!profitVal.isValid) {
    res.status(400).json({ error: profitVal.error });
    return;
  }

  const discountVal = validatePercentOrNull(req.body.discountPercent || 0, 'درصد تخفیف', 0, 90);
  if (!discountVal.isValid) {
    res.status(400).json({ error: discountVal.error });
    return;
  }

  const newProduct: Product = {
    id: `ina-prod-${Date.now()}`,
    title: titleVal.value,
    slug: req.body.slug ? String(req.body.slug).trim().slice(0, 100) : `product-${Date.now()}`,
    category: req.body.category ? String(req.body.category).trim().slice(0, 50) : 'پلاک طلا',
    collection: req.body.collection ? String(req.body.collection).trim().slice(0, 80) : 'INANA SIGNATURE',
    weight: Number(weightVal.value.toFixed(3)),
    purity: req.body.purity ? String(req.body.purity).trim().slice(0, 30) : '18 عیار',
    customMakingChargePercent: makingChargeVal.value,
    customProfitPercent: profitVal.value,
    additionalCost: Math.max(0, Number(req.body.additionalCost) || 0),
    stoneCost: Math.max(0, Number(req.body.stoneCost) || 0),
    discountPercent: discountVal.value ?? 0,
    images: Array.isArray(req.body.images) && req.body.images.length > 0 ? req.body.images.slice(0, 8) : [
      'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=800&q=85',
    ],
    description: req.body.description ? String(req.body.description).slice(0, 2000) : 'توضیحات محصول طلای لوکس اینانا',
    features: Array.isArray(req.body.features) ? req.body.features.slice(0, 10) : ['طلای ۱۸ عیار استاندارد ۷۵۰', 'شناسنامه و فاکتور رسمی'],
    dimensions: req.body.dimensions ? String(req.body.dimensions).slice(0, 100) : 'استاندارد',
    sku: req.body.sku ? String(req.body.sku).trim().slice(0, 50) : `INA-${Math.floor(1000 + Math.random() * 9000)}`,
    stock: stockVal.value,
    isNewArrival: Boolean(req.body.isNewArrival),
    isBestSeller: Boolean(req.body.isBestSeller),
    isFeatured: Boolean(req.body.isFeatured),
    letter: req.body.letter ? String(req.body.letter).slice(0, 10) : undefined,
    createdAt: new Date().toISOString(),
  };

  productsList.unshift(newProduct);
  saveProductsToDb(productsList);
  logger.security('ADMIN', `ثبت محصول جدید توسط مدیر: ${newProduct.title} (${newProduct.sku})`, {
    admin: req.user?.email,
    productId: newProduct.id,
    sku: newProduct.sku,
  });
  res.status(201).json(newProduct);
});

app.put('/api/admin/products/:id', requireAdminAuth, (req: AuthenticatedRequest, res: Response) => {
  const index = productsList.findIndex((p) => p.id === req.params.id);
  if (index === -1) {
    res.status(404).json({ error: 'محصول یافت نشد' });
    return;
  }

  if (req.body.title !== undefined) {
    const tVal = validateString(req.body.title, 'عنوان محصول', 2, 150);
    if (!tVal.isValid) {
      res.status(400).json({ error: tVal.error });
      return;
    }
  }

  if (req.body.weight !== undefined) {
    const wVal = validatePositiveNumber(req.body.weight, 'وزن طلا', 0.01, 5000);
    if (!wVal.isValid) {
      res.status(400).json({ error: wVal.error });
      return;
    }
  }

  if (req.body.stock !== undefined) {
    const sVal = validateInteger(req.body.stock, 'موجودی انبار', 0, 100000);
    if (!sVal.isValid) {
      res.status(400).json({ error: sVal.error });
      return;
    }
  }

  productsList[index] = {
    ...productsList[index],
    ...req.body,
    title: req.body.title ? String(req.body.title).trim() : productsList[index].title,
    weight: req.body.weight !== undefined ? Number(Number(req.body.weight).toFixed(3)) : productsList[index].weight,
    customMakingChargePercent:
      req.body.customMakingChargePercent !== undefined
        ? req.body.customMakingChargePercent === '' || req.body.customMakingChargePercent === null
          ? null
          : Math.min(100, Math.max(0, Number(req.body.customMakingChargePercent)))
        : productsList[index].customMakingChargePercent,
    customProfitPercent:
      req.body.customProfitPercent !== undefined
        ? req.body.customProfitPercent === '' || req.body.customProfitPercent === null
          ? null
          : Math.min(50, Math.max(0, Number(req.body.customProfitPercent)))
        : productsList[index].customProfitPercent,
    discountPercent:
      req.body.discountPercent !== undefined
        ? Math.min(90, Math.max(0, Number(req.body.discountPercent)))
        : productsList[index].discountPercent,
    stock: req.body.stock !== undefined ? Math.max(0, Number(req.body.stock)) : productsList[index].stock,
  };

  saveProductsToDb(productsList);
  logger.security('ADMIN', `ویرایش محصول توسط مدیر: ${productsList[index].title}`, {
    admin: req.user?.email,
    productId: productsList[index].id,
  });
  res.json(productsList[index]);
});

// Dedicated fast endpoint to directly update making charge & profit on a specific gold product
app.patch('/api/admin/products/:id/pricing', requireAdminAuth, (req: AuthenticatedRequest, res: Response) => {
  const index = productsList.findIndex((p) => p.id === req.params.id);
  if (index === -1) {
    res.status(404).json({ error: 'محصول یافت نشد' });
    return;
  }

  const { customMakingChargePercent, customProfitPercent, discountPercent } = req.body;

  if (customMakingChargePercent !== undefined) {
    productsList[index].customMakingChargePercent =
      customMakingChargePercent === null || customMakingChargePercent === ''
        ? null
        : Math.min(100, Math.max(0, Number(customMakingChargePercent)));
  }

  if (customProfitPercent !== undefined) {
    productsList[index].customProfitPercent =
      customProfitPercent === null || customProfitPercent === ''
        ? null
        : Math.min(50, Math.max(0, Number(customProfitPercent)));
  }

  if (discountPercent !== undefined) {
    productsList[index].discountPercent = Math.min(90, Math.max(0, Number(discountPercent) || 0));
  }

  saveProductsToDb(productsList);
  const calc = calculateProductPrice(productsList[index], currentGoldState.pricePerGram, pricingSettings);
  res.json({
    success: true,
    product: productsList[index],
    calculatedPrice: calc.finalPrice,
    priceBreakdown: calc,
  });
});

app.delete('/api/admin/products/:id', requireAdminAuth, (req: AuthenticatedRequest, res: Response) => {
  const index = productsList.findIndex((p) => p.id === req.params.id);
  if (index === -1) {
    res.status(404).json({ error: 'محصول یافت نشد' });
    return;
  }
  const deleted = productsList.splice(index, 1);
  saveProductsToDb(productsList);
  logger.security('ADMIN', `حذف محصول توسط مدیر: ${deleted[0].title} (${deleted[0].id})`, {
    admin: req.user?.email,
    productId: deleted[0].id,
  });
  res.json({ success: true, deleted: deleted[0] });
});

// 4. Collections & Categories
app.get('/api/collections', (_req: Request, res: Response) => {
  res.json(INITIAL_COLLECTIONS);
});

// 5. Settings
app.get('/api/settings', (_req: Request, res: Response) => {
  res.json(pricingSettings);
});

app.put('/api/admin/settings', requireAdminAuth, (req: AuthenticatedRequest, res: Response) => {
  const makingVal = validatePositiveNumber(req.body.globalMakingChargePercent ?? pricingSettings.globalMakingChargePercent, 'اجرت ساخت پایه', 0, 100);
  const profitVal = validatePositiveNumber(req.body.profitPercent ?? pricingSettings.profitPercent, 'درصد سود پایه', 0, 50);
  const taxVal = validatePositiveNumber(req.body.taxPercent ?? pricingSettings.taxPercent, 'درصد مالیات ارزش افزوده', 0, 30);
  const fixedVal = validatePositiveNumber(req.body.fixedCost ?? pricingSettings.fixedCost, 'هزینه بسته‌بندی و ارسال', 0, 100_000_000);

  if (!makingVal.isValid || !profitVal.isValid || !taxVal.isValid || !fixedVal.isValid) {
    res.status(400).json({ error: makingVal.error || profitVal.error || taxVal.error || fixedVal.error });
    return;
  }

  pricingSettings = {
    ...pricingSettings,
    ...req.body,
    globalMakingChargePercent: Number(makingVal.value),
    profitPercent: Number(profitVal.value),
    taxPercent: Number(taxVal.value),
    fixedCost: Math.round(Number(fixedVal.value)),
    bankCardNumber: req.body.bankCardNumber !== undefined ? String(req.body.bankCardNumber).trim().slice(0, 30) : pricingSettings.bankCardNumber,
    bankCardHolder: req.body.bankCardHolder !== undefined ? String(req.body.bankCardHolder).trim().slice(0, 100) : pricingSettings.bankCardHolder,
    bankName: req.body.bankName !== undefined ? String(req.body.bankName).trim().slice(0, 50) : pricingSettings.bankName,
    bankSheba: req.body.bankSheba !== undefined ? String(req.body.bankSheba).trim().slice(0, 40) : pricingSettings.bankSheba,
  };
  saveSettingsToDb(pricingSettings);
  logger.security('ADMIN', `ویرایش تنظیمات مالی و فرمول طلا توسط مدیر`, {
    admin: req.user?.email,
    settings: {
      globalMakingChargePercent: pricingSettings.globalMakingChargePercent,
      profitPercent: pricingSettings.profitPercent,
      taxPercent: pricingSettings.taxPercent,
    },
  });
  res.json({ success: true, settings: pricingSettings });
});

// 6. Orders (Server-Side Recalculation & Persistent DB Storage)

// Tracking code generator with high cryptographic entropy and collision prevention
function generateUniqueTrackingCode(): string {
  for (let attempt = 0; attempt < 100; attempt++) {
    const randomHex = crypto.randomBytes(3).toString('hex').toUpperCase();
    const code = `INA-${randomHex}`;
    const exists = ordersList.some((o) => o.trackingCode.toUpperCase() === code);
    if (!exists) {
      return code;
    }
  }
  return `INA-${Date.now().toString().slice(-6)}`;
}

// In-memory idempotency cache for orders (prevents double-billing / duplicate orders)
const idempotencyOrdersMap: Map<string, Order> = new Map();

// In-memory quotes cache for locking gold & product prices (15-minute TTL)
interface ServerPriceQuote {
  quoteId: string;
  items: Array<{
    productId: string;
    productTitle: string;
    productImage: string;
    weight: number;
    unitPrice: number;
    quantity: number;
    totalPrice: number;
    goldPriceAtOrder: number;
    makingChargePercent: number;
  }>;
  totalWeight: number;
  totalPrice: number;
  goldPriceAtQuote: number;
  expiresAt: number;
  createdAt: number;
  userId?: string;
}

const quotesMap: Map<string, ServerPriceQuote> = new Map();

app.get('/api/orders', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  // If user is admin, allow viewing all orders or querying specific customer
  if (req.user?.role === 'admin') {
    const { userId } = req.query;
    if (userId && typeof userId === 'string') {
      const userOrders = ordersList.filter((o) => o.userId === userId);
      res.json(userOrders);
      return;
    }
    res.json(ordersList);
    return;
  }

  // Non-admin customers can strictly ONLY see their own personal orders by verified userId (PII Protected)
  const currentUid = req.user?.uid;
  const customerOrders = ordersList.filter((o) => currentUid && o.userId === currentUid);
  res.json(customerOrders);
});

// Safe public order status tracking by tracking code (No sensitive customer PII leaked)
app.get('/api/orders/track/:trackingCode', (req: Request, res: Response) => {
  const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';
  const rl = checkRateLimit(`track_order_${clientIp}`, 30, 60 * 1000);
  if (!rl.allowed) {
    res.status(429).json({ error: 'تعداد استعلام کد رهگیری بیش از حد مجاز است. لطفاً کمی بعد تلاش فرمایید.' });
    return;
  }

  const code = String(req.params.trackingCode || '').trim().toUpperCase();
  if (!code || code.length < 5 || code.length > 30) {
    res.status(400).json({ error: 'کد رهگیری نامعتبر است.' });
    return;
  }
  const order = ordersList.find((o) => o.trackingCode.toUpperCase() === code || o.id === code);
  if (!order) {
    res.status(404).json({ error: 'سفارشی با این کد رهگیری یافت نشد.' });
    return;
  }
  res.json({
    success: true,
    trackingCode: order.trackingCode,
    status: order.status,
    totalPrice: order.totalPrice,
    totalWeight: order.totalWeight,
    itemsCount: order.items?.length || 0,
    createdAt: order.createdAt,
    reviewedAt: order.reviewedAt,
    rejectionReason: order.status === 'رد شده' ? order.rejectionReason : undefined,
  });
});

// Server-Side Price Quote generation with 15-minute price lock
app.post('/api/orders/quote', authenticateUser, (req: AuthenticatedRequest, res: Response) => {
  const { items } = req.body;
  if (!items || !Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: 'اقلام پیش‌فاکتور نامعتبر است.' });
    return;
  }

  const currentGoldPrice = currentGoldState.pricePerGram;
  let computedTotalWeight = 0;
  let computedTotalPrice = 0;
  const quoteItems: ServerPriceQuote['items'] = [];

  for (const itm of items) {
    if (!itm || !itm.productId) {
      res.status(400).json({ error: 'اطلاعات ردیف کالا ناقص است.' });
      return;
    }
    const product = productsList.find((p) => p.id === String(itm.productId));
    if (!product) {
      res.status(404).json({ error: `محصول با شناسه ${itm.productId} یافت نشد.` });
      return;
    }
    const qty = Number(itm.quantity);
    if (!Number.isInteger(qty) || qty < 1 || qty > 20) {
      res.status(400).json({ error: 'تعداد هر قلم باید یک عدد صحیح بین ۱ تا ۲۰ باشد.' });
      return;
    }

    const priceBreakdown = calculateProductPrice(product, currentGoldPrice, pricingSettings);
    const unitPrice = priceBreakdown.finalPrice;
    const itemTotal = unitPrice * qty;

    computedTotalWeight += product.weight * qty;
    computedTotalPrice += itemTotal;

    quoteItems.push({
      productId: product.id,
      productTitle: product.title,
      productImage: product.images[0] || '',
      weight: product.weight,
      unitPrice,
      quantity: qty,
      totalPrice: itemTotal,
      goldPriceAtOrder: currentGoldPrice,
      makingChargePercent: priceBreakdown.effectiveMakingChargePercent,
    });
  }

  const quoteId = `quote_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
  const quoteTtlMs = 15 * 60 * 1000;
  const expiresAt = Date.now() + quoteTtlMs;

  const quoteRecord: ServerPriceQuote = {
    quoteId,
    items: quoteItems,
    totalWeight: Number(computedTotalWeight.toFixed(3)),
    totalPrice: computedTotalPrice,
    goldPriceAtQuote: currentGoldPrice,
    expiresAt,
    createdAt: Date.now(),
    userId: req.user?.uid,
  };

  quotesMap.set(quoteId, quoteRecord);

  // Expired quotes housekeeping
  const now = Date.now();
  for (const [k, q] of quotesMap.entries()) {
    if (now > q.expiresAt + 60 * 60 * 1000) {
      quotesMap.delete(k);
    }
  }

  res.json({
    success: true,
    quoteId,
    totalPrice: computedTotalPrice,
    totalWeight: Number(computedTotalWeight.toFixed(3)),
    goldPriceAtQuote: currentGoldPrice,
    expiresAt,
    expiresInSeconds: Math.floor(quoteTtlMs / 1000),
    items: quoteItems,
  });
});

app.post('/api/orders', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';
  const rl = checkRateLimit(`submit_order_${clientIp}`, 15, 60 * 1000);
  if (!rl.allowed) {
    res.status(429).json({ error: 'درخواست ثبت سفارش بیش از حد مجاز است. لطفاً کمی بعد تلاش فرمایید.' });
    return;
  }

  // Idempotency Key check
  const idempotencyKey = String(req.headers['x-idempotency-key'] || req.body.idempotencyKey || '').trim();
  if (idempotencyKey) {
    const existing = idempotencyOrdersMap.get(idempotencyKey);
    if (existing) {
      res.status(200).json({
        success: true,
        order: existing,
        isIdempotentReplay: true,
        message: 'این سفارش قبلاً با موفقیت ثبت شده است.',
      });
      return;
    }
  }

  const {
    customerName,
    customerPhone,
    customerAddress,
    contactMethod,
    notes,
    items,
    paymentMethod,
    paymentTrackingNumber,
    paymentReceiptImage,
    quoteId,
  } = req.body;

  const nameVal = validateString(customerName, 'نام و نام‌خانوادگی خریدار', 2, 80);
  if (!nameVal.isValid) {
    res.status(400).json({ error: nameVal.error });
    return;
  }

  const phoneVal = validatePhoneNumber(customerPhone);
  if (!phoneVal.isValid) {
    res.status(400).json({ error: phoneVal.error });
    return;
  }

  if (!items || !Array.isArray(items) || items.length === 0 || items.length > 50) {
    res.status(400).json({ error: 'لیست اقلام سفارش نامعتبر است (حداقل ۱ و حداکثر ۵۰ قلم کالا).' });
    return;
  }

  // 1. Prevent OOM: Enforce receipt image length limit (~600KB max base64)
  if (
    paymentReceiptImage &&
    typeof paymentReceiptImage === 'string' &&
    paymentReceiptImage.length > 750 * 1024
  ) {
    res.status(400).json({
      error: 'حجم تصویر فیش بیش از حد مجاز است',
      message: 'حجم تصویر فیش بیش از حد مجاز است. لطفاً از تصویر فشرده یا کم‌حجم‌تر استفاده فرمایید.',
    });
    return;
  }

  // 2. Validate integers and aggregate quantities by productId (prevent duplicate row bypass)
  const aggregatedQuantities = new Map<string, number>();
  for (const item of items) {
    if (!item || !item.productId) {
      res.status(400).json({ error: 'اطلاعات ردیف‌های سفارش ناقص است.' });
      return;
    }
    const qty = Number(item.quantity);
    if (!Number.isInteger(qty) || qty < 1 || qty > 20) {
      res.status(400).json({ error: 'تعداد هر قلم در سفارش باید یک عدد صحیح بین ۱ تا ۲۰ باشد.' });
      return;
    }
    const pId = String(item.productId);
    aggregatedQuantities.set(pId, (aggregatedQuantities.get(pId) || 0) + qty);
  }

  // 3. User identity: strictly verified from authenticated session
  const orderUserId = req.user!.uid;
  const orderUserEmail = req.user!.email;
  const uId = `usr_${orderUserId}`;

  // 4. Verify stock availability
  for (const [pId, totalRequestedQty] of aggregatedQuantities.entries()) {
    const product = productsList.find((p) => p.id === pId);
    if (!product) {
      res.status(404).json({ error: `محصول با شناسه ${pId} یافت نشد.` });
      return;
    }
    const available = getAvailableStock(product, uId);
    if (product.stock !== undefined && available < totalRequestedQty) {
      res.status(409).json({
        error: 'اتمام موجودی قطعه طلا',
        message: `متأسفانه مجموع تعداد درخواستی قطعه «${product.title}» (${totalRequestedQty} عدد) بیش از موجودی قابل سفارش (${available} عدد) است.`,
        productId: product.id,
        availableStock: available,
        requestedQuantity: totalRequestedQty,
      });
      return;
    }
  }

  // 5. Price calculation / Quote price locking
  let effectiveGoldPrice = currentGoldState.pricePerGram;
  let validatedItems: Order['items'] = [];
  let computedTotalWeight = 0;
  let computedTotalPrice = 0;

  if (quoteId && typeof quoteId === 'string') {
    const activeQuote = quotesMap.get(quoteId.trim());
    if (!activeQuote || Date.now() > activeQuote.expiresAt) {
      res.status(400).json({
        error: 'پیش‌فاکتور قیمت طلا منقضی گردیده است. لطفاً پیش‌فاکتور جدید دریافت نمایید.',
        quoteExpired: true,
      });
      return;
    }
    effectiveGoldPrice = activeQuote.goldPriceAtQuote;
    computedTotalWeight = activeQuote.totalWeight;
    computedTotalPrice = activeQuote.totalPrice;
    validatedItems = activeQuote.items;
    // Invalidate quote so it cannot be reused
    quotesMap.delete(quoteId.trim());
  } else {
    // Dynamic recalculation at current live gold price
    for (const [pId, totalQty] of aggregatedQuantities.entries()) {
      const product = productsList.find((p) => p.id === pId)!;
      const priceBreakdown = calculateProductPrice(product, effectiveGoldPrice, pricingSettings);
      const unitPrice = priceBreakdown.finalPrice;
      const itemTotal = unitPrice * totalQty;

      computedTotalWeight += product.weight * totalQty;
      computedTotalPrice += itemTotal;

      validatedItems.push({
        productId: product.id,
        productTitle: product.title,
        productImage: product.images[0] || '',
        weight: product.weight,
        unitPrice,
        quantity: totalQty,
        totalPrice: itemTotal,
        goldPriceAtOrder: effectiveGoldPrice,
        makingChargePercent: priceBreakdown.effectiveMakingChargePercent,
      });
    }
  }

  // 6. Transactional Execution with In-Memory Snapshot & Rollback
  const productsSnapshot = JSON.stringify(productsList);
  const ordersSnapshot = JSON.stringify(ordersList);

  const newOrder: Order = {
    id: `ord-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
    trackingCode: generateUniqueTrackingCode(),
    userId: orderUserId,
    userEmail: orderUserEmail,
    customerName: nameVal.value,
    customerPhone: phoneVal.phone,
    customerAddress: customerAddress || 'ارسال پستی بیمه‌شده',
    contactMethod: contactMethod || 'telegram',
    notes,
    items: validatedItems,
    totalWeight: Number(computedTotalWeight.toFixed(3)),
    totalPrice: computedTotalPrice,
    goldPriceAtCheckout: effectiveGoldPrice,
    status: 'در انتظار بررسی',
    paymentMethod: paymentMethod || 'card_to_card',
    paymentTrackingNumber: paymentTrackingNumber ? String(paymentTrackingNumber).trim() : '',
    paymentReceiptImage: paymentReceiptImage || '',
    paymentDate: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    inventoryReleased: false,
    idempotencyKey: idempotencyKey || undefined,
    quoteId: quoteId || undefined,
  };

  try {
    // Atomically decrement stock and clear reservation
    for (const [pId, totalQty] of aggregatedQuantities.entries()) {
      const product = productsList.find((p) => p.id === pId);
      if (product && product.stock !== undefined) {
        product.stock = Math.max(0, product.stock - totalQty);
      }
      if (product && stockReservations.has(product.id)) {
        const remaining = (stockReservations.get(product.id) || []).filter((r) => r.userId !== uId);
        if (remaining.length > 0) stockReservations.set(product.id, remaining);
        else stockReservations.delete(product.id);
      }
    }

    ordersList.unshift(newOrder);

    // Atomic awaitable persistence
    await persistProducts();
    await persistOrders();

    if (idempotencyKey) {
      idempotencyOrdersMap.set(idempotencyKey, newOrder);
    }
  } catch (persistErr) {
    // Rollback
    productsList = JSON.parse(productsSnapshot);
    ordersList = JSON.parse(ordersSnapshot);
    console.error('[ORDERS DB] Transaction rollback due to error:', persistErr);
    res.status(500).json({ error: 'خطای سیستمی در ذخیره‌سازی تراکنش سفارش. لطفاً مجدداً تلاش فرمایید.' });
    return;
  }

  logger.order('ORDERS', `ثبت سفارش جدید کد ${newOrder.trackingCode} با مبلغ ${newOrder.totalPrice.toLocaleString('fa-IR')} تومان`, {
    orderId: newOrder.id,
    trackingCode: newOrder.trackingCode,
    customerName: newOrder.customerName,
    customerPhone: newOrder.customerPhone,
    totalPrice: newOrder.totalPrice,
    totalWeight: newOrder.totalWeight,
    itemsCount: newOrder.items.length,
    hasReceiptImage: Boolean(newOrder.paymentReceiptImage),
  });

  res.status(201).json({
    success: true,
    message: 'سفارش شما با موفقیت در پایگاه داده ثبت شد و در حال بررسی کارشناس است.',
    order: newOrder,
  });
});

async function handleOrderStatusUpdate(
  orderId: string,
  body: any,
  adminUser: any,
  res: Response
): Promise<void> {
  const { status, rejectionReason, paymentTrackingNumber } = body;
  const order = ordersList.find((o) => o.id === orderId || o.trackingCode === orderId);
  if (!order) {
    res.status(404).json({ error: 'سفارش یافت نشد.' });
    return;
  }

  if (status !== undefined) {
    const validStatuses = [
      'در انتظار بررسی',
      'تایید شده',
      'تأیید شده',
      'رد شده',
      'در حال آماده‌سازی',
      'آماده تحویل',
      'تکمیل شده',
      'لغو شده',
    ];
    if (!validStatuses.includes(status)) {
      res.status(400).json({ error: `وضعیت ارسالی نامعتبر است: «${status}».` });
      return;
    }
  }

  const isRejecting = status === 'رد شده' || status === 'لغو شده';
  const wasRejected = order.status === 'رد شده' || order.status === 'لغو شده';

  const productsSnapshot = JSON.stringify(productsList);
  const orderSnapshot = JSON.stringify(order);

  try {
    // 1. Transition to Rejected/Cancelled: Restore inventory only once
    if (isRejecting && !order.inventoryReleased) {
      for (const itm of order.items) {
        const prod = productsList.find((p) => p.id === itm.productId);
        if (prod && prod.stock !== undefined) {
          prod.stock += itm.quantity;
        }
      }
      order.inventoryReleased = true;
    }
    // 2. Transition from Rejected/Cancelled to Active status: Deduct inventory again if available
    else if (!isRejecting && wasRejected && order.inventoryReleased) {
      for (const itm of order.items) {
        const prod = productsList.find((p) => p.id === itm.productId);
        if (prod && prod.stock !== undefined && prod.stock < itm.quantity) {
          res.status(409).json({
            error: 'موجودی ناکافی جهت بازفعال‌سازی سفارش',
            message: `موجودی قطعه «${prod.title}» (${prod.stock} عدد) برای فعال‌سازی مجدد این سفارش (${itm.quantity} عدد) کافی نیست.`,
          });
          return;
        }
      }
      for (const itm of order.items) {
        const prod = productsList.find((p) => p.id === itm.productId);
        if (prod && prod.stock !== undefined) {
          prod.stock -= itm.quantity;
        }
      }
      order.inventoryReleased = false;
    }

    if (status) {
      order.status = status;
      order.reviewedAt = new Date().toISOString();
    }
    if (rejectionReason !== undefined) {
      order.rejectionReason = String(rejectionReason).slice(0, 500);
    }
    if (paymentTrackingNumber !== undefined) {
      order.paymentTrackingNumber = String(paymentTrackingNumber).slice(0, 100);
    }
    order.updatedAt = new Date().toISOString();

    await persistProducts();
    await persistOrders();

    logger.order('ORDERS', `بروزرسانی وضعیت سفارش ${order.trackingCode} به «${order.status}» توسط مدیر`, {
      admin: adminUser?.email,
      orderId: order.id,
      trackingCode: order.trackingCode,
      status: order.status,
      inventoryReleased: order.inventoryReleased,
    });

    res.json({ success: true, order });
  } catch (saveErr) {
    productsList = JSON.parse(productsSnapshot);
    const restoredOrder = JSON.parse(orderSnapshot);
    Object.assign(order, restoredOrder);

    console.error('[ORDERS DB] Error updating order status:', saveErr);
    res.status(500).json({ error: 'خطای سرور در ذخیره‌سازی تغییرات وضعیت سفارش.' });
  }
}

app.patch('/api/admin/orders/:id', requireAdminAuth, (req: AuthenticatedRequest, res: Response) => {
  handleOrderStatusUpdate(req.params.id, req.body, req.user, res);
});

app.patch('/api/orders/:id/status', requireAdminAuth, (req: AuthenticatedRequest, res: Response) => {
  handleOrderStatusUpdate(req.params.id, req.body, req.user, res);
});

app.put('/api/orders/:id/status', requireAdminAuth, (req: AuthenticatedRequest, res: Response) => {
  handleOrderStatusUpdate(req.params.id, req.body, req.user, res);
});

async function handleDeleteOrder(orderId: string, adminUser: any, res: Response): Promise<void> {
  const index = ordersList.findIndex((o) => o.id === orderId || o.trackingCode === orderId);
  if (index === -1) {
    res.status(404).json({ error: 'سفارش مورد نظر در پایگاه داده یافت نشد.' });
    return;
  }

  const productsSnapshot = JSON.stringify(productsList);
  const ordersSnapshot = JSON.stringify(ordersList);

  const [deletedOrder] = ordersList.splice(index, 1);

  try {
    if (!deletedOrder.inventoryReleased && deletedOrder.status !== 'رد شده' && deletedOrder.status !== 'لغو شده') {
      for (const itm of deletedOrder.items) {
        const prod = productsList.find((p) => p.id === itm.productId);
        if (prod && prod.stock !== undefined) {
          prod.stock += itm.quantity;
        }
      }
      deletedOrder.inventoryReleased = true;
    }

    await persistProducts();
    await persistOrders();

    logger.security('ADMIN', `حذف سفارش توسط مدیر: کد ${deletedOrder.trackingCode}`, {
      admin: adminUser?.email,
      orderId: deletedOrder.id,
    });

    res.json({
      success: true,
      message: `سفارش کد ${deletedOrder.trackingCode} با موفقیت حذف شد.`,
      deletedId: deletedOrder.id,
      remainingCount: ordersList.length,
    });
  } catch (err) {
    productsList = JSON.parse(productsSnapshot);
    ordersList = JSON.parse(ordersSnapshot);
    res.status(500).json({ error: 'خطای سرور در حذف سفارش.' });
  }
}

app.delete('/api/orders/:id', requireAdminAuth, (req: AuthenticatedRequest, res: Response) => {
  handleDeleteOrder(req.params.id, req.user, res);
});

app.delete('/api/admin/orders/:id', requireAdminAuth, (req: AuthenticatedRequest, res: Response) => {
  handleDeleteOrder(req.params.id, req.user, res);
});

// Bulk delete or clear orders from database and memory
app.delete('/api/orders', requireAdminAuth, (req: AuthenticatedRequest, res: Response) => {
  const { ids, clearAll } = req.body || {};
  if (clearAll === true) {
    const prevCount = ordersList.length;
    ordersList = [];
    saveOrdersToDb(ordersList);
    logger.security('ADMIN', `پاکسازی تمام سفارشات توسط مدیر (تعداد: ${prevCount})`, {
      admin: req.user?.email,
      prevCount,
    });
    res.json({ success: true, message: 'تمام سفارش‌ها از پایگاه داده و حافظه حذف شدند.', deletedCount: prevCount });
    return;
  }
  if (Array.isArray(ids) && ids.length > 0) {
    const idSet = new Set(ids);
    const prevCount = ordersList.length;
    ordersList = ordersList.filter((o) => !idSet.has(o.id) && !idSet.has(o.trackingCode));
    saveOrdersToDb(ordersList);
    logger.security('ADMIN', `حذف دسته‌ای سفارشات توسط مدیر (تعداد: ${prevCount - ordersList.length})`, {
      admin: req.user?.email,
      deletedCount: prevCount - ordersList.length,
    });
    res.json({
      success: true,
      message: 'سفارش‌های انتخابی با موفقیت حذف شدند.',
      deletedCount: prevCount - ordersList.length,
      remainingCount: ordersList.length,
    });
    return;
  }
  res.status(400).json({ error: 'پارامترهای حذف مشخص نشده است.' });
});

// 7. Authentication Endpoints (Email/Password registration & login for all users)
app.post('/api/auth/register', (req: Request, res: Response) => {
  const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';
  const rl = checkRateLimit(`auth_reg_${clientIp}`, 10, 60 * 1000);
  if (!rl.allowed) {
    res.status(429).json({ success: false, error: 'تعداد درخواست‌ها بیش از حد مجاز است. لطفاً کمی بعد دوباره تلاش کنید.' });
    return;
  }

  try {
    const { email, password, displayName, phoneNumber } = req.body;
    const emailVal = validateEmail(email);
    if (!emailVal.isValid) {
      res.status(400).json({ success: false, error: emailVal.error });
      return;
    }
    const passVal = validatePassword(password);
    if (!passVal.isValid) {
      res.status(400).json({ success: false, error: passVal.error });
      return;
    }

    const result = registerUser(emailVal.value, passVal.value, displayName, phoneNumber);
    setAuthCookie(res, result.token);
    logger.security('AUTH', `ثبت‌نام موفق کاربر جدید: ${emailVal.value} (${displayName || 'بدون نام'})`, {
      email: emailVal.value,
      displayName,
      role: result.user.role,
    });
    res.status(201).json({ success: true, ...result });
  } catch (err: any) {
    logger.warn('AUTH', `تلاش ناموفق برای ثبت‌نام کاربر: ${req.body?.email || 'نامشخص'} - ${err?.message}`, {
      email: req.body?.email,
      error: err?.message,
    });
    res.status(400).json({ success: false, error: err?.message || 'خطا در ثبت‌نام کاربر' });
  }
});

app.post('/api/auth/login', (req: Request, res: Response) => {
  const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';
  const rl = checkRateLimit(`auth_login_${clientIp}`, 10, 60 * 1000);
  if (!rl.allowed) {
    res.status(429).json({ success: false, error: 'تعداد دفعات تلاش ورود بیش از حد مجاز است. لطفاً ۱ دقیقه صبر کنید.' });
    return;
  }

  try {
    const { email, password } = req.body;
    const emailVal = validateEmail(email);
    if (!emailVal.isValid) {
      res.status(400).json({ success: false, error: emailVal.error });
      return;
    }

    const result = loginUser(emailVal.value, password);
    setAuthCookie(res, result.token);
    logger.security('AUTH', `ورود موفق کاربر: ${emailVal.value} با نقش [${result.user.role}]`, {
      email: emailVal.value,
      role: result.user.role,
    });
    res.json({ success: true, ...result });
  } catch (err: any) {
    logger.warn('AUTH', `تلاش ناموفق برای ورود به سیستم: ${req.body?.email || 'نامشخص'}`, {
      email: req.body?.email,
      error: err?.message,
    });
    res.status(401).json({ success: false, error: err?.message || 'ایمیل یا کلمه عبور نادرست است' });
  }
});

app.post('/api/auth/logout', (req: Request, res: Response) => {
  const token = extractToken(req);
  if (token) {
    revokeSessionToken(token);
  }
  clearAuthCookie(res);
  res.json({ success: true, message: 'خروج موفقیت‌آمیز بود.' });
});

// Google Firebase auth integration & account synchronization
app.post('/api/auth/google-sync', (req: Request, res: Response) => {
  const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';
  const rl = checkRateLimit(`auth_google_${clientIp}`, 15, 60 * 1000);
  if (!rl.allowed) {
    res.status(429).json({ success: false, error: 'درخواست ورود گوگل بیش از حد مجاز است.' });
    return;
  }

  try {
    const { uid, email, displayName, photoURL } = req.body;
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      res.status(400).json({ success: false, error: 'ایمیل گوگل نامعتبر است.' });
      return;
    }

    const result = syncGoogleUser({ uid, email, displayName, photoURL });
    setAuthCookie(res, result.token);
    logger.security('AUTH', `همگام‌سازی و ورود موفق حساب گوگل: ${result.user.email} (${result.user.role})`, {
      email: result.user.email,
      role: result.user.role,
      uid: result.user.uid,
    });

    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message || 'خطا در همگام‌سازی حساب گوگل.' });
  }
});

// 7.1 SMS OTP Endpoints (سرویس ارسال و تایید کد پیامکی یکبارمصرف)
app.post('/api/auth/otp/send', async (req: Request, res: Response) => {
  const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';
  const rl = checkRateLimit(`auth_otp_send_${clientIp}`, 5, 60 * 1000);
  if (!rl.allowed) {
    res.status(429).json({ success: false, error: 'درخواست ارسال کد پیامکی بیش از حد مجاز است. لطفاً ۱ دقیقه صبر فرمایید.' });
    return;
  }

  try {
    const { mobile } = req.body;
    const phoneVal = validatePhoneNumber(mobile);
    if (!phoneVal.isValid) {
      res.status(400).json({ success: false, error: phoneVal.error });
      return;
    }

    const result = await sendSmsOtpCode(phoneVal.phone);
    logger.security('AUTH', `درخواست ارسال کد پیامکی OTP به شماره: ${phoneVal.phone}`, {
      mobile: phoneVal.phone,
      isRegistered: result.isRegistered,
    });

    res.json({
      success: true,
      message: 'کد تایید پیامکی با موفقیت ارسال شد.',
      ...result,
    });
  } catch (err: any) {
    logger.warn('AUTH', `خطا در ارسال پیامک OTP به ${req.body?.mobile}: ${err.message}`);
    res.status(400).json({
      success: false,
      error: err.message || 'خطا در ارسال پیامک کد تایید.',
    });
  }
});

app.post('/api/auth/otp/verify', (req: Request, res: Response) => {
  const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';
  const rl = checkRateLimit(`auth_otp_verify_${clientIp}`, 10, 60 * 1000);
  if (!rl.allowed) {
    res.status(429).json({ success: false, error: 'تعداد دفعات ورود کد بیش از حد مجاز است. لطفاً بعداً تلاش کنید.' });
    return;
  }

  try {
    const { mobile, code, displayName } = req.body;
    const phoneVal = validatePhoneNumber(mobile);
    if (!phoneVal.isValid || !code) {
      res.status(400).json({ success: false, error: 'شماره موبایل و کد تایید ۵ رقمی الزامی هستند.' });
      return;
    }

    const result = verifySmsOtpAndAuthenticate(phoneVal.phone, String(code).trim(), displayName);
    setAuthCookie(res, result.token);
    logger.security(
      'AUTH',
      `ورود/ثبت‌نام موفق پیامکی کاربر با شماره ${phoneVal.phone} (${result.isNewUser ? 'عضو جدید' : 'ورود مجدد'})`,
      {
        mobile: phoneVal.phone,
        isNewUser: result.isNewUser,
        role: result.user.role,
        uid: result.user.uid,
      }
    );

    res.json({
      success: true,
      message: result.isNewUser
        ? 'حساب کاربری شما با موفقیت ایجاد و فعال گردید.'
        : 'با موفقیت وارد حساب کاربری خود شدید.',
      ...result,
    });
  } catch (err: any) {
    logger.warn('AUTH', `تلاش ناموفق برای تایید OTP شماره ${req.body?.mobile}: ${err.message}`);
    res.status(400).json({
      success: false,
      error: err.message || 'کد تایید نامعتبر است.',
    });
  }
});

// Secure Phone Number Change with SMS Verification (Prevents Unauthorized Phone Hijacking)
app.post('/api/auth/phone/change-request', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';
  const rl = checkRateLimit(`phone_change_req_${clientIp}`, 5, 60 * 1000);
  if (!rl.allowed) {
    res.status(429).json({ success: false, error: 'درخواست بیش از حد مجاز است. لطفاً کمی بعد تلاش کنید.' });
    return;
  }

  try {
    const { newMobile } = req.body;
    const phoneVal = validatePhoneNumber(newMobile);
    if (!phoneVal.isValid) {
      res.status(400).json({ success: false, error: phoneVal.error });
      return;
    }

    const result = await requestPhoneChangeOtp(req.user!.uid, phoneVal.phone);
    res.json({
      success: true,
      message: 'کد تایید به شماره موبایل جدید ارسال گردید.',
      ...result,
    });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message || 'خطا در ارسال کد تایید شماره موبایل جدید.' });
  }
});

app.post('/api/auth/phone/change-verify', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { code } = req.body;
    if (!code) {
      res.status(400).json({ success: false, error: 'کد تایید ۵ رقمی الزامی است.' });
      return;
    }

    const updatedUser = verifyPhoneChangeOtp(req.user!.uid, String(code).trim());
    res.json({
      success: true,
      message: 'شماره موبایل حساب شما با موفقیت تغییر یافت.',
      user: updatedUser,
    });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message || 'کد تایید نامعتبر یا منقضی است.' });
  }
});

app.get('/api/auth/me', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  res.json({ success: true, user: req.user });
});

app.put('/api/auth/profile', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const updated = updateUser(req.user!.uid, req.body);
    res.json({ success: true, user: updated });
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'خطا در بروزرسانی اطلاعات' });
  }
});

// ----------------------------------------------------
// SYSTEM LOGGING & AUDIT TRAIL API ENDPOINTS
// ----------------------------------------------------

// Get paginated and filtered logs (Strictly Admin Protected)
app.get('/api/admin/logs', requireAdminAuth, (req: AuthenticatedRequest, res: Response) => {
  const level = req.query.level as string | undefined;
  const moduleName = req.query.module as string | undefined;
  const search = req.query.search as string | undefined;
  const limit = req.query.limit ? Math.min(200, Math.max(1, parseInt(req.query.limit as string, 10))) : 50;
  const offset = req.query.offset ? Math.max(0, parseInt(req.query.offset as string, 10)) : 0;
  const since = req.query.since as string | undefined;

  const result = logger.getLogs({ level, module: moduleName, search, limit, offset, since });
  res.json(result);
});

// Get logging statistics and counters (Strictly Admin Protected)
app.get('/api/admin/logs/stats', requireAdminAuth, (_req: AuthenticatedRequest, res: Response) => {
  res.json(logger.getStats());
});

// Client-side event / exception reporter endpoint (Rate Limited & Sanitized)
app.post('/api/logs', (req: Request, res: Response) => {
  const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';
  const rl = checkRateLimit(`client_log_${clientIp}`, 30, 60 * 1000);
  if (!rl.allowed) {
    res.status(429).json({ error: 'محدودیت تعداد ثبت لاگ فعال است.' });
    return;
  }

  const { level = 'info', module = 'CLIENT', message, details } = req.body;
  const msgVal = validateString(message, 'پیام لاگ', 1, 500);
  if (!msgVal.isValid) {
    res.status(400).json({ error: msgVal.error });
    return;
  }

  const safeLevel = (['info', 'warn', 'error', 'security', 'order'] as const).includes(level) ? level : 'info';
  const allowedModules: SystemLogModule[] = ['API', 'AUTH', 'ADMIN', 'ORDERS', 'GOLD_PRICE', 'INVENTORY', 'CLIENT', 'SYSTEM'];
  const safeModule: SystemLogModule = allowedModules.includes(module as SystemLogModule) ? (module as SystemLogModule) : 'CLIENT';
  const safeDetails = details
    ? typeof details === 'object'
      ? JSON.parse(JSON.stringify(details).slice(0, 2000))
      : String(details).slice(0, 2000)
    : undefined;

  const log = logger.addLog({
    level: safeLevel,
    module: safeModule,
    message: msgVal.value,
    details: safeDetails,
    ip: clientIp,
  });
  res.status(201).json({ success: true, log });
});

// Purge or clear logs (Strictly Admin Protected)
app.delete('/api/admin/logs', requireAdminAuth, (req: AuthenticatedRequest, res: Response) => {
  const retainCount = req.body?.retainCount !== undefined ? Math.max(0, parseInt(req.body.retainCount, 10)) : 0;
  logger.clearLogs(retainCount);
  logger.security('SYSTEM', `پاکسازی تاریخچه لاگ‌های سیستم توسط مدیر (تعداد حفظ شده: ${retainCount})`, {
    admin: req.user?.email,
    retainCount,
  });
  res.json({ success: true, message: 'لاگ‌های سیستم با موفقیت پاکسازی شدند' });
});

// Export logs as CSV or JSON file (Strictly Admin Protected)
app.get('/api/admin/logs/export', requireAdminAuth, (req: AuthenticatedRequest, res: Response) => {
  const format = (req.query.format as string) || 'json';
  logger.security('SYSTEM', `خروجی لاگ‌های سیستم توسط مدیر با فرمت [${format}]`, {
    admin: req.user?.email,
    format,
  });

  if (format === 'csv') {
    const csv = logger.exportCsv();
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="inana_system_logs.csv"');
    res.send('\uFEFF' + csv);
  } else {
    const data = logger.getLogs({ limit: 5000 });
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="inana_system_logs.json"');
    res.send(JSON.stringify(data.logs, null, 2));
  }
});

// ----------------------------------------------------
// VITE / STATIC INTEGRATION
// ----------------------------------------------------
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[INANA GOLD] Server listening on http://0.0.0.0:${PORT}`);

    // Initial fetch on server start
    getOrUpdateGoldPrice(true).catch((err) => {
      console.warn('[INANA GOLD] Initial gold price fetch error:', err);
    });

    // Background scheduled fetch: query official live gold price every 1 hour (3600000 ms)
    const ONE_HOUR_MS = 60 * 60 * 1000;
    setInterval(async () => {
      console.log(`[INANA GOLD] Scheduled 1-hour price query triggered at: ${new Date().toISOString()}`);
      try {
        await getOrUpdateGoldPrice(true);
        console.log(`[INANA GOLD] 1-hour price update completed: ${currentGoldState.pricePerGram} Toman`);
      } catch (err) {
        console.error('[INANA GOLD] Scheduled hourly price query failed:', err);
      }
    }, ONE_HOUR_MS);
  });
}

startServer();
