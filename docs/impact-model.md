# Impact Model

Impact answers the forwards question: if this entity changes, what could be
affected, along which path, and on what reasoning?

An impact finding is deliberately **not a score**. A score is unarguable — a reader
who disagrees has nothing to inspect. `schema/impact.schema.json` therefore carries
the whole reasoning, so that a reader can disagree with the conclusion by checking
the path instead of trusting a number.

## The record

Required: `id`, `changedEntity`, `affectedEntity`, `impactType`, `hopDepth`,
`evidence`, `confidence`, `reason`.

| Field               | Meaning                                                                                          |
| ------------------- | ------------------------------------------------------------------------------------------------ |
| `id`                | Stable across runs, so a snapshot diff detects a genuinely new finding rather than a reordering. |
| `changedEntity`     | The entity that changed, or is assumed to change.                                                |
| `affectedEntity`    | The entity potentially affected.                                                                 |
| `impactType`        | A non-empty _set_ of classifications.                                                            |
| `hopDepth`          | Edges between the two entities.                                                                  |
| `path`              | The path, required when `hopDepth` is greater than zero.                                         |
| `relationshipTypes` | Relationship types in path order, required to agree with the path.                               |
| `direction`         | `DEPENDENTS`, `DEPENDENCIES` or `BOTH`, derived from propagation semantics.                      |
| `changeType`        | `ADDED`, `REMOVED`, `MODIFIED`, `UPGRADED`, `DOWNGRADED`, `REPLACED`.                            |
| `evidence`          | Required and non-empty.                                                                          |
| `confidence`        | Aggregated from the steps.                                                                       |
| `reason`            | Why the entity is considered affected, in terms of the traversed relationships.                  |

### Why `impactType` is a set

One finding is routinely several classifications at once. A change reaching a
contract three hops away is simultaneously `TRANSITIVE`, `MULTI_HOP` and
`CONTRACT`. Forcing a single value would discard two true statements to store one,
and a consumer aggregating by classification would then systematically undercount.

`taxonomies/impact-types.yaml` groups the terms into three families:

- **`distance`** — `DIRECT` (depth 1), `TRANSITIVE` (depth ≥ 2), `MULTI_HOP`
  (depth ≥ 3). Derived from `hopDepth`, therefore mechanically checkable.
- **`entity`** — `ARTIFACT`, `CONTRACT`, `DEPLOYMENT`. Declares `affectedKinds`, so
  the classification and the affected entity cannot contradict each other.
- **`trigger`** — `CHANGE`, which requires a `changeType`.

At least one `distance` term must be present, and the distance terms must agree with
`hopDepth`. That agreement is a rule, not a convention, because it is exactly the
kind of field that drifts once findings are assembled from several traversals.

### Why `reason` is required

`reason` is what replaces a score. It must be stated in terms of the traversed
relationships — "the subject INVOCATES the changed contract, so a change to its
interface may break the caller" — so that a reader can follow it and disagree. A
finding whose reason cannot be expressed in those terms is a finding whose path does
not justify it.

## Confidence aggregation

An impact finding's confidence equals the minimum confidence ordinal among its
steps, for the same reason a transitive dependency's does: a chain is only as strong
as its weakest link. `taxonomies/confidence-levels.yaml` fixes the strategy as
`minimum_ordinal` with `UNKNOWN` as an absorbing element.

## Impact is not the same as dependency

A dependency says two entities are connected. An impact finding says a change to one
_reaches_ the other. The difference is the direction of traversal, and it is derived
from the relationship's declared `changePropagation` rather than inferred. Following
`DEPENDS_ON` backwards gives dependents; following it forwards gives the changed
entity's own dependencies. Both are legitimate analyses and they answer different
questions, which is why `direction` is recorded explicitly.

## The three entity models

`models/impact/` defines three affected-entity models alongside the direct and
transitive ones:

- `affected-contract` — a contract identity is reachable.
- `affected-artifact` — an artifact is reachable, including the case where a
  rebuild would produce different bytes.
- `affected-deployment` — a _deployment record_ is reachable, which is distinct
  from the contract identity, because a contract can be re-deployed without its
  identity changing.

## Rules

| Rule                       | Obligation                                                                                                                                                                                                                 |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `impact/direct-impact`     | Depth 1 findings carry `DIRECT`; findings with no path declare depth 0 and are only meaningful as change findings; every non-empty path matches `hopDepth`.                                                                |
| `impact/transitive-impact` | Depth ≥ 2 findings carry `TRANSITIVE`, depth ≥ 3 also carry `MULTI_HOP`; the path carries per-step evidence and confidence; `relationshipTypes` matches the path; the entity classification agrees with the affected kind. |
| `impact/deployment-impact` | A finding about a deployment must not be reported as a finding about the contract identity.                                                                                                                                |
| `impact/change-impact`     | A finding whose trigger is a typed change must carry that change type, and its impact type set must include `CHANGE`.                                                                                                      |

## When impact must not be claimed

The specification is explicit about three non-claims:

- **Reachability is not occurrence.** An impact finding says an entity _may_ be
  affected. It does not say it was, and no field asserts that it will be.
- **Bounded traversal is bounded.** A finding set is the result of a bounded search;
  the bound must be disclosed, and its absence is not evidence that nothing else is
  reachable. This is the same principle as
  [transitive-dependencies.md](transitive-dependencies.md).
- **Impact is not risk assessment.** Nothing in this chapter says an affected
  contract is broken, unsafe or vulnerable. See [security.md](security.md).

## Related chapters

- [impact-propagation.md](impact-propagation.md) — how direction is derived
- [evidence-model.md](evidence-model.md) — the evidence a finding must cite
- [confidence-model.md](confidence-model.md) — the aggregation ordering
