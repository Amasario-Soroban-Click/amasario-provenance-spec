# Evidence Model

Evidence is the only thing that makes a claim assertable. `schema/evidence.schema.json`
requires `id`, `type`, `claim` and `observedAt`, and carries an optional
`supportsRelationships` list that binds a record to the specific claims it supports.

## The record

| Field                                                   | Required | Meaning                                                         |
| ------------------------------------------------------- | -------- | --------------------------------------------------------------- |
| `id`                                                    | yes      | Identifier, referenced by every claim that cites this evidence. |
| `type`                                                  | yes      | The evidence class.                                             |
| `claim`                                                 | yes      | The claim this record supports, stated explicitly.              |
| `observedAt`                                            | yes      | When the evidence was observed.                                 |
| `supportsRelationships`                                 | no       | The relationship ids this evidence supports.                    |
| `boundary`                                              | no       | Network and ledger range for the observation.                   |
| `digest`                                                | no       | A digest the evidence establishes.                              |
| `repository`, `revision`                                | no       | Source-side detail.                                             |
| `toolchain`, `configurationDigest`                      | no       | Build-side detail.                                              |
| `artifactType`                                          | no       | Artifact-side detail.                                           |
| `contractId`, `transactionHash`, `ledger`, `successful` | no       | Deployment- and transaction-side detail.                        |
| `attestationId`                                         | no       | The attestation this record references.                         |
| `observationNote`                                       | no       | A short human-readable note. Never machine-interpreted.         |

## The types

`taxonomies/evidence-types.yaml` defines nine classes, and each declares
`traceableTo`: the thing a reviewer would consult to independently confirm it.

| Type          | Traceable to                                                         |
| ------------- | -------------------------------------------------------------------- |
| `SOURCE`      | The repository at the recorded revision — not merely the repository. |
| `BUILD`       | The build record and its declared inputs.                            |
| `ARTIFACT`    | The content addressed by the digest.                                 |
| `WASM`        | The network observation at a recorded ledger boundary.               |
| `DEPLOYMENT`  | The deployment transaction and its ledger.                           |
| `TRANSACTION` | The transaction hash on a named network.                             |
| `EVENT`       | The emitting transaction and the event's position within it.         |
| `ATTESTATION` | The attestation record and its issuer.                               |
| `OBSERVATION` | The observation record and the boundary it was made at.              |

### Why `traceableTo` is part of the taxonomy

Evidence that cannot be traced is not evidence. Stating the traceability target on
the term makes that checkable rather than rhetorical: a `SOURCE` record with a
repository but no revision is not traceable to the target the taxonomy declares, and
rule `provenance/source-to-build` rejects it. Requiring traceability also blocks the
most convenient way to fake a strong claim — citing "the repository" when the
question was which revision.

### Why `claim` is required alongside `type`

A record that says only _what kind of thing was observed_ without saying _what it
supports_ cannot be checked for sufficiency. Requiring the claim makes it possible
to ask, mechanically, whether the evidence for a given claim is complete: the claim
text is the thing the evidence must be adequate for.

### Why attestation is a type and not a flag

An attestation is evidence about a claim an issuer makes. Modelling it as a boolean
on the attested entity would discard the issuer, the method, the issuance time, the
expiry and the scope limitations — all of which a consumer needs in order to decide
how much the attestation is worth. It is a record with its own schema; see
[attestations.md](attestations.md).

## Evidence is never a property of a thing

Evidence is a record _about a claim regarding a thing_. The distinction matters
because the alternative — attaching `verified: true` to an artifact — loses the
ability to represent two conflicting pieces of evidence about the same artifact. The
specification has a `CONFLICTING` verification status precisely so that this case is
representable; see [verification.md](verification.md).

## Binding evidence to claims

`supportsRelationships` lets an evidence record bind to the specific relationships
it supports. This is what allows a dependency edge to cite evidence and lets a
validator confirm the reference resolves to a record that actually claims to support
that relationship. `validate-fixtures.ts` enforces the resolution: every evidence
reference in a document must resolve, and every referenced attestation must be
present.

### Minimum evidence per claim

| Claim                      | Minimum evidence                                                                  |
| -------------------------- | --------------------------------------------------------------------------------- |
| A contract identity        | At least one record of the network observation establishing it.                   |
| A deployed executable hash | At least one record of the network observation reporting it.                      |
| A dependency               | At least one record, satisfying the class's `requiredEvidence`.                   |
| A `CONFIRMED` deployment   | Deployment and transaction evidence, with the transaction recorded as successful. |
| A transitive dependency    | Evidence for every hop, plus the path itself.                                     |
| An impact finding          | At least one record, with per-step evidence when multi-hop.                       |
| A provenance document      | At least one record, enforced by `minItems: 1` in the schema.                     |

An empty evidence array is rejected everywhere it appears, and the specification
states why in each schema's description: a claim with no evidence is not a weakly
supported claim, it is a malformed one.

## Evidence and confidence

Evidence and confidence are separate fields and must remain separate. A confidence
level describes the evidence; it does not replace it. `schema/confidence.schema.json`
therefore _requires_ an `evidence` array alongside `level`, and carries an optional
`contradictingEvidence` array for the case where the counter-evidence is what
determines the outcome. A confidence level with no evidence fails validation — which
is the point, because a bare level is exactly the shape of claim this whole layer
exists to prevent.

## Related chapters

- [confidence-model.md](confidence-model.md) — how evidence becomes a level
- [verification.md](verification.md) — how evidence becomes a status
- [attestations.md](attestations.md) — issuer evidence in detail
- [provenance-model.md](provenance-model.md) — the claims evidence supports
