# Impact Propagation

Propagation is the single normative source of impact semantics. It is declared per
term in `taxonomies/relationship-types.yaml` as `changePropagation`, and nothing in
this specification may infer a propagation direction from anything else — not from
the name of a relationship, not from which end of the edge a consumer happens to
start at, not from a default chosen by an implementation.

## Why it is declared rather than derived

Relationship names are not reliable guides to direction. `BUILT_FROM` and
`DEPLOYED_AS` both point from the derived thing to its origin, but the _change_
travels the other way: change the source revision and the build it produced is
invalidated. A reader could plausibly guess either direction from the name.

Worse, some relationships do not propagate at all. `OBSERVED_IN` and `VERIFIED_BY`
look structurally identical to `DEPENDS_ON` — a directed edge between two entities —
but propagating through them is wrong, and wrong in a way that produces plausible
output rather than an error. A new transaction observing an existing fact does not
change the fact, and re-verifying a claim does not create a dependency. Declaring
`changePropagation: none` is what makes that prohibition explicit and checkable.

## The four directions

| Value               | Meaning                                                                                          |
| ------------------- | ------------------------------------------------------------------------------------------------ |
| `object_to_subject` | A change to the object affects the subject. The subject depends on the object.                   |
| `subject_to_object` | A change to the subject affects the object. The arrow already points in the direction of change. |
| `bidirectional`     | A change in either direction affects the other.                                                  |
| `none`              | Impact must not propagate through this relationship.                                             |

## Declared propagation per relationship

| Relationship   | Propagation         | Rationale                                                                                                                                        |
| -------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `DEPENDS_ON`   | `object_to_subject` | A change to the dependency may break the dependent.                                                                                              |
| `INVOCATES`    | `object_to_subject` | A change to the callee's interface or behaviour can break the caller.                                                                            |
| `BUILT_FROM`   | `object_to_subject` | A changed source revision invalidates the build produced from it, and everything derived from that build.                                        |
| `DERIVED_FROM` | `object_to_subject` | A change to a derivation input changes the output — the property a digest match relies on.                                                       |
| `DEPLOYED_AS`  | `object_to_subject` | A change to the deployment record (for example a re-deployment with different bytes) changes what the deployed subject is.                       |
| `OBSERVED_IN`  | `none`              | Observation is not dependency. A new observation of the same fact does not change the fact.                                                      |
| `VERIFIED_BY`  | `none`              | Verification supports or refutes a claim; it does not create a dependency. Propagating through it would make re-verification look like a change. |
| `AFFECTS`      | `subject_to_object` | An explicitly declared impact edge, so the arrow is already the direction of change.                                                             |

## Traversal

An impact analysis starts from a changed entity and follows edges whose
`changePropagation` permits the traversal in the direction being analysed:

- **Following dependents** means traversing `object_to_subject` edges _backwards_:
  starting at the changed entity, find entities whose dependency on it makes them
  candidates. This is the `A ← B ← C` direction in the `A → B → C` chain.
- **Following dependencies** means traversing `object_to_subject` edges _forwards_:
  starting at the changed entity, find what it depends on.
- `AFFECTS` edges are followed in their own direction in both analyses, because the
  arrow already encodes the assertion.

The `direction` field on an impact finding records which of these was performed, so
that `DEPENDENTS`, `DEPENDENCIES` and `BOTH` analyses are distinguishable in the
output rather than silently mixed.

## Propagation and aggregation

Each traversal step contributes its own confidence, and the finding's aggregated
confidence is the minimum across steps. Two properties follow, and both are
intentional:

1. A path through an `INFERRED_INTERFACE` dependency cannot be reported as
   high-confidence, however strong the rest of the path is.
2. A path that includes an `UNKNOWN` step is `UNKNOWN` outright. `UNKNOWN` is an
   absorbing element in the aggregation, so an unknown link cannot be outvoted by
   certain ones.

## Worked example

Given `A INVOCATES B` and `B DEPENDS_ON C`:

- A change to `C` propagates `object_to_subject` into `B`, then `object_to_subject`
  into `A`. Following dependents from `C` reaches `B` at depth 1 and `A` at depth 2.
  The findings carry `DIRECT` for `B` and `TRANSITIVE` for `A`, with `direction:
DEPENDENTS`.
- A change to `A` propagates `object_to_subject` backwards — that is, `A`'s
  dependencies are `B`, and `B`'s are `C`. Following dependencies from `A` reaches
  `B` at depth 1 and `C` at depth 2. Same path, same relationships, opposite
  analysis, and `direction: DEPENDENCIES`.

The two analyses produce different findings from the same graph, and the
specification requires both to be labelled. A tool that reported only a depth number
would make them indistinguishable.

## What propagation must not do

- It must not traverse `OBSERVED_IN` or `VERIFIED_BY` edges, in any direction.
- It must not deduplicate two distinct paths into one finding; two paths are two
  reasons, and the second may survive inspection when the first does not.
- It must not exceed the depth bound, and it must report when it stopped.
- It must not claim that a reachable entity _was_ affected. Reachability is a
  possibility statement.

## Related chapters

- [relationship-types taxonomy](../taxonomies/relationship-types.yaml) — the terms themselves
- [impact-model.md](impact-model.md) — the finding this produces
- [confidence-model.md](confidence-model.md) — the minimum-ordinal aggregation
- [transitive-dependencies.md](transitive-dependencies.md) — the same reasoning on the dependency side
