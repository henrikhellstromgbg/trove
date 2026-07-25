// Verifies the color system in tokens/primitives.css against APCA.
// primitives.css provides raw values and semantic.css provides the rendered
// pairings. Both files are parsed so token remapping cannot silently drift
// away from the APCA matrix.
// Run: node tools/generate-scales.mjs
//
// Threshold tiers (abs Lc), per README:
//   90  primary text
//   75  body text (secondary, status text, links)
//   60  meta text (tertiary: hints, timestamps, placeholders; never body copy)
//   45  non-text UI (icons, status indicators)
//   30  input/control borders (paired with filled bg + visible label)
//   --  decorative separators: exempt (WCAG 1.4.11 non-essential), reported informationally
//
// Tertiary text is only permitted on canvas/surface/raised/sunken.
// On hover/active surfaces, use primary or secondary text (see semantic.css).

import { readFileSync } from 'node:fs';
import { converter, formatHex, parse } from 'culori';
import { APCAcontrast, sRGBtoY } from 'apca-w3';
import { colorParsley } from 'colorparsley';

function parseScopes(path) {
  const scopes = { root: {}, dark: {} };
  let scope;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    if (/^\s*:root\s*{/.test(line)) scope = scopes.root;
    else if (/^\s*\.dark\s*{/.test(line)) scope = scopes.dark;
    else if (/^\s*}/.test(line)) scope = undefined;
    const match = line.match(/(--[\w-]+):\s*([^;]+);/);
    if (scope && match && !line.trim().startsWith('/*')) scope[match[1]] = match[2].trim();
  }
  return scopes;
}

const primitives = parseScopes(new URL('../tokens/primitives.css', import.meta.url));
const semantic = parseScopes(new URL('../tokens/semantic.css', import.meta.url));

function modeVars(mode) {
  return {
    ...primitives.root,
    ...semantic.root,
    ...(mode === 'dark' ? primitives.dark : {}),
    ...(mode === 'dark' ? semantic.dark : {}),
  };
}

function hex(vars, name) {
  let raw = vars[name];
  const seen = new Set([name]);
  while (raw) {
    const reference = raw.match(/^var\((--[\w-]+)\)$/);
    if (!reference) break;
    if (seen.has(reference[1])) throw new Error(`Circular token reference: ${[...seen, reference[1]].join(' -> ')}`);
    seen.add(reference[1]);
    raw = vars[reference[1]];
  }
  if (!raw) throw new Error(`Missing token: ${name}`);
  const parsed = parse(raw);
  if (!parsed) throw new Error(`Token ${name} does not resolve to a color: ${raw}`);
  return formatHex(converter('rgb')(parsed));
}
const Lc = (fg, bg) => Math.abs(APCAcontrast(sRGBtoY(colorParsley(fg)), sRGBtoY(colorParsley(bg))));

const checks = [];
const add = (label, fg, bg, min) => {
  const v = Lc(fg, bg);
  checks.push({ label, lc: v, min, pass: v >= min });
};

/* ================= LIGHT MODE =================
   Surfaces: canvas=gray-50, surface/raised=white, sunken/hover=gray-100, active=gray-200 */
const light = modeVars('light');
const L = Object.fromEntries(
  ['canvas', 'surface', 'surface-raised', 'surface-sunken', 'surface-hover', 'surface-active']
    .map((name) => [name.replace('surface-', ''), hex(light, `--color-${name}`)])
);
const Ltext = {
  primary: [hex(light, '--color-text-primary'), 90],
  secondary: [hex(light, '--color-text-secondary'), 75],
};

for (const [tname, [t, min]] of Object.entries(Ltext))
  for (const [sname, s] of Object.entries(L))
    add(`LIGHT ${tname} on ${sname}`, t, s, min);
for (const sname of ['canvas', 'surface', 'raised', 'sunken'])
  add(`LIGHT tertiary on ${sname}`, hex(light, '--color-text-tertiary'), L[sname], 60);

