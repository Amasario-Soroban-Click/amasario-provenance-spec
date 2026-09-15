/**
 * Model validation.
 *
 * A model is a focused view of a schema: it names the fields that matter for one
 * concept, states how strongly each is required, and records the invariants that JSON
 * Schema cannot express plus the non-goals that say what the concept does not claim.
 *
 * Because a model restates part of a schema, it can drift. This validator closes that
 * by checking every field against the schema it points at, and by checking the four
 * requirement levels distinctly:
 *
 * - `always`      the field must appear in the schema's own `required` array
 * - `conditional` the field must be required by some `allOf` branch's `then`
 * - `rule`        the field must NOT be in `required`: a rule governs it
 * - `optional`    the field must NOT be in `required`
 *
 * Without the last two, a model could describe a rule-enforced requirement as a schema
 * requirement and a reader would look for a guarantee the schema does not make.
 *
 * Run with `npm run validate:models`.
 */
import { readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  Reporter,
  asRecordArray,
  asString,
  asStringArray,
  isRecord,
  listFiles,
  loadSchemaRegistry,
  readYamlFile,
  repoPath,
  REPO_ROOT,
  resolveJsonPointer,
  schemaProperties,
  schemaRequired,
} from './validate-schema.js';

export const EXPECTED_MODEL_COUNT = 24;

const REQUIREMENTS = new Set(['always', 'conditional', 'rule', 'optional']);
const MODEL_TYPES = new Set(['string', 'integer', 'boolean', 'object', 'array']);

function conditionalRequired(document: Record<string, unknown>): Set<string> {
  const out = new Set<string>();
  for (const branch of asRecordArray(document.allOf)) {
    const then = branch.then;
    if (isRecord(then)) for (const name of schemaRequired(then)) out.add(name);
  }
  return out;
}

