# Build Provenance

Build provenance is the middle of the chain: it records how a source revision
became an artifact. `schema/build.schema.json` requires `sourceRevision` and
describes the rest as claims that may or may not have been established.

## The model

| Field             | Required | Meaning                                                                                  |
| ----------------- | -------- | ---------------------------------------------------------------------------------------- |
| `sourceRevision`  | yes      | The revision the build consumed.                                                         |
| `toolchain`       | no       | Compiler and toolchain identity, as recorded by the producer.                            |
| `configuration`   | no       | Build configuration, digest-addressed where it can be.                                   |
| `lockfile`        | no       | The resolved lockfile artifact, when one exists.                                         |
| `target`          | no       | `WASM`, `BUILD_ARTIFACT`, `SOURCE_ARCHIVE` or `OTHER`.                                   |
| `artifact`        | no       | The artifact produced.                                                                   |
| `artifactDigest`  | no       | Digest of that artifact.                                                                 |
| `reproducibility` | no       | `REPRODUCED`, `REPRODUCED_BY_THIRD_PARTY`, `NOT_REPRODUCED`, `NOT_ATTEMPTED`, `UNKNOWN`. |
| `attestations`    | no       | Attestations about this build.                                                           |
| `evidence`        | no       | Evidence references supporting the build claims.                                         |

### Why `sourceRevision` is required but `toolchain` is not

A build that does not name a source revision establishes nothing about origin, so
the field is required. A toolchain identity, on the other hand, is frequently
unobtainable: a third-party builder may publish an artifact without publishing a
compiler version. Requiring it would mean either refusing the artifact or inventing
a value, and refusing a verifiable-artifact-if-the-digest-matches record would be
the wrong trade. Its absence lowers the achievable verification status to
`PARTIALLY_VERIFIED`, which is exactly the honest outcome.

### The five reproducibility values

`REPRODUCED` and `REPRODUCED_BY_THIRD_PARTY` are separate because they are
different evidence. A producer reproducing its own build has a weaker claim than an
independent party reproducing it from published inputs, and a consumer deciding how
much to rely on the record needs to see that difference. Neither is the same as
`NOT_REPRODUCED` (attempted and failed, which is a conflict signal) or
`NOT_ATTEMPTED` (not tried) or `UNKNOWN` (not answerable at this specification
version). See [reproducibility.md](reproducibility.md).

### Why `lockfile` is an artifact reference

Declared dependencies and resolved dependencies are different facts. The build
record points at a lockfile artifact rather than embedding constraints, because the
resolved set is what a rebuild would consume, and the lockfile's digest is what
makes it possible to confirm that two builds used the same resolution.

## The build-to-WASM comparison

Rule `provenance/build-to-wasm` is the most consequential rule in the
specification. It states:

1. The deployed executable's `hash` is compared against the digest of the build
   artifact this build produced.
2. A match establishes the join. If every other claim in the chain is also
   supported, the outcome is `VERIFIED`.
3. A **mismatch is a contradiction**. It must be recorded as `CONFLICTING`, and it
   must never be recorded as `VERIFIED` or `PARTIALLY_VERIFIED`.
4. A build with no recorded `artifact` or `artifactDigest` cannot establish the
   join at all; the correct outcome is `UNVERIFIED`, not a low-confidence match.

Point 3 is why the specification has a `CONFLICTING` status at all. Without it, an
implementation facing a digest mismatch has only two options: claim verification it
cannot support, or drop the information. Both are worse than reporting the
contradiction.

## Rules

Rule `provenance/build-to-wasm` additionally makes the following normative:

- `target: WASM` requires the produced `artifact` to have type `WASM`, and
  `artifactDigest` to equal both the artifact's digest and the deployed hash.
- `reproducibility: REPRODUCED` requires consistent evidence; a record claiming
  reproduction whose recomputed digest differs is itself a conflict.
- A build record whose `lockfile` is absent must not be presented as a pinned build
  in a report's observed-facts section, because the resolution is not established.
- Toolchain identity, where present, must be recorded verbatim as observed and must
  not be normalised into a canonical form the specification does not define.

## Worked example

A fully established build:

```yaml
sourceRevision: 6f9c2b1e4d8a7305c2f1b9e6a4d3c8f7b2a1905e
toolchain:
  name: rustc
  version: '1.83.0'
  target: wasm32v1-none
configuration:
  profile: release
  digest: { algorithm: sha256, value: '1c...77' }
lockfile:
  id: art-lock
  type: LOCKFILE
  digest: { algorithm: sha256, value: '7c...22' }
target: WASM
artifact:
  id: art-wasm
  type: WASM
  digest: { algorithm: sha256, value: '9d...4a' }
artifactDigest: { algorithm: sha256, value: '9d...4a' }
reproducibility: REPRODUCED_BY_THIRD_PARTY
evidence: [ev-build-log, ev-rebuild]
```

The claim here is precise: this revision, with this toolchain and configuration,
resolved by this lockfile, produced a module with this digest, and a third party
reproduced it. Every element is checkable, and the record still does not claim the
module is well-written or safe — that is not what build provenance means.
