/**
 * Fixture and example validation.
 *
 * Two kinds of artefact are checked here. A valid fixture or example MUST validate
 * against the schema it targets. An invalid fixture MUST fail, and it MUST fail with
 * the exact keyword and instance path it declares. That second requirement is what
 * makes the invalid fixtures worth having: a fixture that merely fails proves the
 * schema rejects something, whereas one that fails for the declared reason proves the
 * specific constraint works.
 *
 * Examples are validated by the same harness as fixtures. Documentation that drifts
 * from the schemas is worse than no documentation, because readers trust it.
 *
 * Documents that carry their own evidence records are additionally checked for
 * cross-reference integrity: every evidence reference must resolve, and every
 * referenced attestation must be present.
 *
 * Run with `npm run validate:fixtures`.
 */
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  Reporter,
  asRecordArray,
  asString,
  describeAjvErrors,
  isRecord,
  listFiles,
  loadSchemaRegistry,
  readYamlFile,
  repoPath,
  REPO_ROOT,
} from './validate-schema.js';
import { createValidator } from './validate-schema.js';

export const EXPECTED_FIXTURE_COUNT = 17;
export const EXPECTED_EXAMPLE_COUNT = 8;

/**
 * Schemas deliberately not exercised by a fixture or example, and where they are
 * exercised instead.
 *
 * Four schemas describe records that stand outside a provenance document tree: a
 * diff compares two snapshots, and an invocation, an event and an error are records
 * an implementation produces about an observation or a failure. None of them is
 * reachable by `$ref` from a document a fixture can target, and this repository
 * performs no analysis, so a fixture here would be asserting the shape of a record
 * that no artefact in this repository can produce -- an example that looked
 * authoritative while resting on nothing.
 *
 * They are not left unverified. `tests/schema` accepts a well-formed instance of each
 * and rejects a malformed one, which is the property a fixture would actually have
 * established. The substitution is recorded per schema so that an exemption always
 * names its substitute; an exemption that could not would be a gap.
 */
const EXERCISED_BY_TESTS_INSTEAD: Readonly<Record<string, string>> = {
  'https://amasario.dev/spec/v1/schema/diff.schema.json':
    'tests/schema (`diff schema` cases) rather than a fixture',
  'https://amasario.dev/spec/v1/schema/error.schema.json':
    'tests/schema (`error schema` cases) rather than a fixture',
  'https://amasario.dev/spec/v1/schema/event.schema.json':
    'tests/schema (`event schema` cases) rather than a fixture',
  'https://amasario.dev/spec/v1/schema/invocation.schema.json':
    'tests/schema (`invocation schema` cases) rather than a fixture',
};

interface Reference {
  readonly id: string;
  readonly where: string;
}

interface DocumentIndex {
  readonly evidenceIds: Set<string>;
  readonly evidenceRefs: Reference[];
  readonly attestationIds: Set<string>;
  readonly attestationRefs: Reference[];
}

/**
 * Walks a document collecting evidence and attestation definitions and references.
 *
 * The distinction is structural rather than schema-driven: an array of objects with
 * string ids under a known key defines entities, while an array of strings or a scalar
 * under a known key references one. This is deliberately applied only to documents
 * that define evidence, so a fragment fixture is validated structurally and not
 * penalised for referencing evidence defined elsewhere.
 */
function indexDocument(document: unknown, pointer = ''): DocumentIndex {
  const index: DocumentIndex = {
    evidenceIds: new Set<string>(),
    evidenceRefs: [],
    attestationIds: new Set<string>(),
    attestationRefs: [],
  };

  const visit = (node: unknown, path: string): void => {
    if (Array.isArray(node)) {
      node.forEach((entry, i) => {
        visit(entry, `${path}/${i}`);
      });
      return;
    }
    if (!isRecord(node)) return;

    for (const [key, value] of Object.entries(node)) {
      const childPath = `${path}/${key}`;

      if (key === 'evidence' && Array.isArray(value)) {
        for (const [i, entry] of value.entries()) {
          if (typeof entry === 'string') {
            index.evidenceRefs.push({ id: entry, where: `${childPath}/${i}` });
          } else if (isRecord(entry)) {
            const id = asString(entry.id);
            if (id !== undefined) index.evidenceIds.add(id);
          }
        }
      }

      if (key === 'contradictingEvidence' && Array.isArray(value)) {
        for (const [i, entry] of value.entries()) {
          if (typeof entry === 'string') {
            index.evidenceRefs.push({ id: entry, where: `${childPath}/${i}` });
          }
        }
      }

      if (key === 'attestations' && Array.isArray(value)) {
        for (const [i, entry] of value.entries()) {
          if (typeof entry === 'string') {
            index.attestationRefs.push({ id: entry, where: `${childPath}/${i}` });
          } else if (isRecord(entry)) {
            const id = asString(entry.id);
            if (id !== undefined) index.attestationIds.add(id);
          }
        }
      }

      if (key === 'attestationId' && typeof value === 'string') {
        index.attestationRefs.push({ id: value, where: childPath });
      }

      visit(value, childPath);
    }
  };

  visit(document, pointer);
  return index;
}

