import { PAGE_PATHS, productPath } from '../src/utils/siteRoutes';

// Link previews (Instagram, Telegram, WhatsApp) and search engines read the HTML the
// server sends and never run the app, so each page's title, description and picture
// are written into the HTML shell here.

export const SITE_ORIGIN = 'https://inanagold.ir';
const BRAND = 'INANA GOLD';

export interface PageMeta {
  status: 200 | 404;
  title: string;
  description: string;
  image: string;
  path: string;
  type: 'website' | 'product';
  noindex?: boolean;
  jsonLd?: Record<string, unknown>;
}

interface CatalogProduct {
  id: string; title: string; description?: string; images?: string[]; sku?: string; category?: string;
  calculatedPrice?: number; stock?: number; availableStock?: number; createdAt?: string; updatedAt?: string;
}

const HOME_DESCRIPTION = 'خرید آنلاین زیورآلات و طلای ۱۸ عیار از INANA GOLD با محاسبه لحظه‌ای قیمت طلا و طراحی مدرن و اصیل ایرانی.';
// Same wording the app sets in the browser (src/App.tsx).
const PAGES: Record<string, { title: string; description: string; noindex?: boolean }> = {
  home: { title: `${BRAND} | زیورآلات و طلای لوکس ۱۸ عیار`, description: HOME_DESCRIPTION },
  shop: { title: `ویترین زیورآلات | ${BRAND}`, description: 'ویترین زیورآلات طلای ۱۸ عیار و مروارید اینانا گلد با قیمت روز طلا و امکان خرید آنلاین.' },
  'gold-price': { title: `نرخ طلا | ${BRAND}`, description: 'نرخ لحظه‌ای طلای ۱۸ عیار و محاسبه قیمت زیورآلات اینانا گلد بر اساس قیمت روز.' },
  collections: { title: `کالکشن‌ها | ${BRAND}`, description: 'کالکشن‌های اینانا گلد: مروارید، ترکیب مروارید و طلا، دریا و حروف اختصاصی طلای ۱۸ عیار.' },
  about: { title: `درباره اینانا | ${BRAND}`, description: 'درباره اینانا در گالری اینانا گلد، زیورآلات طلای ۱۸ عیار و مروارید.' },
  contact: { title: `تماس با اینانا | ${BRAND}`, description: 'تماس با اینانا در گالری اینانا گلد، زیورآلات طلای ۱۸ عیار و مروارید.' },
  favorites: { title: `علاقه‌مندی‌ها | ${BRAND}`, description: HOME_DESCRIPTION, noindex: true },
  admin: { title: `مدیریت | ${BRAND}`, description: HOME_DESCRIPTION, noindex: true },
};
const DEFAULT_IMAGE = `${SITE_ORIGIN}/logo.jpg`;

const escapeHtml = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const oneLine = (text = '', max = 200) => {
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean;
};

