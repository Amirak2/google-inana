import type { CollectionInfo, Product } from '../src/types';
import type { Store } from './storage';

type Body = Record<string, unknown>;
export class CollectionError extends Error { constructor(message: string, public status = 400) { super(message); } }

const text = (value: unknown, max: number) => String(value ?? '').trim().slice(0, max);
const MIGRATION = 'collectionsInStore20261118V1';

/** Collections live in the store so the admin can add, edit, reorder and delete them. */
export function createCollections(store: Store, initial: CollectionInfo[]) {
  // First run: copy the collections that used to be written in the code, exactly as the site showed them.
  if (!store.get('migrations', MIGRATION)) {
    store.map('collections').clear();
    initial.forEach((collection, index) => store.set('collections', collection.id, { ...collection, sortOrder: index }));
    store.set('migrations', MIGRATION, true);
  }

  const list = (): CollectionInfo[] => [...store.map<CollectionInfo>('collections').values()]
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.titleFa.localeCompare(b.titleFa, 'fa'));

  function clean(body: Body, current?: CollectionInfo): Omit<CollectionInfo, 'id' | 'sortOrder'> {
    const titleFa = text(body.titleFa ?? current?.titleFa, 60);
    const name = text(body.name ?? current?.name, 40).toUpperCase();
    if (titleFa.length < 2) throw new CollectionError('نام فارسی کالکشن را بنویسید.');
    if (!/^[A-Z0-9][A-Z0-9 &'-]{1,39}$/.test(name)) throw new CollectionError('نام انگلیسی کالکشن فقط با حروف انگلیسی، عدد و فاصله نوشته شود (مثلاً INANA MOON).');
    if (list().some(other => other.id !== current?.id && other.name.toUpperCase() === name)) throw new CollectionError('کالکشنی با همین نام انگلیسی وجود دارد.');
    const coverImage = String(body.coverImage ?? current?.coverImage ?? '');
    if (!coverImage) throw new CollectionError('یک عکس کاور برای کالکشن انتخاب کنید.');
    if (!/^(data:image\/(png|jpeg|webp);base64,|\/|https:\/\/)/.test(coverImage) || coverImage.length > 4_500_000) throw new CollectionError('عکس کاور معتبر نیست.');
    return {
      name, titleFa, coverImage,
      subtitleFa: text(body.subtitleFa ?? current?.subtitleFa, 120),
      description: text(body.description ?? current?.description, 400),
      accentQuote: text(body.accentQuote ?? current?.accentQuote, 120),
      tag: text(body.tag ?? current?.tag, 20) || name.replace(/^INANA\s+/, ''),
    };
  }

  return {
    list,
    add(body: Body): CollectionInfo {
      const collection: CollectionInfo = { id: `col-${Date.now().toString(36)}`, ...clean(body), sortOrder: Math.max(-1, ...list().map(c => c.sortOrder ?? 0)) + 1 };
      store.set('collections', collection.id, collection);
      return collection;
    },
    /** Renaming the English name moves the collection's products with it. */
    update(id: string, body: Body, products: Product[]): { collection: CollectionInfo; movedProducts: number } {
      const current = store.get<CollectionInfo>('collections', id);
      if (!current) throw new CollectionError('کالکشن پیدا نشد.', 404);
      const collection: CollectionInfo = { ...current, ...clean(body, current) };
      store.set('collections', id, collection);
      let movedProducts = 0;
      if (collection.name !== current.name) for (const product of products) {
        if (product.collection === current.name) { product.collection = collection.name; store.set('products', product.id, product); movedProducts++; }
      }
      return { collection, movedProducts };
    },
    /** Products keep their collection name; they simply stop showing in a collection row. */
    remove(id: string) {
      if (!store.get('collections', id)) throw new CollectionError('کالکشن پیدا نشد.', 404);
      store.map('collections').delete(id);
    },
    reorder(ids: unknown) {
      if (!Array.isArray(ids)) throw new CollectionError('ترتیب کالکشن‌ها معتبر نیست.');
      const known = list();
      const order = [...ids.filter((id): id is string => typeof id === 'string' && known.some(c => c.id === id)), ...known.map(c => c.id).filter(id => !ids.includes(id))];
      order.forEach((id, index) => store.set('collections', id, { ...store.get<CollectionInfo>('collections', id)!, sortOrder: index }));
      return list();
    },
  };
}
