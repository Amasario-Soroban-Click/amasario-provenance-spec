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

/**
 * A copy of `record` with `key` omitted.
 *
 * Written as a rebuild rather than a `delete` so the omission is a value the test
 * holds, and so the same helper works for a field named by a loop variable.
 */
function without(record: object, key: string): Record<string, unknown> {
  return Object.fromEntries(Object.entries(record).filter(([name]) => name !== key));
}

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

describe('error schema', () => {
  // This schema is exercised here rather than by a fixture, and the reason is recorded
  // in `scripts/validate-fixtures.ts`: an error record is produced by an
  // implementation when an analysis fails, and this repository performs no analysis,
  // so a fixture would assert the shape of a failure nothing here can produce.
  const errorSchema = `${SCHEMA_ID_PREFIX}error.schema.json`;

  const wellFormed = {
    code: 'AMASARIO_NETWORK_UNAVAILABLE',
    category: 'NETWORK',
    message: 'The RPC endpoint did not respond within the configured timeout.',
    retryable: true,
    path: 'contracts/CA3D5KRYM6CB7OWQ6TWYRR3Z4T7GNZLKERYNZGGA5SOAOPIFY6YQGAXE',
  };

  it('accepts a well-formed error record', () => {
    const validate = ajv.getSchema(errorSchema);
    expect(validate?.(wellFormed), JSON.stringify(validate?.errors ?? [])).toBe(true);
  });

  it('rejects a category outside the enumeration rather than collapsing failure kinds', () => {
    const validate = ajv.getSchema(errorSchema);
    const valid = validate?.({ ...wellFormed, category: 'SOMETHING_WENT_WRONG' });
    expect(valid).toBe(false);
    expect(
      (validate?.errors ?? []).map((error) => `${error.keyword}@${error.instancePath}`),
    ).toContain('enum@/category');
  });

  it('requires a code, a category and a message on every error', () => {
    const validate = ajv.getSchema(errorSchema);
    for (const field of ['code', 'category', 'message']) {
      expect(validate?.(without(wellFormed, field)), `omitting ${field}`).toBe(false);
    }
  });

  it('rejects an unrecognised property rather than letting it pass as detail', () => {
    const validate = ajv.getSchema(errorSchema);
    expect(validate?.({ ...wellFormed, stack: 'trace' })).toBe(false);
  });

  it('documents every category the engine is expected to distinguish', () => {
    const entry = entries.find((candidate) => candidate.id === errorSchema);
    const properties = entry?.document.properties;
    expect(properties).toBeTypeOf('object');
    const category = (properties as Record<string, { enum?: string[] }>).category;
    // Collapsing failures into one generic error is explicitly prohibited, so the
    // categories must cover the layers rather than a single catch-all.
    expect(category?.enum).toContain('NETWORK');
    expect(category?.enum).toContain('SPECIFICATION_COMPATIBILITY');
    expect((category?.enum ?? []).length).toBeGreaterThanOrEqual(10);
  });
});

describe('invocation and event schemas', () => {
  // Both are engine outputs rather than part of a provenance document tree, so they are
  // exercised here rather than by a fixture. See `scripts/validate-fixtures.ts`.
  const invocationSchema = `${SCHEMA_ID_PREFIX}invocation.schema.json`;
  const eventSchema = `${SCHEMA_ID_PREFIX}event.schema.json`;

  const invocation = {
    caller: 'C2IJTO436D5EBFSQZM4AEWZUDEKNWWPJRHGFJOFGNQKE445P5FSA26XB',
    callee: 'C5AW7RAJS26BSZ27BPUE62MOJ3C6WUZC2M6HJG66BDXHEBLDRBMRKQSP',
    function: 'transfer',
    ledger: 1234567,
    transactionHash: '00db878209ffecedbb99166310e2111e73150638dd2c10da695167103fbd0712',
    successful: true,
    callDepth: 1,
  };

  const event = {
    id: 'evt-1234567-1-0',
    contractId: 'C2IJTO436D5EBFSQZM4AEWZUDEKNWWPJRHGFJOFGNQKE445P5FSA26XB',
    type: 'CONTRACT',
    ledger: 1234567,
    transactionHash: '00db878209ffecedbb99166310e2111e73150638dd2c10da695167103fbd0712',
    eventIndex: 0,
    inSuccessfulTransaction: true,
  };

  it('accepts a well-formed invocation and event', () => {
    const validateInvocation = ajv.getSchema(invocationSchema);
    const validateEvent = ajv.getSchema(eventSchema);
    expect(validateInvocation?.(invocation), JSON.stringify(validateInvocation?.errors ?? [])).toBe(
      true,
    );
    expect(validateEvent?.(event), JSON.stringify(validateEvent?.errors ?? [])).toBe(true);
  });

  it('requires an invocation to name what was called, where and in which transaction', () => {
    const validate = ajv.getSchema(invocationSchema);
    for (const field of ['callee', 'ledger', 'transactionHash']) {
      expect(validate?.(without(invocation, field)), `omitting ${field}`).toBe(false);
    }
  });

  it('rejects an event type outside the network-reported categories', () => {
    const validate = ajv.getSchema(eventSchema);
    expect(validate?.({ ...event, type: 'TELEMETRY' })).toBe(false);
    expect(
      (validate?.errors ?? []).map((error) => `${error.keyword}@${error.instancePath}`),
    ).toContain('enum@/type');
  });

  it('rejects a negative ledger, which cannot be a Stellar ledger sequence', () => {
    const validate = ajv.getSchema(eventSchema);
    expect(validate?.({ ...event, ledger: -1 })).toBe(false);
  });
});