export function checkCrossReferences(reporter: Reporter, where: string, document: unknown): void {
  const index = indexDocument(document);

  // Only enforce reference resolution when the document actually defines evidence.
  // A fragment fixture such as a dependency edge references evidence that lives in the
  // document that will contain it, and treating that as a dangling reference would
  // force every fragment to embed evidence it does not own.
  if (index.evidenceIds.size > 0) {
    for (const ref of index.evidenceRefs) {
      if (!index.evidenceIds.has(ref.id)) {
        reporter.fail(
          where,
          `${ref.where} references evidence ${ref.id}, which the document does not define`,
        );
      }
    }
  }
  if (index.attestationIds.size > 0) {
    for (const ref of index.attestationRefs) {
      if (!index.attestationIds.has(ref.id)) {
        reporter.fail(
          where,
          `${ref.where} references attestation ${ref.id}, which the document does not define`,
        );
      }
    }
  }
}

/**
 * The transitive `$ref` closure from the schemas a fixture names directly.
 *
 * Coverage is counted over reachability rather than over direct targets, because a
 * composite document validates its sub-schemas as a side effect: a fixture targeting
 * `provenance.schema.json` genuinely exercises the contract, wasm, source, build,
 * artifact, deployment, evidence, confidence and attestation schemas, and counting
 * only the named target reports those as untested when they are tested hardest.
 */
function referenceClosure(direct: ReadonlySet<string>): Set<string> {
  const registry = new Map(loadSchemaRegistry().map((entry) => [entry.id, entry.document]));
  const reachable = new Set<string>();
  const pending = [...direct];
  while (pending.length > 0) {
    const id = pending.pop();
    if (id === undefined || reachable.has(id) || !registry.has(id)) continue;
    reachable.add(id);
    // A reference is a `$ref` to a known schema id. Matching against the registry's
    // own ids avoids parsing `$ref` strings, and a `$ref` that does not name a known
    // schema never resolves, so the registry compilation would have failed already.
    const serialised = JSON.stringify(registry.get(id));
    for (const candidate of registry.keys()) {
      if (candidate !== id && !reachable.has(candidate) && serialised.includes(candidate)) {
        pending.push(candidate);
      }
    }
  }
  return reachable;
}

