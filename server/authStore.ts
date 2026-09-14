import crypto from 'crypto';
import type { Store } from './storage';
import firebaseConfig from '../firebase-applet-config.json';

import { UserProfile, UserRole } from '../src/types';

export interface StoredUser {
  uid: string;
  email: string;
  passwordHash?: string;
  salt?: string;
  displayName: string;
  phoneNumber?: string;
  role: UserRole;
  address?: string;
  createdAt: string;
  updatedAt?: string;
}

interface OtpRecord {
  mobile: string;
  code: string;
  expiresAt: number;
  attempts: number;
  createdAt: number;
}

export function createAuthStore(store: Store, env: Record<string, any>) {
const SECRET_KEY = env.SESSION_SECRET;
if (!SECRET_KEY || SECRET_KEY.length < 32) throw new Error('SESSION_SECRET is required');
const PRIMARY_ADMIN_EMAIL = (env.ADMIN_EMAIL || 'amirbiashad@gmail.com').toLowerCase().trim();
const PRIMARY_ADMIN_PHONE = env.ADMIN_PHONE || '09128481806';
const PRIMARY_ADMIN_INIT_PASS = env.ADMIN_DEFAULT_PASSWORD || '';

// Load Firebase Web API Key and Project config for cryptographically verifying Google/Firebase ID tokens
let FIREBASE_WEB_API_KEY = env.FIREBASE_WEB_API_KEY || '';
let FIREBASE_PROJECT_ID = env.FIREBASE_PROJECT_ID || '';
let FIREBASE_MESSAGING_SENDER_ID = env.FIREBASE_MESSAGING_SENDER_ID || '';
let FIREBASE_APP_ID = env.FIREBASE_APP_ID || '';
FIREBASE_WEB_API_KEY ||= firebaseConfig.apiKey;
FIREBASE_PROJECT_ID ||= firebaseConfig.projectId;
FIREBASE_MESSAGING_SENDER_ID ||= firebaseConfig.messagingSenderId;
FIREBASE_APP_ID ||= firebaseConfig.appId;
// SMS OTP Provider Config
const SMS_OTP_URL = env.SMS_OTP_URL || 'https://s.api.ir/api/sw1/SmsOTP';
const SMS_OTP_API_KEY = env.SMS_OTP_API_KEY || '';

// In-memory cache
let usersCache: Map<string, StoredUser> = store.map('users');
const otpCache: Map<string, OtpRecord> = store.map('otp');
const revokedTokensSet = store.tokenSet('revoked');
const phoneChangeOtpCache: Map<string, { newMobile: string; code: string; expiresAt: number; attempts: number }> = store.map('phoneOtp');

// PBKDF2 Iteration constants: 100k standard, 10k backward compatibility
const CURRENT_ITERATIONS = 100000;
const LEGACY_ITERATIONS = 10000;

function hashPassword(password: string, salt: string, iterations = CURRENT_ITERATIONS): string {
  return crypto.pbkdf2Sync(password, salt, iterations, 64, 'sha512').toString('hex');
}

// In-memory IP and endpoint rate limit tracker
interface RateLimitRecord {
  count: number;
  resetAt: number;
}
const rateLimits = store.map<RateLimitRecord>('rateLimits');

function checkRateLimit(
  key: string,
  maxAttempts: number,
  windowMs: number
): { allowed: boolean; remaining: number; retryAfterSeconds: number } {
  const now = Date.now();
  const record = rateLimits.get(key);
  if (!record || now > record.resetAt) {
    rateLimits.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: maxAttempts - 1, retryAfterSeconds: 0 };
  }
  if (record.count >= maxAttempts) {
    const retryAfter = Math.ceil((record.resetAt - now) / 1000);
    return { allowed: false, remaining: 0, retryAfterSeconds: retryAfter };
  }
  record.count += 1;
  return { allowed: true, remaining: maxAttempts - record.count, retryAfterSeconds: 0 };
}

