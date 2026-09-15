/**
 * Vector and canonical-serialisation tests.
 *
 * A vector is only useful if two implementations can agree on it with no room for
 * interpretation, so the property under test is reproducibility: the same value must
 * serialise to the same bytes regardless of how it was built, and the recorded digest
 * must be the digest of exactly that string.
 *
 * Key-order independence is the property that most often fails in practice, because
 * an implementation whose serialiser follows insertion order will pass a test that
 * only round-trips one ordering.
 */
import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import {
  canonicalJson,
  canonicalise,
  isRecord,
  listFiles,
  readYamlFile,
  repoPath,
  REPO_ROOT,
  sha256Hex,
} from '../../scripts/validate-schema.js';
import { EXPECTED_VECTOR_DIRECTORY_COUNT } from '../../scripts/validate-vectors.js';

const vectorFiles = listFiles(join(REPO_ROOT, 'vectors'), ['.yaml']);

describe('vector inventory', () => {
  it('has the expected number of populated vector directories', () => {
    const directories = new Set(
      vectorFiles.map((file) => repoPath(file).split('/').slice(1, -1).join('/')),
    );
    expect(directories.size).toBe(EXPECTED_VECTOR_DIRECTORY_COUNT);
  });

  it('gives every vector a unique id and a declared domain', () => {
    const ids = new Set<string>();
    for (const file of vectorFiles) {
      const parsed = readYamlFile(file);
      expect(isRecord(parsed), repoPath(file)).toBe(true);
      const record = parsed as Record<string, unknown>;
      const id = String(record.id);
      expect(ids.has(id), `${repoPath(file)}: duplicate id ${id}`).toBe(false);
      ids.add(id);
      // The domain must match the directory, so a vector cannot be filed where a
      // consumer looking for its domain will not find it.
      const domain = repoPath(file).split('/')[1];
      expect(String(record.domain), `${repoPath(file)}: domain must be ${String(domain)}`).toBe(
        String(domain),
      );
    }
  });

  it('declares every vector deterministic', () => {
    for (const file of vectorFiles) {
      const record = readYamlFile(file) as Record<string, unknown>;
      // A non-deterministic vector has no place in a suite consumed by another
      // implementation, so the flag is required rather than advisory.
      expect(record.deterministic, repoPath(file)).toBe(true);
    }
  });
});

describe('canonical serialisation', () => {
  it('sorts object keys by code point regardless of insertion order', () => {
    const a = { zeta: 1, alpha: 2, mid: 3 };
    const b = { mid: 3, alpha: 2, zeta: 1 };
    expect(canonicalJson(a)).toBe(canonicalJson(b));
    expect(canonicalJson(a)).toBe('{"alpha":2,"mid":3,"zeta":1}');
  });

  it('orders nested objects the same way at every depth', () => {
    const nested = { outer: { b: 1, a: 2 }, list: [{ y: 1, x: 2 }] };
    expect(canonicalJson(nested)).toBe('{"list":[{"x":2,"y":1}],"outer":{"a":2,"b":1}}');
  });

  it('is stable under repeated serialisation', () => {
    const value = { list: [3, 1, 2], nested: { b: true, a: null } };
    const once = canonicalJson(value);
    // Re-parsing and serialising must be a fixed point; if it is not, a digest over
    // the value is not an identity.
    expect(canonicalJson(JSON.parse(once))).toBe(once);
  });

  it('keeps array order, because an array is a sequence and not a set', () => {
    expect(canonicalJson([1, 2, 3])).not.toBe(canonicalJson([3, 2, 1]));
  });

  it('retains null and omits absent properties rather than emitting null', () => {
    expect(canonicalJson({ present: null })).toBe('{"present":null}');
    expect(canonicalJson({ a: 1 })).toBe('{"a":1}');
    expect(canonicalJson({ a: 1, b: null })).toBe('{"a":1,"b":null}');
  });
});

describe('digests', () => {
  it('computes sha256 over the canonical serialisation', () => {
    const value = { b: 1, a: 'x' };
    const result = canonicalise(value);
    const expected = `sha256:${createHash('sha256')
      .update('{"a":"x","b":1}', 'utf8')
      .digest('hex')}`;
    expect(result.canonical).toBe('{"a":"x","b":1}');
    expect(result.digest).toBe(expected);
  });

  it('produces the published sha256 of the empty string', () => {
    // A known-answer check, so a change to the digest definition cannot pass by
    // being consistently wrong.
    expect(sha256Hex('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });

  it('changes when any byte of the canonical form changes', () => {
    expect(canonicalise({ a: 1 }).digest).not.toBe(canonicalise({ a: 2 }).digest);
  });
});

describe('recorded vector digests reproduce', () => {
  for (const file of vectorFiles) {
    it(`${repoPath(file)} recomputes its recorded canonical forms`, () => {
      const record = readYamlFile(file) as Record<string, unknown>;
      const expected = record.expected;
      if (!isRecord(expected)) return;
      const canonicalisation = expected.canonicalisation;
      if (!isRecord(canonicalisation)) return;

      const declaredAlgorithm = String(canonicalisation.algorithm);

      // The input side: an object literal, so a stable serialisation is defined.
      const input = record.input;
      if (isRecord(input) && typeof canonicalisation.inputCanonical === 'string') {
        expect(canonicalJson(input), `${repoPath(file)}: inputCanonical`).toBe(
          canonicalisation.inputCanonical,
        );
        const digest = canonicalise(input).digest;
        expect(digest, `${repoPath(file)}: inputDigest`).toBe(canonicalisation.inputDigest);
        expect(digest.startsWith(`${declaredAlgorithm}:`), repoPath(file)).toBe(true);
      }
    });
  }
});
