# Artifact Model

An artifact is any content-addressable or revision-addressable object that
participates in provenance. `schema/artifact.schema.json` requires `id`, `type`
and `digest`, and models the derivation relationships that let a chain be
traversed in either direction.

## Types

`taxonomies/artifact-types.yaml` defines five types, each declaring
`digestRequired` and the permitted digest algorithms.

| Type                  | What it is                                            | Algorithms     |
| --------------------- | ----------------------------------------------------- | -------------- |
| `SOURCE_ARCHIVE`      | A packaged snapshot of source at a revision.          | sha256, sha512 |
| `LOCKFILE`            | A resolved dependency manifest, such as `Cargo.lock`. | sha256, sha512 |
| `BUILD_ARTIFACT`      | The output of a build step before deployment.         | sha256, sha512 |
| `WASM`                | A WebAssembly module, deployed or intermediate.       | sha256         |
| `DEPLOYMENT_ARTIFACT` | The content actually submitted in a deployment.       | sha256, sha512 |

`WASM` permits only `sha256` because that is the algorithm the Stellar network
reports for a contract's executable hash. Allowing a second algorithm for WASM
would make a network-reported hash and a locally computed hash incomparable
without a conversion step, which is a correctness hazard disguised as flexibility.

`DEPLOYMENT_ARTIFACT` exists because the uploaded content and the resulting
contract are two different objects. An upload that was never instantiated as a
contract produces a deployment artifact with no contract, and conflating the two
hides that case.

`LOCKFILE` is called out as a type because it is the artifact that converts
declared dependencies into pinned ones. It is the primary evidence for package
dependency resolution, and a declared dependency without a resolved lock entry is a
weaker fact that must not be presented as a pinned one.

## The shape

| Field          | Required | Meaning                                                                                                          |
| -------------- | -------- | ---------------------------------------------------------------------------------------------------------------- |
| `id`           | yes      | Stable identifier within the document. Not the digest; an artifact can be referenced before its digest is known. |
| `type`         | yes      | From `artifact-types`.                                                                                           |
| `digest`       | yes      | Content digest with an explicit algorithm.                                                                       |
| `sizeBytes`    | no       | Size, as a drift check.                                                                                          |
| `mediaType`    | no       | IANA media type where known.                                                                                     |
| `locator`      | no       | Where the content can be found. Never identity — locations move.                                                 |
| `parent`       | no       | The artifact this one was produced from, when there is exactly one primary input.                                |
| `inputs`       | no       | All inputs where the derivation has several.                                                                     |
| `derived`      | no       | Artifacts produced from this one.                                                                                |
| `reproducible` | no       | Tri-state: `REPRODUCED`, `NOT_REPRODUCED`, `NOT_ATTEMPTED`, `UNKNOWN`.                                           |
| `evidence`     | no       | Evidence references supporting the artifact's existence and identity.                                            |

### Why `id` is not the digest

An implementation can observe a source archive before it has finished hashing it,
and two documents can give the same artifact different local names. Separating the
local identifier from the content digest lets references be written and resolved
without pretending every reference carries the content's identity.

### Why `inputs` and `derived` both exist

The graph is traversable in both directions and the specification records both
directions explicitly for the same reason the corpus records edges rather than
only adjacency: a consumer loading a single artifact should not have to load the
whole document to know what it came from. The two must agree; `validate-fixtures.ts`
checks cross-reference integrity, and rule `identity/artifact-identity` makes the
agreement normative.

### On reproducibility

`NOT_REPRODUCED` and `NOT_ATTEMPTED` are different facts, and neither is the same
as an absent field. A digest-matched artifact whose rebuild was attempted and
failed is materially different from one whose rebuild was never tried. The
enumeration keeps all four apart; see [reproducibility.md](reproducibility.md).

## Rules

Rule `identity/artifact-identity` makes the following normative:

- `digest.algorithm` must be permitted for the artifact's type, and a WASM artifact
  must use `sha256`.
- Where both `parent`/`inputs` and `derived` are present, they must be consistent:
  every artifact listing this one as an input must appear in its `derived` list.
- An artifact reachable from another by a cycle of `inputs` is a malformed
  derivation and must be rejected, because a content-addressed derivation cannot be
  circular.
- A `locator` must never be used as an identity for comparison; two artifacts are
  the same artifact exactly when their digests and algorithms match.
- Cycle detection over derivations must be bounded, and a bounded traversal that
  hits its limit must report the limit rather than returning an empty result.

## Worked example

A paired derivation: a source archive and lockfile produce a WASM module.

```yaml
- id: art-src
  type: SOURCE_ARCHIVE
  digest: { algorithm: sha256, value: 'a1...e0' }
  sizeBytes: 184320
  derived: [art-wasm]
  evidence: [ev-src-archive]
- id: art-lock
  type: LOCKFILE
  digest: { algorithm: sha256, value: '7c...22' }
  mediaType: text/plain
  derived: [art-wasm]
  evidence: [ev-lock]
- id: art-wasm
  type: WASM
  digest: { algorithm: sha256, value: '9d...4a' }
  sizeBytes: 41984
  mediaType: application/wasm
  inputs: [art-src, art-lock]
  reproducible: REPRODUCED
  evidence: [ev-build-artifact, ev-rebuild]
```

Reading the third entry: the module was produced from those two inputs, and a
rebuild reproduced the same digest. The specification does not infer anything about
_how_ the build ran from this — that is the build record's job; see
[build-provenance.md](build-provenance.md).
