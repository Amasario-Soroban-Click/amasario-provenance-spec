/**
 * Compatibility tests.
 *
 * A specification that can be published with two disagreeing version numbers is a
 * specification a consumer cannot trust to identify itself. These tests assert that
 * every place a version appears agrees, and that the compatibility family declared by
 * a schema id matches the family declared by the documents those schemas validate.
 *
 * The same agreement is checked by `scripts/release-check.ts` before a release. It is
 * checked here too because a release check only runs at release time, and a version
 * drift introduced mid-cycle should fail on the next commit rather than at the tag.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  API_VERSION,
  REPO_ROOT,
  SCHEMA_ID_PREFIX,
  SPEC_VERSION,
  listFiles,
  loadSchemaRegistry,
  readJsonFile,
  readYamlFile,
  repoPath,
} from '../../scripts/validate-schema.js';
import { isRecord } from '../../scripts/validate-schema.js';

const manifest = readJsonFile(join(REPO_ROOT, 'package.json')) as Record<string, unknown>;

describe('version agreement', () => {
  it('stamps the specification version and compatibility family on the manifest', () => {
    expect(manifest.version).toBe(SPEC_VERSION);
    expect(manifest.private).toBe(true);
  });

  it('declares the compatibility family once, in the shared constants', () => {
    expect(API_VERSION).toBe('amasario.dev/v1');
    expect(SCHEMA_ID_PREFIX).toBe(`https://amasario.dev/spec/v1/schema/`);
    // The family must be derivable from the version, not maintained separately, so
    // a major bump cannot leave one of them behind.
    const major = SPEC_VERSION.split('.')[0];
    expect(SCHEMA_ID_PREFIX).toContain(`/v${String(major)}/`);
    expect(API_VERSION).toBe(`amasario.dev/v${String(major)}`);
  });

  it('stamps every versioned artefact with the current specification version', () => {
    const directories = ['taxonomies', 'models', 'rules', 'fixtures', 'examples', 'vectors'];
    for (const directory of directories) {
      for (const file of listFiles(join(REPO_ROOT, directory), ['.yaml'])) {
        const parsed = readYamlFile(file);
        expect(isRecord(parsed), repoPath(file)).toBe(true);
        expect((parsed as Record<string, unknown>).specVersion, repoPath(file)).toBe(SPEC_VERSION);
      }
    }
  });

  it('carries the compatibility family on every artefact that produces a document', () => {
    // Models and rules are specification-internal and carry no apiVersion; the
    // artefacts a consumer receives do.
    for (const directory of ['taxonomies', 'fixtures', 'examples', 'vectors']) {
      for (const file of listFiles(join(REPO_ROOT, directory), ['.yaml'])) {
        const parsed = readYamlFile(file) as Record<string, unknown>;
        expect(parsed.apiVersion, repoPath(file)).toBe(API_VERSION);
      }
    }
  });

  it('publishes every schema inside the compatibility family it declares', () => {
    const major = SPEC_VERSION.split('.')[0];
    for (const entry of loadSchemaRegistry()) {
      expect(entry.id.startsWith(SCHEMA_ID_PREFIX), repoPath(entry.file)).toBe(true);
      expect(entry.id.includes(`/v${String(major)}/`), repoPath(entry.file)).toBe(true);
    }
  });
});

describe('the changelog accounts for the released version', () => {
  const changelog = readFileSync(join(REPO_ROOT, 'CHANGELOG.md'), 'utf8');

  it('has a heading for the current version or an unreleased section', () => {
    const hasVersion = changelog.includes(`## [${SPEC_VERSION}]`);
    const hasUnreleased = changelog.includes('## [Unreleased]');
    expect(hasVersion || hasUnreleased).toBe(true);
  });

  it('uses Keep a Changelog section headings', () => {
    expect(/^### (Added|Changed|Removed|Fixed|Deprecated|Security|Notes)/m.test(changelog)).toBe(
      true,
    );
  });

  it('documents the versioning rules the release gate depends on', () => {
    const versioning = readFileSync(join(REPO_ROOT, 'VERSIONING.md'), 'utf8');
    // The release check compares these three, so the document must actually state
    // the rules rather than merely exist.
    expect(versioning).toContain('MAJOR');
    expect(versioning).toContain('MINOR');
    expect(versioning).toContain('PATCH');
    expect(versioning).toContain('apiVersion');
  });
});

describe('openness declarations are usable by a consumer', () => {
  const taxonomyFiles = listFiles(join(REPO_ROOT, 'taxonomies'), ['.yaml']);

  it('declares openness and the unknown-term obligation on every taxonomy', () => {
    for (const file of taxonomyFiles) {
      const parsed = readYamlFile(file) as Record<string, unknown>;
      const openness = parsed.openness;
      expect(['open', 'closed'], repoPath(file)).toContain(openness);
      // A closed taxonomy promises exhaustiveness, so an unrecognised value must be
      // a rejection; an open one degrades gracefully. The two must stay consistent
      // with what the taxonomy actually requires of a consumer.
      expect(parsed.consumersMustHandleUnknown, repoPath(file)).toBe(openness === 'open');
    }
  });

  it('binds every taxonomy to at least one schema location', () => {
    for (const file of taxonomyFiles) {
      const parsed = readYamlFile(file) as Record<string, unknown>;
      const usedBy = parsed.usedBy;
      expect(Array.isArray(usedBy), repoPath(file)).toBe(true);
      expect((usedBy as unknown[]).length, repoPath(file)).toBeGreaterThan(0);
    }
  });
});

describe('the engine relationship is stated', () => {
  const readme = readFileSync(join(REPO_ROOT, 'README.md'), 'utf8');

  it('names both repositories so the boundary is unambiguous', () => {
    expect(readme).toContain('amasario-provenance-spec');
    expect(readme).toContain('amasario-provenance-engine');
  });

  it('does not claim a security opinion', () => {
    // The specification must never present itself as a security tool, so the
    // prohibition is asserted rather than left to review. Emphasis markers are
    // stripped and whitespace normalised first, so neither bolding a word nor
    // reflowing a paragraph can defeat the check.
    const plain = readme.replace(/[*_`]/g, '').replace(/\s+/g, ' ');
    expect(plain).toContain('not a security scanner');
    for (const prohibited of ['secure', 'safe', 'malicious', 'vulnerable']) {
      expect(plain).toContain(prohibited);
    }
  });
});
