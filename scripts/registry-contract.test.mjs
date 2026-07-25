import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const uiRoot = join(repoRoot, 'components/ui');
const registry = JSON.parse(readFileSync(join(repoRoot, 'design-system/registry.json'), 'utf8'));
const entries = [...registry.components, ...registry.patterns];

function sortedUnique(values) {
  return [...new Set(values)].sort();
}

function sourceExports(file) {
  const source = readFileSync(join(uiRoot, file), 'utf8');
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const exports = [];

  for (const statement of sourceFile.statements) {
    if (ts.isExportDeclaration(statement) && statement.exportClause && ts.isNamedExports(statement.exportClause)) {
      exports.push(...statement.exportClause.elements.map((element) => element.name.text));
      continue;
    }

    if ((ts.getCombinedModifierFlags(statement) & ts.ModifierFlags.Export) === 0) continue;
    if (statement.name && ts.isIdentifier(statement.name)) {
      exports.push(statement.name.text);
    } else if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name)) exports.push(declaration.name.text);
      }
    }
  }

  return sortedUnique(exports);
}

const files = readdirSync(uiRoot).filter((file) => file.endsWith('.tsx'));
const entrypoints = files.map((file) => file.replace(/\.tsx$/, '')).sort();
assert.equal(new Set(entries.map(({ entrypoint }) => entrypoint)).size, entries.length, 'Registry entrypoints must be unique.');
assert.deepEqual(sortedUnique(entries.map(({ entrypoint }) => entrypoint)), entrypoints, 'Registry entrypoints must match components/ui files.');

const dataListSource = readFileSync(join(uiRoot, 'data-list.tsx'), 'utf8');
assert.match(
  dataListSource,
  /trailing && <span className="relative z-\[var\(--z-raised\)\] shrink-0">/,
  'DataRow trailing actions must stay above the stretched row control.',
);

for (const entry of entries) {
  assert.deepEqual(
    sortedUnique(entry.exports),
    sourceExports(`${entry.entrypoint}.tsx`),
    `Registry exports must match components/ui/${entry.entrypoint}.tsx.`,
  );
  assert.ok(entry.exports.length > 0, `${entry.entrypoint} must expose at least one named export.`);
  if (entry.classNamePolicy !== undefined) {
    assert.equal(entry.classNamePolicy, 'system-owned', `${entry.entrypoint} has an unknown classNamePolicy.`);
  }
}

const inventory = readFileSync(join(uiRoot, 'README.md'), 'utf8');
const documentedEntrypoints = [...inventory.matchAll(/^\| `([^`]+)` \| Available \|/gm)].map((match) => match[1]);
assert.deepEqual(sortedUnique(documentedEntrypoints), entrypoints, 'README inventory must list every UI entrypoint exactly once.');
assert.equal(documentedEntrypoints.length, entrypoints.length, 'README inventory contains duplicate entrypoints.');

const claudeSkill = readFileSync(join(repoRoot, '.claude/skills/ux-patterns/SKILL.md'), 'utf8');
const codexSkill = readFileSync(join(repoRoot, '.codex/skills/ux-patterns/SKILL.md'), 'utf8');
assert.equal(claudeSkill, codexSkill, 'Claude and Codex ux-patterns skills must be byte-identical.');

const exportsByEntrypoint = new Map(entries.map((entry) => [entry.entrypoint, new Set(entry.exports)]));
const mappedSymbols = new Set();
for (const match of claudeSkill.matchAll(/^\| ((?:`[^`]+`(?:, )?)+) \| ((?:`@\/components\/ui\/[^`]+`(?: or )?)+) \|$/gm)) {
  const symbols = [...match[1].matchAll(/`([^`]+)`/g)].map((symbolMatch) => symbolMatch[1]);
  const paths = [...match[2].matchAll(/`@\/components\/ui\/([^`]+)`/g)].map((pathMatch) => pathMatch[1]);
  for (const path of paths) assert.ok(exportsByEntrypoint.has(path), `Skill maps to missing entrypoint: ${path}.`);
  for (const symbol of symbols) {
    mappedSymbols.add(symbol);
    assert.ok(paths.some((path) => exportsByEntrypoint.get(path).has(symbol)), `Skill maps ${symbol} to an entrypoint that does not export it.`);
  }
}

const namedComponents = sortedUnique([...claudeSkill.matchAll(/`([A-Z][A-Za-z0-9]+)`/g)].map((match) => match[1]));
const allExports = new Set(entries.flatMap((entry) => entry.exports));
for (const symbol of namedComponents) {
  assert.ok(allExports.has(symbol), `Skill names a component that is not exported: ${symbol}.`);
  assert.ok(mappedSymbols.has(symbol), `Skill component is missing from the component map: ${symbol}.`);
}

console.log(`Registry contract verified for ${entrypoints.length} UI entrypoints.`);
