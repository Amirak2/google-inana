import { normalizeCatalogFilters } from './catalogFilters';

export const PAGE_TABS = ['home', 'shop', 'gold-price', 'collections', 'favorites', 'about', 'contact', 'admin'];
export const ADMIN_TABS = ['direct-pricing', 'products', 'gold-rate', 'calculator', 'orders', 'logs'] as const;
export type AdminTab = typeof ADMIN_TABS[number];
export const NAVIGATION_KEY = 'inana_navigation_v1';

export function readSessionValue(key: string): unknown {
  try { return JSON.parse(sessionStorage.getItem(key) || 'null'); } catch { return null; }
}

export function saveSessionValue(key: string, value: unknown): void {
  try { sessionStorage.setItem(key, JSON.stringify(value)); } catch { /* Storage may be disabled. */ }
}

export function readNavigationState() {
  const saved = readSessionValue(NAVIGATION_KEY) as Record<string, unknown> | null;
  const text = (key: string) => typeof saved?.[key] === 'string' ? saved[key] as string : null;
  return {
    activeTab: PAGE_TABS.includes(text('activeTab') || '') ? text('activeTab')! : 'home',
    ...normalizeCatalogFilters(saved || {}),
    quickViewProductId: text('quickViewProductId'),
    isCartOpen: saved?.isCartOpen === true,
  };
}

export function readAdminTab(uid?: string): AdminTab {
  const saved = readSessionValue(`inana_admin_tab_${uid || ''}`);
  return ADMIN_TABS.includes(saved as AdminTab) ? saved as AdminTab : 'direct-pricing';
}
