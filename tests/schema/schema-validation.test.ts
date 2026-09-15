/**
 * Schema-level tests.
 *
 * The validators in `scripts/` already fail the build on a malformed schema, so
 * these tests exist for the complementary reason: they assert the *properties* the
 * schemas are supposed to have, so that a schema can be changed in a way the
 * validators tolerate but a consumer would not accept. A schema that still compiles
 * but has stopped being closed is exactly the change that slips through.
 */
import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import {
  EXPECTED_SCHEMA_COUNT,
  JSON_SCHEMA_DIALECT,
  REPO_ROOT,
  SCHEMA_ID_PREFIX,
  createValidator,
  listFiles,
  loadSchemaRegistry,
  readJsonFile,
  readYamlFile,
  repoPath,
} from '../../scripts/validate-schema.js';

const entries = loadSchemaRegistry();
const ajv = createValidator();

describe('schema registry', () => {
  it('contains exactly the expected number of schemas', () => {
    expect(entries).toHaveLength(EXPECTED_SCHEMA_COUNT);
  });

  it('declares the draft 2020-12 dialect on every schema', () => {
    for (const entry of entries) {
      expect(entry.document.$schema, repoPath(entry.file)).toBe(JSON_SCHEMA_DIALECT);
    }
  });

  it('gives every schema a unique id inside the v1 compatibility family', () => {
    const ids = entries.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(id.startsWith(SCHEMA_ID_PREFIX)).toBe(true);
      expect(id.includes('/v1/')).toBe(true);
    }
  });

  it('compiles every schema into a resolvable registry entry', () => {
    for (const entry of entries) {
      expect(ajv.getSchema(entry.id), repoPath(entry.file)).toBeDefined();
    }
  });
});

describe('document envelopes', () => {
  it('closes every document root so an unrecognised field cannot be dropped silently', () => {
    for (const entry of entries) {
      // A silently ignored field is indistinguishable from a correctly handled one,
      // so openness at the root is a defect even when the schema still compiles.
      expect(entry.document.additionalProperties, repoPath(entry.file)).toBe(false);
    }
  });

  it('requires the compatibility family and specification version on every produced document', () => {
    // Models and rules are specification-internal and carry no apiVersion; the
    // documents a consumer receives do.
    const produced = new Set([
      'provenance.schema.json',
      'snapshot.schema.json',
      'diff.schema.json',
      'report.schema.json',
      'graph.schema.json',
      'error.schema.json',
    ]);
    for (const entry of entries) {
      const name = repoPath(entry.file).replace('schema/', '');
      if (!produced.has(name)) continue;
      const required = entry.document.required;
      expect(Array.isArray(required), name).toBe(true);
      if (name !== 'error.schema.json') {
        expect(required, name).toContain('apiVersion');
        expect(required, name).toContain('specVersion');
      }
    }
  });

  it('explains itself: every schema has a title and an explanatory description', () => {
    for (const entry of entries) {
      const where = repoPath(entry.file);
      expect(typeof entry.document.title, where).toBe('string');
      expect(typeof entry.document.description, where).toBe('string');
      expect(String(entry.document.description).length, where).toBeGreaterThanOrEqual(40);
    }
  });
});

describe('valid fixtures satisfy their target schema', () => {
  const validFixtures = listFiles(join(REPO_ROOT, 'fixtures'), ['.yaml']).filter(
    (file) => !repoPath(file).startsWith('fixtures/invalid/'),
  );

  it.each(validFixtures.map((file) => repoPath(file)))('%s validates', (relative) => {
    const parsed = readYamlFile(join(REPO_ROOT, relative));
    expect(parsed).toBeTypeOf('object');
    const record = parsed as Record<string, unknown>;
    const target = record.target;
    expect(typeof target, `${relative} must declare a target`).toBe('string');

    const validate = ajv.getSchema(String(target));
    expect(validate, `${relative} targets an unknown schema`).toBeDefined();
    const document = record.document ?? record.instance;
    expect(document, `${relative} must carry a document`).toBeDefined();

    const valid = validate?.(document);
    expect(valid, `${relative}: ${JSON.stringify(validate?.errors ?? [])}`).toBe(true);
  });
});

describe('a schema rejects what it does not define', () => {
  it('rejects an unrecognised property on a contract identity', () => {
    const document = {
      contractId: 'C2IJTO436D5EBFSQZM4AEWZUDEKNWWPJRHGFJOFGNQKE445P5FSA26XB',
      network: {
        id: 'testnet',
        type: 'TESTNET',
        passphrase: 'Test SDF Network ; September 2015',
      },
      identityVersion: 1,
      trustMeThisIsSafe: true,
    };
    const validate = ajv.getSchema(`${SCHEMA_ID_PREFIX}contract.schema.json`);
    expect(validate?.(document)).toBe(false);
    const keywords = (validate?.errors ?? []).map((error) => error.keyword);
    expect(keywords).toContain('additionalProperties');
  });

  it('rejects a contract address that is not a strkey shape', () => {
    const document = {
      contractId: 'NOTANADDRESS',
      network: {
        id: 'testnet',
        type: 'TESTNET',
        passphrase: 'Test SDF Network ; September 2015',
      },
      identityVersion: 1,
    };
    const validate = ajv.getSchema(`${SCHEMA_ID_PREFIX}contract.schema.json`);
    expect(validate?.(document)).toBe(false);
    const paths = (validate?.errors ?? []).map((error) => `${error.keyword}${error.instancePath}`);
    expect(paths).toContain('pattern/contractId');
  });
});

describe('the registry is loaded from disk, not from memory', () => {
  it('reads a schema whose JSON parses to an object', () => {
    const parsed = readJsonFile(join(REPO_ROOT, 'schema', 'provenance.schema.json'));
    expect(parsed).toBeTypeOf('object');
    expect((parsed as Record<string, unknown>).$id).toBe(
      `${SCHEMA_ID_PREFIX}provenance.schema.json`,
    );
  });
});
