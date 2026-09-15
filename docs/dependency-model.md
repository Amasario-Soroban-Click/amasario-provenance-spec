# Dependency Model

## The problem

Dependency graphs are easy to produce and hard to justify. Almost every false
dependency in real tooling comes from one of five shortcuts:

1. two repositories share a name,
2. two projects mention each other in documentation,
3. two contracts exist in the same ecosystem,
4. two packages have similar metadata,
5. two contracts expose a similar interface.

Each of those produces output that looks exactly like a real finding. So the
specification does not ask "are these entities related?" — it asks **"how was this
requirement established?"**, and refuses to represent a dependency it cannot
answer that for.

## The dependency record

`schema/dependency.schema.json` requires `source`, `target`, `type`, `basis` and
`evidence`.

| Field                           | Required | Meaning                                                        |
| ------------------------------- | -------- | -------------------------------------------------------------- |
| `source`                        | yes      | The depending entity.                                          |
| `target`                        | yes      | The depended-upon entity.                                      |
| `type`                          | yes      | The dependency class, from `dependency-types`.                 |
| `basis`                         | yes      | How the requirement was established.                           |
| `evidence`                      | yes      | At least one evidence record.                                  |
| `id`                            | no       | Stable identifier for references from impact and diff records. |
| `confidence`                    | no       | How strongly the evidence supports the claim.                  |
| `path`                          | no       | Intermediate entities, required for `TRANSITIVE`.              |
| `network`                       | no       | Required for `CONTRACT` and `RUNTIME`.                         |
| `firstObserved`, `lastObserved` | no       | Observation boundaries for a runtime-observed dependency.      |
| `verificationStatus`            | no       | Outcome of comparing claim against evidence.                   |
| `metadata`                      | no       | Producer-specific detail. Never evidence.                      |

## The basis enumeration

`basis` is the field that makes the difference between infrastructure and a
correlator:

| Basis                 | What it means                                             |
| --------------------- | --------------------------------------------------------- |
| `DECLARED_MANIFEST`   | The subject's manifest declares the dependency.           |
| `RESOLVED_LOCKFILE`   | A lockfile resolves the dependency to a specific version. |
| `OBSERVED_INVOCATION` | A cross-contract call was observed in a transaction.      |
| `OBSERVED_EVENT`      | A contract event evidenced the relationship.              |
| `EMBEDDED_DIGEST`     | A digest embedded in the subject matches the target.      |
| `CONFIGURED_ENDPOINT` | The subject's configuration names the target.             |
| `ATTESTED`            | An issuer attestation asserts the relationship.           |
| `INFERRED_INTERFACE`  | The target's interface is consistent with the claim.      |

`INFERRED_INTERFACE` is the honest label for interface similarity. It is permitted
as a basis precisely so that it does not have to be either ignored or dressed up as
something stronger. A dependency with that basis is capped at `LOW_CONFIDENCE` and
must not appear in a report's observed-facts section.

## Required evidence by class

`taxonomies/dependency-types.yaml` declares `requiredEvidence` per class. A
dependency whose evidence does not satisfy its class must not be emitted at that
class — it may be emitted at a weaker class only if _that_ class's requirement is
met. This is what prevents a claim from being upgraded by relabelling it.

| Class        | Required evidence                                  |
| ------------ | -------------------------------------------------- |
| `DIRECT`     | source, build, artifact, deployment or transaction |
| `TRANSITIVE` | as `DIRECT`, plus a non-empty `path`               |
| `CONTRACT`   | transaction, event, source or artifact             |
| `PACKAGE`    | source, build or artifact                          |
| `WASM`       | artifact, build or deployment                      |
| `RUNTIME`    | transaction or event                               |
| `EXTERNAL`   | source or observation                              |

## The edge

`schema/dependency-edge.schema.json` is the graph-shaped view of the same
relationship, and it requires `id`, `source`, `target`, `relationship`, `evidence`
and `confidence`. Where the dependency record classifies _what kind of thing_ is
depended upon, the edge names a typed relationship from
`taxonomies/relationship-types.yaml`:

`DEPENDS_ON`, `INVOCATES`, `BUILT_FROM`, `DERIVED_FROM`, `DEPLOYED_AS`,
`OBSERVED_IN`, `VERIFIED_BY`, `AFFECTS`.

Each relationship declares the entity kinds it may connect and, critically,
`changePropagation`. That last field is what impact analysis reads; nothing in the
specification infers direction from a relationship's name. See
[impact-propagation.md](impact-propagation.md).

Edges additionally carry `observed`, a boolean distinguishing a relationship that
was directly observed from one that was inferred. The specification requires
confirmed and inferred relationships to be distinguishable, and this is the field
that does it.

## Rules

| Rule                               | Obligation                                                                                                                                                                                                                        |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `dependency/direct-dependency`     | Every dependency states a basis and references evidence; `CONTRACT` and `RUNTIME` name their network; `RUNTIME` rests on a successful transaction; an observed edge records `firstObserved` with `lastObserved` not preceding it. |
| `dependency/transitive-dependency` | A transitive dependency carries its ordered path; aggregated confidence equals the minimum hop ordinal; a dependency set partitions every edge, sets `maxDepth`, and reports truncation and cycles.                               |
| `dependency/contract-dependency`   | A contract dependency rests on an observed invocation, event, or a source/storage reference — never interface similarity alone.                                                                                                   |
| `dependency/artifact-dependency`   | An artifact dependency rests on a digest or declared build input, never on size, media type or name similarity; an `EXTERNAL` target is recorded as out of boundary and never `VERIFIED`.                                         |

## Related chapters

- [dependency-resolution.md](dependency-resolution.md) — the resolution order
- [dependency-classification.md](dependency-classification.md) — assigning a class
- [transitive-dependencies.md](transitive-dependencies.md) — paths, bounds, cycles
- [evidence-model.md](evidence-model.md) — what an evidence record contains
