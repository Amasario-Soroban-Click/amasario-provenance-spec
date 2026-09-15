/**
 * Taxonomy validation.
 *
 * A taxonomy is a controlled vocabulary. Its value depends entirely on it being the
 * single source of truth for its term set, so this validator checks two directions:
 * every location a taxonomy claims to govern must hold exactly that term set, and any
 * enumeration in a schema that happens to equal a term set must be one of those
 * declared locations. The second direction is what stops a restated enum from drifting
 * away from its taxonomy unnoticed.
 *
 * Run with `npm run validate:taxonomies`.
 */
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import {
  Reporter,
  asRecordArray,
  asString,
  asStringArray,
  collectLiteralEnums,
  isRecord,
  loadSchemaRegistry,
  readYamlFile,
  repoPath,
  REPO_ROOT,
  resolveJsonPointer,
} from './validate-schema.js';

export const EXPECTED_TAXONOMY_COUNT = 10;

const TERM_ID = /^[A-Z][A-Z0-9_]*$/;
const OPENNESS = new Set(['open', 'closed']);

interface TaxonomyTerm {
  readonly id: string;
  readonly label: string;
  readonly description: string;
}

export interface LoadedTaxonomy {
  readonly file: string;
  readonly id: string;
  readonly openness: string;
  readonly consumersMustHandleUnknown: boolean;
  readonly terms: readonly TaxonomyTerm[];
  readonly usedBy: readonly { file: string; pointer: string }[];
}

function loadTerm(
  where: string,
  raw: Record<string, unknown>,
  reporter: Reporter,
): TaxonomyTerm | undefined {
  const id = asString(raw.id);
  const label = asString(raw.label);
  const description = asString(raw.description);
  if (id === undefined || !TERM_ID.test(id)) {
    reporter.fail(where, `term id ${String(raw.id)} must be UPPER_SNAKE_CASE`);
    return undefined;
  }
  if (label === undefined || label.length === 0) reporter.fail(where, `term ${id} has no label`);
  if (description === undefined || description.length < 30) {
    reporter.fail(where, `term ${id} needs an explanatory description`);
  }
  if (asString(raw.introducedIn) !== '1.0.0') {
    reporter.fail(where, `term ${id} must declare introducedIn: 1.0.0`);
  }
  return { id, label: label ?? '', description: description ?? '' };
}

export function loadTaxonomies(reporter: Reporter): LoadedTaxonomy[] {
  const dir = join(REPO_ROOT, 'taxonomies');
  const files = readdirSync(dir)
    .filter((entry) => entry.endsWith('.yaml'))
    .sort();

  const out: LoadedTaxonomy[] = [];
  for (const entry of files) {
    const file = join(dir, entry);
    const where = repoPath(file);
    const parsed = readYamlFile(file);
    if (!isRecord(parsed)) {
      reporter.fail(where, 'taxonomy is not a mapping');
      continue;
    }
    const id = asString(parsed.id);
    const stem = entry.replace(/\.yaml$/, '');
    if (id !== stem) reporter.fail(where, `id must equal the file stem (${stem})`);

    const openness = asString(parsed.openness);
    if (openness === undefined || !OPENNESS.has(openness)) {
      reporter.fail(where, `openness must be one of ${[...OPENNESS].join(', ')}`);
    }
    const consumersMustHandleUnknown = parsed.consumersMustHandleUnknown;
    if (typeof consumersMustHandleUnknown !== 'boolean') {
      reporter.fail(where, 'consumersMustHandleUnknown must be a boolean');
    } else if (consumersMustHandleUnknown !== (openness === 'open')) {
      reporter.fail(
        where,
        `consumersMustHandleUnknown must be ${String(openness === 'open')} for an ${String(openness)} taxonomy: an unknown term in a closed vocabulary makes a computation undefined, so a consumer must reject the document rather than guess`,
      );
    }
    if (typeof parsed.description !== 'string' || parsed.description.length < 80) {
      reporter.fail(where, 'description must explain the vocabulary and its intended use');
    }

    const rawTerms = asRecordArray(parsed.terms);
    if (rawTerms.length === 0) reporter.fail(where, 'taxonomy must declare at least one term');
    const terms: TaxonomyTerm[] = [];
    for (const raw of rawTerms) {
      const term = loadTerm(where, raw, reporter);
      if (term !== undefined) terms.push(term);
    }
    const ids = terms.map((term) => term.id);
    if (new Set(ids).size !== ids.length) reporter.fail(where, 'term ids must be unique');

    const usedBy: { file: string; pointer: string }[] = [];
    for (const raw of asRecordArray(parsed.usedBy)) {
      const target = asString(raw.file);
      const pointer = asString(raw.pointer);
      if (target === undefined || pointer === undefined) {
        reporter.fail(where, 'usedBy entries need file and pointer');
        continue;
      }
      usedBy.push({ file: target, pointer });
    }
    if (usedBy.length === 0) {
      reporter.fail(
        where,
        'taxonomy must declare at least one usedBy location so schema drift is detectable',
      );
    }

    out.push({
      file: where,
      id: id ?? stem,
      openness: openness ?? 'unknown',
      consumersMustHandleUnknown: consumersMustHandleUnknown === true,
      terms,
      usedBy,
    });
  }
  return out;
}

