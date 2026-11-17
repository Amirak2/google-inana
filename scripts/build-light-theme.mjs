// Generates src/theme-light.css: a white-and-gold version of the storefront.
// It is switched on only when <html data-theme="light"> is set (open the site with ?theme=light),
// so the normal dark site is unchanged. Re-run after adding new colour classes:
//   node scripts/build-light-theme.mjs
import { readFile, writeFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');

// Readable colours on white (all at least 4.5:1 contrast for text).
const INK = '#1F1A12';        // main text
const INK_SOFT = '#3D3528';   // secondary text
const MUTED = '#625846';      // small grey text
const GOLD_TEXT = '#7A5A0C';  // gold that is readable on white (~6:1)
const GOLD_TEXT_2 = '#8C6A14';
const LINE = '#E6DAC0';       // borders
const PAPER = '#FFFFFF';
const CREAM = '#FBF7EE';
const CREAM_2 = '#F5EDDA';
const CREAM_3 = '#EFE3C6';

const tw = {
  white: '#ffffff', black: '#000000',
  'slate-100': '#f1f5f9', 'slate-200': '#e2e8f0', 'slate-300': '#cbd5e1', 'slate-400': '#94a3b8', 'slate-500': '#64748b',
  'slate-600': '#475569', 'slate-700': '#334155', 'slate-800': '#1e293b', 'slate-900': '#0f172a', 'slate-950': '#020617',
};
const hues = { emerald: ['#047857', '#ecfdf5', '#a7f3d0'], rose: ['#be123c', '#fff1f2', '#fecdd3'], red: ['#b91c1c', '#fef2f2', '#fecaca'],
  amber: ['#92400e', '#fffbeb', '#fde68a'], sky: ['#0369a1', '#f0f9ff', '#bae6fd'], cyan: ['#0e7490', '#ecfeff', '#a5f3fc'],
  teal: ['#0f766e', '#f0fdfa', '#99f6e4'], blue: ['#1d4ed8', '#eff6ff', '#bfdbfe'], indigo: ['#4338ca', '#eef2ff', '#c7d2fe'],
  purple: ['#7e22ce', '#faf5ff', '#e9d5ff'] };

const hexLum = hex => {
  const h = hex.replace('#', ''); const n = h.length === 3 ? h.split('').map(c => c + c).join('') : h.slice(0, 6);
  const [r, g, b] = [0, 2, 4].map(i => parseInt(n.slice(i, i + 2), 16) / 255).map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const isGoldHex = hex => /^#(D4AF37|E6CA65|C5A059|AA822A|B38A30|E8C766|F3D77A|c5a033)$/i.test(hex);

// Returns the light-theme colour for a role (bg, text, border, grad) and a colour token, or null to keep it.
function mapColour(role, token) {
  const hueMatch = token.match(/^(emerald|rose|red|amber|sky|cyan|teal|blue|indigo|purple)-(\d+)$/);
  if (hueMatch) {
    const [, hue, shade] = hueMatch; const [deep, tint, soft] = hues[hue]; const s = Number(shade);
    if (role === 'text') return s <= 400 ? deep : null;
    if (role === 'bg' || role === 'grad') return s >= 800 ? tint : null;
    if (role === 'border') return s >= 800 ? soft : null;
    return null;
  }
  if (token === 'black') return role === 'text' ? null : (role === 'bg' ? CREAM_2 : null);
  const hex = token.startsWith('#') ? token : tw[token];
  if (!hex) return null;
  if (isGoldHex(hex)) {
    if (role === 'text') return /D4AF37|C5A059|c5a033/i.test(hex) ? GOLD_TEXT : GOLD_TEXT_2;
    return null; // gold buttons, borders and gradients stay gold
  }
  const lum = hexLum(hex);
  if (role === 'text') {
    if (token === 'slate-950' || token === 'slate-900' || lum < 0.03) return null; // dark text on gold buttons stays dark
    if (/^#F5E8C7$/i.test(hex)) return GOLD_TEXT;
    if (token === 'slate-500' || token === 'slate-600' || token === 'slate-400') return MUTED;
    if (lum > 0.6) return INK;
    if (lum > 0.35) return INK_SOFT;
    return MUTED;
  }
  if (role === 'bg' || role === 'grad') {
    if (lum > 0.5) return null;   // already light
    if (lum < 0.012) return PAPER;
    if (lum < 0.03) return CREAM;
    if (lum < 0.06) return CREAM_2;
    return CREAM_3;
  }
  if (role === 'border') return lum > 0.5 ? LINE : LINE;
  return null;
}

const roleOf = { bg: 'bg', text: 'text', border: 'border', divide: 'border', ring: 'border', outline: 'border', from: 'grad', via: 'grad', to: 'grad', placeholder: 'text', fill: 'bg', stroke: 'border' };

async function walk(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...await walk(p)); else if (/\.(tsx|ts)$/.test(e.name)) out.push(p);
  }
  return out;
}

const files = [...await walk(path.join(root, 'src')), path.join(root, 'index.html')];
const re = /(?<![\w-])((?:[a-z0-9-]+:)*)(bg|text|border(?:-[trblxy])?|from|via|to|ring|fill|stroke|divide|placeholder|outline)-(\[#[0-9A-Fa-f]{3,8}\]|white|black|(?:slate|emerald|rose|red|amber|sky|cyan|teal|blue|indigo|purple)-\d{2,3})(\/(?:\d+|\[[\d.]+\]))?(?![\w-])/g;
const classes = new Set();
for (const f of files) { const src = await readFile(f, 'utf8'); for (const m of src.matchAll(re)) classes.add(m[0]); }

const esc = s => s.replace(/[^a-zA-Z0-9_-]/g, c => '\\' + c);
const pseudo = { hover: ':hover', focus: ':focus', 'focus-visible': ':focus-visible', disabled: ':disabled', active: ':active', 'focus-within': ':focus-within', placeholder: '::placeholder' };
const media = { sm: '(min-width: 640px)', md: '(min-width: 768px)', lg: '(min-width: 1024px)', xl: '(min-width: 1280px)' };
const blocks = { base: [] }; const skipped = [];

for (const cls of [...classes].sort()) {
  const m = cls.match(new RegExp(re.source));
  const [, prefixStr, util, rawColour, alpha] = m;
  const prefixes = prefixStr.split(':').filter(Boolean);
  const kind = util.startsWith('border') ? 'border' : util;
  const colour = rawColour.startsWith('[') ? rawColour.slice(1, -1) : rawColour;
  const mapped = mapColour(roleOf[kind], colour);
  if (!mapped) continue;
  let value = mapped;
  if (alpha) {
    const a = alpha.slice(1).replace(/[[\]]/g, ''); const pct = a.includes('.') ? Number(a) * 100 : Number(a);
    value = `color-mix(in oklab, ${mapped} ${pct}%, transparent)`;
  }
  let selector = `html[data-theme="light"] .${esc(cls)}`; let mq = null; let ok = true;
  for (const p of prefixes) {
    if (pseudo[p]) selector += pseudo[p];
    else if (media[p]) mq = media[p];
    else if (p === 'group-hover') selector = selector.replace('html[data-theme="light"] ', 'html[data-theme="light"] .group:hover ');
    else if (p === 'selection') selector += '::selection';
    else { ok = false; }
  }
  if (!ok) { skipped.push(cls); continue; }
  const side = util.match(/^border-([trblxy])$/)?.[1];
  const props = {
    bg: `background-color: ${value}`, text: `color: ${value}`, placeholder: `color: ${value}`, fill: `fill: ${value}`, stroke: `stroke: ${value}`,
    ring: `--tw-ring-color: ${value}`, outline: `outline-color: ${value}`, divide: `border-color: ${value}`,
    from: `--tw-gradient-from: ${value}`, via: `--tw-gradient-via: ${value}`, to: `--tw-gradient-to: ${value}`,
    border: side ? ({ t: 'border-top-color', r: 'border-right-color', b: 'border-bottom-color', l: 'border-left-color', x: 'border-inline-color', y: 'border-block-color' })[side] + `: ${value}` : `border-color: ${value}`,
  };
  if (util === 'placeholder') selector += '::placeholder';
  if (util === 'divide') selector += ' > :not(:last-child)';
  const rule = `${selector} { ${props[kind]} !important; }`;
  (blocks[mq || 'base'] ||= []).push(rule);
}

let css = `/* Generated by scripts/build-light-theme.mjs - do not edit by hand. White-and-gold test theme (?theme=light). */\n`;
css += blocks.base.join('\n') + '\n';
for (const [mq, rules] of Object.entries(blocks)) if (mq !== 'base') css += `@media ${mq} {\n${rules.join('\n')}\n}\n`;
await writeFile(path.join(root, 'src', 'theme-light.generated.css'), css);
console.log(`theme-light.generated.css: ${Object.values(blocks).flat().length} rules from ${classes.size} colour classes; skipped ${skipped.length}: ${skipped.join(' ')}`);
