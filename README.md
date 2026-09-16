# AMASARIO — Provenance Specification

[![CI](https://github.com/Amasario-Soroban-Click/amasario-provenance-spec/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/Amasario-Soroban-Click/amasario-provenance-spec/actions/workflows/ci.yml)
[![Schema validation](https://github.com/Amasario-Soroban-Click/amasario-provenance-spec/actions/workflows/schema-validation.yml/badge.svg?branch=main)](https://github.com/Amasario-Soroban-Click/amasario-provenance-spec/actions/workflows/schema-validation.yml)
[![Fixture and vector validation](https://github.com/Amasario-Soroban-Click/amasario-provenance-spec/actions/workflows/fixture-validation.yml/badge.svg?branch=main)](https://github.com/Amasario-Soroban-Click/amasario-provenance-spec/actions/workflows/fixture-validation.yml)
[![License: Apache-2.0](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![Version: 1.0.0](https://img.shields.io/badge/version-1.0.0-informational.svg)](CHANGELOG.md)
[![Walkthrough](https://img.shields.io/badge/%E2%96%B6_watch-the_5--minute_walkthrough-58a6ff)](https://amasario-explorer.vercel.app/pitch/amasario-pitch-v2.mp4)

[![Press play: the five-minute walkthrough](https://amasario-explorer.vercel.app/pitch/amasario-pitch-thumbnail.png)](https://amasario-explorer.vercel.app/pitch/amasario-pitch-v2.mp4)

**Soroban contract dependency, provenance and impact infrastructure.**

This repository is `amasario-provenance-spec`, the **normative specification layer**
of Amasario. It defines, in a machine-readable, versioned, deterministic and
extensible way, what Amasario means by contract identity, artifact identity, source
provenance, build provenance, deployment provenance, dependency relationships,
evidence, confidence, snapshots, graph relationships and impact analysis.

It does **not** perform analysis. The companion repository
[`amasario-provenance-engine`](https://github.com/Amasario-Soroban-Click/amasario-provenance-engine)
consumes this specification and performs discovery, verification, graph construction
and impact analysis. Keeping the two separate is deliberate: it keeps the model small
enough to depend on and checkable without trusting any particular implementation.

## The question this specification formalises

> What does it mean to know what a Soroban contract depends on, where its deployed
> artifact came from, what evidence supports that relationship, and what could be
> affected when an upstream dependency or artifact changes?

The specification answers it by making claims and evidence inseparable. A dependency
that does not state how it was established does not validate. A confidence level with
no evidence does not validate. A provenance document with no evidence is malformed
rather than weakly supported, because a document that can claim nothing should not be
producible at all.

## Why this matters

**Why provenance.** A contract address identifies an address. It is unique only
within a network, it can host different executables over time as the contract is
upgraded, and it says nothing about origin. "The contract at `C...`" is not a
statement about any particular bytes, and every relationship derived from that
assumption inherits the ambiguity.

**Why dependency graphs.** Almost every false dependency in real tooling comes from
one of five shortcuts: two repositories share a name, two projects mention each
other, two contracts sit in the same ecosystem, two packages have similar metadata,
or two contracts expose a similar interface. Each produces output that looks exactly
like a real finding. Amasario requires every dependency to state its basis — declared,
resolved, observed, embedded, configured, attested or inferred — and records the
inferred case at its true weight instead of dressing it up.

**Why impact analysis.** A change to a dependency is only actionable if you can see
what reaches it. Impact is derived from the declared `changePropagation` of each
relationship traversed, never inferred from the name of the relationship. A chain is
only as strong as its weakest link, so aggregated confidence is the minimum ordinal
across the path, with `UNKNOWN` absorbing.

## What this repository provides

| Directory     | Contents                                                                                                                        |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `schema/`     | 24 strict JSON Schemas: explicit types, required properties, constrained enumerations, `additionalProperties: false`.           |
| `taxonomies/` | 10 controlled vocabularies. Closed where an unknown term could corrupt an analysis; open where recognition degrades gracefully. |
| `models/`     | 24 conceptual models checked field-by-field against the schemas.                                                                |
| `rules/`      | 18 normative rules, every one referenced from a schema and resolvable by the validators.                                        |
| `fixtures/`   | 17 fixtures, including invalid ones that must fail on the exact declared keyword and instance path.                             |
| `examples/`   | 8 complete documents, validated by the same harness as the fixtures.                                                            |
| `vectors/`    | 13 deterministic vectors with canonical serialisations and digests, re-derived on every run.                                    |
| `scripts/`    | 8 real TypeScript validators. CI fails when any of them fails.                                                                  |
| `docs/`       | The explanatory chapters, plus reference pages generated from the artefacts themselves.                                         |

## What it does not claim

Amasario is provenance, dependency and impact infrastructure. It is **not** a
security scanner and no output is a security opinion. No term in any taxonomy here
means "trustworthy", and the following must never be emitted or implied:

`secure` · `safe` · `malicious` · `vulnerable` · `vulnerability-free` · `audited` · `certified`

`VERIFIED` means _the stated evidence is consistent with the stated claim_. It does
not mean the contract, its source, its dependencies or its operator are trustworthy.
A fully verified provenance chain can describe a deliberate backdoor. Where a third
party genuinely performs an assessment, it is representable as `ATTESTATION` evidence
with an issuer, a method and explicit scope limitations — never as a conclusion the
model reaches on its own.

The specification also refuses to treat absence as false: `UNVERIFIED` means a claim
has not been checked, not that it is discredited. See
[`docs/security.md`](docs/security.md) and [`docs/verification.md`](docs/verification.md).

## The model in one page

```
SOURCE            a repository and an immutable revision
  │ BUILT_FROM
BUILD             a recorded act of production: toolchain, config, inputs
  │ DERIVED_FROM
ARTIFACT          content-addressed outputs, including the WASM module
  │ DEPLOYED_AS
DEPLOYMENT        a transaction and a ledger that installed/instantiated it
  │ DEPLOYED_AS
CONTRACT          an address on a network hosting that executable
```

Only the rightmost node is directly observable from a network. Everything to the left
is supplied by a builder, matched against a digest, or unknown — and the model keeps
those three cases apart rather than collapsing them.

Two independent axes qualify every claim:

- **Confidence** — `VERIFIED`, `HIGH_CONFIDENCE`, `MEDIUM_CONFIDENCE`, `LOW_CONFIDENCE`, `UNKNOWN`. How much evidence there is.
- **Verification status** — `VERIFIED`, `PARTIALLY_VERIFIED`, `UNVERIFIED`, `CONFLICTING`, `UNKNOWN`. What that evidence says.

They are separate because contradictions must be representable. When a claimed source
revision rebuilds to a different digest than the deployed module, the correct output
is `CONFLICTING` — never `VERIFIED`. An incorrect `VERIFIED` is the most damaging
output this system can produce, because it is the one that stops a reader from
looking further.

## Reading the specification

- **New here?** [`docs/introduction.md`](docs/introduction.md) → [`docs/architecture.md`](docs/architecture.md) → [`docs/terminology.md`](docs/terminology.md)
- **The two directions:** [`docs/provenance-model.md`](docs/provenance-model.md) (backwards) and [`docs/impact-model.md`](docs/impact-model.md) (forwards)
- **Identity:** [`contract-identity`](docs/contract-identity.md), [`wasm-identity`](docs/wasm-identity.md), [`source-identity`](docs/source-identity.md), [`artifact-model`](docs/artifact-model.md)
- **Judging a claim:** [`evidence-model`](docs/evidence-model.md), [`confidence-model`](docs/confidence-model.md), [`verification`](docs/verification.md), [`attestations`](docs/attestations.md)
- **Versioning and compatibility:** [`VERSIONING.md`](VERSIONING.md), [`docs/versioning.md`](docs/versioning.md), [`docs/compatibility.md`](docs/compatibility.md)
- **Generated reference:** [`docs/generated/`](docs/generated/)

## Contributing

### Adding a model, rule or vector

Every artefact is validated by machinery, so the fastest way to contribute correctly
is to make the validators happy:

```bash
npm install
npm run typecheck     # strict TypeScript over the tooling
npm run lint          # type-aware ESLint
npm run validate      # taxonomies, schemas, models, rules, fixtures, vectors
npm run test          # the vitest suite
npm run docs:generate # regenerate docs/generated after changing an artefact
npm run ci            # everything CI runs, in order
```

A new normative artefact must arrive with all of the following, and CI fails without
them:

1. A **rationale** — what could not be represented before, and what went wrong as a
   result.
2. A **fixture or vector** that exercises it, validated by
   `scripts/validate-fixtures.ts` or `scripts/validate-vectors.ts`.
3. **Cross-layer consistency** — a term in a schema must exist in its taxonomy; a
   rule referenced from a schema must exist as a file; a model must not describe a
   field the schema does not define.
4. A **versioning assessment** — breaking, additive or editorial, per
   [`VERSIONING.md`](VERSIONING.md).

Template-driven changes start at the
[issue templates](.github/ISSUE_TEMPLATE/) — `model-proposal` for anything that
alters meaning. See [`GOVERNANCE.md`](GOVERNANCE.md) and
[`docs/governance.md`](docs/governance.md).

### Why validation is not a formality

Each validator catches a specific way a specification rots:

| Validator                | Catches                                                                                  |
| ------------------------ | ---------------------------------------------------------------------------------------- |
| `validate-schema.ts`     | A taxonomy enumeration drifting from a schema enumeration.                               |
| `validate-taxonomies.ts` | A `usedBy` binding that no longer resolves.                                              |
| `validate-models.ts`     | A model describing a field the schema does not define.                                   |
| `validate-rules.ts`      | A rule id referenced by a schema that has no file.                                       |
| `validate-fixtures.ts`   | An invalid fixture failing for the wrong reason; a dangling evidence reference.          |
| `validate-vectors.ts`    | A digest that does not reproduce, or a serialisation that is not stable.                 |
| `generate-docs.ts`       | A published inventory describing something that does not exist.                          |
| `release-check.ts`       | A missing artefact, a version disagreement, a placeholder directory, a committed secret. |

## How versioning works

Two version numbers exist and must not be conflated. The **specification version**
follows SemVer and is stamped on every document as `specVersion`. The **`apiVersion`**
(`amasario.dev/v1`) is the compatibility family and changes only on a major release,
so a consumer can reject an incompatible document before interpreting any field —
including fields it has never seen.

Breaking changes are distinguishable from additive ones: a required property added or
renamed, a narrowed enumeration, a stricter rule, or a change to canonical
serialisation is major. A new optional property, a new term in an open taxonomy, or a
relaxed rule is minor. See [`VERSIONING.md`](VERSIONING.md) for the full rules and
[`docs/compatibility.md`](docs/compatibility.md) for what a consumer may assume.

## Licence

Apache-2.0. See [`LICENSE`](LICENSE).