function normalizeIranianMobile(phone: string): string {
  if (!phone) return '';
  // Convert Persian/Arabic digits to English
  let clean = phone
    .replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d).toString())
    .replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString())
    .replace(/\D/g, ''); // remove non-digits

  if (clean.startsWith('98')) {
    clean = '0' + clean.slice(2);
  } else if (clean.startsWith('+98')) {
    clean = '0' + clean.slice(3);
  } else if (clean.length === 10 && clean.startsWith('9')) {
    clean = '0' + clean;
  }

  return clean;
}

function isValidIranianMobile(phone: string): boolean {
  const norm = normalizeIranianMobile(phone);
  return /^09\d{9}$/.test(norm);
}

function loadUsers(): void {
  // Ensure default admin user template exists if not already registered
  const adminEmail = PRIMARY_ADMIN_EMAIL.toLowerCase().trim();
  let adminUser = usersCache.get(adminEmail);
  if (!adminUser) {
    const salt = crypto.randomBytes(16).toString('hex');
    const initialPass = PRIMARY_ADMIN_INIT_PASS;
    const defaultAdmin: StoredUser = {
      uid: 'ina_admin_master',
      email: adminEmail,
      passwordHash: initialPass ? hashPassword(initialPass, salt, CURRENT_ITERATIONS) : '',
      salt: initialPass ? salt : '',
      displayName: 'مدیریت ارشد اینانا گلد',
      role: 'admin',
      phoneNumber: PRIMARY_ADMIN_PHONE,
      address: 'دفتر مرکزی اینانا گلد',
      createdAt: new Date().toISOString(),
    };
    usersCache.set(adminEmail, defaultAdmin);
    adminUser = defaultAdmin;
  }

  // Keep Google, email/password and SMS login tied to one administrator record.
  // If this phone was previously used by another account, unlink it there first.
  const normalizedAdminPhone = normalizeIranianMobile(PRIMARY_ADMIN_PHONE);
  for (const [email, user] of usersCache) {
    if (
      email !== adminEmail &&
      user.phoneNumber &&
      normalizeIranianMobile(user.phoneNumber) === normalizedAdminPhone
    ) {
      user.phoneNumber = '';
      user.updatedAt = new Date().toISOString();
    }
  }
  if (adminUser.role !== 'admin' || adminUser.phoneNumber !== normalizedAdminPhone) {
    adminUser.role = 'admin';
    adminUser.phoneNumber = normalizedAdminPhone;
    adminUser.updatedAt = new Date().toISOString();
  }
  saveUsers();
}

// Mutations are committed durably before the HTTP response is released.
function saveUsers(): void {}
// Initialize on boot
loadUsers();