// Preview crawlers want an absolute JPEG; the site's own photos are converted on request.
export function previewImage(src?: string): string {
  if (!src) return DEFAULT_IMAGE;
  if (/^https?:\/\//.test(src)) return src;
  return `${SITE_ORIGIN}${src}${src.includes('?') ? '&' : '?'}w=960&f=jpg`;
}

function productMeta(product: CatalogProduct, path: string): PageMeta {
  const description = oneLine(product.description) || `${product.title} از گالری اینانا گلد.`;
  const images = (product.images || []).slice(0, 4).map(previewImage);
  const inStock = (product.availableStock ?? product.stock ?? 0) > 0;
  const url = `${SITE_ORIGIN}${path}`;
  return {
    status: 200, type: 'product', path, title: `${product.title} | ${BRAND}`, description, image: images[0] || DEFAULT_IMAGE,
    jsonLd: {
      '@context': 'https://schema.org', '@type': 'Product', name: product.title, description, image: images, url,
      ...(product.sku ? { sku: product.sku } : {}), ...(product.category ? { category: product.category } : {}),
      brand: { '@type': 'Brand', name: BRAND },
      // Prices are stored in toman; search engines expect the official currency, the rial.
      ...(product.calculatedPrice && product.calculatedPrice > 0 ? { offers: {
        '@type': 'Offer', url, priceCurrency: 'IRR', price: product.calculatedPrice * 10,
        availability: `https://schema.org/${inStock ? 'InStock' : 'OutOfStock'}`,
      } } : {}),
    },
  };
}

/** Decides what a requested address is: a known page, a product, or nothing (404). */
export function resolvePage(pathname: string, products: CatalogProduct[] | null): PageMeta {
  const path = pathname.replace(/\/+$/, '') || '/';
  const missing: PageMeta = { status: 404, type: 'website', path, title: `صفحه پیدا نشد | ${BRAND}`, description: HOME_DESCRIPTION, image: DEFAULT_IMAGE, noindex: true };
  const tab = Object.keys(PAGE_PATHS).find(key => PAGE_PATHS[key] === path);
  if (tab) return { status: 200, type: 'website', path, image: DEFAULT_IMAGE, ...PAGES[tab] };
  if (!path.startsWith('/product/')) return missing;
  let id = '';
  try { id = decodeURIComponent(path.slice('/product/'.length)); } catch { return missing; }
  // If the catalog could not be read, the page still opens with the general preview.
  if (!products) return { status: 200, type: 'website', path, image: DEFAULT_IMAGE, ...PAGES.shop };
  const product = products.find(item => item.id === id);
  return product ? productMeta(product, productPath(product.id)) : missing;
}

/** Writes one page's preview information into the built HTML shell. */
export function renderPage(template: string, meta: PageMeta): string {
  const url = `${SITE_ORIGIN}${meta.path}`;
  const replaceContent = (html: string, attribute: string, value: string) =>
    html.replace(new RegExp(`(<meta ${attribute} content=")[^"]*(")`), (_match, before, after) => `${before}${escapeHtml(value)}${after}`);
  let html = template.replace(/<title>[^<]*<\/title>/, () => `<title>${escapeHtml(meta.title)}</title>`);
  html = replaceContent(html, 'name="description"', meta.description);
  html = replaceContent(html, 'property="og:title"', meta.title);
  html = replaceContent(html, 'property="og:description"', meta.description);
  html = replaceContent(html, 'property="og:type"', meta.type);
  html = replaceContent(html, 'property="og:image"', meta.image);
  const extra = [
    `<meta property="og:url" content="${escapeHtml(url)}" />`,
    `<meta property="og:site_name" content="${BRAND}" />`,
    meta.noindex ? '<meta name="robots" content="noindex" />' : `<link rel="canonical" href="${escapeHtml(url)}" />`,
    // "<" is escaped so product text can never close the script element.
    meta.jsonLd ? `<script type="application/ld+json">${JSON.stringify(meta.jsonLd).replace(/</g, '\\u003c')}</script>` : '',
  ].filter(Boolean).join('\n    ');
  return html.replace('</head>', () => `  ${extra}\n  </head>`);
}

export function robotsTxt(): string {
  return ['User-agent: *', 'Allow: /', 'Disallow: /admin', 'Disallow: /favorites', 'Disallow: /api/', '', `Sitemap: ${SITE_ORIGIN}/sitemap.xml`, ''].join('\n');
}

export function sitemapXml(products: CatalogProduct[]): string {
  const day = (iso?: string) => (iso && !Number.isNaN(Date.parse(iso)) ? new Date(iso).toISOString().slice(0, 10) : '');
  const entry = (path: string, lastmod = '') => `  <url><loc>${escapeHtml(SITE_ORIGIN + path)}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ''}</url>`;
  const pages = Object.keys(PAGE_PATHS).filter(tab => !PAGES[tab]?.noindex).map(tab => entry(PAGE_PATHS[tab]));
  const items = products.map(product => entry(productPath(product.id), day(product.updatedAt || product.createdAt)));
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${[...pages, ...items].join('\n')}\n</urlset>\n`;
}
