# Temporal Model

Every fact in this specification is qualified by the boundary at which it was
observed. Nothing is a statement about the present.

## Observation boundaries

An `observationBoundary` combines a network, a ledger range, and when the
observation was made. It appears on provenance documents (`boundary`), dependency
edges (`boundary`, `firstObserved`, `lastObserved`), evidence records, and
snapshots (`boundary`, `ledgerBoundary`).

The rule is simple and it is not a formatting choice: **a fact without a boundary is
not reproducible**. Two implementations can only be compared if they state the
range they looked at, and "the dependency graph for contract X" is not a
well-defined object without one. This is why `boundary` is required on a provenance
document even when every other field is optional.

## Ledgers as the unit

Stellar's unit of ordering is the ledger, and every observation records a ledger
sequence rather than only a wall-clock time. Wall-clock time is present where the
network reports it, but ordering between two observations is by ledger.

The reason is that wall-clock time is not authoritative for inclusion. A transaction
observed at time T was included at a ledger, and two observers can disagree about
timestamps while agreeing about ledgers.

## Observed is not created

`firstObservedLedger` is an observation, not a creation fact. The true creation
ledger can be earlier than the earliest ledger an implementation queried. The
contract schema says this in the field description, and the specification requires
it to be reported as an observation.

A consumer that presents `firstObservedLedger` as "deployed at this ledger" has
upgraded an observation into a claim the evidence does not support. Where the actual
creation ledger matters, it must come from the deployment record, which is a
different fact with different evidence.

## Boundaries that reset

Not every network's state is durable. `taxonomies/network-types.yaml` declares a
`durability` per network type:

| Type        | Durability                                                                                                                           |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `LOCAL`     | `ephemeral` — state is disposable and a ledger boundary here is not meaningful outside it.                                           |
| `FUTURENET` | `reset_without_notice` — state can be reset, so an observation must record its boundary and must not be treated as stable over time. |
| `TESTNET`   | `persistent_but_untrusted` — persistent enough for integration testing; identifiers carry no production meaning.                     |
| `MAINNET`   | `authoritative` — the only observations with production significance.                                                                |
| `CUSTOM`    | `operator_defined` — endpoints must be supplied explicitly.                                                                          |

The durability field is what makes it checkable that a comparison is legitimate. Two
observations on `FUTURENET` at different boundaries are not two observations of one
fact, because the environment may have been reset between them. A consumer comparing
snapshots across such a boundary must treat the difference as incomparable rather
than as a change.

## Comparing across boundaries

`schema/diff.schema.json` compares two snapshots and requires `before`, `after`,
`changes` and `comparisonMode`. It also carries `comparable` and an
`incomparableReason`, whose values include `API_VERSION_MISMATCH`,
`SPEC_VERSION_INCOMPATIBLE`, `NETWORK_MISMATCH`, `BOUNDARY_ORDER_INVALID` and
`MALFORMED_SNAPSHOT`.

That enumeration exists because comparing incomparable snapshots is a real and
attractive mistake: it always produces output, and the output always looks like a
change. Making "incomparable" a first-class result — with a reason — means a
consumer that respects it cannot accidentally read an environment change as a
dependency change. `BOUNDARY_ORDER_INVALID` covers the case where the "before"
boundary is later than the "after" boundary, which would otherwise invert every
change.

## Volatile fields

Snapshots carry a `volatileFields` list. A volatile field is one that changes
between runs without any underlying fact changing — the capture timestamp, the
engine version, the wall-clock time of an observation. `capturedAt` on a snapshot
and `generatedAt` on a document are declared not to participate in any digest, and
the canonical serialisation used for comparison excludes them.

Without this separation, two snapshots of an unchanged system would always differ,
and a diff would be noise. The specification makes the exclusion explicit rather
than leaving it to each implementation.

## Determinism

For the same input, specification version, observation boundary, available evidence
and engine version, results must be identical. That requires the temporal model to
be an input rather than a source of variation — which is why:

- the boundary is a required, recorded field and not an implicit "now",
- ledgers, not timestamps, establish ordering,
- volatile fields are excluded from digests,
- `firstObserved`/`lastObserved` pairs must not invert (`lastObserved` must not
  precede `firstObserved`, enforced by `dependency/direct-dependency`).

## Related chapters

- [network-model.md](network-model.md) — where observations come from
- [reproducibility.md](reproducibility.md) — what can be re-derived
- [verification.md](verification.md) — how the boundary affects a status
