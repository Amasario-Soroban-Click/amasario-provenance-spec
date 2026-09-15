/**
 * Fixture-level tests.
 *
 * A schema suite shown only valid documents is consistent with a schema that accepts
 * anything. This suite is the other half: every invalid case must fail, and it must
 * fail on the exact keyword and instance path it declares.
 *
 * The distinction matters more than it looks. A fixture that merely fails still passes
 * if the schema rejected the document for an incidental reason — a typo in an unrelated
 * field, say — which is how a suite quietly stops testing what it claims to test.
 */
import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { EXPECTED_FIXTURE_COUNT, EXPECTED_EXAMPLE_COUNT } from '../../scripts/validate-fixtures.js';
import {
  createValidator,
  listFiles,
  loadSchemaRegistry,
  readYamlFile,
  repoPath,
  REPO_ROOT,
} from '../../scripts/validate-schema.js';

const ajv = createValidator();
const schemaIds = new Set(loadSchemaRegistry().map((entry) => entry.id));

interface InvalidCase {
  readonly id: string;
  readonly target: unknown;
  readonly expectedError: unknown;
  readonly document: unknown;
}

/** Every declared invalid case across `fixtures/invalid/`, with its source file. */
function loadInvalidCases(): (InvalidCase & { readonly where: string })[] {
  const out: (InvalidCase & { readonly where: string })[] = [];
  for (const file of listFiles(join(REPO_ROOT, 'fixtures', 'invalid'), ['.yaml'])) {
    const parsed = readYamlFile(file);
    if (typeof parsed !== 'object' || parsed === null) continue;
    const cases = (parsed as Record<string, unknown>).cases;
    if (!Array.isArray(cases)) continue;
    for (const entry of cases) {
      if (typeof entry !== 'object' || entry === null) continue;
      const record = entry as Record<string, unknown>;
      out.push({
        id: String(record.id),
        target: record.target,
        expectedError: record.expectedError,
        document: record.document,
        where: `${repoPath(file)}#${String(record.id)}`,
      });
    }
  }
  return out;
}

const invalidCases = loadInvalidCases();

describe('fixture inventory', () => {
  it('holds the expected number of fixtures and examples', () => {
    expect(listFiles(join(REPO_ROOT, 'fixtures'), ['.yaml'])).toHaveLength(EXPECTED_FIXTURE_COUNT);
    expect(listFiles(join(REPO_ROOT, 'examples'), ['.yaml'])).toHaveLength(EXPECTED_EXAMPLE_COUNT);
  });

  it('declares a target and an expected error on every invalid case', () => {
    expect(invalidCases.length).toBeGreaterThan(0);
    for (const testCase of invalidCases) {
      expect(typeof testCase.target, testCase.where).toBe('string');
      expect(schemaIds.has(String(testCase.target)), testCase.where).toBe(true);
      expect(typeof testCase.expectedError, testCase.where).toBe('object');
    }
  });

  it('gives every invalid case a unique identifier', () => {
    const ids = invalidCases.map((testCase) => testCase.where);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('invalid fixtures are rejected for the declared reason', () => {
  for (const testCase of invalidCases) {
    it(`${testCase.where} fails with ${JSON.stringify(testCase.expectedError)}`, () => {
      const validate = ajv.getSchema(String(testCase.target));
      expect(validate, `${testCase.where}: unknown target schema`).toBeDefined();

      const valid = validate?.(testCase.document);
      expect(valid, `${testCase.where}: expected rejection but the document validated`).toBe(false);

      const expected = testCase.expectedError as { keyword?: unknown; path?: unknown };
      const keyword = String(expected.keyword);
      const path = typeof expected.path === 'string' ? expected.path : '';

      const errors = validate?.errors ?? [];
      const matched = errors.some(
        (error) => error.keyword === keyword && error.instancePath === path,
      );
      expect(
        matched,
        `${testCase.where}: no error with keyword "${keyword}" at "${path}"; got ${JSON.stringify(
          errors.map((error) => `${error.keyword}@${error.instancePath}`),
        )}`,
      ).toBe(true);
    });
  }
});

describe('valid fixtures are accepted', () => {
  const valid = listFiles(join(REPO_ROOT, 'fixtures'), ['.yaml']).filter(
    (file) => !repoPath(file).startsWith('fixtures/invalid/'),
  );

  for (const file of valid) {
    it(`${repoPath(file)} validates against its target`, () => {
      const parsed = readYamlFile(file);
      const record = parsed as Record<string, unknown>;
      const validate = ajv.getSchema(String(record.target));
      expect(validate, `${repoPath(file)}: unknown target`).toBeDefined();
      const validResult = validate?.(record.document);
      expect(validResult, `${repoPath(file)}: ${JSON.stringify(validate?.errors ?? [])}`).toBe(
        true,
      );
    });
  }
});

describe('fixtures never claim to be real', () => {
  it('marks every fixture and example as synthetic', () => {
    const files = [
      ...listFiles(join(REPO_ROOT, 'fixtures'), ['.yaml']),
      ...listFiles(join(REPO_ROOT, 'examples'), ['.yaml']),
    ];
    for (const file of files) {
      const parsed = readYamlFile(file);
      const record = parsed as Record<string, unknown>;
      // Synthetic data is not a formality: a fixture that looked real could be
      // quoted as an observation of a real contract.
      expect(record.synthetic, repoPath(file)).toBe(true);
    }
  });
});
