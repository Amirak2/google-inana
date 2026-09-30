export function requestWrites(method: string, pathname: string): boolean {
  if (!['GET', 'HEAD'].includes(method)) return true;
  return ['/api/products', '/api/gold-price', '/api/gold-history'].includes(pathname)
    || /^\/api\/products\/[^/]+$/.test(pathname)
    || pathname.startsWith('/api/orders/track/');
}