function createSessionToken(user: StoredUser): string {
  const payload = Buffer.from(
    JSON.stringify({
      uid: user.uid,
      email: user.email,
      role: user.role,
      phoneNumber: user.phoneNumber,
      exp: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days
    })
  ).toString('base64url');

  const signature = crypto.createHmac('sha256', SECRET_KEY).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

function revokeSessionToken(token: string): void {
  if (!token || typeof token !== 'string') return;
  revokedTokensSet.add(token.trim());
}

function verifySessionToken(token: string): UserProfile | null {
  try {
    if (!token || typeof token !== 'string') return null;
    const cleanToken = token.trim();
    if (revokedTokensSet.has(cleanToken)) return null;

    const parts = cleanToken.split('.');
    if (parts.length !== 2) return null;
    const [payloadB64, signature] = parts;
    if (!payloadB64 || !signature) return null;

    const expectedSig = crypto.createHmac('sha256', SECRET_KEY).update(payloadB64).digest('base64url');
    
    // Constant-time HMAC comparison to prevent timing attacks
    const expBuf = Buffer.from(expectedSig);
    const sigBuf = Buffer.from(signature);
    if (expBuf.length !== sigBuf.length || !crypto.timingSafeEqual(expBuf, sigBuf)) {
      return null;
    }

    const data = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf-8'));
    if (typeof data.exp !== 'number' || data.exp < Date.now()) return null;

    const user = usersCache.get(data.email?.toLowerCase().trim());
    if (!user) return null;

    return sanitizeUser(user);
  } catch {
    return null;
  }
}

function sanitizeUser(u: StoredUser): UserProfile {
  // Only designated master admin UID or explicit stored role in database is admin.
  // Never elevate role to admin based solely on phone number!
  const isAdmin = u.uid === 'ina_admin_master' || u.role === 'admin';
  return {
    uid: u.uid,
    email: u.email,
    displayName: u.displayName,
    phoneNumber: u.phoneNumber || '',
    role: isAdmin ? 'admin' : 'customer',
    address: u.address || '',
    createdAt: u.createdAt,
    updatedAt: u.updatedAt,
  };
}

function findUserByMobile(mobile: string): StoredUser | undefined {
  const norm = normalizeIranianMobile(mobile);
  if (!norm) return undefined;
  for (const u of usersCache.values()) {
    if (u.phoneNumber && normalizeIranianMobile(u.phoneNumber) === norm) {
      return u;
    }
  }
  return undefined;
}

function registerUser(
  email: string,
  pass: string,
  displayName: string,
  phoneNumber?: string
): { user: UserProfile; token: string } {
  const cleanEmail = email.toLowerCase().trim();
  if (!cleanEmail || !cleanEmail.includes('@')) {
    throw new Error('فرمت آدرس ایمیل معتبر نمی‌باشد.');
  }
  if (!pass || pass.length < 6) {
    throw new Error('کلمه عبور باید حداقل ۶ کاراکتر باشد.');
  }
  if (!displayName || !displayName.trim()) {
    throw new Error('لطفاً نام و نام خانوادگی خود را وارد نمایید.');
  }

  // Prevent registration with primary admin email
  if (cleanEmail === PRIMARY_ADMIN_EMAIL.toLowerCase().trim()) {
    throw new Error('این آدرس ایمیل متعلق به مدیریت سیستم است. لطفاً از طریق فرم ورود اقدام فرمایید.');
  }

  if (usersCache.has(cleanEmail)) {
    throw new Error('این آدرس ایمیل قبلاً در سیستم ثبت‌نام کرده است. لطفاً وارد شوید.');
  }

  const normPhone = phoneNumber ? normalizeIranianMobile(phoneNumber) : '';
  if (normPhone) {
    if (normPhone === normalizeIranianMobile(PRIMARY_ADMIN_PHONE)) {
      throw new Error('این شماره همراه متعلق به مدیریت سیستم است.');
    }
    const existingPhone = findUserByMobile(normPhone);
    if (existingPhone) {
      throw new Error('این شماره همراه قبلاً در سیستم ثبت‌نام شده است.');
    }
  }

  const salt = crypto.randomBytes(16).toString('hex');
  const passwordHash = hashPassword(pass, salt, CURRENT_ITERATIONS);

  // New registrations are strictly customer role
  const newUser: StoredUser = {
    uid: `ina_usr_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
    email: cleanEmail,
    passwordHash,
    salt,
    displayName: displayName.trim(),
    phoneNumber: normPhone || phoneNumber?.trim() || '',
    role: 'customer',
    address: '',
    createdAt: new Date().toISOString(),
  };

  usersCache.set(cleanEmail, newUser);
  saveUsers();

  const token = createSessionToken(newUser);
  return { user: sanitizeUser(newUser), token };
}

function loginUser(
  email: string,
  pass: string
): { user: UserProfile; token: string } {
  const cleanEmail = email.toLowerCase().trim();
  const user = usersCache.get(cleanEmail);

  if (!user) {
    throw new Error('ایمیل یا کلمه عبور وارد شده نادرست است.');
  }

  if (!user.passwordHash || !user.salt) {
    throw new Error('برای این حساب کاربری رمز عبور تعریف نشده است. لطفاً با کد تایید پیامکی (OTP) وارد شوید.');
  }

  const inputHash = hashPassword(pass, user.salt, CURRENT_ITERATIONS);
  let isMatch = (inputHash === user.passwordHash);

  // Backward compatibility: check 10,000 legacy iterations and auto-upgrade to 100,000
  if (!isMatch && user.passwordHash) {
    const legacyHash = hashPassword(pass, user.salt, LEGACY_ITERATIONS);
    if (legacyHash === user.passwordHash) {
      isMatch = true;
      user.passwordHash = inputHash; // upgrade hash
      saveUsers();
    }
  }

  if (!isMatch) {
    throw new Error('ایمیل یا کلمه عبور وارد شده نادرست است.');
  }

  // Ensure role is admin if it's the primary admin email
  if (cleanEmail === PRIMARY_ADMIN_EMAIL.toLowerCase().trim() && user.role !== 'admin') {
    user.role = 'admin';
    saveUsers();
  }

  const token = createSessionToken(user);
  return { user: sanitizeUser(user), token };
}

function updateUser(
  uid: string,
  updates: Partial<UserProfile>
): UserProfile {
  let targetUser: StoredUser | undefined;
  for (const u of usersCache.values()) {
    if (u.uid === uid) {
      targetUser = u;
      break;
    }
  }

  if (!targetUser) {
    throw new Error('کاربر مورد نظر یافت نشد.');
  }

  if (updates.displayName !== undefined) targetUser.displayName = updates.displayName.trim();
  
  // Issue #6 Fix: Bypassing SMS OTP for phone change is strictly prevented.
  // Direct modification of phoneNumber is prohibited.
  if (updates.phoneNumber !== undefined && updates.phoneNumber.trim() !== (targetUser.phoneNumber || '')) {
    throw new Error('تغییر شماره همراه صرفاً از طریق تایید پیامکی (OTP) در بخش تغییر شماره امکان‌پذیر است و امکان تغییر مستقیم آن وجود ندارد.');
  }

  if (updates.address !== undefined) targetUser.address = updates.address.trim();
  targetUser.updatedAt = new Date().toISOString();

  saveUsers();
  return sanitizeUser(targetUser);
}

/**
 * Send SMS OTP via s.api.ir provider (with dev fallback and rate-limiting)
 */
async function sendSmsOtpCode(mobile: string, clientIp?: string): Promise<{
  expiresInSeconds: number;
  isRegistered: boolean;
  isDevelopmentSimulation?: boolean;
}> {
  const cleanMobile = normalizeIranianMobile(mobile);
  if (!isValidIranianMobile(cleanMobile)) {
    throw new Error('شماره موبایل وارد شده نامعتبر است. شماره باید ۱۱ رقمی و با ۰۹ شروع شود.');
  }

  // Rate limit: max 5 OTP requests per 10 minutes per mobile
  const rateLimitPhone = checkRateLimit(`otp_phone_${cleanMobile}`, 5, 10 * 60 * 1000);
  if (!rateLimitPhone.allowed) {
    throw new Error(`تعداد درخواست‌های کد تایید بیش از حد مجاز است. لطفاً ${rateLimitPhone.retryAfterSeconds} ثانیه دیگر مجدداً تلاش فرمایید.`);
  }

  // Rate limit: max 10 OTP requests per 10 minutes per IP
  if (clientIp) {
    const rateLimitIp = checkRateLimit(`otp_ip_${clientIp}`, 10, 10 * 60 * 1000);
    if (!rateLimitIp.allowed) {
      throw new Error(`درخواست‌های مجاز از این آدرس اینترنتی تکمیل گردید. لطفاً ${rateLimitIp.retryAfterSeconds} ثانیه دیگر شکیبا باشید.`);
    }
  }

  // Rate-limiting: Don't allow resending within 60 seconds
  const existing = otpCache.get(cleanMobile);
  const now = Date.now();
  if (existing && now - existing.createdAt < 60 * 1000) {
    const waitSeconds = Math.ceil((60 * 1000 - (now - existing.createdAt)) / 1000);
    throw new Error(`لطفاً ${waitSeconds} ثانیه دیگر جهت درخواست مجدد کد تایید شکیبا باشید.`);
  }

  // Generate 5-digit cryptographically secure OTP code
  const otpNumber = crypto.randomInt(10000, 99999);
  const otpCode = otpNumber.toString();

  // If SMS_OTP_API_KEY is configured, dispatch SMS to provider
  const hasApiKey = Boolean(SMS_OTP_API_KEY && SMS_OTP_API_KEY.trim());
  if (hasApiKey) {
    const bearerHeader = SMS_OTP_API_KEY.startsWith('Bearer ')
      ? SMS_OTP_API_KEY
      : `Bearer ${SMS_OTP_API_KEY}`;

    console.log(`[SMS OTP] Sending OTP to ${cleanMobile} via ${SMS_OTP_URL}...`);

    try {
      const response = await fetch(SMS_OTP_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: bearerHeader,
        },
        body: JSON.stringify({
          code: otpCode,
          mobile: cleanMobile,
          template: 1,
        }),
        signal: AbortSignal.timeout(7000),
      });

      const responseText = await response.text();
      console.log(`[SMS OTP] Provider HTTP status: ${response.status}`);

      if (!response.ok) {
        console.error(`[SMS OTP] Provider error: HTTP ${response.status} - ${responseText}`);
        throw new Error(`ارسال پیامک با خطا مواجه شد (کد پاسخ سامانه: ${response.status}).`);
      }
    } catch (err: any) {
      console.error('[SMS OTP] Network or provider failure:', err);
      throw new Error(err.message || 'خطا در برقراری ارتباط با سرور پیامک.');
    }
  } else {
    // Check if running in production environment
    if (env.NODE_ENV === 'production') {
      console.error('[SMS OTP] Error: SMS_OTP_API_KEY environment variable is not configured in production.');
      throw new Error('سرویس پیامک در سرور پیکربندی نشده است. لطفاً متغیر محیطی SMS_OTP_API_KEY را تنظیم فرمایید.');
    }
    // In dev / test environments, log code clearly for debugging
    console.warn(`[SMS OTP DEV] No SMS_OTP_API_KEY configured. Development test code for ${cleanMobile} is: ${otpCode}`);
  }

  // Store code in OTP cache for 3 minutes (180 seconds)
  otpCache.set(cleanMobile, {
    mobile: cleanMobile,
    code: otpCode,
    expiresAt: now + 180 * 1000,
    attempts: 0,
    createdAt: now,
  });

  const existingUser = findUserByMobile(cleanMobile);

  return {
    expiresInSeconds: 180,
    isRegistered: Boolean(existingUser),
    isDevelopmentSimulation: !hasApiKey,
  };
}

/**
 * Verify SMS OTP Code and Login or Register
 */
function verifySmsOtpAndAuthenticate(
  mobile: string,
  code: string,
  displayName?: string
): { user: UserProfile; token: string; isNewUser: boolean } {
  const cleanMobile = normalizeIranianMobile(mobile);
  const cleanCode = (code || '').trim().replace(/\D/g, '');

  if (!isValidIranianMobile(cleanMobile)) {
    throw new Error('شماره موبایل نامعتبر است.');
  }

  if (!cleanCode || cleanCode.length < 4) {
    throw new Error('کد تایید وارد شده نامعتبر است.');
  }

  const record = otpCache.get(cleanMobile);
  const now = Date.now();

  if (!record) {
    throw new Error('کد تاییدی برای این شماره ثبت نشده یا منقضی شده است. لطفاً مجدداً درخواست ارسال کد دهید.');
  }

  if (now > record.expiresAt) {
    otpCache.delete(cleanMobile);
    throw new Error('کد تایید منقضی شده است. لطفاً کد جدیدی دریافت کنید.');
  }

  if (record.attempts >= 5) {
    otpCache.delete(cleanMobile);
    throw new Error('تعداد تلاش‌های ناموفق بیش از حد مجاز بود. لطفاً کد جدید دریافت نمایید.');
  }

  if (record.code !== cleanCode) {
    record.attempts += 1;
    const remainingAttempts = 5 - record.attempts;
    throw new Error(`کد تایید اشتباه است. (${remainingAttempts} تلاش دیگر باقی مانده)`);
  }

  // OTP is correct! Clear it from cache
  otpCache.delete(cleanMobile);

  const isMasterAdmin = cleanMobile === normalizeIranianMobile(PRIMARY_ADMIN_PHONE);

  // The designated admin phone always resolves to the same email-backed account.
  let user = isMasterAdmin
    ? usersCache.get(PRIMARY_ADMIN_EMAIL.toLowerCase().trim())
    : findUserByMobile(cleanMobile);
  let isNewUser = false;

  if (!user) {
    // Register new user with this mobile
    isNewUser = true;
    const defaultEmail = `${cleanMobile}@inanagold.ir`;

    user = {
      uid: isMasterAdmin ? 'ina_admin_master' : `ina_usr_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
      email: isMasterAdmin ? PRIMARY_ADMIN_EMAIL : defaultEmail,
      displayName: displayName?.trim() || `کاربر ${cleanMobile.slice(-4)}`,
      phoneNumber: cleanMobile,
      role: isMasterAdmin ? 'admin' : 'customer',
      address: '',
      createdAt: new Date().toISOString(),
    };

    usersCache.set(user.email.toLowerCase(), user);
    saveUsers();
  } else {
    if (isMasterAdmin) {
      user.role = 'admin';
      user.phoneNumber = cleanMobile;
      user.updatedAt = new Date().toISOString();
      saveUsers();
    }
    // Existing user: if displayName was supplied and user didn't have a good name, update it
    if (displayName && displayName.trim() && user.displayName.startsWith('کاربر ')) {
      user.displayName = displayName.trim();
      user.updatedAt = new Date().toISOString();
      saveUsers();
    }
  }

  const token = createSessionToken(user);
  return {
    user: sanitizeUser(user),
    token,
    isNewUser,
  };
}

