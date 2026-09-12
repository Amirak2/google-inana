import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
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

const USERS_FILE = path.join(process.cwd(), 'users_db.json');

// Persistent session secret saved in .session_secret or process.env.SESSION_SECRET
function getOrCreateSessionSecret(): string {
  if (process.env.SESSION_SECRET && process.env.SESSION_SECRET.trim().length >= 16) {
    return process.env.SESSION_SECRET.trim();
  }
  const secretFile = path.join(process.cwd(), '.session_secret');
  try {
    if (fs.existsSync(secretFile)) {
      const existing = fs.readFileSync(secretFile, 'utf-8').trim();
      if (existing.length >= 32) return existing;
    }
    const newSecret = crypto.randomBytes(32).toString('hex');
    fs.writeFileSync(secretFile, newSecret, { encoding: 'utf-8', mode: 0o600 });
    return newSecret;
  } catch {
    return 'inana_gold_secure_fallback_session_key_' + (process.pid || '1000');
  }
}

const SECRET_KEY = getOrCreateSessionSecret();
const PRIMARY_ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'admin@inanagold.ir').toLowerCase().trim();
const PRIMARY_ADMIN_PHONE = process.env.ADMIN_PHONE || '09120000000';
const PRIMARY_ADMIN_INIT_PASS = process.env.ADMIN_DEFAULT_PASSWORD || '';

// SMS OTP Provider Config
const SMS_OTP_URL = process.env.SMS_OTP_URL || 'https://s.api.ir/api/sw1/SmsOTP';
const SMS_OTP_API_KEY = process.env.SMS_OTP_API_KEY || '';

// In-memory cache
let usersCache: Map<string, StoredUser> = new Map();
const otpCache: Map<string, OtpRecord> = new Map();
const revokedTokensSet: Set<string> = new Set();
const phoneChangeOtpCache: Map<string, { newMobile: string; code: string; expiresAt: number; attempts: number }> = new Map();

// PBKDF2 Iteration constants: 100k standard, 10k backward compatibility
const CURRENT_ITERATIONS = 100000;
const LEGACY_ITERATIONS = 10000;

export function hashPassword(password: string, salt: string, iterations = CURRENT_ITERATIONS): string {
  return crypto.pbkdf2Sync(password, salt, iterations, 64, 'sha512').toString('hex');
}

// In-memory IP and endpoint rate limit tracker
interface RateLimitRecord {
  count: number;
  resetAt: number;
}
const rateLimits = new Map<string, RateLimitRecord>();

export function checkRateLimit(
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

export function normalizeIranianMobile(phone: string): string {
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

export function isValidIranianMobile(phone: string): boolean {
  const norm = normalizeIranianMobile(phone);
  return /^09\d{9}$/.test(norm);
}

function loadUsers(): void {
  try {
    if (fs.existsSync(USERS_FILE)) {
      const data = fs.readFileSync(USERS_FILE, 'utf-8');
      const list: StoredUser[] = JSON.parse(data);
      usersCache.clear();
      for (const u of list) {
        usersCache.set(u.email.toLowerCase().trim(), u);
      }
    }
  } catch (err) {
    console.error('[AUTH STORE] Error loading users_db.json:', err);
  }

  // Ensure default admin user template exists if not already registered
  const adminEmail = PRIMARY_ADMIN_EMAIL.toLowerCase().trim();
  if (!usersCache.has(adminEmail)) {
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
    saveUsers();
  }
}

let isSavingUsers = false;
let needsReSaveUsers = false;

async function saveUsersAsync(): Promise<void> {
  if (isSavingUsers) {
    needsReSaveUsers = true;
    return;
  }
  isSavingUsers = true;
  try {
    const list = Array.from(usersCache.values());
    const tmpFile = `${USERS_FILE}.tmp`;
    await fs.promises.writeFile(tmpFile, JSON.stringify(list, null, 2), 'utf-8');
    await fs.promises.rename(tmpFile, USERS_FILE);
  } catch (err) {
    console.error('[AUTH STORE] Error saving users_db.json:', err);
  } finally {
    isSavingUsers = false;
    if (needsReSaveUsers) {
      needsReSaveUsers = false;
      saveUsersAsync();
    }
  }
}

function saveUsers(): void {
  saveUsersAsync().catch((err) => console.error('[AUTH STORE] Background saveUsers error:', err));
}

// Initialize on boot
loadUsers();

export function createSessionToken(user: StoredUser): string {
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

export function revokeSessionToken(token: string): void {
  if (!token || typeof token !== 'string') return;
  revokedTokensSet.add(token.trim());
}

export function verifySessionToken(token: string): UserProfile | null {
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

export function sanitizeUser(u: StoredUser): UserProfile {
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

export function findUserByMobile(mobile: string): StoredUser | undefined {
  const norm = normalizeIranianMobile(mobile);
  if (!norm) return undefined;
  for (const u of usersCache.values()) {
    if (u.phoneNumber && normalizeIranianMobile(u.phoneNumber) === norm) {
      return u;
    }
  }
  return undefined;
}

export function registerUser(
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

export function loginUser(
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

export function updateUser(
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
  if (updates.phoneNumber !== undefined) {
    const rawPhone = updates.phoneNumber.trim();
    if (rawPhone) {
      const normPhone = normalizeIranianMobile(rawPhone);
      if (!isValidIranianMobile(normPhone)) {
        throw new Error('شماره همراه وارد شده نامعتبر است. فرمت صحیح: ۰۹۱۲۳۴۵۶۷۸۹');
      }
      const existingUser = findUserByMobile(normPhone);
      if (existingUser && existingUser.uid !== targetUser.uid) {
        throw new Error('این شماره همراه قبلاً در سیستم برای کاربر دیگری ثبت شده است.');
      }
      if (normPhone === normalizeIranianMobile(PRIMARY_ADMIN_PHONE) && targetUser.uid !== 'ina_admin_master') {
        throw new Error('این شماره همراه متعلق به مدیریت سیستم است.');
      }
      targetUser.phoneNumber = normPhone;
    } else {
      targetUser.phoneNumber = '';
    }
  }
  if (updates.address !== undefined) targetUser.address = updates.address.trim();
  targetUser.updatedAt = new Date().toISOString();

  saveUsers();
  return sanitizeUser(targetUser);
}

/**
 * Send SMS OTP via s.api.ir provider (with dev fallback and rate-limiting)
 */
export async function sendSmsOtpCode(mobile: string, clientIp?: string): Promise<{
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
    if (process.env.NODE_ENV === 'production') {
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
export function verifySmsOtpAndAuthenticate(
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

  // Check if user already exists
  let user = findUserByMobile(cleanMobile);
  let isNewUser = false;

  if (!user) {
    // Register new user with this mobile
    isNewUser = true;
    const isMasterAdmin = cleanMobile === normalizeIranianMobile(PRIMARY_ADMIN_PHONE);
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

/**
 * Sync Google Authenticated User with Server Session
 */
export function syncGoogleUser(googleUser: {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
}): { user: UserProfile; token: string } {
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
    if (isPrimaryAdmin && user.role !== 'admin') {
      user.role = 'admin';
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
export async function requestPhoneChangeOtp(
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
export function verifyPhoneChangeOtp(userId: string, code: string): UserProfile {
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
  targetUser.phoneNumber = pending.newMobile;
  targetUser.updatedAt = new Date().toISOString();
  saveUsers();

  phoneChangeOtpCache.delete(userId);
  return sanitizeUser(targetUser);
}

