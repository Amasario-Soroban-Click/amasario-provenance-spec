# Compatibility

This chapter states the expectations between a specification version and an engine
version, and — more importantly — the cases where a consumer must refuse to
interpret rather than guess.

## Who depends on whom

```
amasario-provenance-spec   defines the model
        ▲
        │ consumed by
amasario-provenance-engine produces documents conforming to it
        ▲
        │ consumed by
consumers                  pipelines, verification systems, release gates
```

The specification does not depend on the engine. The engine depends on the
specification, and it declares which specification versions it supports.

## Engine-to-specification compatibility

| Engine declares       | May consume documents from                                                                |
| --------------------- | ----------------------------------------------------------------------------------------- |
| Supports spec `1.0.0` | Any `1.y.z`, where `y >= 0`                                                               |
| Supports spec `1.4.0` | Any `1.y.z`, where `y >= 4` for full semantics; `1.0.0`–`1.3.z` with documented reduction |
| Supports spec `2.0.0` | Any `2.y.z`. Not `1.y.z`, unless a migration path is documented.                          |

The asymmetry follows from the release rules. A minor release only adds optional
properties, new open-taxonomy terms, and relaxations, so an older engine reading a
newer document sees fewer fields but never a changed meaning — provided it treats an
unrecognised open-taxonomy term as `UNKNOWN`, as
[versioning.md](versioning.md) requires.

An engine reading a document from a _newer_ minor version must not silently ignore
fields that affect the analysis. If it cannot honour a field, it must either reduce
its confidence for the affected claim or report the document as unsupported. It must
never accept the document and proceed as if the field were absent, because that
converts a partial understanding into an authoritative-looking result.

## Refusal cases

A consumer must refuse to interpret, with a reason, when:

| Condition                                                            | Reason                                         |
| -------------------------------------------------------------------- | ---------------------------------------------- |
| `apiVersion` is not a known family                                   | Hard rejection before field interpretation.    |
| `specVersion` is not valid SemVer                                    | Malformed document.                            |
| A required field is absent                                           | Validation failure with the instance path.     |
| A closed-taxonomy term is unrecognised                               | Rejection; guessing could corrupt an analysis. |
| An unknown field appears where `additionalProperties: false` applies | Rejection.                                     |
| Two snapshots differ in `apiVersion`                                 | `API_VERSION_MISMATCH`.                        |
| Two snapshots have incompatible `specVersion` values                 | `SPEC_VERSION_INCOMPATIBLE`.                   |
| Two snapshots are from different networks                            | `NETWORK_MISMATCH`.                            |
| The "before" boundary is later than the "after" boundary             | `BOUNDARY_ORDER_INVALID`.                      |
| A snapshot is structurally malformed                                 | `MALFORMED_SNAPSHOT`.                          |

The last five are values of `incomparableReason` in `schema/diff.schema.json`. They
exist because comparing incomparable inputs always produces output, and the output
always looks like a change. Making incomparability a first-class result with a reason
is what prevents an environment change from being read as a dependency change.

## What must not happen

The specification names four prohibited behaviours explicitly:

1. **Silently interpreting unknown fields.** A dropped field is indistinguishable
   from a handled one, and an analysis that quietly loses evidence is worse than one
   that refuses to run.
2. **Interpreting an unknown closed-taxonomy term as a known one.** Narrowing is a
   breaking change, so an unknown term may mean something narrower than any known
   term. Substituting a known term could invert an impact conclusion.
3. **Assuming ordering across an `apiVersion` boundary.** Nothing about `2.0.0` is
   inferable from `1.y.z`.
4. **Treating `UNVERIFIED` as `false`.** See [verification.md](verification.md).

## Compatibility of the shipped artefacts

Beyond document compatibility, the specification ships artefacts whose identifiers
are part of its contract with consumers:

- **Schema `$id` values** are stable within a release family. `https://amasario.dev/spec/v1/schema/*.schema.json`
  identifies the `1.y.z` family. They do not change on minor releases.
- **Rule ids** (`dependency/direct-dependency`, `identity/contract-identity`, …) are
  stable and referenced from schemas. Removing or renaming one is a breaking change.
- **Taxonomy term ids** are stable identifiers. A term's `id` is its identity; its
  `label` is display text and may be edited.
- **Vector digests** are stable. A vector whose recomputed digest differs is a
  breaking change, because a consumer that recorded the digest is now holding a
  different fact.

`scripts/release-check.ts` verifies that the versions across `package.json`,
`VERSIONING.md`, the changelog and the artefacts agree before a release can be
produced, so an inconsistency is caught by the build rather than by a consumer.

## Related chapters

- [versioning.md](versioning.md) — the version rules themselves
- [temporal-model.md](temporal-model.md) — why boundaries make comparisons legitimate
- [governance.md](governance.md) — how a compatibility-affecting change is reviewed
