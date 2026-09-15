# Dependency Classification

Classification answers two questions at once: _what kind of thing_ is depended
upon, and _how the requirement was established_. The second half is what makes
`taxonomies/dependency-types.yaml` a normative layer rather than a label set.

## The classes

| Class        | Object is                                                 | Required evidence                                  | Notable constraint                                               |
| ------------ | --------------------------------------------------------- | -------------------------------------------------- | ---------------------------------------------------------------- |
| `DIRECT`     | Anything the subject requires with no intermediate entity | source, build, artifact, deployment or transaction | Need not be a contract.                                          |
| `TRANSITIVE` | Anything reached only through intermediates               | as `DIRECT`                                        | Must carry its path.                                             |
| `CONTRACT`   | Another Soroban contract                                  | transaction, event, source or artifact             | Interface similarity is not sufficient.                          |
| `PACKAGE`    | A software package or crate                               | source, build or artifact                          | Declaration and resolution are distinct facts.                   |
| `WASM`       | A WASM artifact the subject embeds or derives from        | artifact, build or deployment                      | Digest match or explicit build input, never metadata similarity. |
| `RUNTIME`    | A contract invoked during execution                       | transaction or event                               | Must be flagged as observed, not inferred.                       |
| `EXTERNAL`   | Something outside the observable boundary                 | source or observation                              | Must state the boundary; never `VERIFIED`.                       |

## Why `requiredEvidence` is the enforcement point

A class is not a decoration. `requiredEvidence` is the mechanism that prevents a
dependency from being asserted on inadequate grounds: if the evidence for a claim
does not satisfy its class, the claim must not be emitted at that class. It may be
emitted at a weaker class only if that class's requirement is met — which means the
downgrade is visible in the output rather than hidden in a producer's judgement.

This also prevents the reverse trick, upgrading by relabelling. A producer cannot
take a `DIRECT` claim supported only by an interface observation and emit it as
`CONTRACT`, because `CONTRACT` requires transaction, event, source or artifact
evidence, and an interface observation is none of those.

## Choosing between classes

Classification is not always obvious, so the specification fixes the ordering where
classes overlap:

1. **`RUNTIME` outranks everything when the evidence is an observation.** If a
   dependency was established from a transaction or event, it is a runtime
   dependency even if a manifest also declares something similar. Observed
   behaviour and declared intent are different facts, and an observed fact is the
   more informative one to report.
2. **`CONTRACT` outranks `DIRECT` when the target is a contract.** `DIRECT`
   describes the absence of intermediates, not the kind of target, so a direct
   dependency on another contract is a contract dependency. Emitting it as
   `DIRECT` would discard the information that the target is a live contract with
   its own provenance.
3. **`TRANSITIVE` applies whenever intermediates exist**, regardless of target kind.
   A transitive dependency on a contract is still transitive; the class records how
   it was reached.
4. **`PACKAGE` and `WASM` are distinguished by the target's artifact type**, not by
   the presence of a manifest. A crate resolved from a lockfile is a package
   dependency; a module whose digest matches a build output is a WASM dependency.
5. **`EXTERNAL` is chosen when inspection is impossible**, not when it merely did
   not happen. A target that could not be inspected because a request failed is
   unresolved, not external.

## The boundary case

`EXTERNAL` is the most commonly misused class, because it is tempting to use it as
a bucket for "we could not establish this". That is wrong in both directions:

- A target outside the observable boundary is a **correct configuration**, not a
  failure. Rule `dependency/artifact-dependency` states that an external
  dependency must record that its target is out of boundary and must not be
  reported as `VERIFIED` — but it must also not be reported as unverifiable, as if
  the producer had failed at something.

- A target that is inside the boundary but was not reached is a **resolution
  failure**. Rule `dependency/transitive-dependency` requires truncation to be
  disclosed, and the honest result is a bounded result with a reason, not an
  `EXTERNAL` classification.

## Worked examples

A contract that calls another contract, observed in a successful transaction:

```yaml
source: { kind: CONTRACT, id: CA3D...GAXE }
target: { kind: CONTRACT, id: CBF7...YQ2K }
type: RUNTIME
basis: OBSERVED_INVOCATION
network: { type: TESTNET, passphrase: 'Test SDF Network ; September 2015' }
evidence: [ev-tx-9912, ev-event-call]
confidence: { level: HIGH_CONFIDENCE, evidence: [ev-tx-9912, ev-event-call] }
verificationStatus: VERIFIED
```

A crate declared in a manifest but never resolved — correctly classified as
`PACKAGE`, correctly not pinned:

```yaml
source: { kind: CONTRACT, id: CA3D...GAXE }
target: { kind: PACKAGE, id: soroban-sdk }
type: PACKAGE
basis: DECLARED_MANIFEST
evidence: [ev-manifest]
confidence: { level: MEDIUM_CONFIDENCE, evidence: [ev-manifest] }
verificationStatus: PARTIALLY_VERIFIED
```

The second record is precise about what it knows: the dependency is declared, the
resolution is not established, and therefore the confidence is not raised. A tool
that reported the declared version as pinned would be reporting something no
rebuild could confirm.
