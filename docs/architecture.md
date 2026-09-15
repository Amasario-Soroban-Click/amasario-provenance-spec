# Architecture

The specification is layered so that a change to one layer cannot silently
invalidate another. Each layer constrains the one above it, and the validation
tooling walks the layering in the same order.

```
                    schema/            wire format: what validates
                       ▲
                       │ constrained by
                  taxonomies/          controlled vocabularies
                       ▲
                       │ described by
                    models/            field-level meaning
                       ▲
                       │ obligated by
                     rules/            what a producer must satisfy
                       ▲
                       │ exercised by
              fixtures/  examples/     instances, valid and invalid
                       ▲
                       │ pinned by
                   vectors/            canonical input/output pairs
```

## Layer responsibilities

### `taxonomies/`

A taxonomy is the single owner of a term set. Each file declares the terms, and
`usedBy` binds the taxonomy to the exact schema locations that consume it. Terms
declare `openness`: a `closed` vocabulary means an unrecognised value is a
validation failure, and an `open` vocabulary means a consumer must handle an
unknown term explicitly rather than guessing. Network, evidence and deployment
taxonomies are open; relationship, confidence, verification and dependency
taxonomies are closed.

Each term also carries `changeClass`. That is what allows the versioning rules in
[versioning.md](versioning.md) to be enforced mechanically: adding a term to an
`additive` vocabulary is a minor change, while changing the meaning of a term in a
`normative` vocabulary is major.

### `schema/`

Twenty-four JSON Schemas. They are strict: explicit types, declared required
properties, constrained enumerations, and `additionalProperties: false` wherever a
typo would otherwise be silently accepted. Enumerations are never restated —
where a schema constrains a value to a taxonomy, the validator asserts that the
schema's enumeration and the taxonomy's term set are identical, so the two cannot
drift apart.

The schemas are the only layer a consumer needs to accept or reject a document.
That is deliberate: an implementation should be able to validate without
understanding Amasario's modelling choices.

### `models/`

A model explains what a set of fields means, why a field exists, and what its
absence implies. Models are validated against the schemas: a model may not claim a
field the schema does not define, and a field the schema requires must be
explained.

### `rules/`

Rules are the normative obligations. A rule states what a producer must do for a
claim of a given kind to be assertable — for example that a direct dependency
requires evidence traceable to its basis, and that ambiguous matching must not be
resolved by preference. Every rule id referenced from a schema resolves to a file
here; the validator enforces both directions.

### `fixtures/`, `examples/`, `vectors/`

Fixtures and examples are validated instances. `fixtures/invalid/` entries declare
the exact JSON Schema keyword and instance path they must fail on, so the suite
proves the schemas reject bad input for the intended reason rather than for an
incidental one. Vectors carry a canonical serialisation and its digest, and the
validator re-serialises to confirm the bytes are stable — the property that makes
a digest usable as an identity.

## The boundary with the engine

This repository defines meaning. `amasario-provenance-engine` produces instances.

The boundary is testable rather than aspirational: the engine consumes the schemas
and vectors published here, and a change that would break an existing consumer is
detectable as a schema validation failure rather than as a silently different
analysis result. The specification does not contain a scanner, a network client, a
graph implementation or a renderer, and adding one here would break the boundary
that makes the specification small enough to depend on.

## Determinism

Two properties are required across the whole specification, and both are stated
normatively rather than left to implementations:

1. **Canonical ordering.** Any set-valued structure has a defined serialisation
   order, so two implementations serialising the same model produce the same
   bytes.
2. **Observation boundaries.** Anything derived from a network is qualified by the
   ledger boundary it was observed at, so "the same input" is a well-defined
   notion. See [temporal-model.md](temporal-model.md).

## Why the layering is enforced

The failure mode this design is built to prevent is a specification that looks
authoritative while containing claims nothing can check. Concretely:

- A term added to a schema but not to its taxonomy would mean two consumers
  disagree about validity → caught by `validate-schema.ts`.
- A rule referenced by a schema but never defined would mean a consumer cannot
  know the obligation → caught by `validate-rules.ts`.
- A fixture that fails for the wrong reason would mean the schema is not testing
  what it claims → caught by `validate-fixtures.ts`.
- An example that drifted from its schema would mean the documentation lies →
  caught by `validate-fixtures.ts`.
- A vector whose digest depends on key insertion order would mean the identity is
  not portable → caught by `validate-vectors.ts`.
- An empty directory presented as a completed feature → caught by
  `release-check.ts`.

Each of those checks fails the build. None of them is a manual review step.