add('LIGHT separator (border-subtle, decorative use only, exempt) vs surface', hex(light, '--color-border-subtle'), L.surface, 0);
add('LIGHT input border (border-strong) vs surface', hex(light, '--color-border-strong'), L.surface, 30);
add('LIGHT text on primary button', hex(light, '--color-primary-text'), hex(light, '--color-primary'), 90);
add('LIGHT text on primary button hover', hex(light, '--color-primary-text'), hex(light, '--color-primary-hover'), 90);

for (const s of ['error', 'warning', 'success', 'info']) {
  const text = hex(light, `--color-status-${s}-text`);
  const base = hex(light, `--color-status-${s}`);
  add(`LIGHT ${s}-text on ${s}-bg`, text, hex(light, `--color-status-${s}-bg`), 75);
  for (const [surface, background] of Object.entries(L)) add(`LIGHT ${s}-text on ${surface}`, text, background, 75);
  add(`LIGHT ${s}-base (icon) on canvas`, base, L.canvas, 45);
  add(`LIGHT ${s}-base (icon) on surface`, base, L.surface, 45);
}
add('LIGHT text on destructive button', hex(light, '--color-text-on-status'), hex(light, '--color-status-error'), 75);

/* ================= DARK MODE =================
   Surfaces: canvas=gray-950, surface=gray-900, raised=gray-800,
   sunken=gray-925, hover=gray-800, active=gray-750 */
const dark = modeVars('dark');
const D = Object.fromEntries(
  ['canvas', 'surface', 'surface-raised', 'surface-sunken', 'surface-hover', 'surface-active']
    .map((name) => [name.replace('surface-', ''), hex(dark, `--color-${name}`)])
);
const Dtext = {
  primary: [hex(dark, '--color-text-primary'), 90],
  secondary: [hex(dark, '--color-text-secondary'), 75],
};

for (const [tname, [t, min]] of Object.entries(Dtext))
  for (const [sname, s] of Object.entries(D))
    add(`DARK ${tname} on ${sname}`, t, s, min);
for (const sname of ['canvas', 'surface', 'raised', 'sunken'])
  add(`DARK tertiary on ${sname}`, hex(dark, '--color-text-tertiary'), D[sname], 60);

add('DARK separator (border-subtle, decorative use only, exempt) vs surface', hex(dark, '--color-border-subtle'), D.surface, 0);
add('DARK input border (border-strong) vs surface', hex(dark, '--color-border-strong'), D.surface, 30);
add('DARK text on primary button', hex(dark, '--color-primary-text'), hex(dark, '--color-primary'), 90);
add('DARK text on primary button hover', hex(dark, '--color-primary-text'), hex(dark, '--color-primary-hover'), 90);

for (const s of ['error', 'warning', 'success', 'info']) {
  const text = hex(dark, `--color-status-${s}-text`);
  const base = hex(dark, `--color-status-${s}`);
  add(`DARK ${s}-text on ${s}-bg`, text, hex(dark, `--color-status-${s}-bg`), 75);
  for (const [surface, background] of Object.entries(D)) add(`DARK ${s}-text on ${surface}`, text, background, 75);
  add(`DARK ${s}-base (icon) on canvas`, base, D.canvas, 45);
  add(`DARK ${s}-base (icon) on surface`, base, D.surface, 45);
}
add('DARK text on destructive button', hex(dark, '--color-text-on-status'), hex(dark, '--color-status-error'), 75);

/* ================= REPORT ================= */
let failed = 0;
for (const c of checks) {
  if (!c.pass) failed++;
  console.log(`${c.pass ? 'PASS' : 'FAIL'}  Lc ${String(Math.round(c.lc)).padStart(3)} (min ${c.min})  ${c.label}`);
}
console.log(`\n${checks.length} rendered pairs checked from parsed primitives.css + semantic.css.`);
console.log(failed === 0 ? 'All pairs pass APCA.' : `${failed} FAILED.`);
process.exit(failed === 0 ? 0 : 1);
