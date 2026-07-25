#!/usr/bin/env node
// Machine enforcement of [lint]-tagged rules in design-rules/RULES.md.
// Run: npm run design-check
// Hardened after external review: comments are masked character-wise (not
// line-skipped), matching is case-insensitive, arbitrary font sizes are
// parsed numerically, and modern color functions (oklab, lab, lch, color())
// plus Tailwind palette utilities are caught.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import ts from 'typescript';

const ROOTS = ['app', 'components', 'examples', 'lib'];
const EXT = /\.(tsx|ts|jsx|js|css)$/;
const SKIP_DIRS = new Set(['node_modules', '.next', 'dist', 'tokens']);

// Mask comment CONTENT with spaces, preserving offsets and newlines, so
// banned patterns inside comments are ignored but code on the same line
// is still scanned (review finding: line-skip allowed same-line bypass).
function maskComments(src, isCss) {
  let out = '';
  let i = 0;
  const n = src.length;
  let mode = 'code'; // code | line | block | sq | dq | tpl
  while (i < n) {
    const c = src[i], d = src[i + 1];
    if (mode === 'code') {
      if (c === '/' && d === '*') { mode = 'block'; out += '  '; i += 2; continue; }
      if (!isCss && c === '/' && d === '/') { mode = 'line'; out += '  '; i += 2; continue; }
      if (!isCss && c === "'") { mode = 'sq'; out += c; i++; continue; }
      if (!isCss && c === '"') { mode = 'dq'; out += c; i++; continue; }
      if (!isCss && c === '`') { mode = 'tpl'; out += c; i++; continue; }
      out += c; i++; continue;
    }
    if (mode === 'block') {
      if (c === '*' && d === '/') { mode = 'code'; out += '  '; i += 2; continue; }
      out += c === '\n' ? '\n' : ' '; i++; continue;
    }
    if (mode === 'line') {
      if (c === '\n') { mode = 'code'; out += '\n'; i++; continue; }
      out += ' '; i++; continue;
    }
    // strings: keep content (class names live in strings and MUST be scanned)
    if (mode === 'sq' && c === "'" && src[i - 1] !== '\\') mode = 'code';
    if (mode === 'dq' && c === '"' && src[i - 1] !== '\\') mode = 'code';
    if (mode === 'tpl' && c === '`' && src[i - 1] !== '\\') mode = 'code';
    out += c; i++;
  }
  return out;
}

const TW_PALETTE =
  '(?:white|black|slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)';
const TW_COLOR_UTILITY = `(?:text|bg|border|ring|fill|stroke|outline|decoration|divide|from|via|to|accent|caret|shadow)-${TW_PALETTE}(?:-\\d{2,3})?(?:\\/\\d{1,3})?`;

