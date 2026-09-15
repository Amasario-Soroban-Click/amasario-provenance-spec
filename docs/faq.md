# Frequently Asked Questions

Answers are short and point at the chapter that gives the full reasoning.

## What is Amasario, in one sentence?

A specification for recording what a Soroban contract depends on, where its deployed
bytes came from, what evidence supports those claims, and what could be affected when
something upstream changes — with the evidence always carried alongside the claim.

## Why not just use a contract address?

Because an address is not an identity. It is unique only within a network, it can
host different executables over time as the contract is upgraded, and it says
nothing about origin. See [contract-identity.md](contract-identity.md).

## Why is a repository URL not enough to identify source?

Because repositories move and revisions can be rewritten. A branch or tag name can
be re-pointed, so only an immutable revision identifies source. See
[source-identity.md](source-identity.md).

## Why do I need a build record if the digests match?

Because a digest match establishes that two sets of bytes are the same, not how they
were produced. The build record is what names the revision and toolchain, and without
it a chain can be verified as "these bytes" but not as "these bytes from this
source". See [build-provenance.md](build-provenance.md).

## Why is there both a confidence level and a verification status?

Because they answer different questions, and collapsing them makes contradictions
unrepresentable. Confidence asks how much evidence there is; verification asks what
that evidence says about the claim. A claim can have extensive evidence that
contradicts it — high evidence strength, `CONFLICTING` status — and that is exactly
the case the model exists to represent. See [confidence-model.md](confidence-model.md)
and [verification.md](verification.md).

## What does `CONFLICTING` mean, and why does it take precedence?

Evidence exists and contradicts the claim, or two pieces of valid evidence contradict
each other. It takes precedence over every other status because the alternatives are
worse: an implementation must otherwise choose between claiming `VERIFIED` it cannot
support and discarding the finding. An incorrect `VERIFIED` is the most damaging
output this system can produce. See [verification.md](verification.md).

## Does `VERIFIED` mean the contract is safe?

No. `VERIFIED` means the stated evidence is consistent with the stated claim. It
says nothing about intent, safety or vulnerabilities — a contract with fully verified
provenance can be a deliberate backdoor deployed from a repository that honestly
published that code. See [security.md](security.md).

## Does `UNVERIFIED` mean the contract is malicious?

No. It means the claim has not been checked. It is not a statement about the claim's
truth, and a report listing `UNVERIFIED` claims is not a list of discredited
contracts. See [verification.md](verification.md).

## If two contracts appear in the same repository, do they depend on each other?

Not necessarily, and Amasario will not say they do. Co-location, shared naming,
shared ecosystem membership and mutual mentions are explicitly insufficient bases.
A dependency must state its basis and cite evidence, or it does not validate. See
[dependency-model.md](dependency-model.md) and
[dependency-classification.md](dependency-classification.md).

## What about two contracts that expose a similar interface?

Similar interfaces are real evidence, so they are representable — as
`INFERRED_INTERFACE`, capped at `LOW_CONFIDENCE`, and explicitly not to be presented
as an established relationship. Making it a labelled basis is the alternative to
either ignoring the signal or dressing it up as something stronger. See
[dependency-model.md](dependency-model.md).

## Why does a transitive dependency need its path?

Without the path, a reader cannot tell how many intermediaries were involved, whether
any hop is uncertain, or whether the chain is real rather than two unrelated facts
collapsed together. A transitive dependency without its path is indistinguishable
from a guess. See [transitive-dependencies.md](transitive-dependencies.md).

## Why must a bounded traversal say it was bounded?

Because "not found" and "the search stopped" are different results, and a consumer
cannot tell them apart after the fact. Rate limiting is the most common real cause of
an incomplete traversal, and it is the easiest to mistake for a complete result. See
[dependency-resolution.md](dependency-resolution.md).

## Why is a cycle reported rather than removed?

Because a cycle can be a real fact — mutual invocation between two contracts, a
package graph with a dev-dependency loop. Collapsing it makes the graph easier to
read and destroys the ability to reason about it. The exception is artifact
derivation, where a content-addressed artifact cannot be its own input. See
[transitive-dependencies.md](transitive-dependencies.md).

## How does impact analysis work if I change something?

Impact is derived from the declared `changePropagation` of each relationship
traversed, never inferred from the name of the relationship. Following
`object_to_subject` edges backwards from a change gives dependents; following them
forwards gives the changed entity's own dependencies. `OBSERVED_IN` and
`VERIFIED_BY` do not propagate at all, and the specification says so explicitly. See
[impact-propagation.md](impact-propagation.md).

## Is an impact finding a prediction?

No. It states that an entity _may_ be affected, along a named path, with named
evidence. Nothing in the model asserts that it will be. See
[impact-model.md](impact-model.md).

## Where is the code that does the analysis?

In `amasario-provenance-engine`. This repository defines what the data means; the
engine produces it. The boundary is deliberate: it keeps the specification small
enough to depend on and checkable without trusting an implementation. See
[architecture.md](architecture.md).

## Can I validate a document without understanding Amasario's modelling?

Yes. The JSON Schemas are the only layer needed to accept or reject a document, and
they are strict — explicit types, required properties, constrained enumerations and
`additionalProperties: false`. See [versioning.md](versioning.md).

## What happens if a document contains a field I do not know?

Validation fails, unless the field sits in a named extension point. A silently
ignored field is indistinguishable from a correctly handled one, and an analysis that
quietly drops evidence is worse than one that refuses to run. See
[versioning.md](versioning.md) and [compatibility.md](compatibility.md).

## Can I compare snapshots taken on different networks?

The model will refuse, with `NETWORK_MISMATCH` as the stated reason. Comparing
incomparable inputs always produces output, and the output always looks like a change,
so incomparability is a first-class result. See
[compatibility.md](compatibility.md).

## Why does a fact need a ledger boundary?

Because a fact without a boundary is not reproducible. Two implementations can only
be compared if they state the range they looked at, which is why `boundary` is
required on a provenance document even when every other field is optional. See
[temporal-model.md](temporal-model.md).

## Why is `firstObservedLedger` not the creation ledger?

Because it is an observation. The true creation ledger can be earlier than the
earliest ledger an implementation queried. Where the creation ledger matters, it comes
from the deployment record, which is a different fact. See
[temporal-model.md](temporal-model.md).

## Does a successful reproduction prove the source is safe?

No. A reproduction establishes which revision produced the bytes — not that anyone
reviewed it, not that it was deployed, and not that it is safe. A reproduced artifact
can be a backdoor. See [reproducibility.md](reproducibility.md).

## What is an attestation for?

For claims that cannot be re-derived by the verifier — a signature, a third-party
service record. It is a record with an issuer, method, issuance time, expiry and
`scopeLimitations`, because a consumer needs all of those to weigh it. It is never a
property of the artifact it concerns. See [attestations.md](attestations.md).

## Why do some taxonomies allow unknown terms and others do not?

A vocabulary whose unknown value could change the meaning of an analysis result is
closed, because guessing is dangerous. A vocabulary that extends the reach of an
observation is open, because recognising an unknown term degrades gracefully. See
[versioning.md](versioning.md).

## How do I propose a new term or rule?

Open a `model-proposal` issue. Normative changes must arrive with a rationale, a
fixture or vector that exercises them, and a versioning assessment. See
[governance.md](governance.md).

## What is explicitly out of scope?

Execution logic, network calls from the specification, security judgements, and
documentation describing features that do not exist as artefacts. See
[governance.md](governance.md) and [architecture.md](architecture.md).
