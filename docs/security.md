# Security Posture

The normative security policy is [`SECURITY.md`](../SECURITY.md). This chapter
explains the boundary it draws and why the boundary is a modelling decision as much
as a policy one.

## Amasario is not a security scanner

Amasario models **dependency, provenance and impact** relationships. It does not
perform security analysis, and no Amasario output constitutes a security opinion.

This is not a disclaimer bolted onto the side of the project. It is a constraint on
the model: no term in any taxonomy here means "trustworthy", and none of the
verification statuses mean anything about intent, safety or vulnerability.

## Prohibited conclusions

The following must never be emitted or implied as a conclusion of an Amasario
analysis:

| Prohibited                          | Why                                                                                                                  |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `secure`                            | Absence of observed evidence is not absence of vulnerabilities.                                                      |
| `safe`                              | No inspection of contract logic occurs at all.                                                                       |
| `malicious`                         | The model observes declared and evidenced relationships, not intent.                                                 |
| `vulnerable` / `vulnerability-free` | No vulnerability analysis is part of the model.                                                                      |
| `audited` / `certified`             | Only an `ATTESTATION` evidence record can support such a claim, and only for the exact claim the attestation states. |

The last row is the constructive alternative. Where a third party genuinely performs
an assessment, it is representable — as `ATTESTATION` evidence with an identified
issuer, method and `scopeLimitations`, subject to the normal confidence and
verification rules. What is prohibited is an implementation deciding for itself that
a well-evidenced chain implies the code is fine.

## What `VERIFIED` actually means

> `VERIFIED` means: _the stated evidence is consistent with the stated claim._

It does not mean the contract, its source, its dependencies or its operator are
trustworthy. A contract with `VERIFIED` provenance may be a deliberate backdoor
deployed from a repository that honestly published exactly that code. The chain is
true; the inference people want to draw from it is not in the chain.

This is why [confidence-model.md](confidence-model.md) says confidence describes the
evidence and never the subject, and why [verification.md](verification.md) treats
`VERIFIED` as a statement about a comparison rather than a property.

## Reporting states, not opinions

Implementations report factual states — `OBSERVED`, `INFERRED`, `VERIFIED`,
`PARTIALLY_VERIFIED`, `UNVERIFIED`, `CONFLICTING`, `UNKNOWN`. Each describes the
relationship between evidence and a claim. None carries a judgement.

`schema/report.schema.json` supports this structurally: a report must separate
observed facts, inferred relationships, verification status, confidence, unknown
information and errors, and it carries a `disclaimers` array. The separation is the
point — a reader must be able to see which lines are observations and which are
inferences without having to trust the renderer.

## The attack surface of this repository

`amasario-provenance-spec` is a specification repository. It does not contact any
network, hold credentials, execute user-provided code, or deploy anything. Its attack
surface is limited to:

1. The validation tooling in `scripts/` and `tests/`, which parses untrusted YAML and
   JSON when a contributor validates a fixture, vector or example.
2. The JSON Schemas themselves, where a consumer uses them to validate untrusted
   input in a security-sensitive path.

Both are addressed by the same design choice: the tooling runs in CI with no secrets
and read-only permissions, and the schemas are strict, with `additionalProperties:
false`, constrained enumerations and bounded array sizes.

## Secrets

- No credential, private key, API token or seed phrase may be committed.
- CI receives no secrets; every workflow runs with `permissions: contents: read`.
- Vector and fixture digests are computed from public content only.
- `scripts/release-check.ts` scans the repository for token and key shapes — GitHub
  tokens, AWS access key ids, PEM private keys, Stellar secret seeds, Slack tokens —
  and fails the release if one is found.

A fixture, vector or example containing a credential is **invalid**, not merely
inadvisable. The specification states this as a rule rather than a convention
because a plausible-looking fixture is exactly how a credential ends up committed.

## Why no field carries a secret

The specification defines no field whose purpose is to carry credentials, private
keys or personal data, and requires no access to private source code. This is a
design constraint, not an omission. A provenance model that needed a private key
would be a provenance model that its subjects could not use for public
verification, and one that needed private source could not be checked by anyone
other than its owner — which would defeat the purpose of publishing the model at
all.

## Integrity of the specification itself

There is a second security consideration, internal to the project: a specification
that can be changed silently is not a specification anyone should depend on. The
guards are:

- Every change is validated by the tooling and by CI.
- Version agreement across `package.json`, `VERSIONING.md`, schema `$id` values and
  the changelog is checked before release.
- Canonical serialisation is frozen: changing it is a major version change, so
  published digests cannot be invalidated quietly.
- Rule and taxonomy term identifiers are stable and referenced from schemas, so
  removing one is a detected breaking change rather than an oversight.

See [verification.md](verification.md) for the status model and
[privacy.md](privacy.md) for the handling of sensitive metadata.
