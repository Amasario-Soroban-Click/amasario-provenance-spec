# Contributing to Amasario Provenance Specification

Thank you for considering a contribution. This repository is the normative
specification layer for AMASARIO — Soroban contract dependency, provenance and
impact infrastructure.

Before you start, please read:

- `GOVERNANCE.md` — how normative changes are proposed and approved.
- `VERSIONING.md` — what counts as a breaking change.
- `docs/architecture.md` — the boundary between this repository and
  `amasario-provenance-engine`.

---

## 1. The one rule that matters

**This repository defines what things mean. It does not perform analysis.**

If your change would add network access, contract inspection, dependency
discovery, graph traversal or impact propagation, it belongs in
`amasario-provenance-engine`. The only executable code here is the validation
tooling in `scripts/` and `tests/`, whose sole job is to prove that the
machine-readable artefacts are internally consistent.

---

## 2. Local setup

Requires Node.js >= 20.19.

```bash
git clone https://github.com/Amasario-Soroban-Click/amasario-provenance-spec.git
cd amasario-provenance-spec
npm ci
```

Verify your environment end to end:

```bash
npm run ci
```

`npm run ci` runs, in order: `prettier --check`, `eslint`, `tsc --noEmit`, all
six validators, the documentation check, and the test suite. It is the same
sequence CI runs, so a green local run means a green pull request.

Individual steps:

```bash
npm run format          # rewrite formatting
npm run lint            # type-aware lint
npm run typecheck       # tsc --noEmit
npm run validate        # all six validators
npm run test            # vitest
npm run docs:check      # generated documentation is up to date
npm run docs:generate   # regenerate docs/generated/
```

---

## 3. Repository layout

| Path          | Contains                                                      | Validated by             |
| ------------- | ------------------------------------------------------------- | ------------------------ |
| `schema/`     | JSON Schemas (2020-12). The machine-readable contract.        | `validate-schema.ts`     |
| `taxonomies/` | Controlled vocabularies.                                      | `validate-taxonomies.ts` |
| `models/`     | Conceptual model definitions that map onto schemas.           | `validate-models.ts`     |
| `rules/`      | Normative rules with severity and fixture references.         | `validate-rules.ts`      |
| `fixtures/`   | Valid and invalid instances used to prove the schemas behave. | `validate-fixtures.ts`   |
| `vectors/`    | Deterministic input/expected pairs with canonical digests.    | `validate-vectors.ts`    |
| `examples/`   | Complete, realistic documents for humans.                     | `validate-fixtures.ts`   |
| `docs/`       | Explanatory prose. Not normative.                             | `docs:check`             |
| `scripts/`    | Validation tooling.                                           | `tsc`, `eslint`          |
| `tests/`      | Tests of the tooling itself.                                  | `vitest`                 |

Normative priority, highest first: `schema/` → `rules/` → `taxonomies/` →
`models/` → `vectors/` → `fixtures/` and `examples/` → `docs/`. If prose in
`docs/` contradicts a schema, the schema is correct and the prose is a bug.

---

## 4. Recipes

### Add an enumeration term

1. Add the term to the taxonomy in `taxonomies/`.
2. Check `openness`: adding a term to a `closed` taxonomy is a MAJOR change and
   needs two maintainer approvals (`GOVERNANCE.md` §6).
3. If the term must be accepted by a schema, update the corresponding `enum` in
   `schema/`. `validate-taxonomies.ts` fails if a schema enum and its taxonomy
   disagree in either direction.
4. Add a fixture that exercises it and, where the value affects output, a vector.
5. Add a `CHANGELOG.md` entry.

### Add a schema property

1. Add it to the schema with an explicit `type` and a `description`.
2. Decide `required`. A new required property is a MAJOR change. Prefer optional
   plus a rule that requires it conditionally.
3. Update the matching model in `models/` so the model's field list matches the
   schema's properties. `validate-models.ts` fails on drift.
4. Add a valid fixture, and an invalid fixture under `fixtures/invalid/` that
   declares an `expectedError` proving the constraint rejects bad input.

### Add a rule

Rules live in `rules/<area>/<name>.yaml`. A rule MUST include:

- `id` — stable, kebab-case, unique.
- `severity` — one of `MUST`, `MUST_NOT`, `SHOULD`, `SHOULD_NOT`, `MAY`.
- `statement` — the normative assertion.
- `rationale` — why it exists. "Because it seems sensible" is not a rationale.
- `appliesTo` — the schema `$id`s or model ids it constrains.
- `fixtures` — at least one fixture id that demonstrates it. CI rejects a rule
  with no fixture, because an untested rule is an unverifiable one.

### Add a fixture

- Valid fixtures go under `fixtures/<area>/` and declare `schema:` pointing at a
  file in `schema/`. They MUST validate.
- Invalid fixtures go under `fixtures/invalid/` and MUST declare
  `expectedError: { keyword, path }`. They MUST **fail** validation with that
  keyword at that path. A fixture under `invalid/` that validates successfully
  fails CI.

### Add a vector

A vector is a deterministic input/expected pair consumable by
`amasario-provenance-engine`:

```yaml
id: identity/contract/basic
description: ...
input: { ... }
expected:
  canonical: '{"..."}' # canonical JSON serialisation of the output
  canonicalDigest: sha256:... # digest of the above
```

`validate-vectors.ts` recomputes the digest from `canonical` and fails on a
mismatch, and asserts that re-serialising the input is byte-stable. Vectors must
never be edited by hand to make a failing test pass — regenerate them.

---

## 5. What is not accepted

Pull requests are rejected automatically or on review when they contain:

- **Fake functionality.** Placeholder implementations, empty directories
  presented as features, simulated network results.
- **Hardcoded analysis results** presented as discovered data.
- **Unsupported claims.** Content that asserts a contract is secure, safe,
  malicious or vulnerability-free (`SECURITY.md`).
- **Documentation for features that do not exist.**
- **Uncontrolled strings** where a taxonomy term is appropriate.
- **Executable analysis logic in YAML.** YAML declares meaning; Rust and
  TypeScript execute it.
- **A relationship with no evidence.** If a fixture asserts a dependency, the
  fixture must carry the evidence that supports it.

---

## 6. Commit and pull request conventions

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <summary>

<body: what changed and why>
```

Types: `feat`, `fix`, `docs`, `spec`, `schema`, `taxonomy`, `model`, `rule`,
`fixture`, `vector`, `test`, `build`, `ci`, `chore`.

One logical change per commit. A commit that adds a schema property **and**
unrelated documentation is two commits.

Pull requests must complete the checklist in
`.github/PULL_REQUEST_TEMPLATE.md`, including the statement of which invariants
in `GOVERNANCE.md` §5 the change touches.

---

## 7. Reporting issues

- Bugs and inconsistencies: `bug-report.yml`.
- New models, terms or relationship types: `model-proposal.yml`.
- Quality, tooling and documentation improvements: `improvement.yml`.

Security reports do **not** go through public issues. See `SECURITY.md`.
