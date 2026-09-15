/**
 * Schema validation, and the shared foundation for every other validator.
 *
 * The repository structure fixes exactly eight files under `scripts/`, so rather
 * than add a ninth for shared utilities, this file hosts them. It is the natural
 * home: schema loading, the canonical serialisation defined in VERSIONING.md, and
 * the Ajv configuration that every other validator needs are all defined in terms
 * of the schemas.
 *
 * Run directly with `npm run validate:schemas`.
 */
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
// The named export is imported rather than the default one: ajv is CommonJS-only, and
// under NodeNext resolution the default import binds to the module's exports object
// rather than to the class, so it can be used as a value but not as the type of the
// created instance.
import { Ajv2020 } from 'ajv/dist/2020.js';
import * as ajvFormatsModule from 'ajv-formats';

// ajv-formats is CommonJS and declares its plugin only as a default export, which
// does not survive CommonJS interop as a callable here. The cast is confined to this
// one binding and is asserted to be the plugin's real shape.
type FormatsPlugin = (ajv: Ajv2020) => Ajv2020;
const applyFormats = ajvFormatsModule.default as unknown as FormatsPlugin;
import { parse as parseYaml } from 'yaml';

// ---------------------------------------------------------------------------
// Repository constants
// ---------------------------------------------------------------------------

export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const API_VERSION = 'amasario.dev/v1';
export const SPEC_VERSION = '1.0.0';
export const SCHEMA_ID_PREFIX = 'https://amasario.dev/spec/v1/schema/';
export const JSON_SCHEMA_DIALECT = 'https://json-schema.org/draft/2020-12/schema';

// ---------------------------------------------------------------------------
// Narrowing helpers
//
// YAML and JSON are parsed as `unknown`, and the lint configuration forbids unsafe
// access. These guards are the only place a structural assumption about untrusted
// content is made, so every other module narrows through them.
// ---------------------------------------------------------------------------

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
}

export function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

export function asRecordArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

export function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string')
    : [];
}

// ---------------------------------------------------------------------------
// Reading artefacts
// ---------------------------------------------------------------------------

export function readJsonFile(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf8')) as unknown;
}

export function readYamlFile(path: string): unknown {
  return parseYaml(readFileSync(path, 'utf8')) as unknown;
}

/** Every file under `dir` with one of the given extensions, sorted for determinism. */
export function listFiles(dir: string, extensions: readonly string[]): string[] {
  const out: string[] = [];
  const walk = (current: string): void => {
    let entries: string[];
    try {
      entries = readdirSync(current);
    } catch {
      return;
    }
    for (const entry of entries.sort()) {
      const path = join(current, entry);
      if (statSync(path).isDirectory()) walk(path);
      else if (extensions.some((extension) => entry.endsWith(extension))) out.push(path);
    }
  };
  walk(dir);
  return out.sort();
}

export function repoPath(absolutePath: string): string {
  return relative(REPO_ROOT, absolutePath).split('\\').join('/');
}

// ---------------------------------------------------------------------------
// Canonical serialisation and digests
//
// VERSIONING.md section 7 defines these normatively: object keys sorted by Unicode
// code point, no insignificant whitespace, numbers in shortest round-trippable form,
// absent properties omitted rather than emitted as null. Everything downstream that
// compares or hashes a document depends on this exact definition, so it lives in one
// place and is exercised by the determinism tests.
// ---------------------------------------------------------------------------

