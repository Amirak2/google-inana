import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { descriptionText } from '../src/utils/descriptionText.ts';

assert.equal(descriptionText('سطر اول\nسطر دوم'), 'سطر اول\nسطر دوم', 'A line break typed by the owner is kept');
assert.equal(descriptionText('عنوان\n\n\n\nمتن \r\n\r\nپایان '), 'عنوان\n\nمتن\n\nپایان', 'Several empty lines become one; stray spaces are dropped');
assert.equal(descriptionText(undefined), '');
const modal = await readFile(new URL('../src/components/ProductDetailModal.tsx', import.meta.url), 'utf8');
assert.match(modal, /whitespace-pre-line">\s*\{descriptionText\(product\.description\)\}/, 'The product page shows the description with its line breaks');
console.log('PASS: product descriptions keep their line breaks on the product page.');
