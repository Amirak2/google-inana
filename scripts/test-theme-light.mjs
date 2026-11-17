import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// Regenerate the white-and-gold colour overrides so colour classes added later are covered on every build.
await import('./build-light-theme.mjs');

const css = await readFile(new URL('../src/theme-light.generated.css', import.meta.url), 'utf8');
assert.ok(css.includes('html[data-theme="light"] .text-\\[\\#D4AF37\\] { color: #7A5A0C !important; }'), 'Pale gold text becomes a gold that is readable on white');
assert.ok(css.includes('html[data-theme="light"] .bg-\\[\\#060B15\\] { background-color: #FFFFFF !important; }'), 'Navy panels become white');

const main = await readFile(new URL('../src/main.tsx', import.meta.url), 'utf8');
assert.ok(main.includes("localStorage.getItem('inana-theme') !== 'dark'"), 'White and gold is the default; only ?theme=dark shows the navy look');
const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
assert.ok(html.includes('data-theme="light"') && html.includes('content="#FFFFFF"'), 'The first paint is already white');
const hero = await readFile(new URL('../src/components/StarFallHero.tsx', import.meta.url), 'utf8');
assert.ok(hero.includes("const sky = whiteTheme ? '#FFFDF8'"), 'The star hero draws an ivory sky');
console.log('PASS: white-and-gold theme is the default, readable gold text, overrides regenerated.');
