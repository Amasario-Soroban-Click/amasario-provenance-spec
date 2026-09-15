# Transitive Dependencies

A transitive dependency is one the subject reaches only through intermediate
entities. The specification requires a transitive dependency to carry the path that
justifies it, and to disclose the bounds within which that path was searched.

## Why the path is mandatory

`A → B → C` is a much weaker statement than `A → B` and a much stronger statement
than `A ~ C`. Without the path, a reader cannot tell:

- how many intermediaries were involved,
- whether any hop is itself uncertain,
- whether the chain is a real chain or two unrelated facts collapsed together.

`dependency/transitive-dependency` therefore requires the intermediate entities to
be listed in order, with at least one entry. A transitive dependency without its
path is indistinguishable from a guess, and the specification treats it as
malformed rather than as a low-confidence result.

## Aggregated confidence

A transitive dependency's aggregated confidence must equal the **minimum**
confidence ordinal among the hops it traverses. A chain is only as strong as its
weakest link, and the alternative — reporting the strongest hop, or some average —
would let an implementation manufacture confidence out of unrelated strong
evidence. The `aggregation` block in `taxonomies/confidence-levels.yaml` specifies
`minimum_ordinal` for exactly this reason, with `UNKNOWN` as an absorbing element:
if any hop is `UNKNOWN`, the chain is `UNKNOWN`.

## Bounds, truncation and cycles

A dependency set declares how far it looked.

| Field              | Obligation                                                                  |
| ------------------ | --------------------------------------------------------------------------- |
| `maxDepth`         | Must be set. A search without a stated depth cannot be interpreted.         |
| `truncated`        | Must be true when traversal stopped before exhausting reachable entities.   |
| `truncationReason` | Must be present when `truncated` is true.                                   |
| `cycles`           | Any detected cycle must be reported with the edge identifiers that form it. |

### Why a cycle is reported, not resolved

A cycle in a dependency graph is a real phenomenon — mutual recursion between
contracts, a build that consumes its own output, a package graph with a dev-dependency
loop. Removing or collapsing it makes the graph easier to read and destroys the
ability to reason about it. The specification requires the cycle to be reported
with the specific edges involved, so a consumer can decide what it means in context.

Note that a cycle is not automatically an error. A mutual invocation between two
deployed contracts is a fact about them, not a modelling failure. What would be an
error is a cycle in an artifact derivation — a content-addressed artifact cannot be
its own input — and rule `identity/artifact-identity` rejects that case.

### Why truncation is not the same as absence

The most consequential rule in this chapter is that a bounded traversal must say it
was bounded. A consumer reading `truncated: true` with a reason knows the search
stopped; a consumer reading a list that is merely short has no way to tell the
difference between "there are no more dependencies" and "the search was rate
limited". Since the second is far more common in practice, the ambiguity
systematically produces false negatives, and the specification refuses to allow it.

## Partitioning

A dependency set partitions its edges:

- every edge with a dependency class appears in exactly one of the direct or
  transitive partitions,
- no edge appears in both,
- an edge without a dependency class appears in neither.

The partition is exhaustive and disjoint, so a consumer can `sum(direct, transitive)`
and account for every classified edge. Rule `dependency/transitive-dependency` makes
this checkable, and the `contract-dependency/mixed` fixture is validated against it.

## Worked example

The `contract-dependency/transitive` fixture, in outline:

```yaml
dependencySet:
  direct:
    - id: e1
      source: { kind: CONTRACT, id: CA3D...GAXE }
      target: { kind: CONTRACT, id: CBF7...YQ2K }
      type: DIRECT
      basis: OBSERVED_INVOCATION
  transitive:
    - id: e2
      source: { kind: CONTRACT, id: CA3D...GAXE }
      target: { kind: CONTRACT, id: CDH2...M4LQ }
      type: TRANSITIVE
      basis: OBSERVED_INVOCATION
      path: [CBF7...YQ2K]
      confidence: { level: MEDIUM_CONFIDENCE, evidence: [ev-tx-9912, ev-tx-9950] }
  maxDepth: 3
  truncated: false
  cycles: []
```

The second record's confidence is `MEDIUM_CONFIDENCE` even though both underlying
invocations are strong, because the aggregation is the minimum across the hops —
one of the hops is established from a single observation. The path `[CBF7...YQ2K]`
records exactly which contract the subject went through.

## Related chapters

- [dependency-model.md](dependency-model.md) — the record being aggregated
- [confidence-model.md](confidence-model.md) — the ordinal ordering
- [impact-propagation.md](impact-propagation.md) — how a chain of changes follows a path
- [dependency-resolution.md](dependency-resolution.md) — how the search is bounded
