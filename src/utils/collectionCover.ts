import type { CollectionInfo, Product } from '../types';

/** The cover photo of a collection. The letters collection shows a photo of one of its letters. */
export function collectionCover(collection: CollectionInfo, products: Product[]): string | undefined {
  if (collection.name !== 'INANA LETTERS') return collection.coverImage;
  return products.filter(product => product.collection === collection.name && product.letter)
    .flatMap(product => product.images || []).find(image => !image.includes('images.unsplash.com'));
}
