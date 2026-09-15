# Amasario Governance

This document describes how the Amasario provenance specification changes, who
can change it, and how a contributor proposes a new taxonomy term, relationship
type, model, rule or profile.

Governance here is deliberately narrow: it covers the **normative model** in
`amasario-provenance-spec`. Implementation decisions belong to
`amasario-provenance-engine` and are governed by that repository.

---

## 1. Scope and separation of concerns

| Layer           | Repository                   | Owns                                                                                      |
| --------------- | ---------------------------- | ----------------------------------------------------------------------------------------- |
| Normative model | `amasario-provenance-spec`   | What contract identity, provenance, dependency, evidence, confidence and impact **mean**. |
| Execution       | `amasario-provenance-engine` | How those meanings are **discovered, verified and reported** against a network.           |

A change to the _meaning_ of a concept MUST land in this repository first. The
engine MUST NOT define a competing meaning: if the engine needs a concept that
does not exist, the correct action is a model proposal here, not a local
extension. This rule exists because two competing definitions of "dependency"
would make every downstream analysis non-reproducible.

---

## 2. Roles

| Role            | Responsibility                                                                                       |
| --------------- | ---------------------------------------------------------------------------------------------------- |
| **Contributor** | Opens issues and pull requests. Must be able to run `npm run ci` locally.                            |
| **Reviewer**    | Reviews model, rule and taxonomy changes for internal consistency and cross-reference integrity.     |
| **Maintainer**  | Merges changes, cuts releases, owns `CHANGELOG.md`, and is the final arbiter of normative questions. |

Maintainers are listed in the GitHub organisation. A pull request that changes
normative meaning requires approval from at least one maintainer **and** one
reviewer who did not author the change.

---

## 3. Change classes and required review

| Change                                               | Class         | Review required           | Version impact |
| ---------------------------------------------------- | ------------- | ------------------------- | -------------- |
| Documentation clarification                          | Editorial     | 1 reviewer                | PATCH          |
| New fixture, vector or example                       | Additive      | 1 reviewer                | MINOR          |
| New `open` taxonomy term                             | Additive      | 1 reviewer + 1 maintainer | MINOR          |
| New schema, model or rule                            | Additive      | 1 reviewer + 1 maintainer | MINOR          |
| New `closed` taxonomy term                           | **Normative** | 2 maintainers             | MAJOR          |
| Changed field semantics, removed field, removed term | **Normative** | 2 maintainers             | MAJOR          |
| Changed canonicalisation or digest input             | **Normative** | 2 maintainers             | MAJOR          |

The mapping from change class to version bump is normative and is enforced by
`scripts/release-check.ts`, which fails the release when `CHANGELOG.md` and
`package.json#version` disagree about the class of a change.

---

## 4. Proposing a change

Every normative proposal MUST use the `model-proposal` issue template and MUST
answer all of the following. A proposal that omits any of them is incomplete and
will not be reviewed.

1. **Question.** What question does the model fail to answer today? State it as a
   question, not as a feature.
2. **Evidence basis.** What real, observable evidence would support an assertion
   made with this model? A concept that no evidence can support is not
   admissible, because Amasario only emits claims that evidence can carry.
3. **Counter-case.** What content would become _valid_ that is currently
   _invalid_, or vice versa? If the answer is "nothing", the proposal is a
   documentation change, not a model change.
4. **Distinguishability.** How does a consumer distinguish this concept from the
   nearest existing concept? If it cannot, the existing concept should be
   extended instead.
5. **Compatibility.** Is the change additive, or does it invalidate previously
   valid content? See `VERSIONING.md`.
6. **Non-goals.** What is this deliberately _not_ claiming?

### Proposal outcome

| Outcome                  | Meaning                                                              |
| ------------------------ | -------------------------------------------------------------------- |
| Accepted                 | Implemented as a schema/model/rule change plus fixtures and vectors. |
| Accepted as profile      | Modelled as a profile extension rather than a core concept.          |
| Needs evidence           | Plausible but no evidence source exists yet; blocked, not rejected.  |
| Rejected as out of scope | Belongs to the engine, the network layer, or an unrelated domain.    |
| Rejected as unsound      | Would allow an unsupported claim. The reason is recorded.            |

Rejections MUST state which of the above applies and why, so the decision is
reviewable later.

---

## 5. Non-negotiable invariants

The following MUST NOT be changed by any proposal, at any version, because they
are the reason the specification exists:

1. **Confidence never replaces evidence.** A claim with `HIGH_CONFIDENCE` MUST
   still reference the evidence that supports it. There is no confidence level
   that permits an unsupported claim.
2. **No implied relationships.** A dependency MUST NOT be asserted because two
   entities share a name, mention each other, or coexist in an ecosystem.
   Every relationship MUST carry a basis and evidence references.
3. **Conflicting evidence is representable.** If a claimed source revision cannot
   be matched to a deployed WASM, the model MUST be able to represent
   `CONFLICTING`. It must never be possible to force such a case into `VERIFIED`.
4. **Observation boundaries are explicit.** Every observation MUST record the
   network and ledger boundary at which it was made. A claim without a boundary
   is not reproducible.
5. **Amasario is not a security authority.** No change may introduce a field
   whose values assert that an artifact is secure, safe, malicious or free of
   vulnerabilities. See `SECURITY.md`.

---

## 6. Taxonomy governance

Taxonomies are controlled vocabularies. The process differs by openness:

- **`closed` taxonomies** (`confidence-levels`, `verification-statuses`,
  `relationship-types`, `impact-types`, `change-types`) — the term set is
  exhaustive by design. Adding a term requires a MAJOR release and two
  maintainer approvals. These are closed because a consumer computes over their
  full range, so an unknown term would make the computation undefined.
- **`open` taxonomies** (`network-types`, `dependency-types`, `artifact-types`,
  `evidence-types`, `deployment-statuses`) — the ecosystem genuinely gains new
  members over time. Consumers MUST treat unknown terms as `UNKNOWN`, so adding a
  term is a MINOR change.

A term MUST NOT be reused with a different meaning. If a meaning changes,
deprecate the term and add a new one.

---

## 7. Rule governance

Rules are normative assertions of the form _"if content has property P, then it
MUST/MUST NOT/SHOULD ..."_.

- Every rule MUST cite at least one fixture that demonstrates it. A rule with no
  fixture is untested and CI rejects it.
- Every rule MUST declare its severity. Changing a rule's severity from
  `MUST` to `SHOULD` (or the reverse) is a normative change.
- Rules MUST NOT encode executable analysis logic. A rule states a constraint on
  documents; it does not describe how to discover data. Discovery belongs to the
  engine.

---

## 8. Profile governance

A **profile** specialises the core model for a concrete environment without
changing it. The `stellar-soroban` profile, for example, states which networks
exist and which identity fields are observable.

Profiles MUST NOT:

- contradict a core rule,
- redefine a core taxonomy term,
- introduce a claim that no core evidence type can support.

Amasario distinguishes **normative Stellar facts** (behaviour defined by
authoritative Stellar documentation, cited with a source) from **Amasario's own
model** (a decision made by this specification). Every Stellar-specific
statement MUST be marked as one or the other, and a normative Stellar fact MUST
cite its source.

---

## 9. Decision records

Normative decisions are recorded as entries in `CHANGELOG.md` under the release
that introduced them. Where a decision was contested, the pull request
discussion is the record and MUST be linked from the changelog entry.

Proposals rejected for soundness reasons MUST remain open (not deleted) with the
determination and its reasoning, so the same proposal is not silently
re-litigated without new evidence.
