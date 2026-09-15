# Confidence Model

Confidence describes how strongly the available evidence supports a claim. It is an
**ordering, not a score**.

`taxonomies/confidence-levels.yaml` defines five levels with an explicit `ordinal`,
and states that `ordinal` is the only comparison the specification defines. The
purpose is determinism: two implementations combining evidence along a path must
reach the same result, and the only way to guarantee that is to make the combination
rule a property of the taxonomy rather than of the implementation.

## The levels

| Level               | Ordinal | Meaning                                                                                                                                                                       |
| ------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `VERIFIED`          | 5       | Complete, internally consistent, reproducible, independently checkable from the referenced records.                                                                           |
| `HIGH_CONFIDENCE`   | 4       | Authoritative and complete for the claim, but not independently reproducible from the Amasario record alone — for example a signature a verifier can check but not re-derive. |
| `MEDIUM_CONFIDENCE` | 3       | Directionally correct but incomplete — for example a revision matched by branch rather than by commit digest.                                                                 |
| `LOW_CONFIDENCE`    | 2       | Indirect or circumstantial — for example a consistent interface shape.                                                                                                        |
| `UNKNOWN`           | 0       | No supporting evidence, or evidence that cannot be interpreted at this specification version.                                                                                 |

## Confidence is never a substitute for evidence

`schema/confidence.schema.json` requires both `level` and `evidence`. A confidence
without evidence does not validate. This is deliberate and it is the most important
property of the model:

> A claim at any confidence level must identify the evidence supporting it. The
> level describes that evidence; it does not replace it.

So `VERIFIED` is a statement about **evidence completeness and consistency**. It is
not a statement about trustworthiness, intent, safety or vulnerability. A contract
whose provenance is `VERIFIED` has a well-evidenced chain from source to deployment;
it says nothing whatsoever about what that code does. See [security.md](security.md).

## Aggregation

The taxonomy declares:

```yaml
aggregation:
  strategy: minimum_ordinal
  identityElement: VERIFIED
  absorbers: [UNKNOWN]
```

Three consequences, all intentional:

1. **A chain is as strong as its weakest link.** Combining confidences along a path
   or across a conjunction of claims yields the lowest ordinal among the inputs.
2. **`VERIFIED` is the identity element.** Including a fully verified fact alongside
   weaker ones does not raise the result. This is what stops an implementation from
   manufacturing confidence by adding unrelated strong evidence to a weak claim.
3. **`UNKNOWN` is absorbing.** If any input is `UNKNOWN`, the result is `UNKNOWN`.
   An unknown link cannot be outvoted by certain ones.

The rules name the strategy explicitly rather than describing it:
`dependency/transitive-dependency` requires a transitive dependency's aggregated
confidence to equal the minimum ordinal among its hops, and
`impact/transitive-impact` requires the same for an impact finding's steps.

## Confidence versus verification status

These are independent, and the specification keeps them so.

|                     | Answers                                     | Values                                                                   |
| ------------------- | ------------------------------------------- | ------------------------------------------------------------------------ |
| Confidence          | How much evidence, and how good?            | `VERIFIED` … `UNKNOWN`                                                   |
| Verification status | What does the evidence say about the claim? | `VERIFIED`, `PARTIALLY_VERIFIED`, `UNVERIFIED`, `CONFLICTING`, `UNKNOWN` |

They can legitimately diverge. A claim can have extensive evidence that
**contradicts** it: that is high evidence strength with a `CONFLICTING` status, and
the correct output. A claim can be `UNVERIFIED` with no evidence at all, which is
`UNKNOWN` confidence. Collapsing the two into one field would make the contradiction
case unrepresentable, and an unrepresentable contradiction becomes a wrong
`VERIFIED`.

The precedence rule belongs to verification, not confidence: `CONFLICTING` takes
precedence over every other status. In confidence terms, contradictory evidence must
lower the level and additionally force the conflicting status.

## Where the level comes from

The specification does not prescribe a scoring function, because a score is exactly
what it is avoiding. It does constrain what each level _means_, and the rules cap
specific bases:

| Situation                                                     | Ceiling                                              |
| ------------------------------------------------------------- | ---------------------------------------------------- |
| Basis is `INFERRED_INTERFACE`                                 | `LOW_CONFIDENCE`, and never presented as established |
| Claim depends on an attestation the verifier cannot re-derive | `HIGH_CONFIDENCE`                                    |
| Revision matched by branch or tag only                        | `MEDIUM_CONFIDENCE`                                  |
| Any hop `UNKNOWN`                                             | `UNKNOWN`                                            |
| Any contradicting evidence                                    | Level must be lowered, and status `CONFLICTING`      |

Everything else is left to the producer, with the requirement that the level be
justified by the cited evidence.

## Worked example

```yaml
confidence:
  level: MEDIUM_CONFIDENCE
  evidence: [ev-manifest, ev-lock-entry]
  contradictingEvidence: []
  rationale: >-
    The dependency is declared in the manifest and has a resolved lock entry, but
    the lock entry names a version range rather than an exact revision, so the
    resolved artifact cannot be pinned.
```

Reading this: the level is `MEDIUM_CONFIDENCE`, the evidence is named, and the
rationale explains why the evidence does not support a higher level. A consumer can
disagree with the judgement by inspecting the two records, which is the whole point.

## Related chapters

- [evidence-model.md](evidence-model.md) — the records a level describes
- [verification.md](verification.md) — the independent status axis
- [reproducibility.md](reproducibility.md) — what can and cannot be re-derived