const RULES = [
  {
    id: 'N1', desc: 'uppercase is banned',
    test: (src) => [...src.matchAll(/\buppercase\b|text-transform\s*:\s*uppercase|textTransform\s*:\s*['"]uppercase['"]/gi)],
  },
  {
    id: 'N2', desc: 'font sizes below 14px are banned',
    test: (src) => {
      const hits = [...src.matchAll(/\btext-xs\b/gi)];
      // arbitrary Tailwind sizes: text-[Npx] / text-[N.Nrem] etc
      for (const m of src.matchAll(/text-\[(\d+(?:\.\d+)?)(px|rem|em)\]/gi)) {
        const v = parseFloat(m[1]);
        const px = m[2].toLowerCase() === 'px' ? v : v * 16;
        if (px < 14) hits.push(m);
      }
      // CSS/inline font-size declarations
      for (const m of src.matchAll(/font-?[sS]ize\s*:\s*['"]?(\d+(?:\.\d+)?)(px|rem|em)/g)) {
        const v = parseFloat(m[1]);
        const px = m[2].toLowerCase() === 'px' ? v : v * 16;
        if (px < 14) hits.push(m);
      }
      // numeric JSX style: fontSize: 12
      for (const m of src.matchAll(/fontSize\s*:\s*(\d+(?:\.\d+)?)\s*[,}]/g)) {
        if (parseFloat(m[1]) < 14) hits.push(m);
      }
      return hits;
    },
  },
  {
    id: 'N3', desc: 'em/en-dashes are banned in copy',
    test: (src) => [...src.matchAll(/[\u2013\u2014]/g)],
  },
  {
    id: 'N4', desc: 'raw or palette color values banned (use --color-* tokens)',
    test: (src) => [
      ...src.matchAll(/#[0-9a-fA-F]{3,8}\b/g),
      ...src.matchAll(/\b(?:rgba?|hsla?|oklch|oklab|lab|lch|hwb|color)\s*\(/gi),
      ...src.matchAll(new RegExp(`(?:^|[\\s'"\`])(?:[^\\s'"\`]+:)*!?${TW_COLOR_UTILITY}\\b`, 'g')),
      ...src.matchAll(/var\(--(?:gray|white|black|overlay|error|warning|success|info|brand)-?[\w-]*\)/gi),
    ],
  },
  {
    id: 'N6', desc: 'positive letter-spacing / wide tracking banned',
    test: (src) => [...src.matchAll(/tracking-(wide|wider|widest)|letter-?[sS]pacing\s*:\s*['"]?0*\.?0*[1-9]/gi)],
  },
  {
    id: 'N7', desc: 'outline-none without focus-visible replacement',
    test: (src) => {
      const hits = [...src.matchAll(/outline-none|outline\s*:\s*none/gi)];
      return src.includes('focus-visible') ? [] : hits;
    },
  },
  {
    id: 'N13', desc: 'only @carbon/icons-react is allowed for icons',
    test: (src) => [...src.matchAll(/from\s+['"](lucide-react|react-icons|@heroicons|@tabler\/icons|@radix-ui\/react-icons|@fortawesome)['"]/gi)],
  },
  {
    id: 'N14', desc: 'z-index outside the --z-* scale',
    test: (src) => [...src.matchAll(/z-\[(?!var\(--z-)|z-index\s*:\s*(?!var\(--z-)\d|zIndex\s*:\s*\d/g)],
  },
];

// ---------------------------------------------------------------------------
// AST rules. A14, A15, N15 and C1 are about element structure, not text, so
// regex over the source cannot express them. They walk the TypeScript AST
// instead and each returns { line, snippet } hits.
// ---------------------------------------------------------------------------

function jsxAttribute(opening, name) {
  for (const property of opening.attributes.properties) {
    if (ts.isJsxAttribute(property) && property.name.getText() === name) return property;
  }
  return undefined;
}

// Every class name reachable from an element, following identifiers into their
// declarations so cn(tabBase, ...) and cva() variants count as the element's
// own classes. Merging all cva variants together is deliberate: it trades a
// few misses for near-zero false positives.
function classNamesFor(opening, declarations) {
  const attribute = jsxAttribute(opening, 'className');
  if (!attribute?.initializer) return '';
  const parts = [];
  const walk = (node, depth) => {
    if (!node || depth > 4) return;
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) { parts.push(node.text); return; }
    if (ts.isIdentifier(node)) {
      const declaration = declarations.get(node.text);
      if (declaration) walk(declaration, depth + 1);
      return;
    }
    ts.forEachChild(node, (child) => walk(child, depth));
  };
  walk(attribute.initializer, 0);
  return parts.join(' ');
}

const INTERACTIVE_PRIMITIVE = /\.(Trigger|Close|Item|Action|Cancel|Thumb|Tab|Link)$/;
const NON_INTERACTIVE_TAG = /^(div|span|li|tr|td|th|p|section|article|header|footer|aside|nav|ul|ol|figure|img|svg)$/;
const PADDING = /(?:^|\s)!?(?:p|px|pl|pr)-/;
// A fixed box centres its content, so the background cannot sit flush against
// it. `size-11` and the equivalent `h-11 w-11` pair both count.
const FIXED_SQUARE = /(?:^|\s)!?size-|(?:^|\s)!?h-\d.*(?:^|\s)!?w-\d|(?:^|\s)!?w-\d.*(?:^|\s)!?h-\d/s;
// A background that hugs its text: state-prefixed, or one of the tokens that
// only ever paints a chip, row or hover surface.
const HUGGING_BG = /(?:^|\s)[^\s]*:bg-|bg-\[var\(--color-(?:surface-hover|surface-active|brand-subtle|status-\w+-bg)\)\]/;

const AST_RULES = [
  {
    id: 'A14', desc: 'interactive element without cursor-pointer',
    check(sourceFile, { declarations }) {
      const hits = [];
      const visit = (node) => {
        const opening = ts.isJsxElement(node) ? node.openingElement
          : ts.isJsxSelfClosingElement(node) ? node : undefined;
        if (opening) {
          const tag = opening.tagName.getText();
          const isIntrinsic = /^[a-z]/.test(tag);
          const isButton = tag === 'button' || tag === 'summary';
          const isPrimitive = INTERACTIVE_PRIMITIVE.test(tag);
          // onClick on a system component inherits that component's cursor.
          const hasClick = jsxAttribute(opening, 'onClick') !== undefined && (isIntrinsic || isPrimitive);
          // asChild means the child element owns the DOM node and its classes.
          const delegates = jsxAttribute(opening, 'asChild') !== undefined;
          const isNativeLink = tag === 'a' && jsxAttribute(opening, 'href') !== undefined;
          if ((isButton || isPrimitive || hasClick) && !isNativeLink && !delegates) {
            const own = opening.getText(sourceFile);
            const resolved = classNamesFor(opening, declarations);
            if (!own.includes('cursor-pointer') && !resolved.includes('cursor-pointer')) {
              hits.push({ node: opening });
            }
          }
        }
        ts.forEachChild(node, visit);
      };
      visit(sourceFile);
      return hits;
    },
  },
  {
    id: 'A15', desc: 'element with its own background but no inner padding',
    check(sourceFile, { declarations }) {
      const hits = [];
      const visit = (node) => {
        // Self-closing elements have no text for the background to hug.
        const opening = ts.isJsxElement(node) ? node.openingElement : undefined;
        if (opening) {
          const tag = opening.tagName.getText();
          // Table rows and sections delegate padding to their cells, and
          // full-bleed overlays have no text to hug.
          const isDelegating = /^(tr|thead|tbody|tfoot|table)$/.test(tag);
          const classes = classNamesFor(opening, declarations);
          const isOverlay = classes.includes('inset-0');
          if (!isDelegating && !isOverlay && HUGGING_BG.test(classes)
              && !PADDING.test(classes) && !FIXED_SQUARE.test(classes)) {
            hits.push({ node: opening });
          }
        }
        ts.forEachChild(node, visit);
      };
      visit(sourceFile);
      return hits;
    },
  },
  {
    id: 'N15', desc: 'hand-built clickable element (use a system component)',
    // components/ui is where raw interactive elements are allowed to live.
    scope: (file) => !file.startsWith('components/ui/'),
    check(sourceFile) {
      const hits = [];
      const visit = (node) => {
        const opening = ts.isJsxElement(node) ? node.openingElement
          : ts.isJsxSelfClosingElement(node) ? node : undefined;
        if (opening) {
          const tag = opening.tagName.getText();
          const hasClick = jsxAttribute(opening, 'onClick') !== undefined;
          if (tag === 'button' && jsxAttribute(opening, 'className')) hits.push({ node: opening });
          else if (hasClick && NON_INTERACTIVE_TAG.test(tag)) hits.push({ node: opening });
        }
        ts.forEachChild(node, visit);
      };
      visit(sourceFile);
      return hits;
    },
  },
  {
    id: 'C1', desc: 'UI copy is not sentence case',
    check(sourceFile) {
      const hits = [];
      const flag = (text, node) => { if (copyProblem(text)) hits.push({ node }); };
      const visit = (node) => {
        if (ts.isJsxElement(node) && COPY_TAG.test(node.openingElement.tagName.getText())) {
          // Pure text only. Anything with an interpolation is runtime copy we
          // cannot judge, and partial text fragments read as false positives.
          const children = node.children.filter((child) => !(ts.isJsxText(child) && child.text.trim() === ''));
          if (children.length === 1 && ts.isJsxText(children[0])) {
            flag(children[0].text.trim(), children[0]);
          }
        }
        const opening = ts.isJsxElement(node) ? node.openingElement
          : ts.isJsxSelfClosingElement(node) ? node : undefined;
        if (opening) {
          for (const name of ['title', 'label', 'confirmLabel', 'cancelLabel']) {
            const attribute = jsxAttribute(opening, name);
            const value = attribute?.initializer;
            if (value && ts.isStringLiteral(value)) flag(value.text, value);
          }
        }
        ts.forEachChild(node, visit);
      };
      visit(sourceFile);
      return hits;
    },
  },
];

const COPY_TAG = /^(button|Button|h[1-6]|Label|CardTitle|DialogTitle|AlertTitle|AlertDialogTitle)$/;
// Words that carry no case signal in a title.
const SMALL_WORDS = new Set(['a', 'an', 'the', 'and', 'or', 'but', 'of', 'in', 'on', 'to', 'for', 'with', 'at', 'by', 'from', 'as', 'is', 'it', 'per', 'via', 'up', 'off']);
// Capitalising one of these mid-string means Title Case, not a proper noun.
// Deliberately a vocabulary list and not a rule: it keeps names like
// "Anna Lindqvist" and "Stena Line" out of the results.
const UI_VOCABULARY = new Set(['save', 'saved', 'cancel', 'delete', 'deleted', 'remove', 'removed', 'edit', 'create', 'created', 'add', 'added', 'new', 'change', 'changes', 'settings', 'member', 'members', 'invite', 'account', 'profile', 'password', 'email', 'name', 'source', 'sources', 'item', 'items', 'view', 'detail', 'details', 'all', 'more', 'less', 'back', 'next', 'previous', 'continue', 'done', 'close', 'open', 'upload', 'download', 'export', 'import', 'search', 'filter', 'sort', 'select', 'choose', 'apply', 'reset', 'clear', 'confirm', 'submit', 'send', 'share', 'copy', 'move', 'rename', 'archive', 'archived', 'restore', 'publish', 'published', 'draft', 'preview', 'help', 'about', 'home', 'dashboard', 'overview', 'activity', 'history', 'notification', 'notifications', 'team', 'teams', 'project', 'projects', 'user', 'users', 'file', 'files', 'folder', 'folders', 'page', 'pages', 'report', 'reports', 'list', 'lists', 'group', 'groups', 'tag', 'tags', 'label', 'labels', 'status', 'type', 'date', 'time', 'size', 'action', 'actions', 'options', 'general', 'security', 'privacy', 'billing', 'plan', 'usage', 'log', 'logs', 'key', 'keys', 'token', 'tokens', 'connect', 'connected', 'disconnect', 'started', 'get', 'learn', 'read', 'write', 'manage', 'configure', 'enable', 'disable', 'start', 'stop', 'pause', 'paused', 'resume', 'retry', 'refresh', 'update', 'upgrade', 'install', 'workspace', 'workspaces', 'frequency', 'attention']);
// Acronyms that are allowed to stay capitalised.
const ACRONYMS = new Set(['OK', 'API', 'PDF', 'CSV', 'URL', 'ID', 'UI', 'UX', 'AI', 'SEO', 'HTML', 'CSS', 'RSS', 'PIN', 'OTP', 'SSO', 'FAQ', 'GDPR', 'JSON', 'XML', 'SQL', 'CPU', 'DNS', 'SMS', 'PDF', 'ZIP', 'GIF', 'PNG', 'JPG', 'SVG', 'MFA', 'VAT', 'EU', 'US', 'UK']);
// First words that are lowercase on purpose.
const LOWERCASE_BRANDS = new Set(['npm', 'iOS', 'iPhone', 'iPad', 'eBay', 'macOS', 'base-ds', 'ux', 'ui']);

function copyProblem(text) {
  const value = text.replace(/\s+/g, ' ').trim();
  if (!value || /^[^\p{L}]*$/u.test(value)) return false;
  const words = value.split(' ');

  for (const word of words) {
    const bare = word.replace(/[^\p{L}]/gu, '');
    if (bare.length >= 2 && bare === bare.toUpperCase() && /\p{L}/u.test(bare) && !ACRONYMS.has(bare)) {
      return true; // shouting
    }
  }

  for (const word of words.slice(1)) {
    const bare = word.replace(/[^\p{L}]/gu, '');
    if (!bare || SMALL_WORDS.has(bare.toLowerCase())) continue;
    const capitalised = bare[0] === bare[0].toUpperCase() && bare.slice(1) !== bare.slice(1).toUpperCase();
    if (capitalised && UI_VOCABULARY.has(bare.toLowerCase())) return true; // Title Case
  }

  const first = words[0].replace(/[^\p{L}-]/gu, '');
  if (first && /^\p{Ll}/u.test(first) && !LOWERCASE_BRANDS.has(first)) return true; // lowercase label

  return false;
}

const violations = [];
const exemptions = [];

function buildDeclarations(sourceFile) {
  const declarations = new Map();
  const visit = (node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
      declarations.set(node.name.text, node.initializer);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return declarations;
}

function collectConstantValues(sourceFile) {
  const declarations = new Map();
  const results = [];

  function evaluate(node, stack = new Set()) {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
    if (ts.isNumericLiteral(node)) return Number(node.text);
    if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isTypeAssertionExpression(node)) {
      return evaluate(node.expression, stack);
    }
    if (ts.isIdentifier(node)) {
      if (stack.has(node.text)) return undefined;
      const initializer = declarations.get(node.text);
      if (!initializer) return undefined;
      return evaluate(initializer, new Set([...stack, node.text]));
    }
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
      const left = evaluate(node.left, stack);
      const right = evaluate(node.right, stack);
      if ((typeof left === 'string' || typeof left === 'number') && (typeof right === 'string' || typeof right === 'number')) {
        return String(left) + String(right);
      }
    }
    if (ts.isTemplateExpression(node)) {
      let value = node.head.text;
      for (const span of node.templateSpans) {
        const expression = evaluate(span.expression, stack);
        if (typeof expression !== 'string' && typeof expression !== 'number') return undefined;
        value += String(expression) + span.literal.text;
      }
      return value;
    }
    if (ts.isArrayLiteralExpression(node)) {
      const values = node.elements.map((element) => evaluate(element, stack));
      return values.every((value) => typeof value === 'string' || typeof value === 'number') ? values : undefined;
    }
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === 'join'
    ) {
      const target = evaluate(node.expression.expression, stack);
      const separator = node.arguments.length === 0 ? ',' : evaluate(node.arguments[0], stack);
      if (Array.isArray(target) && typeof separator === 'string') return target.join(separator);
    }
    return undefined;
  }

  function visit(node) {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
      declarations.set(node.name.text, node.initializer);
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);

  function collect(node) {
    const value = evaluate(node);
    if (typeof value === 'string' && !ts.isStringLiteral(node) && !ts.isNoSubstitutionTemplateLiteral(node)) {
      results.push({ value, node });
    }
    if (ts.isComputedPropertyName(node)) {
      const property = evaluate(node.expression);
      if (typeof property === 'string') results.push({ value: property, node });
    }
    ts.forEachChild(node, collect);
  }
  collect(sourceFile);
  return results;
}

// ---------------------------------------------------------------------------
// Exemptions. A rule that cannot be followed is declared in the file, with a
// reason, and reported in the summary. Never by editing this checker: a hard
// coded skip list is invisible, and invisible exemptions never get revisited.
//
//   /* design-check-exempt: reason */   in the first 10 lines  -> whole file
//   /* design-check-exempt: reason */   anywhere else          -> that line
//                                                                 and the next
// ---------------------------------------------------------------------------

const EXEMPT_DIRECTIVE = /design-check-exempt:([^*\n]*)/;
const FILE_EXEMPT_LINES = 10;

function readExemptions(file, lines) {
  const fileLevel = [];
  const byLine = new Map();
  const malformed = [];

  lines.forEach((text, index) => {
    const match = EXEMPT_DIRECTIVE.exec(text);
    if (!match) return;
    const lineNo = index + 1;
    const reason = match[1].replace(/\*\/.*$/, '').trim();
    if (!reason) {
      malformed.push({ file, line: lineNo, rule: 'EXEMPT', desc: 'design-check-exempt needs a reason', snippet: text.trim().slice(0, 80) });
      return;
    }
    if (lineNo <= FILE_EXEMPT_LINES) fileLevel.push({ file, line: lineNo, reason, scope: 'file' });
    else byLine.set(lineNo, { file, line: lineNo, reason, scope: 'line' });
  });

  return { fileLevel, byLine, malformed };
}

function scan(dir) {
  let entries;
  try { entries = readdirSync(dir); } catch { return; }
  for (const entry of entries) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (!SKIP_DIRS.has(entry)) scan(full);
      continue;
    }
    if (!EXT.test(entry)) continue;
    const raw = readFileSync(full, 'utf8');
    const src = maskComments(raw, entry.endsWith('.css'));
    const lines = raw.split('\n');
    const file = relative(process.cwd(), full);

    // Read from the raw source: maskComments has already blanked the reason.
    const exempt = readExemptions(file, lines);
    exemptions.push(...exempt.fileLevel, ...exempt.byLine.values());
    violations.push(...exempt.malformed);
    const isExempt = (lineNo) =>
      exempt.fileLevel.length > 0 || exempt.byLine.has(lineNo) || exempt.byLine.has(lineNo - 1);
    const report = (v) => { if (!isExempt(v.line)) violations.push(v); };

    for (const rule of RULES) {
      for (const m of rule.test(src)) {
        const lineNo = src.slice(0, m.index).split('\n').length;
        const line = lines[lineNo - 1] ?? '';
        if (rule.filter && !rule.filter(line)) continue;
        report({ file, line: lineNo, rule: rule.id, desc: rule.desc, snippet: line.trim().slice(0, 80) });
      }
    }

    if (!entry.endsWith('.css')) {
      const sourceFile = ts.createSourceFile(full, raw, ts.ScriptTarget.Latest, true, entry.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
      const declarations = buildDeclarations(sourceFile);
      for (const rule of AST_RULES) {
        if (rule.scope && !rule.scope(file)) continue;
        for (const { node } of rule.check(sourceFile, { declarations, file })) {
          const lineNo = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
          const line = lines[lineNo - 1] ?? '';
          report({ file, line: lineNo, rule: rule.id, desc: rule.desc, snippet: line.trim().slice(0, 80) });
        }
      }
      for (const { value, node } of collectConstantValues(sourceFile)) {
        for (const rule of RULES.filter(({ id }) => ['N1', 'N2', 'N4'].includes(id))) {
          if (rule.test(value).length === 0) continue;
          const lineNo = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
          const line = lines[lineNo - 1] ?? '';
          report({ file, line: lineNo, rule: rule.id, desc: rule.desc, snippet: line.trim().slice(0, 80) });
        }
      }
    }
  }
}

for (const root of ROOTS) scan(join(process.cwd(), root));

// Exemptions are printed on every run, pass or fail. An exemption nobody sees
// is the same thing as no rule at all.
function printExemptions() {
  if (exemptions.length === 0) return;
  console.log(`\ndesign-check: ${exemptions.length} exemption(s)`);
  for (const e of exemptions) {
    const where = e.scope === 'file' ? `${e.file} (whole file)` : `${e.file}:${e.line}`;
    console.log(`  ${where}  ${e.reason}`);
  }
}

if (violations.length === 0) {
  console.log('design-check: all [lint] rules pass.');
  printExemptions();
  process.exit(0);
}

console.error(`design-check: ${violations.length} violation(s)\n`);
for (const v of violations) {
  console.error(`  ${v.rule}  ${v.file}:${v.line}  ${v.desc}`);
  console.error(`      ${v.snippet}`);
}
console.error('\nSee design-rules/RULES.md for the full rule text.');
printExemptions();
process.exit(1);