interface VerifiedGoogleUser {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  emailVerified: boolean;
}

/**
 * Cryptographically verify Firebase ID token or Google OAuth ID token on server.
 * Ensures the client cannot forge user identities, use tokens from other apps, or bypass email verification.
 */
async function verifyGoogleOrFirebaseToken(idToken: string): Promise<VerifiedGoogleUser> {
  const token = (idToken || '').trim();
  if (!token || token.length < 20) {
    throw new Error('توکن امنیتی گوگل یا فایربیس ارائه نشده یا نامعتبر است.');
  }

  // 1. Verify via Firebase Identity Toolkit (official verification with Project API Key)
  if (FIREBASE_WEB_API_KEY) {
    try {
      const lookupEndpoint = `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_WEB_API_KEY}`;
      const resp = await fetch(lookupEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: token }),
        signal: AbortSignal.timeout(8000),
      });

      if (resp.ok) {
        const data = await resp.json();
        if (data.users && Array.isArray(data.users) && data.users.length > 0) {
          const u = data.users[0];
          if (!u.email) {
            throw new Error('حساب کاربری گوگل فاقد ایمیل معتبر می‌باشد.');
          }

          // Strict Requirement 1: Enforce that email is verified by Google before allowing access
          const isVerified = Boolean(u.emailVerified);
          if (!isVerified) {
            throw new Error('ایمیل حساب گوگل تأیید نشده است (email_verified=false). اتصال به حساب یا ورود نیازمند تأیید مالکیت ایمیل است.');
          }

          return {
            uid: u.localId,
            email: String(u.email).toLowerCase().trim(),
            displayName: u.displayName || '',
            photoURL: u.photoUrl || '',
            emailVerified: true,
          };
        }
      }
    } catch (err: any) {
      if (err.message && err.message.includes('تأیید نشده است')) {
        throw err;
      }
      console.warn('[AUTH] Firebase accounts:lookup verification notice:', err?.message || err);
    }
  }

  // 2. Fallback: Google OAuth2 tokeninfo endpoint with strict Audience (aud) validation
  try {
    const googleTokenInfoUrl = `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(token)}`;
    const gResp = await fetch(googleTokenInfoUrl, {
      signal: AbortSignal.timeout(8000),
    });

    if (gResp.ok) {
      const gData = await gResp.json();
      if (gData.email) {
        // Strict Requirement: Exact equality matching against allowed application/project client IDs
        // Loose substring matching (like .includes) is strictly prohibited to prevent cross-app token spoofing
        const tokenAud = String(gData.aud || '').trim();
        const validAudiences = [
          FIREBASE_PROJECT_ID,
          FIREBASE_APP_ID,
          env.GOOGLE_CLIENT_ID,
        ].filter(Boolean) as string[];

        const isAudValid = validAudiences.some((aud) => tokenAud === aud);

        if (!isAudValid) {
          throw new Error('مخاطب توکن گوگل (aud) با شناسه این برنامه مطابقت ندارد و توکن برای برنامه دیگری صادر شده است.');
        }

        // Strict Requirement 1: Require email_verified === true
        const isEmailVerified = gData.email_verified === 'true' || gData.email_verified === true;
        if (!isEmailVerified) {
          throw new Error('ایمیل حساب گوگل تأیید نشده است (email_verified=false). ورود یا اتصال به حساب تنها با ایمیل‌های تأییدشده ممکن است.');
        }

        return {
          uid: gData.sub || `g_${Date.now()}`,
          email: String(gData.email).toLowerCase().trim(),
          displayName: gData.name || '',
          photoURL: gData.picture || '',
          emailVerified: true,
        };
      }
    }
  } catch (err: any) {
    if (err.message && (err.message.includes('مطابقت ندارد') || err.message.includes('تأیید نشده است'))) {
      throw err;
    }
    console.warn('[AUTH] Google oauth2:tokeninfo check notice:', err?.message || err);
  }

  throw new Error('اعتبارسنجی توکن گوگل با شکست مواجه شد. توکن نامعتبر، جعلی یا منقضی شده است.');
}

