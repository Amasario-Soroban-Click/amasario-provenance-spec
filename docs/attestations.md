# Attestations

An attestation is evidence about a claim an issuer makes. `schema/attestation.schema.json`
requires `id`, `issuer`, `subject`, `claim`, `issuedAt` and `verificationStatus`.

Attestations exist because some claims cannot be re-derived by the verifier. A
signature can be checked; a service record cannot be recomputed. Modelling these as
a first-class record rather than as a boolean flag keeps the parts a consumer needs
in order to weigh them: who asserted it, how, when, until when, and within what
scope.

## The record

| Field                | Required | Meaning                                                                       |
| -------------------- | -------- | ----------------------------------------------------------------------------- |
| `id`                 | yes      | Identifier, referenced by `ATTESTATION` evidence.                             |
| `issuer`             | yes      | Who issued it.                                                                |
| `subject`            | yes      | What the attestation is about.                                                |
| `claim`              | yes      | What is asserted.                                                             |
| `issuedAt`           | yes      | When it was issued.                                                           |
| `verificationStatus` | yes      | The outcome of checking the attestation itself.                               |
| `claimDigest`        | no       | A digest of the claim, so it cannot be altered after issuance.                |
| `method`             | no       | `SIGNATURE`, `INDEPENDENT_REBUILD`, `SERVICE_RECORD` or `MANUAL_OBSERVATION`. |
| `signature`          | no       | Signature material, where the method is `SIGNATURE`.                          |
| `expiresAt`          | no       | When the attestation stops being valid.                                       |
| `verificationNote`   | no       | Detail about how the status was reached.                                      |
| `scopeLimitations`   | no       | What the attestation does _not_ cover.                                        |

## Why `method` matters

The four methods are not equivalent evidence:

- **`SIGNATURE`** — the issuer signed the claim. The verifier can check the
  signature but cannot re-derive the underlying fact. Capped at `HIGH_CONFIDENCE`
  unless the fact is independently reproducible.
- **`INDEPENDENT_REBUILD`** — a third party reproduced the artifact from published
  inputs and got the same digest. This is the strongest method, because it is
  checkable by repeating it.
- **`SERVICE_RECORD`** — a service attests to something it observed. Its worth
  depends entirely on the service's coverage and retention, which is why
  `scopeLimitations` exists.
- **`MANUAL_OBSERVATION`** — a human recorded the observation. Not machine-checkable,
  and must be recorded as such rather than promoted.

Recording the method is what allows the confidence ceiling in
[confidence-model.md](confidence-model.md) to be applied rather than guessed.

## Why `scopeLimitations` exists

An attestation almost always covers less than it appears to. A build service can
attest that it ran a build from a given revision, but not that the revision is the
one you wanted, not that the built code is correct, and not that the artifact was
deployed. Recording the limitations on the record is what prevents a downstream
consumer from reading the attestation as a broader claim than it makes.

An attestation whose limitations are not recorded is an attestation a consumer will
over-read, and over-reading an attestation is how a chain of weak claims becomes a
confident-looking conclusion.

## Attestations versus verification

`schema/attestation.schema.json` carries its own `verificationStatus`, which is the
outcome of checking _the attestation_ — is the signature valid, is the issuer who it
claims, has it expired. That is separate from whatever claim the attestation is used
to support.

So a valid attestation can support a claim that is itself `CONFLICTING`, if other
evidence contradicts it. The two statuses are on different objects and the
specification keeps them there.

`CONFLICTING` on an attestation usually means the attestation contradicts itself or
another attestation about the same subject, and rule `provenance/source-to-build`
requires that case to be surfaced rather than resolved by preferring one issuer.

## Attestations in a document

`schema/provenance.schema.json` carries an `attestations` array, and the schema
explains why: a provenance document that cites `ATTESTATION` evidence must be
self-contained enough for a consumer to evaluate the claim the attestation actually
makes, rather than only knowing that an attestation was cited.

`validate-fixtures.ts` enforces the consequence: every `ATTESTATION` evidence record
that names an `attestationId` must have that attestation present in the document.
A dangling reference is a validation failure, not a warning.

## Safety boundary

An attestation is a claim by an issuer. It is not a guarantee, and the
specification does not treat it as one. In particular, an attestation must never be
rendered or interpreted as a statement that a contract is secure, safe or free of
vulnerabilities. See [security.md](security.md).

## Worked example

```yaml
- id: att-rebuild-4412
  issuer:
    id: build-service-example
    name: Example Build Service
  subject: { kind: WASM, id: '9d...4a' }
  claim: >-
    The module with digest 9d...4a was built from revision
    6f9c2b1e4d8a7305c2f1b9e6a4d3c8f7b2a1905e using the published build
    configuration, and the build was executed in an isolated environment.
  claimDigest: { algorithm: sha256, value: '33...ab' }
  method: INDEPENDENT_REBUILD
  issuedAt: '2026-05-02T11:03:44Z'
  expiresAt: '2027-05-02T00:00:00Z'
  verificationStatus: VERIFIED
  verificationNote: Rebuild repeated twice with identical output.
  scopeLimitations:
    - Does not assert that the revision is the revision intended by the contract owner.
    - Does not assert that the module was deployed, or that it remains deployed.
    - Does not assess the behaviour or safety of the module.
```

The limitations are the most important part of the record. Without them, a consumer
could reasonably read "built from revision X" as "this contract runs code from
revision X and it is fine" — two claims the attestation does not make.
