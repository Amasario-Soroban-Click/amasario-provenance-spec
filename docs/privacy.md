# Privacy

Provenance and dependency analysis is, by nature, an exercise in making
relationships visible. That is the point of it, and it is also the reason it needs a
privacy position rather than an assumption that public data is harmless.

## What analysis can reveal

A complete Amasario record can expose:

- **Project relationships.** Which contracts depend on which, and therefore which
  teams' work is load-bearing for others.
- **Deployment timing and cadence.** A ledger boundary makes release schedules
  visible, including quiet periods that correlate with incident response.
- **Infrastructure.** Endpoints, RPC providers, and in some cases deployment
  accounts — the last being publicly visible on-chain anyway, but aggregated here in
  a form that is easier to consume.
- **Organisational structure.** Repeated deployment accounts, shared build services
  and common source repositories can reveal a group structure that an individual
  observation would not.
- **Neglected or abandoned dependencies.** A widely-depended-on contract with no
  recent activity is a fact worth knowing operationally, and also one that is
  commercially sensitive.

None of that is a reason not to analyse. All of it is a reason to be deliberate about
what is collected, what is published, and what is retained.

## Requirements this specification imposes

The specification constrains the model so that a conforming implementation does not
need to collect sensitive material at all:

1. **No private source access is required.** Source identity is established from a
   repository URL and an immutable revision. Nothing requires reading the source
   content, and nothing requires a repository to be public for its revision to be
   recorded.
2. **No secrets are ever required.** No field's purpose is to carry a credential,
   private key, API token or seed phrase. A fixture, vector or example containing one
   is invalid.
3. **No personal data is modelled.** There is no identity, contact or account field.
   A deployment account appears where it is a matter of public chain state and is
   necessary to establish a deployment, not as a subject record.
4. **Evidence is traceable, not recreating.** Evidence records reference where a fact
   can be confirmed — a transaction hash, a revision, a ledger. They store references
   and digests rather than copies of content, so a conforming record does not become a
   de facto archive of someone else's material.

## Handling of sensitive metadata

Where a producer considers a piece of evidence sensitive, the specification's
structure gives it two legitimate options, both of which are better than omission:

- **Record the claim and cite attestation evidence.** An `ATTESTATION` record
  carries an issuer, a method and `scopeLimitations`, and can support a claim without
  the verifier holding the underlying material. The confidence ceiling for a claim
  that cannot be re-derived is `HIGH_CONFIDENCE`, which is the honest level for it.
- **Record the claim as out of boundary.** An `EXTERNAL` dependency states explicitly
  that its target lies outside the observable boundary. This is a _correct
  configuration_, not a failure, and it avoids presenting an uninspected relationship
  as either verified or unverifiable.

Omission is not a legitimate option, because an omitted fact is indistinguishable
from an absent one, and a consumer cannot tell that material was withheld.

## Retention and publication

The specification does not define a storage service, so it cannot mandate a retention
policy — but it does require that retention-affecting facts be visible:

- Every document carries a `boundary` with a ledger range and observation time. A
  consumer can therefore tell how stale a record is and reason about retention.
- Snapshots carry `capturedAt` and a `volatileFields` list, so a consumer can tell
  which parts of a comparison are structural and which are incidental.
- Network `durability` is declared per type. A `LOCAL` or `FUTURENET` observation is
  explicitly marked as not durable, so it is not mistaken for a lasting record.

An engine that publishes analysis output is publishing the relationships it found.
That is inherent to the tool, and the specification's contribution is to make it
possible to publish the _minimum_ — references and digests rather than content,
claims with their evidence rather than raw archives.

## What this specification cannot decide for you

Whether a particular dependency relationship should be published is an operational
decision that depends on context the specification does not have. What the
specification can do, and does, is:

- make the decision explicit, by requiring every claim to name its evidence,
- make withholding visible, by providing out-of-boundary and attestation paths,
- avoid requiring anything that would make the decision for you.

## Related chapters

- [security.md](security.md) — the boundary between provenance and security claims
- [evidence-model.md](evidence-model.md) — what an evidence record stores
- [attestations.md](attestations.md) — the claim-without-material path
- [temporal-model.md](temporal-model.md) — boundaries and retention
