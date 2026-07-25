#!/usr/bin/env node
// APCA verification for rendered brand-token consumers.

import { readFileSync } from 'node:fs';
import { converter, formatHex, parse } from 'culori';
import { APCAcontrast, sRGBtoY } from 'apca-w3';
import { colorParsley } from 'colorparsley';

const THEME_PATH = 'tokens/theme.css';
const GLOBALS_PATH = 'app/globals.css';

if (!readFileSync(GLOBALS_PATH, 'utf8').includes("@import '../tokens/theme.css';")) {
  console.error(`contrast-check: ${GLOBALS_PATH} must import the active ${THEME_PATH}.`);
  process.exit(1);
}

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

const layers = [
  parseScopes('tokens/primitives.css'),
  parseScopes('tokens/semantic.css'),
  parseScopes(THEME_PATH),
];

function modeVars(mode) {
  return Object.assign(
    {},
    ...layers.map((layer) => layer.root),
    ...(mode === 'dark' ? layers.map((layer) => layer.dark) : []),
  );
}

function toHex(vars, name) {
  let value = vars[name];
  const seen = new Set([name]);
  while (value) {
    const reference = value.match(/^var\((--[\w-]+)\)$/);
    if (!reference) break;
    if (seen.has(reference[1])) throw new Error(`Circular token reference: ${[...seen, reference[1]].join(' -> ')}`);
    seen.add(reference[1]);
    value = vars[reference[1]];
  }
  const parsed = value && parse(value);
  if (!parsed) throw new Error(`Token ${name} does not resolve to a color: ${value ?? 'missing'}`);
  return formatHex(converter('rgb')(parsed));
}

const Lc = (fg, bg) =>
  Math.abs(APCAcontrast(sRGBtoY(colorParsley(fg)), sRGBtoY(colorParsley(bg))));

const checks = [];
const add = (label, fg, bg, min) => checks.push({ label, lc: Lc(fg, bg), min });

for (const mode of ['light', 'dark']) {
  const vars = modeVars(mode);
  const surfaces = Object.fromEntries(
    ['canvas', 'surface', 'surface-raised', 'surface-sunken', 'surface-hover', 'surface-active']
      .map((name) => [name.replace('surface-', ''), toHex(vars, `--color-${name}`)])
  );
  const primary = toHex(vars, '--color-primary');
  const primaryHover = toHex(vars, '--color-primary-hover');
  const primaryText = toHex(vars, '--color-primary-text');
  const accentSubtle = toHex(vars, '--color-accent-subtle');

  add(`${mode}: primary button text`, primaryText, primary, 75);
  add(`${mode}: primary button text on hover`, primaryText, primaryHover, 75);

  for (const [surface, background] of Object.entries(surfaces)) {
    add(`${mode}: primary button on ${surface}`, primary, background, 45);
    add(`${mode}: primary button hover on ${surface}`, primaryHover, background, 45);
  }

  add(`${mode}: primary text on selected accent-subtle row`, toHex(vars, '--color-text-primary'), accentSubtle, 90);
  add(`${mode}: secondary text on selected accent-subtle row`, toHex(vars, '--color-text-secondary'), accentSubtle, 75);
  add(`${mode}: tertiary text on selected accent-subtle row`, toHex(vars, '--color-text-tertiary'), accentSubtle, 60);

  const focus = toHex(vars, '--color-focus-ring');
  for (const [surface, background] of Object.entries(surfaces)) {
    add(`${mode}: focus ring on ${surface}`, focus, background, 45);
  }
}

console.log(`contrast-check (${THEME_PATH}), rendered APCA pairs:\n`);
let failed = 0;
for (const check of checks) {
  const pass = check.lc >= check.min;
  if (!pass) failed++;
  console.log(`${pass ? 'PASS' : 'FAIL'}  Lc ${String(Math.round(check.lc)).padStart(3)} (min ${check.min})  ${check.label}`);
}

if (failed > 0) console.error(`\n${failed} rendered pair(s) failed.`);
else console.log(`\nAll ${checks.length} rendered brand pairs pass APCA.`);
process.exit(failed > 0 ? 1 : 0);
