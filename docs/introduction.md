# Introduction

AMASARIO is Soroban contract dependency, provenance and impact infrastructure.

This repository is the **normative specification layer**. It defines what Amasario
means when it says that a contract depends on something, that a deployed artifact
came from a source revision, or that a change to one entity could affect another.
It does not perform analysis. The companion repository,
`amasario-provenance-engine`, performs the analysis and must conform to the models
defined here.

## The question this specification formalises

> What does it mean to know what a Soroban contract depends on, where its deployed
> artifact came from, what evidence supports that relationship, and what could be
> affected when an upstream dependency or artifact changes?

That question contains four separable problems, and the specification keeps them
separable because collapsing them is how provenance tooling ends up asserting
things it cannot support.

1. **Dependency.** What does this contract require in order to run, and on what
   basis does Amasario say so? The word "basis" does the work: two contracts
   interacting is not automatically a dependency, and two repositories sharing a
   name is not a dependency at all. See [dependency-model.md](dependency-model.md)
   and [dependency-classification.md](dependency-classification.md).
2. **Provenance.** Where did the bytes deployed at a contract address come from?
   A contract address identifies an address, not a source revision; a WASM digest
   identifies bytes, not a build. See [provenance-model.md](provenance-model.md),
   [wasm-identity.md](wasm-identity.md) and
   [build-provenance.md](build-provenance.md).
3. **Evidence.** What record supports each of the above claims, and can a reviewer
   reach that record independently? A claim at any confidence level must name its
   evidence. See [evidence-model.md](evidence-model.md) and
   [confidence-model.md](confidence-model.md).
4. **Impact.** If an entity changes, which other entities could be affected, along
   which path, and with what change semantics? Impact is derived from the declared
   propagation direction of a relationship, never from the sound of its name. See
   [impact-model.md](impact-model.md) and
   [impact-propagation.md](impact-propagation.md).

## What is in this repository

| Layer                   | Directory                | Role                                                                  |
| ----------------------- | ------------------------ | --------------------------------------------------------------------- |
| Controlled vocabularies | `taxonomies/`            | The closed and open term sets every other layer draws from.           |
| Wire format             | `schema/`                | JSON Schemas that accept or reject a document deterministically.      |
| Conceptual models       | `models/`                | The field-level meaning of each entity, checked against the schemas.  |
| Normative rules         | `rules/`                 | The obligations a producer must satisfy for a claim to be assertable. |
| Instances               | `fixtures/`, `examples/` | Valid and invalid documents, both machine-validated.                  |
| Deterministic tests     | `vectors/`               | Input/expected-output pairs with canonical digests.                   |
| Tooling                 | `scripts/`               | Real validators; CI fails when any of them fails.                     |

Every artefact in the table is checked. The generated reference pages in
`docs/generated/` are derived from the artefacts themselves rather than written by
hand, so the published inventory cannot describe a schema that does not exist.

## What this specification refuses to do

- It refuses to treat a contract address as a complete identity, because an
  address survives a re-deployment with different bytes.
- It refuses to represent "unchecked" as "false". `UNVERIFIED` and `CONFLICTING`
  are different states, and the specification requires the second when evidence
  contradicts a claim.
- It refuses to let a dependency be unasserted. An edge without a basis and
  evidence does not validate.
- It refuses to be a security judgement. `VERIFIED` describes evidence about a
  claim, never the safety, intent or vulnerability of a contract. See
  [security.md](security.md).

## Reading order

Start with [architecture.md](architecture.md) for the layering, then
[terminology.md](terminology.md) for the vocabulary. From there, the
[provenance](provenance-model.md) and [dependency](dependency-model.md) chapters
follow the two directions the specification works in: backwards from a deployed
contract to its origin, and forwards from an entity to what could be affected.
