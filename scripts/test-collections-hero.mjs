import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { collectionCover } from '../src/utils/collectionCover.ts';

// The home page opens on the collections instead of the falling star.
const app = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8');
assert.ok(app.includes('<CollectionsHero />') && !app.includes('<StarFallHero />'));
const hero = await readFile(new URL('../src/components/CollectionsHero.tsx', import.meta.url), 'utf8');
assert.ok(hero.includes('گالری اینانا برای زنان توانا') && hero.includes('مشاهده مجموعه‌ها'), 'The brand line and the collections button stay');
assert.ok(hero.includes('snap-x snap-mandatory') && hero.includes('lg:grid'), 'Phones swipe, wide screens show a gallery wall');
assert.ok(!/absolute inset-0 bg-gradient/.test(hero), 'Nothing is laid over the collection photos');

const letters = { name: 'INANA LETTERS', coverImage: 'https://images.unsplash.com/x' };
assert.equal(collectionCover(letters, [{ collection: 'INANA LETTERS', letter: 'N', images: ['/products/letters/n.webp'] }]), '/products/letters/n.webp');
assert.equal(collectionCover({ name: 'INANA SEA', coverImage: '/sea.webp' }, []), '/sea.webp');
console.log('PASS: home hero shows the collections (swipe on phones, gallery wall on wide screens).');