export function canonicalJson(value: unknown): string {
  if (value === null) return 'null';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new Error(`canonicalJson: non-finite number ${String(value)} is not serialisable`);
    }
    return JSON.stringify(value);
  }
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'string') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((entry) => canonicalJson(entry)).join(',')}]`;
  }
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record)
      .filter((key) => record[key] !== undefined)
      .sort();
    const body = keys
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
      .join(',');
    return `{${body}}`;
  }
  throw new Error(`canonicalJson: unsupported type ${typeof value}`);
}

export function sha256Hex(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

export interface Canonicalisation {
  readonly canonical: string;
  readonly digest: string;
}

export function canonicalise(value: unknown): Canonicalisation {
  const canonical = canonicalJson(value);
  return { canonical, digest: `sha256:${sha256Hex(canonical)}` };
}

// ---------------------------------------------------------------------------
// Schema registry
// ---------------------------------------------------------------------------

export interface SchemaEntry {
  readonly file: string;
  readonly id: string;
  readonly document: Record<string, unknown>;
}

export function loadSchemaRegistry(): SchemaEntry[] {
  const dir = join(REPO_ROOT, 'schema');
  return listFiles(dir, ['.json']).map((file) => {
    const parsed = readJsonFile(file);
    if (!isRecord(parsed)) {
      throw new Error(`${repoPath(file)}: schema is not a JSON object`);
    }
    return {
      file,
      id: typeof parsed.$id === 'string' ? parsed.$id : '',
      document: parsed,
    };
  });
}

/**
 * The Ajv configuration used by every validator.
 *
 * `strict: true` is kept on so that a schema which is merely tolerated is surfaced
 * rather than accepted. Two relaxations are deliberate and documented:
 *
 * - `strictRequired: false` because evidence.schema.json uses `if`/`then` to require
 *   fields that are declared in the parent object. That is valid JSON Schema and
 *   validates correctly; Ajv's lint only looks within one subschema scope, so it
 *   would otherwise reject a correct schema.
 * - `allowUnionTypes: true` because a diff's before and after values are genuinely
 *   scalars of several types, and collapsing them to one type would lose information
 *   a consumer needs.
 */
export function createValidator(): Ajv2020 {
  const ajv = new Ajv2020({
    strict: true,
    strictRequired: false,
    allowUnionTypes: true,
    allErrors: true,
    validateFormats: true,
  });
  applyFormats(ajv);
  for (const entry of loadSchemaRegistry()) {
    ajv.addSchema(entry.document);
  }
  return ajv;
}

export function describeAjvErrors(
  errors: readonly { keyword: string; instancePath: string; message?: string }[] | null | undefined,
): string {
  if (!errors || errors.length === 0) return '(no Ajv error detail)';
  return errors
    .map(
      (error) =>
        `${error.keyword} at ${error.instancePath === '' ? '/' : error.instancePath}${error.message ? `: ${error.message}` : ''}`,
    )
    .join(' | ');
}

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------

export class Reporter {
  private readonly failures: string[] = [];
  private readonly notes: string[] = [];
  private readonly label: string;

  constructor(label: string) {
    this.label = label;
  }

  fail(where: string, message: string): void {
    this.failures.push(`${where}: ${message}`);
  }

  /** A non-fatal observation worth surfacing but not worth failing a build over. */
  note(message: string): void {
    this.notes.push(message);
  }

  get failureCount(): number {
    return this.failures.length;
  }

  /** Prints the outcome and returns a process exit code. */
  finish(checked: string): number {
    for (const note of this.notes) console.log(`note: ${note}`);
    for (const failure of this.failures) console.log(`FAIL ${failure}`);
    console.log(`${this.label}: checked ${checked}`);
    if (this.failures.length > 0) {
      console.log(`${this.label}: ${this.failures.length} FAILURE(S)`);
      return 1;
    }
    console.log(`${this.label}: PASS`);
    return 0;
  }
}

// ---------------------------------------------------------------------------
// Schema validation
// ---------------------------------------------------------------------------

/** Properties of an object schema node, or an empty record when there is none. */
export function schemaProperties(node: Record<string, unknown>): Record<string, unknown> {
  const properties = node.properties;
  return isRecord(properties) ? properties : {};
}

export function schemaRequired(node: Record<string, unknown>): string[] {
  return asStringArray(node.required);
}

/** Resolves a JSON Pointer such as `/properties/type` against a parsed document. */
export function resolveJsonPointer(document: unknown, pointer: string): unknown {
  if (pointer === '') return document;
  let current: unknown = document;
  for (const rawPart of pointer.split('/').slice(1)) {
    const part = rawPart.replace(/~1/g, '/').replace(/~0/g, '~');
    if (!isRecord(current) && !Array.isArray(current)) return undefined;
    if (Array.isArray(current)) {
      const index = Number.parseInt(part, 10);
      if (!Number.isInteger(index) || index < 0 || index >= current.length) return undefined;
      current = current[index];
      continue;
    }
    if (!isRecord(current) || !(part in current)) return undefined;
    current = current[part];
  }
  return current;
}

interface EnumLocation {
  readonly file: string;
  readonly pointer: string;
  readonly terms: readonly string[];
}

/** Every literal string enum in a document, located by JSON Pointer. */
export function collectLiteralEnums(
  document: unknown,
  file: string,
  pointer = '',
  out: EnumLocation[] = [],
): EnumLocation[] {
  if (Array.isArray(document)) {
    document.forEach((entry, index) =>
      collectLiteralEnums(entry, file, `${pointer}/${index}`, out),
    );
    return out;
  }
  if (!isRecord(document)) return out;
  for (const [key, value] of Object.entries(document)) {
    if (key === 'enum' && isStringArray(value)) {
      out.push({ file, pointer, terms: [...value].sort() });
    }
    collectLiteralEnums(value, file, `${pointer}/${key}`, out);
  }
  return out;
}

export const EXPECTED_SCHEMA_COUNT = 24;

function main(): number {
  const reporter = new Reporter('validate-schema');
  const entries = loadSchemaRegistry();
  const seenIds = new Map<string, string>();

  for (const entry of entries) {
    const where = repoPath(entry.file);
    const doc = entry.document;

    if (doc.$schema !== JSON_SCHEMA_DIALECT) {
      reporter.fail(where, `$schema must be ${JSON_SCHEMA_DIALECT}`);
    }
    if (entry.id === '') {
      reporter.fail(where, 'missing $id');
    } else {
      if (!entry.id.startsWith(SCHEMA_ID_PREFIX)) {
        reporter.fail(where, `$id must start with ${SCHEMA_ID_PREFIX}`);
      }
      const previous = seenIds.get(entry.id);
      if (previous !== undefined) reporter.fail(where, `duplicate $id also used by ${previous}`);
      seenIds.set(entry.id, where);
    }
    if (typeof doc.title !== 'string' || doc.title.length === 0) {
      reporter.fail(where, 'missing title');
    }
    if (typeof doc.description !== 'string' || doc.description.length < 40) {
      reporter.fail(where, 'description must be present and explanatory');
    }
    if (doc.type !== 'object') {
      reporter.fail(where, 'every Amasario document root must be an object');
    }
    // A silently ignored field is indistinguishable from a correctly handled one, so
    // every document root is closed and only named extension points are open.
    if (doc.additionalProperties !== false) {
      reporter.fail(where, 'root must set additionalProperties: false');
    }
  }

  if (entries.length !== EXPECTED_SCHEMA_COUNT) {
    reporter.fail('schema/', `expected ${EXPECTED_SCHEMA_COUNT} schemas, found ${entries.length}`);
  }

  // Ajv compiles a schema only when every $ref it contains resolves, so compiling the
  // whole registry is what actually proves the schemas are mutually consistent.
  try {
    const ajv = createValidator();
    for (const entry of entries) {
      if (ajv.getSchema(entry.id) === undefined) {
        reporter.fail(repoPath(entry.file), 'schema did not compile into the registry');
      }
    }
  } catch (error) {
    reporter.fail(
      'schema/',
      `registry failed to compile: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  return reporter.finish(`${entries.length} schemas`);
}

if (process.argv[1] !== undefined && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  process.exitCode = main();
}
