# Security Policy

## Reporting a vulnerability

Report suspected vulnerabilities privately through GitHub's
[private vulnerability reporting](https://github.com/Amasario-Soroban-Click/amasario-provenance-spec/security/advisories/new)
on this repository. Do not open a public issue for a security report.

Please include:

- the affected file(s) and specification version,
- a minimal reproduction (a fixture, vector or document that demonstrates it),
- the impact you believe it has,
- whether you are willing to be credited.

We aim to acknowledge within 5 working days and to publish a fix or a written
determination within 30 days. Where a report changes the meaning of the
specification, the fix is released following `VERSIONING.md`, and may therefore
require a MAJOR version bump.

## What this repository is

`amasario-provenance-spec` is a **specification** repository. It contains JSON
Schemas, YAML models, taxonomies, rules, fixtures, vectors, examples, and
TypeScript validation tooling that runs at build time.

It does **not** contact any network, does not hold credentials, does not execute
user-provided code, and does not deploy anything. The attack surface is
therefore narrow and is limited to:

1. The validation tooling in `scripts/` and `tests/`, which parses untrusted
   YAML and JSON input when a contributor validates a fixture or vector.
2. The JSON Schemas themselves, if a consumer uses them to validate untrusted
   input in a security-sensitive path.

## Amasario is not a security scanner or audit

**This is the single most important statement in this document.**

Amasario models dependency, provenance and impact relationships. Amasario does
not perform security analysis, and no Amasario output constitutes a security
opinion.

Consequently, this specification and any implementation of it MUST NOT emit or
imply the following terms as a conclusion:

| Prohibited conclusion               | Why it is prohibited                                                                                                 |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `secure`                            | Absence of observed evidence is not evidence of absence of vulnerabilities.                                          |
| `safe`                              | Same as above; no inspection of contract logic occurs.                                                               |
| `malicious`                         | Amasario observes declared and evidenced relationships, not intent.                                                  |
| `vulnerable` / `vulnerability-free` | No vulnerability analysis is part of the model.                                                                      |
| `audited` / `certified`             | Only an `ATTESTATION` evidence record may support such a claim, and only for the exact claim the attestation states. |

A relationship that Amasario reports as `VERIFIED` means _"the stated evidence is
consistent with the stated claim"_. It does **not** mean the contract, its
source, its dependencies or its operator are trustworthy.

Where a third party genuinely performs such an assessment, it MUST be
represented as `ATTESTATION` evidence with an identified issuer, and the
specification's confidence and verification states still apply. An attestation is
evidence about a claim; it is never a property of the artifact itself.

## Reporting states instead of opinions

Implementations MUST report factual states:

`OBSERVED`, `INFERRED`, `VERIFIED`, `PARTIALLY_VERIFIED`, `UNVERIFIED`,
`CONFLICTING`, `UNKNOWN`.

These states describe the relationship between evidence and a claim. They carry
no judgement about safety.

## Privacy

Provenance and dependency analysis can reveal project relationships, deployment
timing and infrastructure. See `docs/privacy.md` for handling requirements.

In summary: this specification MUST NOT require access to private source code,
MUST NOT require secrets, and MUST NOT define any field whose purpose is to carry
credentials, private keys or personal data. A fixture, vector or example that
contains a credential is invalid.

## Secrets in this repository

- No credential, private key, API token or seed phrase may be committed.
- CI MUST NOT receive secrets. Every workflow in `.github/workflows/` runs with
  `permissions: contents: read`.
- Vector and fixture digests are computed from public content only.
