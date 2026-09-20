import { CalculatedPriceBreakdown, PricingSettings, Product } from '../types';

export const DEFAULT_SETTINGS: PricingSettings = {
  globalMakingChargePercent: 20, // 20%
  profitPercent: 7, // 7%
  taxPercent: 0,
  fixedCost: 0,
  autoSyncIntervalMinutes: 60,
  storePhone: '09909622895',
  storeTelegram: 'estella_shopee',
  storeInstagram: 'inanagold.ir',
  storeAddress: 'فروشگاه انحصاری آنلاین اینانا گلد - مرکز پردازش و ارسال پستی بیمه‌شده طلای تهران',
  bankCardNumber: '۶۰۳۷-۹۹۱۸-۴۲۱۰-۸۸۷۶',
  bankCardHolder: 'امیر بی‌اشد (گالری طلای اینانا)',
  bankName: 'بانک ملی ایران (شعبه تجریش)',
  bankSheba: 'IR-120170000000108876543210',
};

/**
 * Centralized Single Source of Truth for INANA GOLD price calculation.
 * Ensures consistent pricing across storefront, product details, cart, checkout, and admin.
 */
export function calculateProductPrice(
  product: Partial<Product>,
  goldPricePerGram: number,
  settings: PricingSettings = DEFAULT_SETTINGS
): CalculatedPriceBreakdown {
  const weight = product.weight || 0;
  const currentGoldPrice = goldPricePerGram > 0 ? goldPricePerGram : 14850000;

  // 1. Base Gold Value: gold_price_per_gram × product_weight
  const baseGoldValue = currentGoldPrice * weight;

  // 2. Making Charge (اجرت ساخت):
  // Check product-specific making charge first, otherwise fallback to global setting
  const effectiveMakingChargePercent =
    product.customMakingChargePercent !== undefined &&
    product.customMakingChargePercent !== null &&
    !isNaN(product.customMakingChargePercent)
      ? Number(product.customMakingChargePercent)
      : (settings.globalMakingChargePercent ?? 20);

  const makingChargeAmount = baseGoldValue * (effectiveMakingChargePercent / 100);

  // 3. Profit (سود فروشنده):
  // Supports 0% profit without reverting to default
  const profitPercent =
    product.customProfitPercent !== undefined &&
    product.customProfitPercent !== null &&
    !isNaN(product.customProfitPercent)
      ? Number(product.customProfitPercent)
      : (settings.profitPercent ?? 7);

  // Standard Iran Gold Union calculation: Profit applies to (Base Gold + Making Charge)
  const profitAmount = (baseGoldValue + makingChargeAmount) * (profitPercent / 100);

  // Tax is intentionally disabled for every storefront and checkout calculation.
  const taxPercent = 0;
  const taxAmount = 0;

  // 5. Additional Costs & Stone/Gem value:
  const stoneCost = product.stoneCost ?? 0;
  const additionalCosts = (product.additionalCost ?? 0) + (settings.fixedCost ?? 0);

  // 6. Subtotal before discount:
  const rawSubtotal =
    baseGoldValue + makingChargeAmount + profitAmount + taxAmount + additionalCosts + stoneCost;

  // 7. Discount:
  const discountPercent = product.discountPercent || 0;
  const discountAmount = rawSubtotal * (discountPercent / 100);

  // 8. Final Price:
  const rawFinalPrice = rawSubtotal - discountAmount;

  // Round to nearest 1,000 Toman for clean luxury presentation
  const finalPrice = Math.round(rawFinalPrice / 1000) * 1000;

  return {
    baseGoldValue: Math.round(baseGoldValue),
    effectiveMakingChargePercent,
    makingChargeAmount: Math.round(makingChargeAmount),
    profitPercent,
    profitAmount: Math.round(profitAmount),
    taxPercent,
    taxAmount: Math.round(taxAmount),
    additionalCosts,
    stoneCost,
    discountPercent,
    discountAmount: Math.round(discountAmount),
    finalPrice,
    rawFinalPrice,
  };
}

/**
 * Public Gold Calculator engine for custom inputs
 */
export function calculateCustomGoldQuotation(
  weightGrams: number,
  goldPricePerGram: number,
  makingChargePercent: number,
  profitPercent: number = 7,
  _taxPercent: number = 0,
  discountPercent: number = 0,
  additionalCost: number = 0
) {
  const baseGoldValue = goldPricePerGram * (weightGrams || 0);
  const makingChargeAmount = baseGoldValue * ((makingChargePercent || 0) / 100);
  const profitAmount = (baseGoldValue + makingChargeAmount) * ((profitPercent || 0) / 100);
  const taxAmount = 0;
  const subtotal = baseGoldValue + makingChargeAmount + profitAmount + (additionalCost || 0);
  const discountAmount = subtotal * ((discountPercent || 0) / 100);
  const finalPrice = Math.round((subtotal - discountAmount) / 1000) * 1000;

  return {
    baseGoldValue: Math.round(baseGoldValue),
    makingChargeAmount: Math.round(makingChargeAmount),
    profitAmount: Math.round(profitAmount),
    taxAmount: Math.round(taxAmount),
    subtotal: Math.round(subtotal),
    discountAmount: Math.round(discountAmount),
    finalPrice,
  };
}
