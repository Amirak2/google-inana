import { normalizeCatalogFilters, type CatalogFilters } from './catalogFilters';

export interface SiteRoute extends CatalogFilters {
  activeTab: string;
  quickViewProductId: string | null;
}

export const PAGE_PATHS: Record<string, string> = {
  home: '/', shop: '/shop', 'gold-price': '/gold-price', collections: '/collections',
  favorites: '/favorites', about: '/about', contact: '/contact', admin: '/admin',
};

export function productPath(id: string): string {
  return `/product/${encodeURIComponent(id)}`;
}

export function parseSiteRoute(pathname: string, search = ''): SiteRoute {
  const path = pathname.replace(/\/+$/, '') || '/';
  const params = new URLSearchParams(search);
  let activeTab = Object.keys(PAGE_PATHS).find(tab => PAGE_PATHS[tab] === path) || 'home';
  let quickViewProductId: string | null = null;
  if (path.startsWith('/product/')) {
    try { quickViewProductId = decodeURIComponent(path.slice('/product/'.length)); } catch { /* Malformed URL. */ }
    activeTab = Object.hasOwn(PAGE_PATHS, params.get('page') || '') ? params.get('page')! : 'shop';
  }
  return {
    activeTab, quickViewProductId,
    ...normalizeCatalogFilters({
      selectedCategory: params.get('category') || null,
      selectedCollection: params.get('collection') || null,
      searchQuery: params.get('q') || '',
      selectedLetter: params.get('letter'),
      maxWeight: params.has('maxWeight') ? Number(params.get('maxWeight')) : null,
      onlyInStock: params.get('inStock') === '1',
      sortBy: params.get('sort'),
    }),
  };
}

export function buildSiteRoute(route: SiteRoute): string {
  const params = new URLSearchParams();
  const path = route.quickViewProductId ? productPath(route.quickViewProductId) : PAGE_PATHS[route.activeTab] || '/';
  if (route.quickViewProductId && route.activeTab !== 'shop') params.set('page', route.activeTab);
  if (route.quickViewProductId || ['home', 'shop', 'collections', 'gold-price'].includes(route.activeTab)) {
    const filters = normalizeCatalogFilters(route);
    if (filters.selectedCategory) params.set('category', filters.selectedCategory);
    if (filters.selectedCollection) params.set('collection', filters.selectedCollection);
    if (filters.searchQuery) params.set('q', filters.searchQuery);
    if (filters.selectedLetter) params.set('letter', filters.selectedLetter);
    if (filters.maxWeight !== null) params.set('maxWeight', String(filters.maxWeight));
    if (filters.onlyInStock) params.set('inStock', '1');
    if (filters.sortBy !== 'newest') params.set('sort', filters.sortBy);
  }
  return path + (params.size ? `?${params}` : '');
}
