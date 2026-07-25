import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const checker = fileURLToPath(new URL('./design-check.mjs', import.meta.url));

function runFixture(source, dir = 'app') {
  const root = mkdtempSync(join(tmpdir(), 'base-ds-design-check-'));
  mkdirSync(join(root, dir), { recursive: true });
  writeFileSync(join(root, dir, 'fixture.tsx'), source);
  const result = spawnSync(process.execPath, [checker], { cwd: root, encoding: 'utf8' });
  rmSync(root, { recursive: true, force: true });
  return result;
}

function expectRules(result, ids, label) {
  const missing = ids.filter((id) => !result.stderr.includes(id));
  if (result.status !== 1 || missing.length > 0) {
    console.error(result.stderr || result.stdout);
    throw new Error(`${label}: expected ${missing.join(', ') || ids.join(', ')} to be reported.`);
  }
}

function expectClean(result, label) {
  if (result.status !== 0) {
    console.error(result.stderr || result.stdout);
    throw new Error(`${label}: expected no violations.`);
  }
}

const violations = runFixture(`
const tooSmall = 13;
export function Fixture({ active }) {
  return <>
    {/* comment */} <div className="uppercase" />
    <div style={{ textTransform: 'Uppercase' }} />
    <div className="text-[13.5px]" />
    <div style={{ color: 'oklab(50% 0 0)' }} />
    <div style={{ color: 'color(display-p3 1 0 0)' }} />
    <div className={\`text-[\${tooSmall}px]\`} />
    <div className={active && ['upper', 'case'].join('')} />
    <div style={{ '--local-color': '#' + 'abc' }} />
    <div className={{ ['bg-' + 'red-500']: active }} />
    <div className="sm:bg-red-500" />
    <div style={{ color: 'var(--gray-500)' }} />
    <div style={{ color: '#abc' }} data-note="design-check-ignore" />
  </>;
}
`);

if (violations.status !== 1 || !violations.stderr.includes('N1') || !violations.stderr.includes('N2') || !violations.stderr.includes('N4')) {
  console.error(violations.stderr || violations.stdout);
  throw new Error('Expected N1, N2, and N4 violations were not all reported.');
}

const clean = runFixture(`export function Clean() { return <div className="text-[var(--color-text-primary)]" />; }`);
if (clean.status !== 0) {
  console.error(clean.stderr || clean.stdout);
  throw new Error('A valid semantic-token fixture failed design-check.');
}

// ---- A14: cursor on interactive elements ----------------------------------

expectRules(runFixture(`
export function Fixture() {
  return <button className="rounded-[var(--radius-md)]">Save changes</button>;
}
`), ['A14'], 'A14 bare button');

expectClean(runFixture(`
const row = 'cursor-pointer rounded-[var(--radius-md)]';
export function Fixture({ onPick }) {
  return <>
    <button type="button" className={row} onClick={onPick} />
    <a href="/x">Read more</a>
    <Button onClick={onPick}>Save changes</Button>
  </>;
}
`, 'components/ui'), 'A14 resolved const, native link, and system component');

// ---- A15: a background needs its own padding ------------------------------

expectRules(runFixture(`
export function Fixture() {
  return <div className="hover:bg-[var(--color-surface-hover)]">Weekly digest</div>;
}
`), ['A15'], 'A15 hover surface flush against text');

expectClean(runFixture(`
export function Fixture({ active }) {
  return <>
    <div className="px-[var(--space-2)] hover:bg-[var(--color-surface-hover)]">Weekly digest</div>
    <div className="animate-pulse bg-[var(--color-surface-active)]" />
    <span className="size-11 bg-[var(--color-surface-hover)]">1</span>
    <span className="h-11 w-11 hover:bg-[var(--color-surface-hover)]">2</span>
    <span className={\`px-[var(--space-2)] \${active ? 'bg-[var(--color-surface-active)]' : 'hover:bg-[var(--color-surface-hover)]'}\`}>3</span>
    <IconButton className="bg-[var(--color-surface-hover)] hover:bg-[var(--color-surface-active)]">4</IconButton>
    <table><tbody><tr className="hover:bg-[var(--color-surface-hover)]"><td className="px-4">a</td></tr></tbody></table>
  </>;
}
`), 'A15 padded row, childless block, fixed squares, template-literal padding, system component, and delegating table row');

// ---- N15: no hand-built clickables in a view ------------------------------

expectRules(runFixture(`
export function Fixture({ onPick }) {
  return <>
    <div onClick={onPick}>Open</div>
    <button className="cursor-pointer rounded-[var(--radius-md)]">Save changes</button>
  </>;
}
`), ['N15'], 'N15 clickable div and hand-styled button in a view');

expectClean(runFixture(`
const row = 'cursor-pointer';
export function DataRow({ onPick }) {
  return <button type="button" className={row} onClick={onPick} />;
}
`, 'components/ui'), 'N15 raw button is allowed inside components/ui');

expectClean(runFixture(`
export function Fixture({ onClose }) {
  return <button type="button" aria-label="Close menu" onClick={onClose} className="fixed inset-0 z-30 cursor-pointer bg-[var(--color-overlay)]" />;
}
`), 'N15 full-bleed scrim button is a dismiss layer, not a content control');

// ---- C1: sentence case ----------------------------------------------------

expectRules(runFixture(`
export function Fixture() {
  return <>
    <button className="cursor-pointer">Save Changes</button>
    <h2>SETTINGS</h2>
    <Label>email address</Label>
  </>;
}
`), ['C1'], 'C1 Title Case, shouting, and a lowercase label');

expectClean(runFixture(`
export function Fixture({ name }) {
  return <>
    <Button>Save changes</Button>
    <h2>Export to CSV</h2>
    <h3>Anna Lindqvist</h3>
    <CardTitle>{name}</CardTitle>
    <Button title="Remove source">OK</Button>
  </>;
}
`), 'C1 sentence case, acronym, proper noun, interpolation, and OK');

// ---- Exemptions -----------------------------------------------------------

const fileExempt = runFixture(`/* design-check-exempt: email clients cannot resolve CSS custom properties */
export function Fixture() { return <div style={{ color: '#aabbcc' }} className="text-xs" />; }
`);
expectClean(fileExempt, 'exempt: whole file');
if (!fileExempt.stdout.includes('1 exemption(s)') || !fileExempt.stdout.includes('email clients')) {
  console.error(fileExempt.stdout);
  throw new Error('exempt: the summary must name the file and its reason.');
}

expectClean(runFixture(`
export function Fixture() {
  /* design-check-exempt: third party embed ships this hex */
  return <div style={{ color: '#aabbcc' }} />;
}
`), 'exempt: the line after the directive');

expectRules(runFixture(`
export function Fixture() {
  /* design-check-exempt: */
  return <div style={{ color: '#aabbcc' }} />;
}
`), ['EXEMPT', 'N4'], 'exempt: a reason is mandatory, and an empty one suppresses nothing');

console.log('design-check regression fixtures pass.');
