# Governance

The normative governance model is [`GOVERNANCE.md`](../GOVERNANCE.md). This chapter
summarises it for readers who are working through the technical documentation and
need to know where a new term or rule comes from.

## Why a specification needs governance

A specification's value is that its terms mean the same thing for everyone who
depends on it. That property is fragile in a specific way: every individual change to
a vocabulary looks small, and the accumulated result of many small changes is a word
that no longer means what a consumer's code assumed. Governance exists to make each
change reviewable as a change to the _shared_ meaning.

## How a change is proposed

| Kind of change                 | Entry point            | Review                                                             |
| ------------------------------ | ---------------------- | ------------------------------------------------------------------ |
| New taxonomy term              | `model-proposal` issue | Vocabulary review, alongside the schemas that must accept the term |
| New schema or model            | `model-proposal` issue | Model review, including a rule and fixture                         |
| New rule                       | `model-proposal` issue | Normative review, since rules can start rejecting content          |
| Bug in an existing artefact    | `bug-report` issue     | Standard review                                                    |
| Improvement to tooling or docs | `improvement` issue    | Standard review                                                    |

The issue templates exist for the first three because those are the changes that
alter meaning. A change that alters meaning requires a stated rationale and the
fixtures and vectors that demonstrate it, so the change is reviewed as a change to
the model rather than as an edit.

## What a proposal must include

For a change to normative content — a schema, model, taxonomy, rule, fixture, vector
or example — the change must arrive with:

1. **A stated question it answers.** What could not be represented before, and what
   went wrong as a result.
2. **Evidence that the representation is checkable.** Which schema constrains it,
   which validator would catch a malformed instance, which fixture exercises it.
3. **A versioning assessment.** Whether it is breaking, additive or editorial, per
   [versioning.md](versioning.md). A change that is breaking must say so, because the
   release rules depend on the classification.
4. **Consistency across the layers.** A term added to a schema must exist in its
   taxonomy; a rule referenced from a schema must exist as a file; a model must not
   describe a field the schema does not define. The validators enforce all four
   directions, so a proposal that is inconsistent fails CI rather than review.

## The acceptance bar

The bar for adding something is that it is **checkable** and **necessary**:

- _Checkable._ Every artefact must be validated by the tooling. A schema that is not
  compiled by `validate-schema.ts`, a model not checked by `validate-models.ts`, a
  rule not resolved by `validate-rules.ts` — each is rejected not because it is
  wrong, but because nothing would catch it becoming wrong later.
- _Necessary._ Something must be unrepresentable, or representable only
  misleadingly, without it. "It might be useful" is not sufficient, because every
  added term is a term every consumer must handle.

## What is out of scope

The following are refused, and the refusal is architectural rather than editorial:

- **Execution logic.** Analysis belongs in `amasario-provenance-engine`. A
  specification that can execute is a specification whose checks are not portable.
- **Network calls from the specification.** There are none, and the tooling makes
  none.
- **Security judgements.** No term may mean "trustworthy". See
  [security.md](security.md).
- **Unverifiable claims.** Documentation describing a feature that does not exist as
  an artefact is rejected. `release-check.ts` verifies the structure so that a
  documented feature without a corresponding artefact fails the build.

## Changing meaning is harder than adding

The specification treats three changes as materially harder than the rest, and they
are the ones most likely to be proposed casually:

1. **Narrowing a closed taxonomy.** Removing a term, or narrowing one, changes what
   existing documents mean. It is a major change and requires a migration note.
2. **Changing canonical serialisation.** It invalidates published digests. The rules
   in `VERSIONING.md` make it a major change precisely so it cannot be done quietly.
3. **Making a rule stricter.** A rule that begins rejecting previously accepted
   content breaks pipelines that were conforming. It is a major change, and the
   proposal must show the affected fixtures.

## Related chapters

- [versioning.md](versioning.md) — how classification affects a release
- [compatibility.md](compatibility.md) — what consumers may assume
- [architecture.md](architecture.md) — why the layering is enforced mechanically
