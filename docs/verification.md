# Verification

Verification answers a different question from confidence. Confidence asks _how
much evidence is there and how good is it_. Verification asks _what does that
evidence say about the claim_.

Keeping them separate is what makes contradictions representable, and a
contradiction that cannot be represented becomes a wrong `VERIFIED`.

## The statuses

`taxonomies/verification-statuses.yaml` defines five:

| Status               | Meaning                                                                                                                        |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `VERIFIED`           | Supported, and the decisive evidence was checked against the claim successfully.                                               |
| `PARTIALLY_VERIFIED` | Some components checked successfully; none contradicted.                                                                       |
| `UNVERIFIED`         | Not checked, or the evidence needed to check it is unavailable. Makes no statement about truth.                                |
| `CONFLICTING`        | Evidence contradicts the claim, or two pieces of valid evidence contradict each other.                                         |
| `UNKNOWN`            | The claim could not be evaluated at all — a required field was absent, or an unrecognised term appeared in an open vocabulary. |

### `CONFLICTING` takes precedence

The taxonomy declares `precedence: 1` on `CONFLICTING` and states that it takes
precedence over every other status. A claim with any contradicted component must be
reported as `CONFLICTING`, never as `VERIFIED` or `PARTIALLY_VERIFIED`.

This is the rule that gives the whole specification its value. Consider the case
where a source revision is claimed for a deployed WASM, and rebuilding that revision
produces a different digest:

- Without a conflict status, an implementation must choose between `VERIFIED`
  (wrong) and `UNVERIFIED` (lossy, and it discards the finding).
- With it, the correct output is `CONFLICTING`, which tells the reader that a
  specific claim was checked and refuted.

An incorrect `VERIFIED` is the most damaging output this system can produce,
because it is the one that stops a reader from looking further.

### `UNVERIFIED` is not `false`

`UNVERIFIED` means the claim has not been checked. It is not a statement that the
claim is false, and the taxonomy says so explicitly. The same applies to
`UNKNOWN`: "not established" is distinct from "established as false".

This distinction propagates into every consumer. A report section listing
`UNVERIFIED` claims must not be read as a list of discredited claims, and a tool
that renders `UNVERIFIED` in the same style as `CONFLICTING` is misrepresenting its
own output.

## Deciding the status

The specification does not prescribe a comparison algorithm, but it does fix the
decisive checks per join:

| Join                  | Decisive check                                                                                     | Required on mismatch                |
| --------------------- | -------------------------------------------------------------------------------------------------- | ----------------------------------- |
| Source → build        | The build's `sourceRevision` equals the source record's `revision`.                                | `CONFLICTING`                       |
| Build → WASM          | The build artifact's digest equals the deployed `hash`.                                            | `CONFLICTING`                       |
| WASM → contract       | The contract's `wasmHash` equals the deployed hash at the same `identityVersion`.                  | `CONFLICTING`                       |
| Contract → deployment | The deployment's `wasmHash` and `contractId` agree with the identity.                              | `CONFLICTING`                       |
| Dependency            | The cited evidence satisfies the class's `requiredEvidence` and supports the claimed relationship. | Downgrade the class, or do not emit |
| Attestation           | The attestation's subject matches the claimed subject and it has not expired.                      | `CONFLICTING` or `UNKNOWN`          |

A join whose decisive check cannot be performed at all yields `UNVERIFIED`, not
`CONFLICTING` and not `VERIFIED`. The difference between "we looked and it
disagrees" and "we could not look" is the reason two statuses exist.

## Worked example: the mismatched case

The `provenance/mismatched-wasm` fixture records a claimed source revision whose
rebuild produces a different digest from the deployed module. The document records:

```yaml
verificationStatus: CONFLICTING
confidence:
  level: MEDIUM_CONFIDENCE
  evidence: [ev-claimed-revision, ev-rebuild]
  contradictingEvidence: [ev-digest-mismatch]
  rationale: >-
    The claimed source revision was checked by rebuilding it with the recorded
    toolchain. The rebuild produced a different digest from the deployed module, so
    the claimed revision cannot be the revision deployed. The chain from source to
    executable is refuted rather than merely unsupported.
```

Note what the record does _not_ do. It does not claim the contract is malicious. It
does not claim the source is wrong in general. It states one specific, checkable
refutation of one specific claim. That precision is the difference between a
provenance finding and an accusation.

## Attestation-based verification

Where a claim cannot be re-derived by the verifier — a signature, a third-party
service record — the status can still be `VERIFIED` or `HIGH_CONFIDENCE`, provided
the attestation is attached and its `scopeLimitations` are recorded. What must not
happen is a claim being marked `VERIFIED` on the strength of an attestation whose
scope does not cover it. See [attestations.md](attestations.md) and
[reproducibility.md](reproducibility.md).

## Related chapters

- [confidence-model.md](confidence-model.md) — the independent evidence-strength axis
- [provenance-model.md](provenance-model.md) — the joins being verified
- [attestations.md](attestations.md) — issuer evidence
- [security.md](security.md) — what verification does not mean
