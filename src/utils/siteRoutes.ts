export interface SiteRoute {
  activeTab: string;
  selectedCategory: string | null;
  selectedCollection: string | null;
  searchQuery: string;
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
    selectedCategory: params.get('category') || null,
    selectedCollection: params.get('collection') || null,
    searchQuery: params.get('q') || '',
  };
}

export function buildSiteRoute(route: SiteRoute): string {
  const params = new URLSearchParams();
  const path = route.quickViewProductId ? productPath(route.quickViewProductId) : PAGE_PATHS[route.activeTab] || '/';
  if (route.quickViewProductId && route.activeTab !== 'shop') params.set('page', route.activeTab);
  if (['home', 'shop', 'collections', 'gold-price'].includes(route.activeTab)) {
    if (route.selectedCategory) params.set('category', route.selectedCategory);
    if (route.selectedCollection) params.set('collection', route.selectedCollection);
    if (route.searchQuery) params.set('q', route.searchQuery);
  }
  return path + (params.size ? `?${params}` : '');
}
