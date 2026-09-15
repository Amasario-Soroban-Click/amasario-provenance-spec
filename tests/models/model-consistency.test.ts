/**
 * Model-level tests.
 *
 * A model explains what a set of fields means. The failure this suite guards against
 * is documentation that has drifted from the wire format: a model describing a field
 * the schema does not define, or omitting one the schema requires. Both directions
 * are checked, because a model that is merely incomplete teaches a reader the wrong
 * set of fields.
 */
import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import {
  isRecord,
  listFiles,
  loadSchemaRegistry,
  readYamlFile,
  repoPath,
  REPO_ROOT,
  resolveJsonPointer,
  schemaProperties,
  schemaRequired,
} from '../../scripts/validate-schema.js';
import { EXPECTED_MODEL_COUNT } from '../../scripts/validate-models.js';

const modelFiles = listFiles(join(REPO_ROOT, 'models'), ['.yaml']);

interface Model {
  readonly relative: string;
  readonly id: string;
  readonly schemaId: string;
  readonly pointer: string;
  readonly fields: readonly Record<string, unknown>[];
  readonly invariants: readonly string[];
  readonly nonGoals: readonly string[];
  readonly taxonomies: readonly string[];
}

function loadModels(): Model[] {
  return modelFiles.map((file) => {
    const parsed = readYamlFile(file);
    if (!isRecord(parsed)) throw new Error(`${repoPath(file)}: model is not a mapping`);
    const schema = isRecord(parsed.schema) ? parsed.schema : {};
    return {
      relative: repoPath(file),
      id: typeof parsed.id === 'string' ? parsed.id : '',
      schemaId: typeof schema.id === 'string' ? schema.id : '',
      pointer: typeof schema.pointer === 'string' ? schema.pointer : '',
      fields: Array.isArray(parsed.fields)
        ? parsed.fields.filter((entry): entry is Record<string, unknown> => isRecord(entry))
        : [],
      invariants: Array.isArray(parsed.invariants) ? parsed.invariants.map(String) : [],
      nonGoals: Array.isArray(parsed.nonGoals) ? parsed.nonGoals.map(String) : [],
      taxonomies: Array.isArray(parsed.taxonomies) ? parsed.taxonomies.map(String) : [],
    };
  });
}

const models = loadModels();
const schemas = new Map(loadSchemaRegistry().map((entry) => [entry.id, entry]));

describe('model inventory', () => {
  it('contains exactly the expected number of models', () => {
    expect(models).toHaveLength(EXPECTED_MODEL_COUNT);
  });

  it('gives every model a unique id matching its path', () => {
    const ids = models.map((model) => model.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const model of models) {
      const fromPath = model.relative.replace(/^models\//, '').replace(/\.yaml$/, '');
      expect(model.id, model.relative).toBe(fromPath);
    }
  });

  it('points every model at a schema that exists', () => {
    for (const model of models) {
      expect(schemas.has(model.schemaId), `${model.relative} -> ${model.schemaId}`).toBe(true);
    }
  });
});

describe('field-level agreement with the schemas', () => {
  it('describes only fields the schema defines', () => {
    for (const model of models) {
      const entry = schemas.get(model.schemaId);
      if (entry === undefined) continue;
      const node = resolveJsonPointer(entry.document, model.pointer);
      expect(isRecord(node), `${model.relative}: pointer ${model.pointer} does not resolve`).toBe(
        true,
      );
      const declared = new Set(Object.keys(schemaProperties(node as Record<string, unknown>)));
      for (const field of model.fields) {
        const name = String(field.name);
        expect(declared.has(name), `${model.relative}: schema does not define ${name}`).toBe(true);
      }
    }
  });

  it('describes every field the schema requires', () => {
    for (const model of models) {
      const entry = schemas.get(model.schemaId);
      if (entry === undefined) continue;
      const node = resolveJsonPointer(entry.document, model.pointer);
      if (!isRecord(node)) continue;
      const described = new Set(model.fields.map((field) => String(field.name)));
      for (const required of schemaRequired(node)) {
        expect(
          described.has(required),
          `${model.relative}: schema requires ${required} but the model does not describe it`,
        ).toBe(true);
      }
    }
  });

  it('marks a field always-required exactly when the schema requires it', () => {
    for (const model of models) {
      const entry = schemas.get(model.schemaId);
      if (entry === undefined) continue;
      const node = resolveJsonPointer(entry.document, model.pointer);
      if (!isRecord(node)) continue;
      const required = new Set(schemaRequired(node));
      for (const field of model.fields) {
        const name = String(field.name);
        const requirement = String(field.requirement);
        // "always" is the model's way of saying the schema requires it; "optional"
        // is the only other value, so the two must agree in both directions.
        expect(requirement === 'always', `${model.relative}: ${name} requirement`).toBe(
          required.has(name),
        );
      }
    }
  });
});

describe('model explanation', () => {
  it('states the invariants JSON Schema cannot express', () => {
    for (const model of models) {
      // A model with no invariants and no non-goals is a field list, not a model.
      expect(model.invariants.length + model.nonGoals.length, model.relative).toBeGreaterThan(0);
    }
  });

  it('names at least one taxonomy when the schema constrains a term set', () => {
    for (const model of models) {
      const entry = schemas.get(model.schemaId);
      if (entry === undefined) continue;
      const node = resolveJsonPointer(entry.document, model.pointer);
      if (!isRecord(node)) continue;
      const properties = schemaProperties(node);
      const constrained = Object.entries(properties).some(([, property]) => {
        return isRecord(property) && Array.isArray(property.enum);
      });
      if (constrained) {
        expect(model.taxonomies.length, `${model.relative} constrains a term set`).toBeGreaterThan(
          0,
        );
      }
    }
  });
});
