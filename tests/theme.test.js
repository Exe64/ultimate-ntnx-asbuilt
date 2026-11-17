// The page's colors, read from its tokens, stay readable (WCAG AA, 4.5:1) in light and in dark.
import { test, expect } from 'bun:test';

const css = await Bun.file(new URL('../web/index.html', import.meta.url)).text();

// `--name: light-dark(#light, #dark)` or `--name: #both`.
function tokens(theme) {
  const out = {};
  for (const [, name, value] of css.matchAll(/--([\w-]+):\s*([^;]+);/g)) {
    const pair = /^light-dark\((#[0-9a-f]{6}),\s*(#[0-9a-f]{6})\)$/i.exec(value.trim());
    if (pair) out[name] = theme === 'light' ? pair[1] : pair[2];
    else if (/^#[0-9a-f]{6}$/i.test(value.trim())) out[name] = value.trim();
  }
  return out;
}

const luminance = (hex) => {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

// Foreground → the backgrounds it is drawn on.
const PAIRS = [
  ['text', ['bg', 'surface', 'field']],
  ['muted', ['bg', 'surface', 'field']],
  ['accent-text', ['bg', 'surface', 'field', 'accent-soft']],
  ['accent-ink', ['accent']],
  ['ok', ['surface']],
  ['ko', ['bg', 'surface']],
];

for (const theme of ['light', 'dark']) {
  test(`AA contrast in ${theme} theme`, () => {
    const t = tokens(theme);
    for (const [fg, bgs] of PAIRS) {
      for (const bg of bgs) {
        expect(t[fg], `--${fg}`).toBeDefined();
        expect(t[bg], `--${bg}`).toBeDefined();
        expect(contrast(t[fg], t[bg]), `${fg} on ${bg} (${theme})`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
}
