# Dependency Resolution

Resolution is the process of turning an observation about a subject into a
dependency record. The specification does not prescribe an algorithm, but it does
prescribe the order in which a producer may consider signals, because the order is
what determines whether a producer reports the strongest available basis or stops
at the first plausible one.

## Resolution order

A producer establishes a dependency from the strongest available signal, and
records that signal as `basis`. The permitted order is:

1. **Declared.** The subject's own manifest names the dependency —
   `DECLARED_MANIFEST`. A declaration is a statement of intent and is not evidence
   that the resolved version is the declared one.
2. **Resolved.** A lockfile pins the dependency to a specific artifact —
   `RESOLVED_LOCKFILE`. This is stronger than a declaration because a resolution
   record is the output of actually reconciling constraints.
3. **Observed.** A transaction or event shows the interaction —
   `OBSERVED_INVOCATION` or `OBSERVED_EVENT`. This is the strongest evidence of a
   _runtime_ requirement, because it is not a statement about intent at all.
4. **Embedded.** A digest embedded in the subject matches the target —
   `EMBEDDED_DIGEST`.
5. **Configured.** The subject's configuration names the target —
   `CONFIGURED_ENDPOINT`.
6. **Attested.** An issuer asserts the relationship — `ATTESTED`.
7. **Inferred.** Only the target's interface is consistent with the claim —
   `INFERRED_INTERFACE`.

Steps 1 and 2 are different facts and must not be conflated. A manifest that
declares `>= 1.2` is compatible with many resolved versions; only the lockfile says
which one was used. A producer that reports the declaration as if it were the
resolution has produced a claim that no rebuild could confirm.

Step 7 is the weakest and is separated deliberately. Interface similarity is real
evidence — it is not noise — but it does not establish a requirement. Keeping it as
a labelled basis lets it be recorded without being promoted.

## Boundaries

Resolution is bounded. A producer must record:

- `maxDepth` — the depth bound it applied.
- `truncated` and `truncationReason` — set when traversal stopped before
  exhausting reachable entities.
- The observation boundary — the network and ledger range for anything observed.

`dependency/transitive-dependency` makes this mandatory, for one specific reason:
a bounded search that does not disclose its bound invites a consumer to read "not
found" as "does not exist". Those are different results, and the specification
refuses to let them be reported identically. A traversal that was rate limited, hit
a depth cap, or stopped at a cycle must say so.

## Failure is not absence

A network failure must remain distinguishable from "no dependency found". The
specification requires this separation at the data level: a resolution that could
not be completed reports truncation, and an unresolvable entity is reported as
unresolved rather than omitted. A graph that silently loses a node because a request
failed is a graph that looks tidier than the analysis was, and a consumer cannot
tell the difference after the fact.

The same principle applies to edges. Rule `dependency/edge-reference-integrity`
states that an edge whose endpoint is absent from the graph is a broken assertion,
not a partial result, and a consumer must not silently drop it.

## Determinism

For the same inputs, specification version, observation boundary, available
evidence and engine version, a resolution must produce identical output. That
requires:

- a defined iteration order over candidate signals,
- a defined tie-break for ambiguous matches (record the ambiguity; do not prefer),
- a canonical ordering for the emitted dependency set,
- no dependence on wall-clock time or on the order responses happened to arrive in.

## Ambiguity

Where a match is ambiguous, the specification requires the ambiguity to be
represented. Concretely: if two candidate targets both satisfy the available
evidence, a producer must not pick one. It records an ambiguous resolution with the
candidates, and downstream confidence reflects the ambiguity. A silent preference
converts an uncertain fact into an authoritative-looking one, which is the failure
mode this whole layer exists to prevent.

## Related chapters

- [dependency-model.md](dependency-model.md) — the record resolution produces
- [dependency-classification.md](dependency-classification.md) — the class assigned
- [network-model.md](network-model.md) — where observations come from
- [temporal-model.md](temporal-model.md) — how observations are bounded