function main(): number {
  const reporter = new Reporter('validate-fixtures');
  const ajv = createValidator();
  const schemaIds = new Set(loadSchemaRegistry().map((entry) => entry.id));

  // Every schema must be reachable through some fixture, otherwise a schema could drift
  // without any fixture noticing.
  const coveredSchemas = new Set<string>();
  let fixtureCount = 0;
  let exampleCount = 0;

  const groups: { directory: string; kind: 'fixtures' | 'examples' }[] = [
    { directory: 'fixtures', kind: 'fixtures' },
    { directory: 'examples', kind: 'examples' },
  ];

  for (const group of groups) {
    for (const file of listFiles(join(REPO_ROOT, group.directory), ['.yaml'])) {
      const where = repoPath(file);
      if (group.kind === 'fixtures') fixtureCount++;
      else exampleCount++;

      const parsed = readYamlFile(file);
      if (!isRecord(parsed)) {
        reporter.fail(where, 'artefact is not a mapping');
        continue;
      }
      if (asString(parsed.apiVersion) !== 'amasario.dev/v1') reporter.fail(where, 'bad apiVersion');
      if (asString(parsed.specVersion) !== '1.0.0') reporter.fail(where, 'bad specVersion');
      if (typeof parsed.description !== 'string' || parsed.description.length < 80) {
        reporter.fail(where, 'description must explain what the artefact demonstrates');
      }
      // Every fixture and example in this repository is a synthetic instance. Recording
      // that here keeps a reader from mistaking one for an observation about a real
      // network, and keeps the claim machine-checkable.
      if (parsed.synthetic !== true) {
        reporter.fail(
          where,
          'must declare synthetic: true, because these are illustrative instances',
        );
      }

      const underInvalid = where.includes('/invalid/');
      const declaredKind = asString(parsed.kind);

      if (group.kind === 'examples') {
        if (declaredKind !== 'valid') reporter.fail(where, 'example kind must be valid');
      } else if (underInvalid) {
        if (declaredKind !== 'invalid')
          reporter.fail(where, 'artefact under invalid/ must have kind: invalid');
      } else if (declaredKind !== 'valid') {
        reporter.fail(where, 'fixture outside invalid/ must have kind: valid');
      }
      if (declaredKind === 'valid') {
        const target = asString(parsed.target);
        if (target === undefined || !schemaIds.has(target)) {
          reporter.fail(where, `target must be a known schema id, got ${String(target)}`);
          continue;
        }
        coveredSchemas.add(target);
        const validate = ajv.getSchema(target);
        if (validate === undefined) {
          reporter.fail(where, `no compiled validator for ${target}`);
          continue;
        }
        const document = parsed.document;
        if (validate(document)) {
          checkCrossReferences(reporter, where, document);
        } else {
          reporter.fail(
            where,
            `expected to validate but was rejected: ${describeAjvErrors(validate.errors)}`,
          );
        }
        continue;
      }

      if (declaredKind === 'invalid') {
        const cases = asRecordArray(parsed.cases);
        if (cases.length === 0)
          reporter.fail(where, 'invalid artefact must declare at least one case');
        for (const testCase of cases) {
          const id = asString(testCase.id) ?? '(unnamed case)';
          const target = asString(testCase.target);
          if (target === undefined || !schemaIds.has(target)) {
            reporter.fail(where, `case ${id}: target must be a known schema id`);
            continue;
          }
          coveredSchemas.add(target);
          if (typeof testCase.description !== 'string' || testCase.description.length < 60) {
            reporter.fail(where, `case ${id}: description must explain why rejection is required`);
          }
          const expected = testCase.expectedError;
          if (!isRecord(expected)) {
            reporter.fail(where, `case ${id}: missing expectedError`);
            continue;
          }
          const keyword = asString(expected.keyword);
          const path = asString(expected.path);
          if (keyword === undefined || path === undefined) {
            reporter.fail(where, `case ${id}: expectedError needs keyword and path`);
            continue;
          }
          const validate = ajv.getSchema(target);
          if (validate === undefined) {
            reporter.fail(where, `case ${id}: no compiled validator for ${target}`);
            continue;
          }
          if (validate(testCase.document)) {
            reporter.fail(where, `case ${id}: expected rejection but the document validated`);
            continue;
          }
          const errors = validate.errors ?? [];
          const matched = errors.some(
            (error) => error.keyword === keyword && error.instancePath === path,
          );
          if (!matched) {
            reporter.fail(
              where,
              `case ${id}: no error matching ${keyword} at ${path || '/'}; saw ${describeAjvErrors(errors)}`,
            );
          }
        }
        continue;
      }

      reporter.fail(where, `unrecognised kind ${String(declaredKind)}`);
    }
  }

  if (fixtureCount !== EXPECTED_FIXTURE_COUNT) {
    reporter.fail(
      'fixtures/',
      `expected ${EXPECTED_FIXTURE_COUNT} fixtures, found ${fixtureCount}`,
    );
  }
  if (exampleCount !== EXPECTED_EXAMPLE_COUNT) {
    reporter.fail(
      'examples/',
      `expected ${EXPECTED_EXAMPLE_COUNT} examples, found ${exampleCount}`,
    );
  }

  const exercised = referenceClosure(coveredSchemas);
  const uncovered = [...schemaIds]
    .filter((id) => !exercised.has(id))
    .filter((id) => !(id in EXERCISED_BY_TESTS_INSTEAD));
  for (const id of uncovered) {
    reporter.note(`${id} is not exercised by any fixture or example`);
  }
  // A schema exempted here is still verified, just not from this file: the reason
  // names where. An exemption that cannot say where is a gap, so the map is
  // exhaustive by construction and every entry states its substitute.
  for (const [id, reason] of Object.entries(EXERCISED_BY_TESTS_INSTEAD)) {
    reporter.note(`${id} is exercised by ${reason}`);
  }
  return reporter.finish(`${fixtureCount} fixtures and ${exampleCount} examples`);
}

if (fileURLToPath(import.meta.url) === resolve(process.argv[1] ?? '')) {
  process.exitCode = main();
}
