/**
 * Release validation.
 *
 * This is the check that runs before a release and answers four questions that no
 * other validator covers:
 *
 * 1. Does the repository still match its specified structure exactly? The structure is
 *    part of the contract with consumers, so a missing or extra artefact is a defect
 *    rather than a matter of taste.
 * 2. Do the versions agree? The package version, the specVersion stamped on every
 *    artefact, the apiVersion family and the schema id prefix must all describe the
 *    same specification.
 * 3. Does the changelog account for the version being released?
 * 4. Does anything that must never be committed appear in the repository?
 *
 * Run with `npm run release:check`.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  API_VERSION,
  Reporter,
  isRecord,
  listFiles,
  readJsonFile,
  readYamlFile,
  repoPath,
  REPO_ROOT,
  SCHEMA_ID_PREFIX,
  SPEC_VERSION,
} from './validate-schema.js';

// ---------------------------------------------------------------------------
// The specified structure
// ---------------------------------------------------------------------------

const ROOT_FILES = [
  'CHANGELOG.md',
  'CONTRIBUTING.md',
  'GOVERNANCE.md',
  'LICENSE',
  'README.md',
  'SECURITY.md',
  'VERSIONING.md',
];

const GITHUB_FILES = [
  '.github/dependabot.yml',
  '.github/PULL_REQUEST_TEMPLATE.md',
  '.github/ISSUE_TEMPLATE/bug-report.yml',
  '.github/ISSUE_TEMPLATE/improvement.yml',
  '.github/ISSUE_TEMPLATE/model-proposal.yml',
  '.github/workflows/ci.yml',
  '.github/workflows/docs.yml',
  '.github/workflows/fixture-validation.yml',
  '.github/workflows/model-validation.yml',
  '.github/workflows/release.yml',
  '.github/workflows/schema-validation.yml',
];

const DOCS_FILES = [
  'architecture.md',
  'artifact-model.md',
  'attestations.md',
  'build-provenance.md',
  'compatibility.md',
  'confidence-model.md',
  'contract-identity.md',
  'dependency-classification.md',
  'dependency-model.md',
  'dependency-resolution.md',
  'deployment-model.md',
  'evidence-model.md',
  'faq.md',
  'governance.md',
  'impact-model.md',
  'impact-propagation.md',
  'introduction.md',
  'network-model.md',
  'privacy.md',
  'provenance-model.md',
  'reproducibility.md',
  'security.md',
  'source-identity.md',
  'temporal-model.md',
  'terminology.md',
  'transitive-dependencies.md',
  'verification.md',
  'versioning.md',
  'wasm-identity.md',
];

const SCHEMA_FILES = [
  'artifact.schema.json',
  'attestation.schema.json',
  'build.schema.json',
  'confidence.schema.json',
  'contract.schema.json',
  'dependency-edge.schema.json',
  'dependency-set.schema.json',
  'dependency.schema.json',
  'deployment.schema.json',
  'diff.schema.json',
  'error.schema.json',
  'event.schema.json',
  'evidence.schema.json',
  'graph.schema.json',
  'impact-path.schema.json',
  'impact.schema.json',
  'invocation.schema.json',
  'network.schema.json',
  'provenance.schema.json',
  'report.schema.json',
  'snapshot.schema.json',
  'source.schema.json',
  'transaction.schema.json',
  'wasm.schema.json',
];

const TAXONOMY_FILES = [
  'artifact-types.yaml',
  'change-types.yaml',
  'confidence-levels.yaml',
  'dependency-types.yaml',
  'deployment-statuses.yaml',
  'evidence-types.yaml',
  'impact-types.yaml',
  'network-types.yaml',
  'relationship-types.yaml',
  'verification-statuses.yaml',
];

const MODEL_FILES = [
  'dependencies/contract.yaml',
  'dependencies/direct.yaml',
  'dependencies/external.yaml',
  'dependencies/package.yaml',
  'dependencies/runtime.yaml',
  'dependencies/transitive.yaml',
  'dependencies/wasm.yaml',
  'evidence/artifact.yaml',
  'evidence/attestation.yaml',
  'evidence/build.yaml',
  'evidence/deployment.yaml',
  'evidence/event.yaml',
  'evidence/source.yaml',
  'evidence/transaction.yaml',
  'impact/affected-artifact.yaml',
  'impact/affected-contract.yaml',
  'impact/affected-deployment.yaml',
  'impact/direct.yaml',
  'impact/transitive.yaml',
  'provenance/artifact.yaml',
  'provenance/build.yaml',
  'provenance/contract.yaml',
  'provenance/deployment.yaml',
  'provenance/source.yaml',
];

const RULE_FILES = [
  'dependency/artifact-dependency.yaml',
  'dependency/contract-dependency.yaml',
  'dependency/direct-dependency.yaml',
  'dependency/transitive-dependency.yaml',
  'identity/artifact-identity.yaml',
  'identity/contract-identity.yaml',
  'identity/wasm-identity.yaml',
  'impact/change-impact.yaml',
  'impact/deployment-impact.yaml',
  'impact/direct-impact.yaml',
  'impact/transitive-impact.yaml',
  'provenance/build-to-wasm.yaml',
  'provenance/contract-to-deployment.yaml',
  'provenance/source-to-build.yaml',
  'provenance/wasm-to-contract.yaml',
];

const FIXTURE_FILES = [
  'contract-dependency/direct.yaml',
  'contract-dependency/mixed.yaml',
  'contract-dependency/transitive.yaml',
  'impact/direct-impact.yaml',
  'impact/multi-hop-impact.yaml',
  'impact/transitive-impact.yaml',
  'invalid/broken-edge.yaml',
  'invalid/invalid-provenance.yaml',
  'invalid/malformed-contract.yaml',
  'invalid/malformed-dependency.yaml',
  'minimal/artifact.yaml',
  'minimal/contract.yaml',
  'minimal/provenance.yaml',
  'provenance/mismatched-wasm.yaml',
  'provenance/partial-build.yaml',
  'provenance/unknown-source.yaml',
  'provenance/verified-build.yaml',
];

const EXAMPLE_FILES = [
  'build-provenance.yaml',
  'complete-project.yaml',
  'contract-with-dependencies.yaml',
  'deployment-provenance.yaml',
  'impact-analysis.yaml',
  'minimal-provenance.yaml',
  'transitive-dependency-graph.yaml',
  'verified-contract.yaml',
];

const SCRIPT_FILES = [
  'generate-docs.ts',
  'release-check.ts',
  'validate-fixtures.ts',
  'validate-models.ts',
  'validate-rules.ts',
  'validate-schema.ts',
  'validate-taxonomies.ts',
  'validate-vectors.ts',
];

const VECTOR_DIRECTORIES = [
  'dependency/contract',
  'dependency/direct',
  'dependency/transitive',
  'identity/artifact',
  'identity/contract',
  'identity/wasm',
  'impact/direct',
  'impact/multi-hop',
  'impact/transitive',
  'provenance/build',
  'provenance/deployment',
  'provenance/source',
  'provenance/wasm',
];

const TEST_DIRECTORIES = ['compatibility', 'fixtures', 'models', 'rules', 'schema', 'vectors'];

/**
 * Tooling files that the specification structure does not name but that any
 * TypeScript repository requires. They are listed explicitly so that an unexpected
 * root file is still surfaced rather than silently tolerated.
 */
