/**
 * Rule validation.
 *
 * Rules are the normative layer: they state what MUST, MUST NOT or SHOULD hold, and
 * every rule must name at least one fixture that demonstrates it. A rule with no
 * fixture is an untested assertion, and the governance document treats that as
 * unverifiable rather than merely incomplete, so this validator enforces it rather
 * than leaving it to review.
 *
 * It also resolves the reverse reference: schemas and models cite rule ids in prose,
 * and a citation that points at a rule which does not exist is worse than no citation
 * because it implies a constraint that nothing enforces.
 *
 * Run with `npm run validate:rules`.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  Reporter,
  asRecordArray,
  asString,
  asStringArray,
  isRecord,
  listFiles,
  loadSchemaRegistry,
  readYamlFile,
  repoPath,
  REPO_ROOT,
} from './validate-schema.js';

export const EXPECTED_RULE_FILE_COUNT = 15;

const SEVERITIES = new Set(['MUST', 'MUST_NOT', 'SHOULD', 'SHOULD_NOT', 'MAY']);
const RULE_ID = /^[a-z]+(?:\/[a-z0-9-]+)+$/;
const RULE_REFERENCE = /rule ([a-z]+(?:\/[a-z0-9-]+)+)/g;

export interface LoadedRule {
  readonly id: string;
  readonly file: string;
  readonly severity: string;
  readonly fixtures: readonly string[];
  readonly examples: readonly string[];
}

function collectDocumentIds(directory: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const file of listFiles(join(REPO_ROOT, directory), ['.yaml'])) {
    const parsed = readYamlFile(file);
    if (isRecord(parsed)) {
      const id = asString(parsed.id);
      if (id !== undefined) out.set(id, repoPath(file));
    }
  }
  return out;
}

export function loadRules(reporter: Reporter): LoadedRule[] {
  const rulesDir = join(REPO_ROOT, 'rules');
  const files = listFiles(rulesDir, ['.yaml']);
  const schemaIds = new Set(loadSchemaRegistry().map((entry) => entry.id));
  const modelIds = new Set(
    listFiles(join(REPO_ROOT, 'models'), ['.yaml']).map((file) =>
      repoPath(file)
        .replace(/^models\//, '')
        .replace(/\.yaml$/, ''),
    ),
  );
  const fixtureIds = collectDocumentIds('fixtures');
  const exampleIds = collectDocumentIds('examples');

  const out: LoadedRule[] = [];
  const seen = new Map<string, string>();

  for (const file of files) {
    const where = repoPath(file);
    const parsed = readYamlFile(file);
    if (!isRecord(parsed)) {
      reporter.fail(where, 'rule file is not a mapping');
      continue;
    }
    const relativeParts = where
      .replace(/^rules\//, '')
      .replace(/\.yaml$/, '')
      .split('/');
    const category = relativeParts[0];
    const stem = relativeParts[1];
    if (relativeParts.length !== 2 || category === undefined || stem === undefined) {
      reporter.fail(where, 'expected exactly rules/<category>/<file>.yaml');
      continue;
    }
    if (asString(parsed.category) !== category) {
      reporter.fail(where, `category must be ${category}`);
    }
    if (asString(parsed.file) !== stem) {
      reporter.fail(where, `file must be ${stem}`);
    }
    if (asString(parsed.apiVersion) !== 'amasario.dev/v1') reporter.fail(where, 'bad apiVersion');
    if (asString(parsed.specVersion) !== '1.0.0') reporter.fail(where, 'bad specVersion');

    const rules = asRecordArray(parsed.rules);
    if (rules.length === 0) reporter.fail(where, 'rule file must declare at least one rule');

    for (const rule of rules) {
      const id = asString(rule.id);
      if (id === undefined || !RULE_ID.test(id)) {
        reporter.fail(where, `invalid rule id ${String(id)}`);
        continue;
      }
      const previous = seen.get(id);
      if (previous !== undefined)
        reporter.fail(where, `duplicate rule id ${id} also in ${previous}`);
      seen.set(id, where);
      if (id.split('/')[0] !== category) {
        reporter.fail(where, `rule ${id} does not belong to category ${category}`);
      }
      const severity = asString(rule.severity);
      if (severity === undefined || !SEVERITIES.has(severity)) {
        reporter.fail(where, `rule ${id} has an invalid severity`);
      }
      if (typeof rule.statement !== 'string' || rule.statement.length < 100) {
        reporter.fail(where, `rule ${id} needs a specific normative statement`);
      }
      if (typeof rule.rationale !== 'string' || rule.rationale.length < 100) {
        reporter.fail(where, `rule ${id} needs a rationale explaining why it exists`);
      }

      const appliesTo = asRecordArray(rule.appliesTo);
      if (appliesTo.length === 0) reporter.fail(where, `rule ${id} declares no appliesTo targets`);
      for (const target of appliesTo) {
        const kind = asString(target.kind);
        const targetId = asString(target.id);
        if (targetId === undefined) {
          reporter.fail(where, `rule ${id} has an appliesTo entry without an id`);
          continue;
        }
        if (kind === 'schema') {
          if (!schemaIds.has(targetId))
            reporter.fail(where, `rule ${id} cites unknown schema ${targetId}`);
        } else if (kind === 'model') {
          if (!modelIds.has(targetId))
            reporter.fail(where, `rule ${id} cites unknown model ${targetId}`);
        } else {
          reporter.fail(where, `rule ${id} has an invalid appliesTo kind ${String(kind)}`);
        }
      }

      const fixtures = asStringArray(rule.fixtures);
      if (fixtures.length === 0) {
        reporter.fail(where, `rule ${id} names no fixture, so nothing demonstrates it`);
      }
      for (const fixture of fixtures) {
        if (!fixtureIds.has(fixture))
          reporter.fail(where, `rule ${id} cites unknown fixture ${fixture}`);
      }
      const examples = asStringArray(rule.examples);
      for (const example of examples) {
        if (!exampleIds.has(example))
          reporter.fail(where, `rule ${id} cites unknown example ${example}`);
      }
      if (asStringArray(rule.checks).length === 0) {
        reporter.fail(where, `rule ${id} declares no checks, so it cannot be shown to hold`);
      }
      if (asStringArray(rule.nonGoals).length === 0) {
        reporter.fail(where, `rule ${id} states no non-goals`);
      }

      out.push({ id, file: where, severity: severity ?? '', fixtures, examples });
    }
  }

  // Reverse references: schemas, models, fixtures and examples cite rule ids in prose,
  // and a citation pointing at a rule that does not exist implies a constraint that
  // nothing enforces. The files are read as text because citations live in
  // descriptions rather than in structured fields.
  const defined = new Set(out.map((rule) => rule.id));
  for (const directory of ['schema', 'models', 'fixtures', 'examples']) {
    for (const file of listFiles(join(REPO_ROOT, directory), ['.json', '.yaml'])) {
      for (const match of readFileSync(file, 'utf8').matchAll(RULE_REFERENCE)) {
        const referenced = match[1];
        if (referenced !== undefined && !defined.has(referenced)) {
          reporter.fail(repoPath(file), `cites rule ${referenced}, which does not exist`);
        }
      }
    }
  }

  if (files.length !== EXPECTED_RULE_FILE_COUNT) {
    reporter.fail(
      'rules/',
      `expected ${EXPECTED_RULE_FILE_COUNT} rule files, found ${files.length}`,
    );
  }
  return out;
}

function main(): number {
  const reporter = new Reporter('validate-rules');
  const rules = loadRules(reporter);

  // The taxonomy directory is read only to confirm the file count expectation is not
  // silently satisfied by a stray file.
  const extra = readdirSync(join(REPO_ROOT, 'rules')).filter((entry) => !entry.endsWith('.yaml'));
  for (const entry of extra) reporter.note(`rules/${entry} is not a rule file`);

  return reporter.finish(`${rules.length} rules across ${EXPECTED_RULE_FILE_COUNT} files`);
}

if (fileURLToPath(import.meta.url) === resolve(process.argv[1] ?? '')) {
  process.exitCode = main();
}