/**
 * Sync Google Authenticated User with Server Session
 * Strictly enforces email verification before linking to or creating any account.
 */
function syncGoogleUser(googleUser: {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  emailVerified: boolean;
}): { user: UserProfile; token: string } {
  if (!googleUser.emailVerified) {
    throw new Error('تأیید مالکیت ایمیل توسط گوگل الزامی است. ایمیل این حساب تأیید نشده است.');
  }

  const cleanEmail = googleUser.email.toLowerCase().trim();
  if (!cleanEmail || !cleanEmail.includes('@')) {
    throw new Error('فرمت ایمیل گوگل نامعتبر است.');
  }

  let user = usersCache.get(cleanEmail);
  const isPrimaryAdmin = cleanEmail === PRIMARY_ADMIN_EMAIL.toLowerCase().trim();

  if (!user) {
    user = {
      uid: googleUser.uid || `ina_usr_g_${Date.now()}`,
      email: cleanEmail,
      displayName: googleUser.displayName?.trim() || cleanEmail.split('@')[0],
      role: isPrimaryAdmin ? 'admin' : 'customer',
      phoneNumber: '',
      address: '',
      createdAt: new Date().toISOString(),
    };
    usersCache.set(cleanEmail, user);
    saveUsers();
  } else {
    // If user exists, upgrade to admin if email matches primary admin
    if (isPrimaryAdmin && (user.role !== 'admin' || user.phoneNumber !== normalizeIranianMobile(PRIMARY_ADMIN_PHONE))) {
      user.role = 'admin';
      user.phoneNumber = normalizeIranianMobile(PRIMARY_ADMIN_PHONE);
      user.updatedAt = new Date().toISOString();
      saveUsers();
    }
    if (googleUser.displayName && (!user.displayName || user.displayName.startsWith('کاربر '))) {
      user.displayName = googleUser.displayName.trim();
      saveUsers();
    }
  }

  const token = createSessionToken(user);
  return {
    user: sanitizeUser(user),
    token,
  };
}