describe('diff schema', () => {
  // A diff compares two snapshots, so it is not reachable from a document tree and is
  // exercised here rather than by a fixture.
  const diffSchema = `${SCHEMA_ID_PREFIX}diff.schema.json`;
  const digest = { algorithm: 'sha256', value: 'a'.repeat(64) };

  const wellFormed = {
    apiVersion: 'amasario.dev/v1',
    specVersion: '1.0.0',
    before: { id: 'snap-a', contentDigest: digest },
    after: { id: 'snap-b', contentDigest: digest },
    comparisonMode: 'CANONICAL',
    comparable: true,
    changes: [
      {
        id: 'change-1',
        category: 'RELATIONSHIP_ADDED',
        changeType: 'ADDED',
        entity: {
          kind: 'CONTRACT',
          id: 'CXGEEQZSI4JVO3U3REEWJTQJ544OBLIBCB53KT3BIXK7JABDBZWU6S3I',
        },
      },
    ],
    summary: { total: 1, byCategory: { RELATIONSHIP_ADDED: 1 }, byChangeType: { ADDED: 1 } },
  };

  it('accepts a well-formed diff', () => {
    const validate = ajv.getSchema(diffSchema);
    expect(validate?.(wellFormed), JSON.stringify(validate?.errors ?? [])).toBe(true);
  });

  it('requires both snapshots to be referenced by id and digest', () => {
    const validate = ajv.getSchema(diffSchema);
    // A diff whose inputs are not identified cannot be re-derived, which is the whole
    // reason the snapshots are referenced rather than embedded.
    expect(validate?.({ ...wellFormed, before: { id: 'snap-a' } })).toBe(false);
  });

  it('requires a comparison mode on every diff', () => {
    const validate = ajv.getSchema(diffSchema);
    expect(validate?.(without(wellFormed, 'comparisonMode'))).toBe(false);
  });

  it('constrains the incomparable reason to the declared set', () => {
    const validate = ajv.getSchema(diffSchema);
    const validateReason = (reason: string): boolean =>
      validate?.({ ...wellFormed, comparable: false, incomparableReason: reason }) === true;
    for (const reason of [
      'API_VERSION_MISMATCH',
      'SPEC_VERSION_INCOMPATIBLE',
      'NETWORK_MISMATCH',
      'BOUNDARY_ORDER_INVALID',
      'MALFORMED_SNAPSHOT',
    ]) {
      expect(validateReason(reason), reason).toBe(true);
    }
    // An unclassified reason would let an implementation invent an incomparability
    // that a consumer cannot act on.
    expect(validateReason('BECAUSE_I_SAID_SO')).toBe(false);
  });

  it('constrains change categories and change types to the taxonomies', () => {
    const validate = ajv.getSchema(diffSchema);
    const withCategory = (category: string): boolean =>
      validate?.({
        ...wellFormed,
        changes: [{ ...wellFormed.changes[0], category }],
      }) === true;
    expect(withCategory('WASM_IDENTITY_CHANGED')).toBe(true);
    expect(withCategory('SOMETHING_ELSE')).toBe(false);
    expect(
      validate?.({
        ...wellFormed,
        changes: [{ ...wellFormed.changes[0], changeType: 'MUTATED' }],
      }),
    ).toBe(false);
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
