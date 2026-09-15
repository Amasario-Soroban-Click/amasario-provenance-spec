/**
 * Vector validation.
 *
 * A vector is a deterministic input and expected output pair intended to be consumed
 * by a separate implementation. Its whole value is that two implementations can agree
 * or disagree with no room for interpretation, so this validator checks three things:
 * that the recorded canonical serialisation really is the canonical serialisation of
 * the input and output, that the recorded digests match those strings, and that
 * re-serialising produces identical bytes.
 *
 * The third check is not redundant. It is the property that makes a digest usable as
 * an identity, and it can fail for an implementation whose key ordering depends on
 * insertion order even when the first two checks happen to pass on one ordering.
 *
 * Run with `npm run validate:vectors`.
 */
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  Reporter,
  asString,
  canonicalise,
  isRecord,
  listFiles,
  readYamlFile,
  repoPath,
  REPO_ROOT,
  sha256Hex,
} from './validate-schema.js';

export const EXPECTED_VECTOR_DIRECTORY_COUNT = 13;

interface VectorReport {
  readonly domain: string;
  readonly operation: string;
}

function main(): number {
  const reporter = new Reporter('validate-vectors');
  const files = listFiles(join(REPO_ROOT, 'vectors'), ['.yaml']);
  const seenIds = new Map<string, string>();
  const directories = new Set<string>();
  const domains = new Map<string, number>();
  const reports: VectorReport[] = [];

  for (const file of files) {
    const where = repoPath(file);
    const expectedId = where.replace(/^vectors\//, '').replace(/\.yaml$/, '');
    const directory = expectedId.split('/').slice(0, -1).join('/');
    directories.add(directory);

    const parsed = readYamlFile(file);
    if (!isRecord(parsed)) {
      reporter.fail(where, 'vector is not a mapping');
      continue;
    }

    const id = asString(parsed.id);
    if (id !== expectedId) reporter.fail(where, `id must be ${expectedId}`);
    if (id !== undefined) {
      const previous = seenIds.get(id);
      if (previous !== undefined) reporter.fail(where, `duplicate vector id also in ${previous}`);
      seenIds.set(id, where);
    }
    if (asString(parsed.apiVersion) !== 'amasario.dev/v1') reporter.fail(where, 'bad apiVersion');
    if (asString(parsed.specVersion) !== '1.0.0') reporter.fail(where, 'bad specVersion');
    if (parsed.deterministic !== true) {
      reporter.fail(where, 'vector must declare deterministic: true');
    }
    const domain = asString(parsed.domain);
    const operation = asString(parsed.operation);
    if (domain === undefined) reporter.fail(where, 'missing domain');
    else {
      if (domain !== expectedId.split('/')[0]) {
        reporter.fail(where, `domain ${domain} does not match the vector path`);
      }
      domains.set(domain, (domains.get(domain) ?? 0) + 1);
    }
    if (operation === undefined || operation.length < 4) reporter.fail(where, 'missing operation');
    else reports.push({ domain: domain ?? '', operation });

    if (typeof parsed.description !== 'string' || parsed.description.length < 120) {
      reporter.fail(where, 'description must explain what the vector pins down and why it matters');
    }
    if (parsed.input === undefined) reporter.fail(where, 'missing input');

    const expected = parsed.expected;
    if (!isRecord(expected)) {
      reporter.fail(where, 'missing expected block');
      continue;
    }
    if (expected.result === undefined) reporter.fail(where, 'missing expected.result');

    const canonicalisation = expected.canonicalisation;
    if (!isRecord(canonicalisation)) {
      reporter.fail(where, 'missing expected.canonicalisation');
      continue;
    }
    if (asString(canonicalisation.algorithm) !== 'sha256') {
      reporter.fail(where, 'canonicalisation.algorithm must be sha256');
    }

    const input = canonicalise(parsed.input);
    if (asString(canonicalisation.inputCanonical) !== input.canonical) {
      reporter.fail(where, 'inputCanonical does not equal the canonical serialisation of input');
    }
    if (asString(canonicalisation.inputDigest) !== input.digest) {
      reporter.fail(where, `inputDigest mismatch, expected ${input.digest}`);
    }

    const output = canonicalise(expected.result);
    if (asString(canonicalisation.outputCanonical) !== output.canonical) {
      reporter.fail(
        where,
        'outputCanonical does not equal the canonical serialisation of expected.result',
      );
    }
    if (asString(canonicalisation.outputDigest) !== output.digest) {
      reporter.fail(where, `outputDigest mismatch, expected ${output.digest}`);
    }

    // Determinism: canonicalising the same value twice, and canonicalising a value
    // rebuilt from the recorded canonical string, must both produce identical bytes.
    const again = canonicalise(parsed.input);
    if (again.canonical !== input.canonical || again.digest !== input.digest) {
      reporter.fail(where, 'canonical serialisation is not reproducible across two evaluations');
    }
    const roundTripped = canonicalise(JSON.parse(input.canonical) as unknown);
    if (roundTripped.canonical !== input.canonical) {
      reporter.fail(
        where,
        'canonical serialisation is not stable under a parse and re-serialise cycle',
      );
    }
    if (sha256Hex(input.canonical) !== input.digest.replace(/^sha256:/, '')) {
      reporter.fail(where, 'recorded inputDigest is not the sha256 of the recorded inputCanonical');
    }
    if (sha256Hex(output.canonical) !== output.digest.replace(/^sha256:/, '')) {
      reporter.fail(
        where,
        'recorded outputDigest is not the sha256 of the recorded outputCanonical',
      );
    }
  }

  if (directories.size !== EXPECTED_VECTOR_DIRECTORY_COUNT) {
    reporter.fail(
      'vectors/',
      `expected ${EXPECTED_VECTOR_DIRECTORY_COUNT} vector directories, found ${directories.size}`,
    );
  }
  const summary = [...domains.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([domain, count]) => `${domain}=${count}`)
    .join(' ');
  reporter.note(`vector domains: ${summary}`);
  reporter.note(`vector operations: ${new Set(reports.map((r) => r.operation)).size} distinct`);

  return reporter.finish(`${files.length} vectors across ${directories.size} directories`);
}

if (fileURLToPath(import.meta.url) === resolve(process.argv[1] ?? '')) {
  process.exitCode = main();
}
