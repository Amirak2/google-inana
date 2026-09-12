/**
 * Persian typography and number formatting utility for INANA GOLD
 */

const PERSIAN_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];

export function toPersianDigits(input: string | number | undefined | null): string {
  if (input === undefined || input === null) return '';
  const str = input.toString();
  return str.replace(/\d/g, (digit) => PERSIAN_DIGITS[parseInt(digit, 10)]);
}

/**
 * Format currency in Toman with Persian digits and separator: e.g. "۱۴,۸۵۰,۰۰۰ تومان"
 */
export function formatToman(amount: number | undefined | null, includeUnit: boolean = true): string {
  if (amount === undefined || amount === null || isNaN(amount)) {
    return includeUnit ? '۰ تومان' : '۰';
  }
  const rounded = Math.round(amount);
  const formattedEn = rounded.toLocaleString('en-US');
  const persianFormatted = toPersianDigits(formattedEn);
  return includeUnit ? `${persianFormatted} تومان` : persianFormatted;
}

/**
 * Format Gold Weight in grams and soot.
 * In Iranian gold market: 1 gram = 1000 soot (سوت).
 * e.g., 0.260g -> "۰.۲۶۰ گرم (۲۶۰ سوت)" or "۰.۲۶۰ گرم"
 */
export function formatWeight(grams: number | undefined | null, showSootDetail: boolean = false): string {
  if (grams === undefined || grams === null || isNaN(grams)) return '۰.۰۰۰ گرم';
  const val = Number(grams).toFixed(3);
  const persianVal = toPersianDigits(val);
  
  if (showSootDetail) {
    const wholeGrams = Math.floor(grams);
    const soot = Math.round((grams - wholeGrams) * 1000);
    if (wholeGrams === 0) {
      return `${persianVal} گرم (${toPersianDigits(soot)} سوت)`;
    }
    return `${persianVal} گرم (${toPersianDigits(wholeGrams)} گرم و ${toPersianDigits(soot)} سوت)`;
  }

  return `${persianVal} گرم`;
}

/**
 * Format percentages: e.g., +0.85% -> "▲ ۰.۸۵٪" or -1.2% -> "▼ ۱.۲۰٪"
 */
export function formatPercent(percent: number, showSignSymbol: boolean = true): string {
  const absVal = Math.abs(percent).toFixed(2);
  const persianAbs = toPersianDigits(absVal);
  if (!showSignSymbol) {
    return `${persianAbs}٪`;
  }
  if (percent > 0) {
    return `▲ +${persianAbs}٪`;
  } else if (percent < 0) {
    return `▼ -${persianAbs}٪`;
  }
  return `۰.۰۰٪`;
}

/**
 * Converts standard Gregorian or ISO timestamp to an Iranian Jalali date representation
 */
export function formatJalaliDateTime(isoOrDateString?: string | Date): string {
  const date = isoOrDateString ? new Date(isoOrDateString) : new Date();
  
  try {
    const formatter = new Intl.DateTimeFormat('fa-IR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    return formatter.format(date);
  } catch {
    // Fallback if Intl fa-IR not supported
    const hours = toPersianDigits(date.getHours().toString().padStart(2, '0'));
    const mins = toPersianDigits(date.getMinutes().toString().padStart(2, '0'));
    return `امروز - ${hours}:${mins}`;
  }
}

/**
 * Format pure time: e.g. "۱۹:۴۲"
 */
export function formatPersianTime(isoOrDateString?: string | Date): string {
  const date = isoOrDateString ? new Date(isoOrDateString) : new Date();
  const hours = toPersianDigits(date.getHours().toString().padStart(2, '0'));
  const mins = toPersianDigits(date.getMinutes().toString().padStart(2, '0'));
  return `${hours}:${mins}`;
}
