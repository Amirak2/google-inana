/**
 * Server-side Input Validation Helpers
 * Enforces strict boundary checks and sanitization across all API endpoints.
 */

export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

export function validateString(
  value: unknown,
  fieldName: string,
  minLen = 1,
  maxLen = 255
): { isValid: boolean; value: string; error?: string } {
  if (typeof value !== 'string') {
    return { isValid: false, value: '', error: `فیلد ${fieldName} باید متنی معتبر باشد.` };
  }
  const trimmed = value.trim();
  if (trimmed.length < minLen) {
    return { isValid: false, value: trimmed, error: `فیلد ${fieldName} باید حداقل حاوی ${minLen} نویسه باشد.` };
  }
  if (trimmed.length > maxLen) {
    return { isValid: false, value: trimmed, error: `فیلد ${fieldName} نمی‌تواند بیش از ${maxLen} نویسه باشد.` };
  }
  return { isValid: true, value: trimmed };
}

export function validatePositiveNumber(
  value: unknown,
  fieldName: string,
  min = 0.001,
  max = 10_000_000_000
): { isValid: boolean; value: number; error?: string } {
  const num = Number(value);
  if (isNaN(num) || !isFinite(num)) {
    return { isValid: false, value: 0, error: `مقدار فیلد ${fieldName} باید یک عدد معتبر باشد.` };
  }
  if (num < min) {
    return { isValid: false, value: num, error: `مقدار ${fieldName} نمی‌تواند کمتر از ${min} باشد.` };
  }
  if (num > max) {
    return { isValid: false, value: num, error: `مقدار ${fieldName} نمی‌تواند بیشتر از ${max} باشد.` };
  }
  return { isValid: true, value: num };
}

export function validateInteger(
  value: unknown,
  fieldName: string,
  min = 0,
  max = 1_000_000
): { isValid: boolean; value: number; error?: string } {
  const num = Number(value);
  if (isNaN(num) || !isFinite(num) || !Number.isInteger(num)) {
    return { isValid: false, value: 0, error: `مقدار فیلد ${fieldName} باید یک عدد صحیح معتبر باشد.` };
  }
  if (num < min || num > max) {
    return { isValid: false, value: num, error: `مقدار ${fieldName} باید بین ${min} و ${max} باشد.` };
  }
  return { isValid: true, value: num };
}

export function validatePercentOrNull(
  value: unknown,
  fieldName: string,
  min = 0,
  max = 100
): { isValid: boolean; value: number | null; error?: string } {
  if (value === null || value === undefined || value === '') {
    return { isValid: true, value: null };
  }
  const num = Number(value);
  if (isNaN(num) || !isFinite(num)) {
    return { isValid: false, value: null, error: `درصد ${fieldName} باید عددی معتبر باشد.` };
  }
  if (num < min || num > max) {
    return { isValid: false, value: null, error: `درصد ${fieldName} باید بین ${min}٪ و ${max}٪ باشد.` };
  }
  return { isValid: true, value: num };
}

export function validatePhoneNumber(phone: unknown): { isValid: boolean; phone: string; error?: string } {
  if (typeof phone !== 'string') {
    return { isValid: false, phone: '', error: 'شماره تماس باید یک مقدار متنی باشد.' };
  }
  const cleaned = phone.replace(/[\s\-\+]/g, '');
  // Matches standard Iranian numbers: 09xxxxxxxxx or international formats
  const iranRegex = /^09[0-9]{9}$/;
  const generalRegex = /^[0-9]{10,15}$/;
  if (!iranRegex.test(cleaned) && !generalRegex.test(cleaned)) {
    return { isValid: false, phone: cleaned, error: 'شماره همراه وارد شده نامعتبر است (مثال: ۰۹۱۲۳۴۵۶۷۸۹).' };
  }
  return { isValid: true, phone: cleaned };
}

export function validateEmail(email: unknown): { isValid: boolean; value: string; error?: string } {
  if (typeof email !== 'string') {
    return { isValid: false, value: '', error: 'ایمیل باید متنی معتبر باشد.' };
  }
  const trimmed = email.trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmed) || trimmed.length > 100) {
    return { isValid: false, value: trimmed, error: 'فرمت آدرس ایمیل وارد شده نامعتبر است.' };
  }
  return { isValid: true, value: trimmed };
}

export function validatePassword(password: unknown): { isValid: boolean; value: string; error?: string } {
  if (typeof password !== 'string') {
    return { isValid: false, value: '', error: 'کلمه عبور باید متنی معتبر باشد.' };
  }
  if (password.length < 6) {
    return { isValid: false, value: password, error: 'کلمه عبور باید حداقل ۶ نویسه داشته باشد.' };
  }
  if (password.length > 128) {
    return { isValid: false, value: password, error: 'کلمه عبور نمی‌تواند بیش از ۱۲۸ نویسه باشد.' };
  }
  return { isValid: true, value: password };
}