const ALLOWED_ROOT_EXTRAS = [
  '.editorconfig',
  '.gitignore',
  '.prettierignore',
  '.prettierrc.json',
  'eslint.config.mjs',
  'package-lock.json',
  'package.json',
  'tsconfig.json',
];

// ---------------------------------------------------------------------------
// Secrets
// ---------------------------------------------------------------------------

const SECRET_PATTERNS: readonly { name: string; pattern: RegExp }[] = [
  { name: 'GitHub token', pattern: /\bgh[pousr]_[A-Za-z0-9]{20,}/ },
  { name: 'GitHub fine-grained token', pattern: /\bgithub_pat_[A-Za-z0-9_]{20,}/ },
  { name: 'AWS access key id', pattern: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: 'PEM private key', pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { name: 'Stellar secret seed', pattern: /\bS[A-Z2-7]{55}\b/ },
  { name: 'Slack token', pattern: /\bxox[abprs]-[A-Za-z0-9-]{10,}/ },
  {
    name: 'generic bearer assignment',
    pattern: /\b(?:api[_-]?key|secret|password)\s*[:=]\s*['"][^'"\s]{16,}['"]/i,
  },
];

// ---------------------------------------------------------------------------

function main(): number {
  const reporter = new Reporter('release-check');

  // -- structure ------------------------------------------------------------
  const expectedFiles: string[] = [
    ...ROOT_FILES,
    ...GITHUB_FILES,
    ...DOCS_FILES.map((name) => `docs/${name}`),
    ...SCHEMA_FILES.map((name) => `schema/${name}`),
    ...TAXONOMY_FILES.map((name) => `taxonomies/${name}`),
    ...MODEL_FILES.map((name) => `models/${name}`),
    ...RULE_FILES.map((name) => `rules/${name}`),
    ...FIXTURE_FILES.map((name) => `fixtures/${name}`),
    ...EXAMPLE_FILES.map((name) => `examples/${name}`),
    ...SCRIPT_FILES.map((name) => `scripts/${name}`),
  ];

  for (const relativePath of expectedFiles) {
    const path = join(REPO_ROOT, relativePath);
    try {
      if (!statSync(path).isFile()) reporter.fail(relativePath, 'expected a file');
    } catch {
      reporter.fail(relativePath, 'missing from the specified structure');
    }
  }

  for (const directory of VECTOR_DIRECTORIES) {
    const path = join(REPO_ROOT, 'vectors', directory);
    let entries: string[];
    try {
      entries = readdirSync(path).filter((entry) => entry.endsWith('.yaml'));
    } catch {
      reporter.fail(`vectors/${directory}`, 'missing vector directory');
      continue;
    }
    if (entries.length === 0) {
      reporter.fail(`vectors/${directory}`, 'vector directory is empty, which is a placeholder');
    }
  }

  for (const directory of TEST_DIRECTORIES) {
    const path = join(REPO_ROOT, 'tests', directory);
    let entries: string[];
    try {
      entries = readdirSync(path).filter((entry) => entry.endsWith('.test.ts'));
    } catch {
      reporter.fail(`tests/${directory}`, 'missing test directory');
      continue;
    }
    if (entries.length === 0) {
      reporter.fail(`tests/${directory}`, 'test directory contains no tests');
    }
  }

  // Unexpected root entries.
  const present = readdirSync(REPO_ROOT);
  const expectedRoot = new Set([
    ...ROOT_FILES,
    ...ALLOWED_ROOT_EXTRAS,
    '.github',
    'docs',
    'examples',
    'fixtures',
    'models',
    'rules',
    'schema',
    'scripts',
    'taxonomies',
    'tests',
    'vectors',
  ]);
  for (const entry of present) {
    if (!expectedRoot.has(entry)) reporter.fail(entry, 'unexpected entry at the repository root');
  }

  // -- versions -------------------------------------------------------------
  const manifest = readJsonFile(join(REPO_ROOT, 'package.json'));
  if (!isRecord(manifest)) {
    reporter.fail('package.json', 'is not an object');
  } else if (manifest.version !== SPEC_VERSION) {
    reporter.fail(
      'package.json',
      `version ${String(manifest.version)} does not match the specification version ${SPEC_VERSION}`,
    );
  }

  const artefacts = [
    ...listFiles(join(REPO_ROOT, 'taxonomies'), ['.yaml']),
    ...listFiles(join(REPO_ROOT, 'models'), ['.yaml']),
    ...listFiles(join(REPO_ROOT, 'rules'), ['.yaml']),
    ...listFiles(join(REPO_ROOT, 'fixtures'), ['.yaml']),
    ...listFiles(join(REPO_ROOT, 'examples'), ['.yaml']),
    ...listFiles(join(REPO_ROOT, 'vectors'), ['.yaml']),
  ];
  for (const file of artefacts) {
    const parsed = readYamlFile(file);
    if (!isRecord(parsed)) {
      reporter.fail(repoPath(file), 'artefact is not a mapping');
      continue;
    }
    if (parsed.specVersion !== SPEC_VERSION) {
      reporter.fail(repoPath(file), `specVersion must be ${SPEC_VERSION}`);
    }
    // Only document-level artefacts carry an apiVersion; models and rules are
    // specification-internal and do not.
    if ('apiVersion' in parsed && parsed.apiVersion !== API_VERSION) {
      reporter.fail(repoPath(file), `apiVersion must be ${API_VERSION}`);
    }
  }

  const major = SPEC_VERSION.split('.')[0] ?? '1';
  for (const file of listFiles(join(REPO_ROOT, 'schema'), ['.json'])) {
    const document = readJsonFile(file);
    if (!isRecord(document)) continue;
    const id = typeof document.$id === 'string' ? document.$id : '';
    if (!id.startsWith(SCHEMA_ID_PREFIX)) {
      reporter.fail(repoPath(file), `$id must start with ${SCHEMA_ID_PREFIX}`);
      continue;
    }
    if (!id.includes(`/v${major}/`)) {
      reporter.fail(repoPath(file), `$id does not declare the v${major} compatibility family`);
    }
  }

  // -- changelog ------------------------------------------------------------
  let changelog = '';
  try {
    changelog = readFileSync(join(REPO_ROOT, 'CHANGELOG.md'), 'utf8');
  } catch {
    reporter.fail('CHANGELOG.md', 'missing');
  }
  if (changelog !== '') {
    const hasVersionHeading =
      changelog.includes(`## [${SPEC_VERSION}]`) || changelog.includes('## [Unreleased]');
    if (!hasVersionHeading) {
      reporter.fail(
        'CHANGELOG.md',
        `must contain a heading for ${SPEC_VERSION} or an [Unreleased] section`,
      );
    }
    if (!/^### (Added|Changed|Removed|Fixed|Deprecated|Security|Notes)/m.test(changelog)) {
      reporter.fail('CHANGELOG.md', 'must use the Keep a Changelog section headings');
    }
  }

  // -- documentation depth --------------------------------------------------
  let readme = '';
  try {
    readme = readFileSync(join(REPO_ROOT, 'README.md'), 'utf8');
  } catch {
    reporter.fail('README.md', 'missing');
  }
  if (readme !== '') {
    if (readme.length < 2000) {
      reporter.fail('README.md', 'must actually explain the project rather than act as a stub');
    }
    for (const required of ['amasario-provenance-engine', 'amasario-provenance-spec']) {
      if (!readme.includes(required)) {
        reporter.fail('README.md', `must state its relationship to ${required}`);
      }
    }
  }

  // -- secrets --------------------------------------------------------------
  const scanned = listFiles(REPO_ROOT, ['.yaml', '.json', '.md', '.ts', '.yml', '.mjs', '.sh']);
  for (const file of scanned) {
    const relative = repoPath(file);
    if (relative.startsWith('node_modules/') || relative === 'package-lock.json') continue;
    const contents = readFileSync(file, 'utf8');
    for (const { name, pattern } of SECRET_PATTERNS) {
      if (pattern.test(contents)) {
        reporter.fail(relative, `looks like it contains a ${name}; no credential may be committed`);
      }
    }
  }

  // -- completeness of the specification surface ----------------------------
  reporter.note(
    `structure: ${expectedFiles.length} specified files, ${VECTOR_DIRECTORIES.length} vector directories, ${TEST_DIRECTORIES.length} test directories`,
  );
  reporter.note(`secrets: scanned ${scanned.length} files`);

  return reporter.finish(
    `${expectedFiles.length} specified files, ${artefacts.length} versioned artefacts, ${scanned.length} scanned files`,
  );
}

if (fileURLToPath(import.meta.url) === resolve(process.argv[1] ?? '')) {
  process.exitCode = main();
}