function main(): number {
  const reporter = new Reporter('validate-models');
  const schemas = loadSchemaRegistry();
  const schemaById = new Map(schemas.map((entry) => [entry.id, entry]));

  const taxonomyIds = new Set(
    readdirSync(join(REPO_ROOT, 'taxonomies'))
      .filter((entry) => entry.endsWith('.yaml'))
      .map((entry) => {
        const parsed = readYamlFile(join(REPO_ROOT, 'taxonomies', entry));
        return isRecord(parsed) ? asString(parsed.id) : undefined;
      })
      .filter((id): id is string => id !== undefined),
  );

  const relationshipTaxonomy = readYamlFile(
    join(REPO_ROOT, 'taxonomies', 'relationship-types.yaml'),
  );
  const relationshipTerms = new Set(
    isRecord(relationshipTaxonomy)
      ? asRecordArray(relationshipTaxonomy.terms)
          .map((term) => asString(term.id))
          .filter((id): id is string => id !== undefined)
      : [],
  );

  const modelFiles = listFiles(join(REPO_ROOT, 'models'), ['.yaml']);

  for (const file of modelFiles) {
    const where = repoPath(file);
    const parsed = readYamlFile(file);
    if (!isRecord(parsed)) {
      reporter.fail(where, 'model is not a mapping');
      continue;
    }

    const expectedId = where.replace(/^models\//, '').replace(/\.yaml$/, '');
    if (asString(parsed.id) !== expectedId) {
      reporter.fail(where, `id must be ${expectedId}`);
    }
    if (asString(parsed.apiVersion) !== 'amasario.dev/v1') reporter.fail(where, 'bad apiVersion');
    if (asString(parsed.specVersion) !== '1.0.0') reporter.fail(where, 'bad specVersion');
    if (typeof parsed.description !== 'string' || parsed.description.length < 120) {
      reporter.fail(where, 'description must explain why the model exists, not only what it is');
    }
    if (asString(parsed.modelKind) === undefined) reporter.fail(where, 'missing modelKind');
    if (asString(parsed.concept) === undefined) reporter.fail(where, 'missing concept');

    const schemaRef = parsed.schema;
    if (!isRecord(schemaRef)) {
      reporter.fail(where, 'missing schema reference');
      continue;
    }
    const schemaId = asString(schemaRef.id);
    const pointer = asString(schemaRef.pointer);
    if (schemaId === undefined || pointer === undefined) {
      reporter.fail(where, 'schema reference needs id and pointer');
      continue;
    }
    const schemaEntry = schemaById.get(schemaId);
    if (schemaEntry === undefined) {
      reporter.fail(where, `schema reference points at an unknown schema: ${schemaId}`);
      continue;
    }
    const target = resolveJsonPointer(schemaEntry.document, pointer);
    if (!isRecord(target)) {
      reporter.fail(where, `schema pointer ${pointer} does not resolve`);
      continue;
    }
    const properties = schemaProperties(target);
    const required = new Set(schemaRequired(target));
    const conditionally = conditionalRequired(schemaEntry.document);

    const fields = asRecordArray(parsed.fields);
    if (fields.length === 0) reporter.fail(where, 'model must declare fields');
    const seenFields = new Set<string>();

    for (const field of fields) {
      const name = asString(field.name);
      if (name === undefined) {
        reporter.fail(where, 'field without a name');
        continue;
      }
      if (seenFields.has(name)) reporter.fail(where, `duplicate field ${name}`);
      seenFields.add(name);

      const property = properties[name];
      if (property === undefined) {
        reporter.fail(where, `field ${name} does not exist in ${schemaId}${pointer}`);
        continue;
      }

      const requirement = asString(field.requirement);
      if (requirement === undefined || !REQUIREMENTS.has(requirement)) {
        reporter.fail(where, `field ${name} has an invalid requirement`);
        continue;
      }
      if (requirement === 'always' && !required.has(name)) {
        reporter.fail(
          where,
          `field ${name} is declared always but ${schemaId} does not require it`,
        );
      }
      if (requirement === 'conditional' && !conditionally.has(name)) {
        reporter.fail(
          where,
          `field ${name} is declared conditional but no conditional requires it`,
        );
      }
      if ((requirement === 'rule' || requirement === 'optional') && required.has(name)) {
        reporter.fail(
          where,
          `field ${name} is declared ${requirement} but ${schemaId} requires it unconditionally`,
        );
      }

      const declaredType = asString(field.type);
      if (declaredType === undefined || !MODEL_TYPES.has(declaredType)) {
        reporter.fail(where, `field ${name} has an invalid type`);
      } else if (isRecord(property)) {
        const schemaType = asString(property.type);
        if (schemaType !== undefined && schemaType !== declaredType) {
          reporter.fail(
            where,
            `field ${name} is declared ${declaredType} but the schema declares ${schemaType}`,
          );
        }
      }
      if (typeof field.description !== 'string' || field.description.length < 20) {
        reporter.fail(where, `field ${name} needs an explanatory description`);
      }
    }

    // Completeness: a model that omits a schema-required field would misrepresent the
    // contract a consumer depends on.
    for (const name of required) {
      if (!seenFields.has(name)) {
        reporter.fail(where, `schema-required field ${name} is missing from the model`);
      }
    }

    for (const taxonomy of asStringArray(parsed.taxonomies)) {
      if (!taxonomyIds.has(taxonomy)) reporter.fail(where, `unknown taxonomy ${taxonomy}`);
    }
    for (const relation of asRecordArray(parsed.relations)) {
      const kind = asString(relation.kind);
      if (kind === undefined || !relationshipTerms.has(kind)) {
        reporter.fail(where, `relation kind ${String(kind)} is not in relationship-types`);
      }
      if (typeof relation.description !== 'string' || relation.description.length < 20) {
        reporter.fail(where, `relation ${String(kind)} needs a description`);
      }
    }
    if (asStringArray(parsed.invariants).length === 0) {
      reporter.fail(where, 'model must state at least one invariant');
    }
    if (asStringArray(parsed.nonGoals).length === 0) {
      reporter.fail(where, 'model must state at least one non-goal');
    }
  }

  if (modelFiles.length !== EXPECTED_MODEL_COUNT) {
    reporter.fail('models/', `expected ${EXPECTED_MODEL_COUNT} models, found ${modelFiles.length}`);
  }

  return reporter.finish(`${modelFiles.length} models`);
}

if (fileURLToPath(import.meta.url) === resolve(process.argv[1] ?? '')) {
  process.exitCode = main();
}
