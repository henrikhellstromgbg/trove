import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const checker = fileURLToPath(new URL('./design-check.mjs', import.meta.url));
const repoRoot = dirname(dirname(checker));

const registry = JSON.parse(readFileSync(join(repoRoot, 'design-system/registry.json'), 'utf8'));
const registeredEntrypoints = [...registry.components, ...registry.patterns]
  .map(({ entrypoint }) => entrypoint)
  .sort();
const componentEntrypoints = readdirSync(join(repoRoot, 'components/ui'))
  .filter((file) => file.endsWith('.tsx'))
  .map((file) => file.replace(/\.tsx$/, ''))
  .sort();
if (JSON.stringify(registeredEntrypoints) !== JSON.stringify(componentEntrypoints)) {
  throw new Error(`Registry/component drift:\nregistered=${registeredEntrypoints.join(',')}\nfiles=${componentEntrypoints.join(',')}`);
}

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

const clean = runFixture(`export function Fixture() { return <div className="text-[var(--color-text-primary)]" />; }`);
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
  return <button type="button" aria-label="Close menu" onClick={onClose} className="fixed inset-0 z-[var(--z-overlay)] cursor-pointer bg-[var(--color-overlay)]" />;
}
`), 'N15 full-bleed scrim button is a dismiss layer, not a content control');

// ---- Registry-backed agent consistency rules -----------------------------

expectRules(runFixture(`
function InventedPanel() { return <section>Details</section>; }
export function Fixture() { return <InventedPanel />; }
`), ['N5'], 'N5 view-local component invention');

expectRules(runFixture(`
function InventedPanel() { return <section>Details</section>; }
export default () => <InventedPanel />;
`), ['N5'], 'N5 invention beside anonymous default page');

expectClean(runFixture(`
export function DeleteProjectButton() { return <Button>Delete project</Button>; }
`), 'N5 exported feature component in its own module');

expectRules(runFixture(`
export function InventedPanel() { return <section>Details</section>; }
`), ['N5'], 'N5 exported component cannot bypass invention rule when it owns DOM');

expectRules(runFixture(`
import { Button } from '@/components/ui/not-in-registry';
export function Fixture() { return <Button>Save changes</Button>; }
`), ['I1'], 'I1 unapproved component entrypoint');

expectClean(runFixture(`
import { Button, EmptyState } from '@/components/ui';
export function Fixture() { return <><Button>Save changes</Button><EmptyState title="No items" /></>; }
`), 'I1 registered exports through a project UI barrel');

expectRules(runFixture(`
import { Button, InventedPanel } from '@/components/ui';
export function Fixture() { return <><Button>Save changes</Button><InventedPanel /></>; }
`), ['I1'], 'I1 unknown export through a project UI barrel');

expectRules(runFixture(`
import { Camera } from 'lucide-react';
export function Fixture() { return <Camera />; }
`), ['N13'], 'N13 third-party icon import');

expectRules(runFixture(`
import { Add } from '@carbon/icons-react';
export function Fixture() { return <Add />; }
`), ['N13'], 'N13 direct Carbon import bypasses icon barrel');

expectRules(runFixture(`
export function Fixture() {
  return <><div className="z-50" /><div style={{ zIndex: 999 }} /></>;
}
`), ['N14'], 'N14 non-tokenized z-index');

expectRules(runFixture(`
export function Fixture() {
  return <><button className="cursor-pointer outline-none">Save changes</button><button className="cursor-pointer outline-none focus-visible:bg-[var(--color-surface-hover)]">Cancel</button></>;
}
`, 'components/ui'), ['N7'], 'N7 local focus replacement');

expectRules(runFixture(`
import { Button } from '@/components/ui/button';
export function Fixture() { return <Button className="rounded-none">Save changes</Button>; }
`), ['A16'], 'A16 Button styling override');

expectRules(runFixture(`
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { DataRow } from '@/components/ui/data-list';
export function Fixture() {
  return <><Badge className="px-8">Active</Badge><Card className="rounded-none" /><DataRow className="gap-8">Row</DataRow></>;
}
`), ['A16'], 'A16 chip, card, and row styling overrides');

expectClean(runFixture(`
import { Button } from '@/components/ui/button';
import { Add } from '@/components/icons';
export function Fixture() {
  return <div className="relative z-[var(--z-overlay)]"><Button><Add aria-hidden="true" />Save changes</Button></div>;
}
`, 'src/app'), 'registry rules in src layout');

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
