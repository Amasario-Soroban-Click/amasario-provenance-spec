# Versioning

The normative source for versioning is [`VERSIONING.md`](../VERSIONING.md). This
chapter explains the model behind it and the mechanics an implementer interacts
with.

## Two version numbers, never conflated

| Version                   | Meaning                                                                          | Where it lives                                                                  |
| ------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| **Specification version** | The version of the normative model: schemas, taxonomies, models, rules, vectors. | `package.json#version`, and the `specVersion` field on every produced document. |
| **`apiVersion`**          | The major-version compatibility family.                                          | The `apiVersion` field on every Amasario document.                              |

`apiVersion` is the string `amasario.dev/v1` for the whole `1.y.z` family. It
changes only on a major release. It exists so that a consumer can reject an
incompatible document _before_ attempting to interpret any field — including fields
it has never seen.

## What counts as breaking

| Change                                                                 | Release |
| ---------------------------------------------------------------------- | ------- |
| Required property added, removed or renamed                            | MAJOR   |
| A property's type or meaning changes                                   | MAJOR   |
| An enumeration term is removed, or its meaning narrowed                | MAJOR   |
| A file is removed from `schema/`, `models/`, `taxonomies/` or `rules/` | MAJOR   |
| A rule begins rejecting content it previously accepted                 | MAJOR   |
| Canonical serialisation or digest input changes                        | MAJOR   |
| New optional property                                                  | MINOR   |
| New term in an **open** taxonomy                                       | MINOR   |
| New schema, model, taxonomy, rule, fixture, vector or example          | MINOR   |
| A rule is relaxed to accept strictly more                              | MINOR   |
| Documentation, formatting, toolchain-only changes                      | PATCH   |

A new term in a **closed** taxonomy is a MAJOR change, because a closed taxonomy
promises exhaustiveness. That is exactly what `openness` is for, and the validators
cross-check the openness declaration against how a taxonomy is consumed.

## Openness

`taxonomies/relationship-types.yaml`, `impact-types.yaml`, `confidence-levels.yaml`
and `verification-statuses.yaml` are **closed**. Network, evidence, deployment,
dependency and artifact taxonomies are **open**.

The split follows a rule of thumb: a vocabulary whose unknown value could change the
_meaning of an analysis result_ is closed, because guessing is dangerous. A
vocabulary that extends the _reach_ of an observation — a new network type, a new
evidence kind — is open, because recognising an unknown one degrades gracefully.

A consumer that encounters an unrecognised term in an open taxonomy must handle it
explicitly and treat it as `UNKNOWN` for confidence and impact calculation. It must
not fail, and it must not guess. In a closed taxonomy, an unrecognised term is a
hard rejection.

## Unknown fields

Amasario schemas set `additionalProperties: false`. Extension points, where they
exist, are named explicitly and are always objects whose properties are documented as
consumer-defined. An unknown field anywhere else fails validation, because a silently
ignored field is indistinguishable from a correctly handled one — and an analysis
that quietly drops evidence is worse than one that refuses to run.

## Deprecation

A field or term must be documented as deprecated in `CHANGELOG.md` for at least one
MINOR release before removal. A deprecated field must remain accepted and valid for
the whole window. Removal is MAJOR and must be listed under `Removed` with its
replacement documented.

## Digests are part of the contract

Where a digest is defined over a document, it is computed over the canonical JSON
serialisation defined in `VERSIONING.md`: keys sorted by code point, no insignificant
whitespace, shortest round-trippable numbers, `null` retained and absent properties
omitted, UTF-8 without BOM.

Because the ordering and number rules are part of the digest definition, no PATCH
release may change them, and changing them is MAJOR. This is what makes the
`vectors/` suite meaningful across implementations: a digest recorded here must
reproduce byte-for-byte elsewhere.

## Determining the producing version

Every document produced by tooling carries both fields. The consumer's algorithm:

1. Read `apiVersion`. An unknown family is a hard rejection.
2. Read `specVersion`. It must be valid SemVer.
3. A consumer supporting `1.0.0` must accept `1.4.2` — minor versions are additive
   by definition — and must not accept `2.0.0`.
4. Ordering must not be assumed across an `apiVersion` boundary.

For snapshots, this is enforced by the diff model: `API_VERSION_MISMATCH` and
`SPEC_VERSION_INCOMPATIBLE` are explicit incomparable reasons, so a comparison
across a version boundary is refused with a reason rather than producing a
plausible-looking set of changes.

## Release gating

A release may only be produced from a commit where validation passes, tests pass,
`docs:check` passes, and `scripts/release-check.ts` confirms that
`package.json#version`, `CHANGELOG.md` and `VERSIONING.md` agree. The version cannot
be bumped without documenting why, because the check fails if the changelog does not
account for the version being released.

See [compatibility.md](compatibility.md) for how this maps onto engine versions.
