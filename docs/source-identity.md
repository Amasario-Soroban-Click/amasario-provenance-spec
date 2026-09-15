# Source Identity

Source identity answers: which immutable revision of which repository is this
artifact claimed to have come from? `schema/source.schema.json` requires two
fields — `repositoryUrl` and `revision` — and refuses to accept a repository
without a revision.

## The model

| Field               | Required | Meaning                                                                      |
| ------------------- | -------- | ---------------------------------------------------------------------------- |
| `repositoryUrl`     | yes      | The repository the artifact came from.                                       |
| `revision`          | yes      | The immutable revision. A commit digest, not a branch name.                  |
| `repositoryName`    | no       | A human-facing name, for display only. Never identity.                       |
| `ref`               | no       | The branch or tag the revision was reached through, with its kind.           |
| `artifactDigest`    | no       | Digest of a source archive at this revision, where one exists.               |
| `timestamp`         | no       | When the revision was authored or committed, when known.                     |
| `license`           | no       | The declared license, as reported by the repository.                         |
| `buildRelationship` | no       | How this source relates to the build: declared, inferred, unlinked, unknown. |
| `evidence`          | no       | Evidence references supporting the source claim.                             |

## Why revision is required

A branch name is mutable. `main` today and `main` tomorrow are different
revisions, so recording `main` as identity produces a claim that silently changes
meaning over time. The rule is therefore simple: a source identity without an
immutable revision does not validate, and a producer that only knows a branch name
must record the fact differently — as a weaker basis in `ref`, or as
`buildRelationship: BUILT_BY_INFERRED_BUILD` when the revision was inferred rather
than declared.

## Why `ref` is a separate structured field

A branch or tag is still useful information: it explains how a producer arrived at
a revision, and it is what a human recognises. Modelling it separately means it can
be recorded at its true weight instead of being smuggled into `revision` where it
would be mistaken for immutable identity.

## Why `buildRelationship` is an enumeration, not a boolean

The distinction between `BUILT_BY_DECLARED_BUILD` and `BUILT_BY_INFERRED_BUILD` is
the difference between "the build inputs name this revision" and "we concluded
this revision probably produced the artifact". Those support different confidence
levels and they must not collapse into a single "linked: true" flag.
`NOT_LINKED` is deliberately distinct from `UNKNOWN`: the first means evidence
exists and does not connect the source to the build, the second means the question
was not answered.

## Rules

Rule `provenance/source-to-build` makes the following normative:

- The `revision` on a source record must match the `sourceRevision` of the build
  record that references it, or the two must be reported as a conflict.
- A source record with `buildRelationship: BUILT_BY_DECLARED_BUILD` must cite build
  evidence that names the revision. A declaration read from an artifact is not
  evidence that the declaration was honoured.
- Where a revision cannot be matched unambiguously — for example because two
  revisions produce indistinguishable short hashes — the ambiguity must be
  recorded, not resolved by preference.
- A source claim must never be inferred from repository naming similarity. Two
  repositories sharing a name, an owner, or a description are not the same
  repository.

## Worked example

```yaml
repositoryUrl: https://github.com/example/token-contract
repositoryName: token-contract
revision: 6f9c2b1e4d8a7305c2f1b9e6a4d3c8f7b2a1905e
ref:
  kind: TAG
  name: v1.4.2
artifactDigest: { algorithm: sha256, value: 'a1...e0' }
timestamp: '2026-03-11T09:14:07Z'
license: Apache-2.0
buildRelationship: BUILT_BY_DECLARED_BUILD
evidence: [ev-src-revision, ev-src-archive]
```

The `ref` records that the revision was reached through tag `v1.4.2`, which is
useful context; the `revision` is what establishes identity; and the tag can be
moved without changing the revision digest, which is why the two are separate.