/**
 * Request OTP to change phone number
 */
async function requestPhoneChangeOtp(
  userId: string,
  newMobile: string
): Promise<{ expiresInSeconds: number; isDevelopmentSimulation?: boolean }> {
  let targetUser: StoredUser | undefined;
  for (const u of usersCache.values()) {
    if (u.uid === userId) {
      targetUser = u;
      break;
    }
  }
  if (!targetUser) throw new Error('کاربر یافت نشد.');

  const cleanMobile = normalizeIranianMobile(newMobile);
  if (!isValidIranianMobile(cleanMobile)) {
    throw new Error('شماره موبایل جدید نامعتبر است. شماره باید ۱۱ رقمی و با ۰۹ شروع شود.');
  }

  const existing = findUserByMobile(cleanMobile);
  if (existing && existing.uid !== targetUser.uid) {
    throw new Error('این شماره همراه قبلاً برای کاربر دیگری در سامانه ثبت شده است.');
  }

  if (cleanMobile === normalizeIranianMobile(PRIMARY_ADMIN_PHONE) && targetUser.uid !== 'ina_admin_master') {
    throw new Error('این شماره همراه متعلق به مدیریت سیستم است.');
  }

  // Send OTP
  const result = await sendSmsOtpCode(cleanMobile);

  phoneChangeOtpCache.set(userId, {
    newMobile: cleanMobile,
    code: otpCache.get(cleanMobile)?.code || '',
    expiresAt: Date.now() + 180 * 1000,
    attempts: 0,
  });

  return {
    expiresInSeconds: result.expiresInSeconds,
    isDevelopmentSimulation: result.isDevelopmentSimulation,
  };
}