function main(): number {
  const reporter = new Reporter('validate-taxonomies');
  const taxonomies = loadTaxonomies(reporter);
  const schemas = loadSchemaRegistry();
  const schemaByFile = new Map(
    schemas.map((entry) => [repoPath(entry.file).replace(/^schema\//, ''), entry]),
  );

  const declaredLocations = new Set<string>();

  for (const taxonomy of taxonomies) {
    const terms = [...taxonomy.terms.map((term) => term.id)].sort();
    for (const usage of taxonomy.usedBy) {
      const relativeFile = usage.file.replace(/^schema\//, '');
      const schema = schemaByFile.get(relativeFile);
      if (schema === undefined) {
        reporter.fail(taxonomy.file, `usedBy references a missing schema: ${usage.file}`);
        continue;
      }
      const node = resolveJsonPointer(schema.document, usage.pointer);
      if (!isRecord(node) || !asStringArray(node.enum).length) {
        reporter.fail(
          taxonomy.file,
          `usedBy ${usage.file}${usage.pointer} does not resolve to a literal string enum`,
        );
        continue;
      }
      const found = [...asStringArray(node.enum)].sort();
      if (found.join(',') !== terms.join(',')) {
        reporter.fail(
          taxonomy.file,
          `${usage.file}${usage.pointer} does not match the term set\n  taxonomy: ${terms.join(',')}\n  schema:   ${found.join(',')}`,
        );
      }
      declaredLocations.add(`${relativeFile}${usage.pointer}`);
    }
  }

  // The reverse direction: an enum that equals a term set but was not declared is a
  // restatement waiting to drift.
  for (const schema of schemas) {
    const relativeFile = repoPath(schema.file).replace(/^schema\//, '');
    for (const location of collectLiteralEnums(schema.document, relativeFile)) {
      for (const taxonomy of taxonomies) {
        const terms = taxonomy.terms.map((term) => term.id).sort();
        if (location.terms.join(',') !== terms.join(',')) continue;
        if (!declaredLocations.has(`${relativeFile}${location.pointer}`)) {
          reporter.fail(
            relativeFile,
            `enum at ${location.pointer || '/'} restates the ${taxonomy.id} term set but is not declared in its usedBy, so it can drift unnoticed`,
          );
        }
      }
    }
  }

  if (taxonomies.length !== EXPECTED_TAXONOMY_COUNT) {
    reporter.fail(
      'taxonomies/',
      `expected ${EXPECTED_TAXONOMY_COUNT} taxonomies, found ${taxonomies.length}`,
    );
  }

  return reporter.finish(`${taxonomies.length} taxonomies across ${schemas.length} schemas`);
}

if (fileURLToPath(import.meta.url) === resolve(process.argv[1] ?? '')) {
  process.exitCode = main();
}
