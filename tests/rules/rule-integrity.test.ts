/**
 * Rule-level tests.
 *
 * Rules are the normative obligations. Two things must hold for the rule layer to be
 * worth anything: every rule must be well-formed, and every rule referenced from a
 * schema must exist. The second direction is the one that fails quietly — a schema
 * can cite a rule for years after the rule was renamed, and nothing would notice
 * unless something checked the reference.
 */
import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import {
  Reporter,
  isRecord,
  listFiles,
  loadSchemaRegistry,
  readYamlFile,
  repoPath,
  REPO_ROOT,
} from '../../scripts/validate-schema.js';
import { EXPECTED_RULE_FILE_COUNT, loadRules } from '../../scripts/validate-rules.js';

const reporter = new Reporter('test');
const rules = loadRules(reporter);

describe('rule inventory', () => {
  it('loads without reporting a single violation', () => {
    // loadRules reports every malformed file it encounters, so an empty failure
    // list is the assertion that the whole layer is well-formed.
    expect(reporter.failureCount).toBe(0);
  });

  it('contains exactly the expected number of rule files', () => {
    const files = listFiles(join(REPO_ROOT, 'rules'), ['.yaml']);
    expect(files).toHaveLength(EXPECTED_RULE_FILE_COUNT);
  });

  it('gives every rule a unique, category-prefixed id', () => {
    const ids = rules.map((rule) => rule.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const rule of rules) {
      const category = rule.id.split('/')[0];
      expect(rule.file.startsWith(`rules/${category}/`), `${rule.id} in ${rule.file}`).toBe(true);
    }
  });

  it('gives every rule a severity from the normative set', () => {
    for (const rule of rules) {
      expect(['MUST', 'MUST_NOT', 'SHOULD', 'SHOULD_NOT', 'MAY'], rule.id).toContain(rule.severity);
    }
  });
});

describe('rule references resolve', () => {
  it('resolves every rule id cited from a schema', () => {
    const known = new Set(rules.map((rule) => rule.id));
    // The same pattern the validator uses, so the test and the build agree on what
    // counts as a reference rather than diverging.
    const reference = /rule ([a-z]+(?:\/[a-z0-9-]+)+)/g;
    let references = 0;

    for (const entry of loadSchemaRegistry()) {
      const text = JSON.stringify(entry.document);
      for (const match of text.matchAll(reference)) {
        const id = match[1];
        references += 1;
        expect(
          known.has(String(id)),
          `${repoPath(entry.file)} cites missing rule ${String(id)}`,
        ).toBe(true);
      }
    }

    // A schema layer that cites no rule at all would pass the loop above vacuously,
    // so the count is asserted too.
    expect(references).toBeGreaterThan(0);
  });

  it('only cites fixtures and examples that exist', () => {
    const fixtureIds = new Set<string>();
    const exampleIds = new Set<string>();
    for (const file of listFiles(join(REPO_ROOT, 'fixtures'), ['.yaml'])) {
      const parsed = readYamlFile(file);
      if (isRecord(parsed) && typeof parsed.id === 'string') fixtureIds.add(parsed.id);
    }
    for (const file of listFiles(join(REPO_ROOT, 'examples'), ['.yaml'])) {
      const parsed = readYamlFile(file);
      if (isRecord(parsed) && typeof parsed.id === 'string') exampleIds.add(parsed.id);
    }

    for (const rule of rules) {
      for (const fixture of rule.fixtures) {
        expect(fixtureIds.has(fixture), `${rule.id} cites missing fixture ${fixture}`).toBe(true);
      }
      for (const example of rule.examples) {
        expect(exampleIds.has(example), `${rule.id} cites missing example ${example}`).toBe(true);
      }
    }
  });
});

describe('every rule is demonstrated', () => {
  it('cites at least one fixture or example, so no rule is untested', () => {
    for (const rule of rules) {
      expect(
        rule.fixtures.length + rule.examples.length,
        `${rule.id} is not demonstrated by any fixture or example`,
      ).toBeGreaterThan(0);
    }
  });

  it('covers every category the structure declares', () => {
    const categories = new Set(rules.map((rule) => rule.id.split('/')[0]));
    expect([...categories].sort()).toEqual(['dependency', 'identity', 'impact', 'provenance']);
  });
});