/**
 * Verify OTP to complete phone number change
 */
function verifyPhoneChangeOtp(userId: string, code: string): UserProfile {
  let targetUser: StoredUser | undefined;
  for (const u of usersCache.values()) {
    if (u.uid === userId) {
      targetUser = u;
      break;
    }
  }
  if (!targetUser) throw new Error('کاربر یافت نشد.');

  const pending = phoneChangeOtpCache.get(userId);
  if (!pending) {
    throw new Error('درخواست تغییر شماره‌ای ثبت نشده یا زمان آن منقضی شده است.');
  }

  if (Date.now() > pending.expiresAt) {
    phoneChangeOtpCache.delete(userId);
    throw new Error('کد تایید منقضی شده است.');
  }

  if (pending.attempts >= 5) {
    phoneChangeOtpCache.delete(userId);
    throw new Error('تعداد تلاش‌های ناموفق بیش از حد مجاز بود.');
  }

  if (pending.code !== code.trim()) {
    pending.attempts += 1;
    throw new Error(`کد تایید اشتباه است. (${5 - pending.attempts} تلاش دیگر باقی مانده)`);
  }

  // Code is verified: update user phone number
  const owner = findUserByMobile(pending.newMobile);
  if ((owner && owner.uid !== targetUser.uid) ||
      (pending.newMobile === normalizeIranianMobile(PRIMARY_ADMIN_PHONE) &&
       targetUser.email.toLowerCase().trim() !== PRIMARY_ADMIN_EMAIL)) {
    phoneChangeOtpCache.delete(userId);
    throw new Error('این شماره همراه به حساب دیگری متصل است.');
  }
  otpCache.delete(pending.newMobile);
  targetUser.phoneNumber = pending.newMobile;
  targetUser.updatedAt = new Date().toISOString();
  saveUsers();

  phoneChangeOtpCache.delete(userId);
  return sanitizeUser(targetUser);
}


return { hashPassword, checkRateLimit, normalizeIranianMobile, isValidIranianMobile, createSessionToken, revokeSessionToken, verifySessionToken, sanitizeUser, findUserByMobile, registerUser, loginUser, updateUser, sendSmsOtpCode, verifySmsOtpAndAuthenticate, verifyGoogleOrFirebaseToken, syncGoogleUser, requestPhoneChangeOtp, verifyPhoneChangeOtp };
}
